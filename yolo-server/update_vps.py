import paramiko
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('69.62.89.218', username='root', password='v,Gq0dtCbyYN2#G3', timeout=30)
sftp = client.open_sftp()
with open('yolo-server/server.py', 'rb') as f:
    sftp.putfo(f, '/opt/yolo-server/server.py')
with open('yolo-server/yolov8n.onnx', 'rb') as f:
    sftp.putfo(f, '/opt/yolo-server/yolov8n.onnx')
# Sincroniza o .env local para que o YOLO na VPS tenha as mesmas chaves da Vercel
with open('.env', 'rb') as f:
    sftp.putfo(f, '/opt/yolo-server/.env')
sftp.close()
client.exec_command('/opt/yolo-server/venv/bin/pip install lapx onnx onnxruntime python-dotenv')
stdin, stdout, stderr = client.exec_command('systemctl restart yolo-server && sleep 5 && systemctl is-active yolo-server')
print(stdout.read().decode().strip())
client.close()
