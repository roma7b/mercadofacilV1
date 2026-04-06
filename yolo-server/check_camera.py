import paramiko
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('69.62.89.218', username='root', password='v,Gq0dtCbyYN2#G3', timeout=30)

# Testa se a câmera DER-SP é acessível a partir do VPS
stdin, stdout, stderr = client.exec_command(
    'curl -s --max-time 10 -I "https://34.104.32.249.nip.io/SP008-KM095/stream.m3u8" 2>&1 | head -20'
)
print("=== Teste câmera DER-SP ===")
print(stdout.read().decode())

# Pega os últimos logs do processo Python
stdin, stdout, stderr = client.exec_command(
    'journalctl -u yolo-server -n 30 --no-pager 2>&1 | tail -30'
)
print("=== Últimos logs do servidor ===")
print(stdout.read().decode())

client.close()
