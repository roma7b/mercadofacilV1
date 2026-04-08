import torch
from ultralytics import YOLO

def main():
    # Monkeypatch para PyTorch 2.6+
    _original_load = torch.load
    def _patched_load(*args, **kwargs):
        if 'weights_only' not in kwargs:
            kwargs['weights_only'] = False
        return _original_load(*args, **kwargs)
    torch.load = _patched_load

    print("Carregando modelo YOLOv8n base (yolov8n.pt)...")
    model = YOLO("yolov8n.pt")

    print("Exportando para OpenVINO FP16...")
    model.export(
        format="openvino",
        half=True,
        imgsz=320,
    )

    print("\n✅ CONCLUÍDO! Modelo salvo em 'yolov8n_openvino_model/'")

if __name__ == "__main__":
    main()
