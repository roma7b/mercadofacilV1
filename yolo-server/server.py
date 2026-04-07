"""
Mercado Fácil - Servidor de Contagem de Veículos com YOLO
Conecta ao stream HLS da câmera, detecta veículos e transmite via WebSocket.
"""

import asyncio
import json
import time
import uuid
import torch
import os
import threading
import cv2
import numpy as np
import subprocess
import queue
from collections import defaultdict
from typing import Dict, Set, Optional

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from ultralytics import YOLO
from supabase import create_client, Client
from dotenv import load_dotenv

# Carrega .env se existir (útil para VPS e dev local)
load_dotenv()

# ─── Configuração ─────────────────────────────────────────────────────────────
# Suporta nomes padrão ou os nomes usados pela Vercel/Supabase Dashboard
SUPABASE_URL = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

# Mapa de câmeras ativas: id -> url do stream
STREAMS: Dict[str, str] = {
    "live-cam-sp008-km095": os.environ.get(
        "CAMERA_URL_RODOVIA",
        "https://34.104.32.249.nip.io/SP008-KM095/stream.m3u8"
    ),
}

# Modelo YOLO — ONNX é ~30% mais rápido em CPU
MODEL_PATH = os.environ.get("YOLO_MODEL", "yolov8n.onnx")

# Classes de veículos no COCO que nos interessam
VEHICLE_CLASSES = {2: "carro", 3: "moto", 5: "ônibus", 7: "caminhão"}

# Cores por classe (R, G, B)
CLASS_COLORS = {
    "carro": [0, 255, 80],
    "moto": [255, 200, 0],
    "ônibus": [0, 180, 255],
    "caminhão": [255, 60, 60],
}

FRAME_SKIP = 1          # FFmpeg já entrega em baixo framerate (12FPS), avaliamos 100% deles.
SAVE_INTERVAL_SEC = 300  # Salva no Supabase a cada 5 minutos

# ─── Estado Global por Câmera ─────────────────────────────────────────────────
class CameraState:
    def __init__(self, stream_id: str, stream_url: str):
        self.stream_id = stream_id
        self.stream_url = stream_url
        self.total_count = 0
        self.frame_count = 0
        self.last_frame: Optional[np.ndarray] = None
        self.last_frame_ai: Optional[np.ndarray] = None
        self.last_frame_bytes: Optional[bytes] = None  # NOVO: frame já encodado em JPEG
        self.lock = threading.Lock()
        self.frame_event = asyncio.Event()             # NOVO: sinaliza frame pronto para o FastAPI
        self.clients: Set[WebSocket] = set()
        self.running = False

        # Linha de contagem (normalizada 0-1)
        self.line = {"x1": 0.0, "y1": 0.45, "x2": 1.0, "y2": 0.45}

        # Rastreamento de IDs para evitar dupla contagem
        self.tracked_ids: Dict[int, dict] = {}
        self.crossed_ids: Set[int] = set()
        
        # Histórico recente de cruzamentos para destacar na UI (visível por 1.5s)
        self.recent_crossings: Dict[int, float] = {}

        # Última vez que salvou no Supabase
        self.last_save_ts = time.time()

cameras: Dict[str, CameraState] = {}
model: Optional[YOLO] = None
supabase: Optional[Client] = None

