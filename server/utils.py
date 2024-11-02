import json
from flask_socketio import emit

def load_data(filename):
    try:
        with open(filename, 'r') as file:
            return json.load(file)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def save_data(filename, data):
    with open(filename, 'w') as file:
        json.dump(data, file)

def emit_update_computers(computers):
    from config import Config
    save_data(Config.COMPUTERS_FILE, computers)
    emit('update_computer_list', computers, broadcast=True)