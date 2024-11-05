import logging
from flask import Flask, send_from_directory, jsonify, request, session, redirect, url_for
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import json
from datetime import datetime

from config import Config
from utils import login_required, load_data, save_data, check_password, encrypt_data, decrypt_data

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='../static', template_folder='../templates')
app.config.from_object(Config)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

def emit_update_computers(computers):
    socketio.emit('update_computer_list', computers)

def clean_computer_data():
    computers = load_data(Config.COMPUTERS_FILE)
    cleaned_computers = {}
    for hostname, data in computers.items():
        if hostname and isinstance(data, dict):
            cleaned_computers[hostname] = data
    save_data(Config.COMPUTERS_FILE, cleaned_computers)
    return cleaned_computers

@app.route('/')
@login_required
def index():
    return send_from_directory(app.template_folder, 'index.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'GET':
        return send_from_directory(app.template_folder, 'login.html')

    data = request.json
    users = load_data(Config.USERS_FILE)
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"success": False, "message": "სახელი და პაროლი აუცილებელია"}), 400

    if username in users:
        stored_hashes = users[username].get('password_hash')
        if check_password(password, stored_hashes):
            session['user_id'] = username
            logger.info(f"User {username} logged in successfully")
            return jsonify({"success": True, "message": "ავტორიზაცია წარმატებულია"})

    logger.warning(f"Failed login attempt for user {username}")
    return jsonify({"success": False, "message": "არასწორი მომხმარებელი ან პაროლი"}), 401

@app.route('/logout')
def logout():
    session.pop('user_id', None)
    return redirect(url_for('login'))

@app.route('/get_computers')
@login_required
def get_computers():
    try:
        computers = load_data(Config.COMPUTERS_FILE)
        logger.info(f"Sending computers data: {computers}")
        return jsonify(computers)
    except Exception as e:
        logger.error(f"Error getting computers: {str(e)}")
        return jsonify({"success": False, "message": "შეცდომა კომპიუტერების მიღებისას"}), 500

@app.route('/get_host_info/<hostname>')
@login_required
def get_host_info(hostname):
    try:
        computers = load_data(Config.COMPUTERS_FILE)
        if hostname in computers:
            host_info = computers[hostname]
            host_info['hostname'] = hostname
            return jsonify({"success": True, "info": host_info})
        else:
            return jsonify({"success": False, "message": "ჰოსტი ვერ მოიძებნა"}), 404
    except Exception as e:
        logger.error(f"Error getting host info: {str(e)}")
        return jsonify({"success": False, "message": "შეცდომა ჰოსტის ინფორმაციის მიღებისას"}), 500

@socketio.on('join')
def handle_join(encrypted_data):
    try:
        data = decrypt_data(encrypted_data)
        hostname = data.get('hostname')
        if not hostname:
            logger.error("Received join request without hostname")
            return

        logger.info(f"Joined: {hostname}")

        computers = load_data(Config.COMPUTERS_FILE)
        if hostname not in computers:
            computers[hostname] = {'static': {}, 'dynamic': {}}
            logger.info(f"New computer added: {hostname}")
        else:
            logger.info(f"Existing computer reconnected: {hostname}")

        save_data(Config.COMPUTERS_FILE, computers)
        emit('status', {'message': f'{hostname} connected'})
        emit_update_computers(computers)
    except Exception as e:
        logger.error(f"Error handling join: {str(e)}")
        emit('error', {'message': 'Error handling join'})

@socketio.on('update_computer_data')
def handle_update_computer_data(encrypted_data):
    try:
        system_info = decrypt_data(encrypted_data)
        hostname = system_info.get('hostname')
        if not hostname:
            logger.error("Received update with empty hostname")
            return

        logger.info(f"Received update for {hostname}")
        computers = load_data(Config.COMPUTERS_FILE)

        if hostname in computers:
            if 'static' in system_info:
                computers[hostname]['static'] = system_info['static']

            computers[hostname]['dynamic'] = system_info.get('dynamic', {})
            computers[hostname]['dynamic']['last_update'] = datetime.now().isoformat()

            save_data(Config.COMPUTERS_FILE, computers)
            emit_update_computers(computers)
        else:
            logger.warning(f"Received update for unknown computer: {hostname}")

    except Exception as e:
        logger.error(f"Error updating computer data: {str(e)}")
        emit('error', {'message': 'Error updating data'})

@socketio.on('restart_host')
def handle_restart_host(data):
    try:
        hostname = data.get('hostname')
        encrypted_command = encrypt_data({'hostname': hostname})
        socketio.emit('restart_command', encrypted_command, room=hostname)
        logger.info(f"Restart command sent to {hostname}")
        emit('restart_result',
             {'success': True, 'message': f'{hostname}-ზე გაიგზავნა გადატვირთვის ბრძანება'})
    except Exception as e:
        logger.error(f"Error sending restart command: {str(e)}")
        emit('restart_result',
             {'success': False, 'message': 'შეცდომა გადატვირთვის ბრძანების გაგზავნისას'})

@socketio.on('check_host')
def handle_check_host(data):
    try:
        hostname = data.get('hostname')
        computers = load_data(Config.COMPUTERS_FILE)
        if hostname in computers:
            encrypted_request = encrypt_data({'hostname': hostname})
            socketio.emit('request_update', encrypted_request, room=hostname)
            logger.info(f"Check request sent to {hostname}")
            emit('check_result',
                 {'success': True, 'message': f'{hostname}-ზე გაიგზავნა შემოწმების მოთხოვნა'})
        else:
            logger.warning(f"Check request for unknown host: {hostname}")
            emit('check_result',
                 {'success': False, 'message': f'ჰოსტი {hostname} ვერ მოიძებნა'})
    except Exception as e:
        logger.error(f"Error sending check request: {str(e)}")
        emit('check_result',
             {'success': False, 'message': 'შეცდომა შემოწმების მოთხოვნის გაგზავნისას'})

@socketio.on('delete_host')
def handle_delete_host(data):
    try:
        hostname = data.get('hostname')
        computers = load_data(Config.COMPUTERS_FILE)
        if hostname in computers:
            del computers[hostname]
            save_data(Config.COMPUTERS_FILE, computers)
            logger.info(f"Host deleted: {hostname}")
            emit('delete_result',
                 {'success': True, 'message': f'{hostname} წარმატებით წაიშალა'})
            emit_update_computers(computers)
        else:
            logger.warning(f"Delete request for unknown host: {hostname}")
            emit('delete_result',
                 {'success': False, 'message': f'ჰოსტი {hostname} ვერ მოიძებნა'})
    except Exception as e:
        logger.error(f"Error deleting host: {str(e)}")
        emit('delete_result',
             {'success': False, 'message': 'შეცდომა ჰოსტის წაშლისას'})

if __name__ == '__main__':
    clean_computer_data()
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)