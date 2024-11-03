import os
import json
import logging
from flask import Flask, send_from_directory, jsonify, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, get_jwt_identity
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from cryptography.fernet import Fernet

from config import Config
from utils import login_required, load_data, save_data, check_password

# ლოგირების კონფიგურაცია
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Flask აპლიკაციის ინიციალიზაცია
app = Flask(__name__,
            static_folder='../static',
            template_folder='../templates')
app.config.from_object(Config)
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*")

# JWT კონფიგურაცია
jwt = JWTManager(app)

# Rate limiting კონფიგურაცია
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

limiter.init_app(app)
# დაშიფვრის გასაღების მომზადება
fernet_key = Fernet.generate_key()
fernet = Fernet(fernet_key)


def emit_update_computers(computers):
    socketio.emit('update_computers', computers)


@app.route('/')
@login_required
def index():
    return send_from_directory(app.template_folder, 'index.html')


@app.route('/login', methods=['POST'])
@limiter.limit("5 per minute")
def login():
    data = request.json
    users = load_data(Config.USERS_FILE)
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({"success": False, "message": "სახელი და პაროლი აუცილებელია"}), 400

    if username in users:
        stored_hashes = users[username].get('password_hash')
        if check_password(password, stored_hashes):
            access_token = create_access_token(identity=username)
            return jsonify({"success": True, "message": "ავტორიზაცია წარმატებულია", "token": access_token}), 200

    return jsonify({"success": False, "message": "არასწორი მომხმარებელი ან პაროლი"}), 401


@app.route('/get_computers')
@jwt_required()
def get_computers():
    try:
        computers = load_data(Config.COMPUTERS_FILE)
        return jsonify(computers)
    except Exception as e:
        logger.error(f"Error getting computers: {str(e)}")
        return jsonify({"success": False, "message": "შეცდომა კომპიუტერების მიღებისას"}), 500


@app.route('/request_update/<hostname>', methods=['POST'])
@jwt_required()
def request_update(hostname):
    socketio.emit('request_update', {'hostname': hostname}, room=hostname)
    return jsonify({"success": True, "message": f"განახლების მოთხოვნა გაიგზავნა {hostname}-ზე"}), 200


@socketio.on('connect')
def handle_connect():
    client_id = request.sid
    logger.info(f"კლიენტი დაკავშირდა: {client_id}")


@socketio.on('join')
def on_join(data):
    hostname = data['hostname']
    room = hostname
    socketio.join_room(room)
    logger.info(f"კლიენტი {request.sid} შეუერთდა ოთახს {room}")


@socketio.on('update_computer_data')
def handle_update_computer_data(data):
    try:
        decrypted_data = fernet.decrypt(data['encrypted_data'].encode()).decode()
        computer_data = json.loads(decrypted_data)
        hostname = computer_data['hostname']

        computers = load_data(Config.COMPUTERS_FILE)
        if hostname in computers:
            computers[hostname].update(computer_data)
            save_data(Config.COMPUTERS_FILE, computers)
            emit_update_computers(computers)
            logger.info(f"კომპიუტერის მონაცემები განახლდა: {hostname}")
        else:
            logger.warning(f"მცდელობა განახლდეს არარსებული hostname: {hostname}")
            emit('error', {'message': 'ჰოსტის სახელი ვერ მოიძებნა'})
    except Exception as e:
        logger.error(f"შეცდომა კომპიუტერის მონაცემების განახლებისას: {str(e)}")
        emit('error', {'message': 'შეცდომა მონაცემების განახლებისას'})


if __name__ == '__main__':
    socketio.run(app, debug=Config.DEBUG, host='0.0.0.0', port=5000)