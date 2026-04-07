import cv2
import time

url = "https://34.104.32.249.nip.io/SP008-KM095/stream.m3u8"
print(f"Testando conexão com: {url}")

cap = cv2.VideoCapture(url)
start_time = time.time()

# Tenta por 15 segundos
while time.time() - start_time < 15:
    ret, frame = cap.read()
    if ret:
        print("SUCESSO: Frame capturado!")
        cv2.imwrite("tmp-test-frame.jpg", frame)
        print("Frame salvo como 'tmp-test-frame.jpg'")
        cap.release()
        exit(0)
    print("Aguardando frame...")
    time.sleep(1)

print("FALHA: Não foi possível capturar frame em 15 segundos.")
cap.release()
exit(1)
