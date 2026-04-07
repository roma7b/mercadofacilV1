import paramiko
import os

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect('69.62.89.218', username='root', password='v,Gq0dtCbyYN2#G3')

stdin, stdout, stderr = client.exec_command('journalctl -u yolo-server -n 100 --no-pager')
print(stdout.read().decode())
client.close()
