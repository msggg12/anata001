import asyncio
import json
import logging
import os
import platform
import socket
import subprocess
import sys
import time
from datetime import datetime

import psutil
import socketio
from cryptography.fernet import Fernet

# კონფიგურაცია
SOCKET_SERVER_URL = 'http://172.16.2.251:5000'
ENCRYPTION_KEY = b'C5Nk6UxL2R1_F0fSj1U5E5y9I7G6dK1O9O5wX5oW9dY='

# ლოგირების კონფიგურაცია
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# SocketIO კლიენტის ინიციალიზაცია
sio = socketio.AsyncClient(logger=True, engineio_logger=True)
fernet = Fernet(ENCRYPTION_KEY)

# დაშიფვრა და გაშიფვრა
def encrypt_data(data):
    try:
        json_data = json.dumps(data)
        logger.info(f"მონაცემები დაშიფვრამდე: {json_data[:100]}...")  # ვაჩვენოთ პირველი 100 სიმბოლო
        encrypted = fernet.encrypt(json_data.encode())
        logger.info(f"დაშიფრული მონაცემები: {encrypted[:50]}...")  # ვაჩვენოთ პირველი 50 სიმბოლო
        return encrypted.decode()
    except Exception as e:
        logger.error(f"მონაცემების დაშიფვრის შეცდომა: {e}")
        return None

def decrypt_data(encrypted_data):
    try:
        return json.loads(fernet.decrypt(encrypted_data.encode()).decode())
    except Exception as e:
        logger.error(f"მონაცემების გაშიფვრის შეცდომა: {e}")
        return None

# სისტემური ინფორმაციის მიღება
async def get_anydesk_id():
    try:
        if platform.system() == "Windows":
            process = await asyncio.create_subprocess_exec(
                'powershell', '-Command', '& "C:\\Program Files (x86)\\AnyDesk\\AnyDesk.exe" --get-id',
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await process.communicate()
            if process.returncode == 0:
                return stdout.decode().strip()
            logger.warning(f"AnyDesk ID მიღება ვერ მოხერხდა: {stderr.decode().strip()}")
        else:
            logger.warning("AnyDesk ID მიღება მხარდაჭერილია მხოლოდ Windows-ზე")
    except Exception as e:
        logger.error(f"AnyDesk ID მიღების შეცდომა: {e}")
    return None

async def get_system_info():
    try:
        anydesk_id = await get_anydesk_id()
        static_info = {
            'hostname': socket.gethostname(),
            'ip_address': socket.gethostbyname(socket.gethostname()),
            'os': platform.system(),
            'os_version': platform.version(),
            'cpu_info': platform.processor(),
            'cpu_count': psutil.cpu_count(),
            'cpu_freq': psutil.cpu_freq().current,
            'memory_total': psutil.virtual_memory().total,
            'disk_space_total': psutil.disk_usage('/').total,
            'anydesk_id': anydesk_id
        }
        dynamic_info = {
            'hostname': socket.gethostname(),
            'cpu_usage': psutil.cpu_percent(interval=1),
            'memory_usage': psutil.virtual_memory().percent,
            'disk_usage': psutil.disk_usage('/').percent,
            'network_usage': psutil.net_io_counters().bytes_sent + psutil.net_io_counters().bytes_recv,
            'last_update': datetime.now().isoformat()
        }
        return {'static': static_info, 'dynamic': dynamic_info}
    except Exception as e:
        logger.error(f"სისტემური ინფორმაციის მიღების შეცდომა: {e}")
        return None

# Socket მოვლენები
@sio.event
async def connect():
    logger.info("სერვერთან დაკავშირება წარმატებით განხორციელდა.")
    hostname = socket.gethostname()
    encrypted_data = encrypt_data({'hostname': hostname})
    if encrypted_data:
        await sio.emit('join', encrypted_data)
        await send_system_info()
    else:
        logger.error("hostname-ის დაშიფვრა ვერ მოხერხდა.")

async def send_system_info():
    try:
        info = await get_system_info()
        if info:
            info['hostname'] = socket.gethostname()
            logger.info(f"მოსამზადებელი ინფორმაცია გასაგზავნად: {info}")
            encrypted_data = encrypt_data(info)
            if encrypted_data:
                logger.info(f"დაშიფრული მონაცემები გასაგზავნად: {encrypted_data[:50]}...")  # ვაჩვენოთ პირველი 50 სიმბოლო
                await sio.emit('update_computer_data', encrypted_data)
                logger.info("სისტემური ინფორმაცია წარმატებით გაიგზავნა სერვერზე.")
            else:
                logger.error("სისტემური ინფორმაციის დაშიფვრა ვერ მოხერხდა.")
        else:
            logger.error("სისტემური ინფორმაციის მიღება ვერ მოხერხდა გასაგზავნად.")
    except Exception as e:
        logger.error(f"შეცდომა სისტემური ინფორმაციის გაგზავნისას: {str(e)}")

@sio.on('host_command')
async def on_host_command(encrypted_data):
    try:
        data = decrypt_data(encrypted_data)
        if not data:
            logger.error("მიღებული ბრძანების გაშიფვრა ვერ მოხერხდა.")
            return

        hostname = data.get('hostname')
        command = data.get('command')

        if hostname != socket.gethostname():
            logger.warning(f"მიღებულია ბრძანება არასწორი hostname-ით: {hostname}")
            return

        logger.info(f"მიღებულია ბრძანება: {command}")

        if command == 'check':
            await send_system_info()
        elif command == 'restart':
            logger.info("კომპიუტერის გადატვირთვა...")
            if platform.system() == "Windows":
                os.system("shutdown /r /t 1")
            else:
                os.system("sudo reboot")
    except Exception as e:
        logger.error(f"შეცდომა ბრძანების დამუშავებისას: {str(e)}")

@sio.event
async def disconnect():
    logger.info("სერვერთან კავშირი გაწყდა.")

async def main():
    while True:
        try:
            await sio.connect(SOCKET_SERVER_URL)
            await sio.wait()
        except Exception as e:
            logger.error(f"სერვერთან დაკავშირების შეცდომა: {e}")
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(main())