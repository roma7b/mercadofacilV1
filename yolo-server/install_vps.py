"""
Script de instalação automática do servidor YOLO no VPS.
Executa todos os comandos necessários via SSH usando Paramiko.
"""
import paramiko
import time
import sys

HOST = "69.62.89.218"
USER = "root"
PASSWORD = "v,Gq0dtCbyYN2#G3"

# Lê os arquivos do servidor
with open("yolo-server/server.py", "r", encoding="utf-8") as f:
    SERVER_PY = f.read()

with open("yolo-server/requirements.txt", "r", encoding="utf-8") as f:
    REQUIREMENTS = f.read()

SERVICE_CONTENT = """[Unit]
Description=Mercado Facil YOLO Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/yolo-server
EnvironmentFile=/opt/yolo-server/.env
ExecStart=/opt/yolo-server/venv/bin/python server.py
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
"""

# Substitua pelos seus valores reais:
import os
SUPABASE_URL = os.environ.get("SUPABASE_URL", "COLOQUE_AQUI")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "COLOQUE_AQUI")

ENV_CONTENT = f"""SUPABASE_URL={SUPABASE_URL}
SUPABASE_SERVICE_KEY={SUPABASE_KEY}
CAMERA_URL_RODOVIA=https://34.104.32.249.nip.io/SP008-KM095/stream.m3u8
YOLO_MODEL=yolov8n.pt
"""


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 120) -> tuple:
    print(f"\n$ {cmd[:80]}{'...' if len(cmd) > 80 else ''}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    stdout.channel.set_combine_stderr(True)
    out = ""
    for line in iter(stdout.readline, ""):
        print(f"  {line}", end="")
        out += line
    exit_code = stdout.channel.recv_exit_status()
    if exit_code != 0:
        print(f"  ⚠️  Exit code: {exit_code}")
    return out, exit_code


def upload_file(sftp: paramiko.SFTPClient, content: str, remote_path: str):
    import io
    print(f"  📤 Upload: {remote_path}")
    sftp.putfo(io.BytesIO(content.encode("utf-8")), remote_path)


def main():
    print("=" * 60)
    print("🚀 Instalando servidor YOLO no VPS")
    print(f"   Host: {HOST}")
    print("=" * 60)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    print("\n🔌 Conectando via SSH...")
    client.connect(HOST, username=USER, password=PASSWORD, timeout=30)
    print("✅ Conectado!")

    sftp = client.open_sftp()

    # ── PASSO 1: Criar pasta ─────────────────────────────────────
    print("\n📁 PASSO 1: Criando pasta do servidor...")
    run(client, "mkdir -p /opt/yolo-server")

    # ── PASSO 2: Upload dos arquivos ─────────────────────────────
    print("\n📤 PASSO 2: Enviando arquivos...")
    upload_file(sftp, SERVER_PY, "/opt/yolo-server/server.py")
    upload_file(sftp, REQUIREMENTS, "/opt/yolo-server/requirements.txt")
    upload_file(sftp, SERVICE_CONTENT, "/opt/yolo-server/yolo-server.service")
    upload_file(sftp, ENV_CONTENT, "/opt/yolo-server/.env")
    print("✅ Arquivos enviados!")

    # ── PASSO 3: Atualizar sistema ───────────────────────────────
    print("\n🛠️  PASSO 3: Atualizando sistema (pode demorar ~2 min)...")
    run(client, "DEBIAN_FRONTEND=noninteractive apt-get update -qq", timeout=120)
    run(client, (
        "DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "
        "python3.11 python3.11-venv python3-pip ffmpeg libgl1-mesa-glx "
        "libglib2.0-0 libsm6 libxext6 libxrender-dev"
    ), timeout=300)
    print("✅ Sistema atualizado!")

    # ── PASSO 4: Criar venv e instalar deps ──────────────────────
    print("\n🐍 PASSO 4: Criando ambiente Python (pode demorar ~5 min)...")
    run(client, "cd /opt/yolo-server && python3.11 -m venv venv", timeout=60)
    run(client, (
        "cd /opt/yolo-server && "
        "venv/bin/pip install --upgrade pip -q && "
        "venv/bin/pip install -r requirements.txt -q"
    ), timeout=600)
    print("✅ Python configurado!")

    # ── PASSO 5: Baixar modelo YOLO ──────────────────────────────
    print("\n🤖 PASSO 5: Baixando modelo YOLOv8n...")
    run(client, (
        "cd /opt/yolo-server && "
        "venv/bin/python -c \"from ultralytics import YOLO; YOLO('yolov8n.pt'); print('YOLO OK')\""
    ), timeout=120)
    print("✅ Modelo YOLO baixado!")

    # ── PASSO 6: Instalar e ativar serviço ───────────────────────
    print("\n⚙️  PASSO 6: Configurando serviço systemd...")
    run(client, "cp /opt/yolo-server/yolo-server.service /etc/systemd/system/")
    run(client, "systemctl daemon-reload")
    run(client, "systemctl enable yolo-server")
    run(client, "systemctl start yolo-server")
    time.sleep(3)
    out, _ = run(client, "systemctl status yolo-server --no-pager")

    # ── PASSO 7: Abrir porta no firewall ─────────────────────────
    print("\n🔓 PASSO 7: Configurando firewall...")
    run(client, "ufw allow 8000/tcp 2>/dev/null || true")
    run(client, "ufw allow 80/tcp 2>/dev/null || true")
    run(client, "ufw allow 443/tcp 2>/dev/null || true")

    # ── PASSO 8: Testar a API ────────────────────────────────────
    print("\n🧪 PASSO 8: Testando a API...")
    time.sleep(5)
    out, code = run(client, (
        "curl -s http://localhost:8000/status/live-cam-rodovia-sp 2>/dev/null || "
        "echo 'API ainda iniciando...'"
    ))

    sftp.close()
    client.close()

    print("\n" + "=" * 60)
    if "running" in out or "total_count" in out:
        print("🎉 INSTALAÇÃO CONCLUÍDA COM SUCESSO!")
        print(f"\n✅ Seu servidor YOLO está em:")
        print(f"   API:       http://{HOST}:8000")
        print(f"   Status:    http://{HOST}:8000/status/live-cam-rodovia-sp")
        print(f"   WebSocket: ws://{HOST}:8000/ws/live/live-cam-rodovia-sp")
    else:
        print("⚠️  Instalação concluída. Verifique os logs no VPS:")
        print(f"   journalctl -u yolo-server -f")
    print("=" * 60)


if __name__ == "__main__":
    main()
