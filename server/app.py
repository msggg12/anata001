import logging
from flask import Flask, send_from_directory, jsonify, request, session, redirect, url_for
from flask_socketio import SocketIO, emit
from flask_cors import CORS

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
    socketio.emit('update_computers', computers)

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

@socketio.on('add_hostname')
@login_required
def handle_add_hostname(data):
    computers = load_data(Config.COMPUTERS_FILE)
    hostname = data.get('hostname')
    if hostname and hostname not in computers and len(hostname) <= 50:
        computers[hostname] = {
            'cpu_usage': 0,
            'memory_usage': 0,
            'disk_usage': 0,
            'status': 'offline',
            'ip_address': 'N/A',
            'anydesk_id': 'N/A'
        }
        save_data(Config.COMPUTERS_FILE, computers)
        emit_update_computers(computers)
        logger.info(f"New hostname added: {hostname}")
    else:
        logger.warning(f"Invalid hostname addition attempt: {hostname}")
        emit('error', {'message': 'არასწორი ან არსებული ჰოსტის სახელი'})

@socketio.on('edit_hostname')
@login_required
def handle_edit_hostname(data):
    computers = load_data(Config.COMPUTERS_FILE)
    old_hostname = data.get('oldHostname')
    new_hostname = data.get('newHostname')
    if old_hostname in computers and new_hostname and len(new_hostname) <= 50:
        computers[new_hostname] = computers.pop(old_hostname)
        save_data(Config.COMPUTERS_FILE, computers)
        emit_update_computers(computers)
        logger.info(f"Hostname changed from {old_hostname} to {new_hostname}")
    else:
        logger.warning(f"Invalid hostname edit attempt: {old_hostname} to {new_hostname}")
        emit('error', {'message': 'არასწორი ჰოსტის სახელი'})

@socketio.on('delete_hostname')
@login_required
def handle_delete_hostname(data):
    computers = load_data(Config.COMPUTERS_FILE)
    hostname = data.get('hostname')
    if hostname in computers:
        del computers[hostname]
        save_data(Config.COMPUTERS_FILE, computers)
        emit_update_computers(computers)
        logger.info(f"Hostname deleted: {hostname}")
    else:
        logger.warning(f"Attempt to delete non-existent hostname: {hostname}")
        emit('error', {'message': 'ჰოსტის სახელი ვერ მოიძებნა'})

@socketio.on('update_computer_data')
def handle_update_computer_data(data):
    computers = load_data(Config.COMPUTERS_FILE)
    hostname = data.get('hostname')
    if hostname in computers:
        computers[hostname].update({
            'cpu_usage': data.get('cpu_usage', 0),
            'memory_usage': data.get('memory_usage', 0),
            'disk_usage': data.get('disk_usage', 0),
            'status': data.get('status', 'offline'),
            'ip_address': data.get('ip_address', 'N/A'),
            'anydesk_id': data.get('anydesk_id', 'N/A')
        })
        save_data(Config.COMPUTERS_FILE, computers)
        emit_update_computers(computers)
        emit('request_data_for_host', {'hostname': hostname, 'data': computers[hostname]})
        logger.info(f"Computer data updated for: {hostname}")
    else:
        logger.warning(f"Attempt to update non-existent hostname: {hostname}")
        emit('error', {'message': 'ჰოსტის სახელი ვერ მოიძებნა'})

if __name__ == '__main__':
    socketio.run(app, debug=Config.DEBUG, host='0.0.0.0', port=5000)