# ─── FastAPI ───────────────────────────────────────────────────────────────────
app = FastAPI(title="Mercado Fácil - YOLO Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Geometria: cruzamento da linha ────────────────────────────────────────────
def point_side_of_line(px, py, x1, y1, x2, y2) -> float:
    """Retorna um valor positivo ou negativo dependendo do lado da linha."""
    return (x2 - x1) * (py - y1) - (y2 - y1) * (px - x1)


def check_crossing(cam: CameraState, track_id: int, cx: float, cy: float, w: int, h: int):
    """
    Verifica se um veículo cruzou a linha virtual.
    Retorna 'down', 'up' ou None.
    """
    if track_id in cam.crossed_ids:
        return None

    lx1 = cam.line["x1"] * w
    ly1 = cam.line["y1"] * h
    lx2 = cam.line["x2"] * w
    ly2 = cam.line["y2"] * h

    if track_id not in cam.tracked_ids:
        side = point_side_of_line(cx, cy, lx1, ly1, lx2, ly2)
        cam.tracked_ids[track_id] = {"prev_side": side}
        return None

    prev_side = cam.tracked_ids[track_id]["prev_side"]
    curr_side = point_side_of_line(cx, cy, lx1, ly1, lx2, ly2)
    cam.tracked_ids[track_id]["prev_side"] = curr_side

    if prev_side * curr_side < 0:  # Mudou de lado
        cam.crossed_ids.add(track_id)
        return "down" if curr_side < 0 else "up"

    return None


# ─── Salvar no Supabase ────────────────────────────────────────────────────────
async def save_count_to_supabase(cam: CameraState):
    if not supabase:
        return
    try:
        supabase.table("mercados_live").update({
            "contagem_veiculos": cam.total_count,
            "updated_at": "now()"
        }).eq("id", cam.stream_id.replace("live-", "")).execute()
        print(f"[Supabase] Saved count {cam.total_count} for {cam.stream_id}")
    except Exception as e:
        print(f"[Supabase] Error saving: {e}")


# ─── Broadcast por WebSocket ───────────────────────────────────────────────────
async def broadcast(cam: CameraState, message: dict):
    disconnected = set()
    for ws in cam.clients:
        try:
            await ws.send_text(json.dumps(message))
        except Exception:
            disconnected.add(ws)
    cam.clients -= disconnected


# ─── Thread de Processamento de Vídeo ─────────────────────────────────────────

# ─── Processamento de Vídeo FFmpeg (Zero-Starvation Pipe) ─────────────────────────

class FFmpegCaptureThread:
    """Consome o Pipe rawvideo no fundo. Previne Pipe Bloat (lag infinito) se a IA atrasar 1ms."""
    def __init__(self, url, width=640, height=360):
        self.width = width
        self.height = height
        cmd = [
            'ffmpeg',
            '-re',                  
            '-fflags', 'nobuffer',
            '-flags', 'low_delay',
            '-i', url,
            '-vf', f'scale={width}:{height}',
            '-f', 'rawvideo',
            '-pix_fmt', 'bgr24',
            '-r', '24',             # 24 FPS: Fluidez total cinematográfica!
            'pipe:1'
        ]
        self.url = url
        try:
            self.proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=10**8)
        except FileNotFoundError:
            self.proc = None
            print("[Capture] Comando 'ffmpeg' não encontrado no sistema.")
        
        self.q = queue.Queue(maxsize=3)
        self.running = True
        self.thread = threading.Thread(target=self._reader, daemon=True)
        self.thread.start()

    def _reader(self):
        framesize = self.width * self.height * 3
        
        # Fallback se o FFmpeg falhar (ex: não instalado no Windows)
        try:
            while self.running and self.proc:
                raw = self.proc.stdout.read(framesize)
                if not raw or len(raw) != framesize:
                    if self.proc.poll() is not None:
                        print("[Capture] FFmpeg encerrado. Usando OpenCV fallback...")
                        break
                    time.sleep(0.1)
                    continue
                frame = np.frombuffer(raw, dtype=np.uint8).reshape((self.height, self.width, 3))
                self._update_queue(frame)
        except Exception as e:
            print(f"[Capture] Erro no pipe FFmpeg ({e}). Iniciando OpenCV fallback...")

        # --- FALLBACK OPENCV COM DRENAGEM CORRETA (Otimização do Claude v2) ---
        cap = cv2.VideoCapture(self.url)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Minimiza buffer interno do OpenCV

        while self.running:
            # Lê frames e descarta tudo EXCETO o último disponível
            # cap.read() = grab + retrieve em um passo só
            ret, frame = cap.read()
            if not ret:
                time.sleep(1)
                continue

            # Drena qualquer frame que acumulou DEPOIS desse read
            # tentando pegar um mais novo sem custo de decode
            for _ in range(3):
                grabbed = cap.grab()
                if not grabbed:
                    break
                ret2, newer = cap.retrieve()
                if ret2:
                    frame = newer  # substitui pelo mais novo disponível

            frame = cv2.resize(frame, (self.width, self.height))
            self._update_queue(frame)

            # Delay estratégico suave
            time.sleep(0.02)

        cap.release()

    def _update_queue(self, frame):
        if not self.q.empty():
            try:
                self.q.get_nowait()
            except queue.Empty:
                pass
        self.q.put(frame)

    def read(self):
        try:
            # Aumentando o timeout para 10s para acomodar o handshake lento do OpenCV em streams HLS
            return self.q.get(timeout=10)
        except queue.Empty:
            return None

    def release(self):
        self.running = False
        if self.proc:
            try:
                self.proc.stdout.close()
                self.proc.kill()
                self.proc.wait()
            except Exception:
                pass
        self.thread.join(timeout=1)

