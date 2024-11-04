import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your-secret-key'
    COMPUTERS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'computers.json')
    USERS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'users.json')
    DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'