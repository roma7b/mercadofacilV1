import time
import cv2
import numpy as np
from ultralytics import YOLO
import sys
import os

# Adiciona o diretório do servidor YOLO ao path para importar as configurações se necessário
sys.path.append(os.path.join(os.getcwd(), 'yolo-server'))

def test_yolo_performance():
    model_path = os.environ.get("YOLO_MODEL", "yolov8n.pt")
    print(f"Carregando modelo: {model_path}")
    
    # Importante o fix do torch que vimos no server.py
    try:
        import torch
        _original_load = torch.load
        def _patched_load(*args, **kwargs):
            if 'weights_only' not in kwargs:
                kwargs['weights_only'] = False
            return _original_load(*args, **kwargs)
        torch.load = _patched_load
    except:
        pass

    model = YOLO(model_path)
    
    # Cria um frame fake de 640x360 (mesma resolução usada no server.py)
    frame = np.random.randint(0, 255, (360, 640, 3), dtype=np.uint8)
    
    print("Iniciando medição (aquecimento)...")
    model.track(frame, persist=True, verbose=False) # warmup
    
    print("Medindo tempo médio de 10 frames...")
    times = []
    for i in range(10):
        start = time.time()
        results = model.track(frame, persist=True, verbose=False)
        end = time.time()
        duration = (end - start) * 1000
        times.append(duration)
        print(f"Frame {i+1}: {duration:.1f}ms")
    
    avg_time = sum(times) / len(times)
    print(f"\nResultado final:")
    print(f"YOLO médio: {avg_time:.1f}ms")

if __name__ == "__main__":
    test_yolo_performance()
