import bcrypt
import json
from datetime import datetime

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

users = {
    "admin": {
        "password_hash": hash_password("Madafaka13!"),
        "email": "datiashvilin@gmail.com",
        "role": "admin",
        "created_at": datetime.utcnow().isoformat()
    },
    "tamtukela": {
        "password_hash": hash_password("Tamtukela10*"),
        "email": "tamtumta@gmail.com",
        "role": "admin",
        "created_at": datetime.utcnow().isoformat()
    }
}

with open('users.json', 'w') as f:
    json.dump(users, f, indent=2)

print("users.json file has been created successfully.")