from flask import Flask, send_from_directory, jsonify, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from config import Config
from utils import load_data, save_data, emit_update_computers
import os

app = Flask(__name__, static_folder='../static', template_folder='../templates')
app.config.from_object(Config)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

@app.route('/')
def index():
    return send_from_directory(app.template_folder, 'index.html')

@app.route('/get_computers')
def get_computers():
    computers = load_data(Config.COMPUTERS_FILE)
    return jsonify(computers)

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    users = load_data(Config.USERS_FILE)
    username = data.get('username')
    password = data.get('password')

    if username in users and check_password_hash(users[username]['password'], password):
        return jsonify({"success": True, "message": "ავტორიზაცია წარმატებულია"})
    return jsonify({"success": False, "message": "არასწორი მომხმარებელი ან პაროლი"}), 401

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    users = load_data(Config.USERS_FILE)
    username = data.get('username')
    password = data.get('password')

    if username in users:
        return jsonify({"success": False, "message": "მომხმარებელი უკვე არსებობს"}), 400

    hashed_password = generate_password_hash(password)
    users[username] = {"password": hashed_password}
    save_data(Config.USERS_FILE, users)

    return jsonify({"success": True, "message": "რეგისტრაცია წარმატებით დასრულდა"})

@socketio.on('add_hostname')
def handle_add_hostname(data):
    computers = load_data(Config.COMPUTERS_FILE)
    hostname = data.get('hostname')
    if hostname and hostname not in computers:
        computers[hostname] = {
            'cpu_usage': 0,
            'memory_usage': 0,
            'disk_usage': 0,
            'status': 'offline',
            'ip_address': 'N/A',
            'anydesk_id': 'N/A'
        }
        emit_update_computers(computers)

@socketio.on('edit_hostname')
def handle_edit_hostname(data):
    computers = load_data(Config.COMPUTERS_FILE)
    old_hostname = data.get('oldHostname')
    new_hostname = data.get('newHostname')
    if old_hostname in computers and new_hostname:
        computers[new_hostname] = computers.pop(old_hostname)
        emit_update_computers(computers)

@socketio.on('delete_hostname')
def handle_delete_hostname(data):
    computers = load_data(Config.COMPUTERS_FILE)
    hostname = data.get('hostname')
    if hostname in computers:
        del computers[hostname]
        emit_update_computers(computers)

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
        emit_update_computers(computers)
        emit('request_data_for_host', {'hostname': hostname, 'data': computers[hostname]})

if __name__ == '__main__':
    socketio.run(app, debug=True, host='0.0.0.0', port=5000)