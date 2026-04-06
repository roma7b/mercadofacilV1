"""
Mercado Fácil - Servidor de Contagem de Veículos com YOLO
Conecta ao stream HLS da câmera, detecta veículos e transmite via WebSocket.
"""

import asyncio
import json
import time
import uuid
import os
import threading
import cv2
import numpy as np
from collections import defaultdict
from typing import Dict, Set, Optional

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from ultralytics import YOLO
from supabase import create_client, Client

# ─── Configuração ─────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# Mapa de câmeras ativas: id -> url do stream
STREAMS: Dict[str, str] = {
    "live-cam-rodovia-sp": os.environ.get(
        "CAMERA_URL_RODOVIA",
        "https://34.104.32.249.nip.io/SP008-KM095/stream.m3u8"
    ),
}

# Modelo YOLO — yolov8n é o mais leve (bom pra CPU)
MODEL_PATH = os.environ.get("YOLO_MODEL", "yolov8n.pt")

# Classes de veículos no COCO que nos interessam
VEHICLE_CLASSES = {2: "carro", 3: "moto", 5: "ônibus", 7: "caminhão"}

# Cores por classe (R, G, B)
CLASS_COLORS = {
    "carro": [0, 255, 80],
    "moto": [255, 200, 0],
    "ônibus": [0, 180, 255],
    "caminhão": [255, 60, 60],
}

FRAME_SKIP = 2          # Processa 1 a cada N frames (economiza CPU)
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
        self.lock = threading.Lock()
        self.clients: Set[WebSocket] = set()
        self.running = False

        # Linha de contagem (normalizada 0-1)
        self.line = {"x1": 0.0, "y1": 0.45, "x2": 1.0, "y2": 0.45}

        # Rastreamento de IDs para evitar dupla contagem
        self.tracked_ids: Dict[int, dict] = {}
        self.crossed_ids: Set[int] = set()

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
def process_stream(stream_id: str):
    global model
    cam = cameras[stream_id]
    cam.running = True

    print(f"[{stream_id}] Iniciando stream: {cam.stream_url}")

    while cam.running:
        cap = cv2.VideoCapture(cam.stream_url)
        if not cap.isOpened():
            print(f"[{stream_id}] Falha ao abrir stream. Tentando em 10s...")
            time.sleep(10)
            continue

        frame_idx = 0
        while cam.running:
            ret, frame = cap.read()
            if not ret:
                print(f"[{stream_id}] Fim do stream. Reconectando...")
                break

            frame_idx += 1

            # Salva o frame bruto (para o modo "live")
            with cam.lock:
                cam.last_frame = frame.copy()

            # Pula frames para economizar CPU
            if frame_idx % FRAME_SKIP != 0:
                continue

            if model is None:
                continue

            h, w = frame.shape[:2]

            # ─── Inferência YOLO com rastreamento ──────────────────────────
            results = model.track(
                frame,
                persist=True,
                classes=list(VEHICLE_CLASSES.keys()),
                verbose=False,
                conf=0.35,
                iou=0.45,
            )

            ai_frame = frame.copy()
            crossings = []

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

                    # Desenha bounding box no frame de IA
                    cv2.rectangle(ai_frame, (x1, y1), (x2, y2), color[::-1], 2)
                    cv2.putText(
                        ai_frame, f"{class_name} #{track_id}",
                        (x1, y1 - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.5,
                        color[::-1], 1, cv2.LINE_AA
                    )

                    # Verifica cruzamento
                    direction = check_crossing(cam, track_id, cx, cy, w, h)
                    if direction:
                        with cam.lock:
                            cam.total_count += 1
                        crossings.append({
                            "track_id": track_id,
                            "class_name": class_name,
                            "color": color,
                            "direction": direction,
                        })

            # Desenha linha no frame de IA
            lx1 = int(cam.line["x1"] * w)
            ly1 = int(cam.line["y1"] * h)
            lx2 = int(cam.line["x2"] * w)
            ly2 = int(cam.line["y2"] * h)
            cv2.line(ai_frame, (lx1, ly1), (lx2, ly2), (0, 255, 80), 3)
            cv2.putText(
                ai_frame, f"TOTAL: {cam.total_count}",
                (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.9,
                (0, 255, 80), 2, cv2.LINE_AA
            )

            with cam.lock:
                cam.last_frame_ai = ai_frame

            # Monta mensagem base
            msg_base = {
                "total_count": cam.total_count,
                "line_x1_pct": cam.line["x1"],
                "line_y1_pct": cam.line["y1"],
                "line_x2_pct": cam.line["x2"],
                "line_y2_pct": cam.line["y2"],
            }

            # Envia update normal + crossing events
            loop = asyncio.new_event_loop()
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
                    loop.run_until_complete(broadcast(cam, crossing_msg))
            else:
                loop.run_until_complete(broadcast(cam, msg_base))
            loop.close()

            # Salva no Supabase periodicamente
            if time.time() - cam.last_save_ts > SAVE_INTERVAL_SEC:
                cam.last_save_ts = time.time()
                save_loop = asyncio.new_event_loop()
                save_loop.run_until_complete(save_count_to_supabase(cam))
                save_loop.close()

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

    def generate():
        while True:
            with cam.lock:
                frame = cam.last_frame_ai if cam.last_frame_ai is not None else cam.last_frame
            if frame is not None:
                _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
                yield (
                    b"--frame\r\n"
                    b"Content-Type: image/jpeg\r\n\r\n" + buf.tobytes() + b"\r\n"
                )
            time.sleep(0.1)

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

    print("[Init] Carregando modelo YOLO...")
    model = YOLO(MODEL_PATH)
    print(f"[Init] Modelo {MODEL_PATH} carregado!")

    if SUPABASE_URL and SUPABASE_KEY:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        print("[Init] Supabase conectado!")
    else:
        print("[Init] AVISO: Supabase não configurado (sem variáveis de ambiente)")

    for stream_id, stream_url in STREAMS.items():
        cam = CameraState(stream_id, stream_url)
        cameras[stream_id] = cam
        thread = threading.Thread(target=process_stream, args=(stream_id,), daemon=True)
        thread.start()
        print(f"[Init] Stream iniciado: {stream_id}")


if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=False)