def process_stream(stream_id: str, main_loop: asyncio.AbstractEventLoop):
    global model
    cam = cameras[stream_id]
    cam.running = True

    print(f"[{stream_id}] Iniciando stream (FFMPEG THREAD PIPE): {cam.stream_url}")

    while cam.running:
        cap = FFmpegCaptureThread(cam.stream_url, width=640, height=360)

        while cam.running:
            frame = cap.read()
            if frame is None:
                # O stream falhou. Se chegamos aqui, o timeout de 10s expirou.
                print(f"[{stream_id}] Stream timeout (10s) ou erro. Reiniciando captura em 3s...")
                cap.release()
                time.sleep(3)
                break

            # Salva o frame para MJPEG fallback
            with cam.lock:
                cam.last_frame = frame.copy()

            # Processo de IA em cada frame que o pipe entregar (pois o FFmpeg já reduziu pra 12 FPS controlados)

            if model is None:
                continue

            h, w = frame.shape[:2]

            # ─── Inferência YOLO com rastreamento ──────────────────────────
            results = model.track(
                frame,
                persist=True,
                classes=list(VEHICLE_CLASSES.keys()),
                imgsz=320,
                conf=0.3,
                iou=0.5,
                verbose=False
            )

            ai_frame = frame.copy()
            crossings = []
            
            # Limpa highlights velhos (> 0.7 segundos para aparecer e sumir rápido)
            now = time.time()
            with cam.lock:
                keys_to_remove = [k for k, v in cam.recent_crossings.items() if now - v > 0.7]
                for k in keys_to_remove:
                    del cam.recent_crossings[k]

            if results[0].boxes.id is not None:
                boxes = results[0].boxes.xyxy.cpu().numpy()
                track_ids = results[0].boxes.id.int().cpu().tolist()
                class_ids = results[0].boxes.cls.int().cpu().tolist()

                for box, track_id, class_id in zip(boxes, track_ids, class_ids):
                    x1, y1, x2, y2 = map(int, box)
                    cx = (x1 + x2) / 2
                    cy = (y1 + y2) / 2
                    class_name = VEHICLE_CLASSES.get(class_id, "veículo")
                    color = CLASS_COLORS.get(class_name, [255, 255, 255])

                    # Verifica cruzamento
                    direction = check_crossing(cam, track_id, cx, cy, w, h)
                    with cam.lock:
                        if direction:
                            cam.total_count += 1
                            cam.recent_crossings[track_id] = now
                            crossings.append({
                                "track_id": track_id,
                                "class_name": class_name,
                                "color": color,
                                "direction": direction,
                            })
                            
                        # Desenha bounding box SOMENTE se ele cruzou a linha recentemente
                        if track_id in cam.recent_crossings:
                            cv2.rectangle(ai_frame, (x1, y1), (x2, y2), color[::-1], 2)
                            cv2.putText(
                                ai_frame, f"{class_name} #{track_id}",
                                (x1, y1 - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.5,
                                color[::-1], 1, cv2.LINE_AA
                            )

            # Desenha linha no frame de IA
            lx1 = int(cam.line["x1"] * w)
            ly1 = int(cam.line["y1"] * h)
            lx2 = int(cam.line["x2"] * w)
            ly2 = int(cam.line["y2"] * h)
            cv2.line(ai_frame, (lx1, ly1), (lx2, ly2), (0, 255, 80), 3)

            # Encoda o frame UMA VEZ no YOLO (Otimização do Claude)
            _, buf = cv2.imencode(".jpg", ai_frame, [cv2.IMWRITE_JPEG_QUALITY, 55])
            frame_bytes = buf.tobytes()
            with cam.lock:
                cam.last_frame_ai = ai_frame
                cam.last_frame_bytes = frame_bytes

            # Avisa o FastAPI que há frame novo (Usa o main_loop explicitamente)
            try:
                main_loop.call_soon_threadsafe(cam.frame_event.set)
            except Exception as e:
                print(f"[Loop] Erro ao sinalizar frame: {e}")

            # Monta mensagem base
            msg_base = {
                "total_count": cam.total_count,
                "line_x1_pct": cam.line["x1"],
                "line_y1_pct": cam.line["y1"],
                "line_x2_pct": cam.line["x2"],
                "line_y2_pct": cam.line["y2"],
            }

            # Envia update normal + crossing events (Usa run_coroutine_threadsafe)
            if crossings:
                for crossing in crossings:
                    crossing_msg = {
                        **msg_base,
                        "event": "crossing",
                        "vehicle": {
                            "class_name": crossing["class_name"],
                            "color": crossing["color"],
                            "direction": crossing["direction"],
                        }
                    }
                    asyncio.run_coroutine_threadsafe(broadcast(cam, crossing_msg), main_loop)
            else:
                asyncio.run_coroutine_threadsafe(broadcast(cam, msg_base), main_loop)

            # Salva no Supabase periodicamente
            if time.time() - cam.last_save_ts > SAVE_INTERVAL_SEC:
                cam.last_save_ts = time.time()
                asyncio.run_coroutine_threadsafe(save_count_to_supabase(cam), main_loop)

        cap.release()
        time.sleep(5)


# ─── Endpoints REST ────────────────────────────────────────────────────────────
@app.get("/status/{stream_id}")
async def get_status(stream_id: str):
    cam = cameras.get(stream_id)
    if not cam:
        return JSONResponse({"error": "Camera not found"}, status_code=404)
    return {
        "stream_id": stream_id,
        "running": cam.running,
        "total_count": cam.total_count,
        "clients": len(cam.clients),
        "line": cam.line,
    }


@app.get("/set-line/{stream_id}/{x1}/{y1}/{x2}/{y2}")
async def set_line(stream_id: str, x1: int, y1: int, x2: int, y2: int):
    cam = cameras.get(stream_id)
    if not cam:
        return JSONResponse({"error": "Camera not found"}, status_code=404)

    # O frontend manda pixels em resolução 640x480
    cam.line = {
        "x1": x1 / 640,
        "y1": y1 / 480,
        "x2": x2 / 640,
        "y2": y2 / 480,
    }
    return {"success": True, "line": cam.line}


@app.get("/video-feed/{stream_id}")
async def video_feed(stream_id: str):
    """MJPEG stream do frame processado pela IA (modo 'VISÃO IA')."""
    cam = cameras.get(stream_id)
    if not cam:
        return JSONResponse({"error": "Camera not found"}, status_code=404)

    async def generate():
        while True:
            # Espera até o YOLO sinalizar frame novo (sem sleep fixo - Otimização do Claude)
            try:
                await asyncio.wait_for(cam.frame_event.wait(), timeout=2.0)
                cam.frame_event.clear()
            except (asyncio.TimeoutError, Exception):
                continue

            with cam.lock:
                frame_bytes = cam.last_frame_bytes

            if frame_bytes:
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + frame_bytes + b"\r\n"
                )

    return StreamingResponse(generate(), media_type="multipart/x-mixed-replace;boundary=frame")


