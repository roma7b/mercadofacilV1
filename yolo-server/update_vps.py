import paramiko
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('69.62.89.218', username='root', password='v,Gq0dtCbyYN2#G3', timeout=30)
sftp = client.open_sftp()
with open('yolo-server/server.py', 'rb') as f:
    sftp.putfo(f, '/opt/yolo-server/server.py')
sftp.close()
client.exec_command('/opt/yolo-server/venv/bin/pip install lapx')
stdin, stdout, stderr = client.exec_command('systemctl restart yolo-server && sleep 5 && systemctl is-active yolo-server')
print(stdout.read().decode().strip())
client.close()
