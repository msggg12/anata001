import logging
from flask import Flask, send_from_directory, jsonify, request, session, redirect, url_for
from flask_socketio import SocketIO, emit
from flask_cors import CORS
import json

from config import Config
from utils import login_required, load_data, save_data, check_password

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__,
            static_folder='../static',
            template_folder='../templates')
app.config.from_object(Config)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")


def emit_update_computers(computers):
    socketio.emit('update_computer_list', computers)


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
        return jsonify(computers)
    except Exception as e:
        logger.error(f"Error getting computers: {str(e)}")
        return jsonify({"success": False, "message": "შეცდომა კომპიუტერების მიღებისას"}), 500


@socketio.on('join')
def handle_join(data):
    hostname = data.get('hostname')
    print(f"Joined: {hostname}")
    emit('status', {'message': f'{hostname} connected'})


@socketio.on('update_computer_data')
def handle_update_computer_data(data):
    try:
        # Direct access to system info since we're not encrypting now
        system_info = data  # The data is already a dictionary

        # Log and save data
        logger.info(f"Received update for {system_info['hostname']}")
        computers = load_data(Config.COMPUTERS_FILE)
        computers[system_info['hostname']] = {
            'status': system_info['status'],
            'cpu_usage': system_info['cpu_usage'],
            'memory_usage': system_info['memory_usage'],
            'disk_usage': system_info['disk_usage'],
            'ip_address': system_info['ip_address'],
            'anydesk_id': system_info['anydesk_id']
        }
        save_data(Config.COMPUTERS_FILE, computers)
        emit_update_computers(computers)

    except Exception as e:
        logger.error(f"Error updating computer data: {str(e)}")
        logger.error(f"Received data: {data}")  # Log the received data
        emit('error', {'message': 'Error updating data'})

if __name__ == '__main__':
    socketio.run(app, debug=Config.DEBUG, host='0.0.0.0', port=5000)
