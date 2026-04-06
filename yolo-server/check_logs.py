import paramiko
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('69.62.89.218', username='root', password='v,Gq0dtCbyYN2#G3', timeout=30)
stdin, stdout, stderr = client.exec_command('journalctl -u yolo-server -n 50 --no-pager')
print('STDOUT:')
print(stdout.read().decode())
client.close()
