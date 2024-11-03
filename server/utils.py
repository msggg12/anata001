import json
import logging
import bcrypt
import hashlib
from functools import wraps
from flask import session, redirect, url_for
from cryptography.fernet import Fernet

ENCRYPTION_KEY = b'C5Nk6UxL2R1_F0fSj1U5E5y9I7G6dK1O9O5wX5oW9dY=' # 32 ბაიტიანი გასაღები

def encrypt_data(data):
    f = Fernet(ENCRYPTION_KEY)
    return f.encrypt(json.dumps(data).encode()).decode()

def decrypt_data(encrypted_data):
    f = Fernet(ENCRYPTION_KEY)
    return json.loads(f.decrypt(encrypted_data.encode()).decode())

logger = logging.getLogger(__name__)


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)

    return decorated_function


def load_data(filename):
    try:
        with open(filename, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        logger.error(f"File not found: {filename}")
        return {}
    except json.JSONDecodeError:
        logger.error(f"Invalid JSON in file: {filename}")
        return {}


def save_data(filename, data):
    with open(filename, 'w') as f:
        json.dump(data, f, indent=2)


def hash_password(password):
    # BCrypt hashing
    bcrypt_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

    # SHA256 hashing
    sha256_hash = hashlib.sha256(password.encode('utf-8')).hexdigest()

    # MD5 hashing (not recommended for security, but included for compatibility)
    md5_hash = hashlib.md5(password.encode('utf-8')).hexdigest()

    return {
        'bcrypt': bcrypt_hash,
        'sha256': sha256_hash,
        'md5': md5_hash
    }


def check_password(password, stored_hashes):
    if not isinstance(stored_hashes, dict):
        # If stored_hashes is not a dict, assume it's a bcrypt hash
        return bcrypt.checkpw(password.encode('utf-8'), stored_hashes.encode('utf-8'))

    # Check bcrypt
    if 'bcrypt' in stored_hashes:
        if bcrypt.checkpw(password.encode('utf-8'), stored_hashes['bcrypt'].encode('utf-8')):
            return True

    # Check SHA256
    if 'sha256' in stored_hashes:
        if hashlib.sha256(password.encode('utf-8')).hexdigest() == stored_hashes['sha256']:
            return True

    # Check MD5
    if 'md5' in stored_hashes:
        if hashlib.md5(password.encode('utf-8')).hexdigest() == stored_hashes['md5']:
            return True

    return False