# ─── WebSocket ────────────────────────────────────────────────────────────────
@app.websocket("/ws/live/{stream_id}")
async def websocket_endpoint(websocket: WebSocket, stream_id: str):
    cam = cameras.get(stream_id)
    if not cam:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    cam.clients.add(websocket)
    print(f"[WS] Cliente conectado: {stream_id}. Total: {len(cam.clients)}")

    # Envia estado atual imediatamente
    await websocket.send_text(json.dumps({
        "total_count": cam.total_count,
        "line_x1_pct": cam.line["x1"],
        "line_y1_pct": cam.line["y1"],
        "line_x2_pct": cam.line["x2"],
        "line_y2_pct": cam.line["y2"],
    }))

    try:
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        cam.clients.discard(websocket)
        print(f"[WS] Cliente desconectado: {stream_id}. Total: {len(cam.clients)}")


# ─── Inicialização ─────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    global model, supabase

    print("[Init] Corrigindo compatibilidade PyTorch 2.6...")
    try:
        import torch
        # Monkeypatch: Força weights_only=False para suportar modelos legados do YOLO
        _original_load = torch.load
        def _patched_load(*args, **kwargs):
            if 'weights_only' not in kwargs:
                kwargs['weights_only'] = False
            return _original_load(*args, **kwargs)
        torch.load = _patched_load
        print("[Init] Monkeypatch do Torch.load aplicado com sucesso.")
    except Exception as e:
        print(f"[Init] Aviso: Falha ao aplicar fix do Torch: {e}")

    print("[Init] Carregando modelo YOLO (ONNX)...")
    torch.set_num_threads(2)        # otimizado para os 2 vCPUs da VPS
    torch.set_num_interop_threads(1)
    
    model = YOLO(MODEL_PATH)
    model.overrides["imgsz"] = 320
    model.overrides["half"] = False
    model.overrides["verbose"] = False
    print(f"[Init] Modelo {MODEL_PATH} carregado com otimizações imgsz=320!")

    if SUPABASE_URL and SUPABASE_KEY:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("[Init] Supabase conectado!")
    else:
        print("[Init] AVISO: Supabase não configurado (sem variáveis de ambiente)")

    main_loop = asyncio.get_running_loop()
    for stream_id, stream_url in STREAMS.items():
        cam = CameraState(stream_id, stream_url)
        cameras[stream_id] = cam
        thread = threading.Thread(target=process_stream, args=(stream_id, main_loop), daemon=True)
        thread.start()
        print(f"[Init] Stream iniciado: {stream_id}")


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
