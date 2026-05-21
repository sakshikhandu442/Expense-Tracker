
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import uuid

app = Flask(__name__)
CORS(app)  # Allow frontend requests

# Simulated "databases"
users = {}
sessions = {}
expenses = {}

# Helper function
def generate_id():
    return str(uuid.uuid4())

# ------------------- Frontend Routes -------------------

@app.route('/')
def home():
    return send_from_directory('.', 'login.html')

@app.route('/<path:filename>')
def serve_frontend_file(filename):
    return send_from_directory('.', filename)

# ------------------- User Routes -------------------

@app.route('/register', methods=['POST'])
def register():
    data = request.json
    email = data['email']
    password = data['password']

    if email in users:
        return jsonify({'error': 'User already exists'}), 400

    users[email] = {'password': password}
    expenses[email] = []
    return jsonify({'message': 'User registered successfully'})

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data['email']
    password = data['password']

    user = users.get(email)
    if not user or user['password'] != password:
        return jsonify({'error': 'Invalid credentials'}), 401

    session_token = generate_id()
    sessions[session_token] = email
    return jsonify({'token': session_token})

# ------------------- Expense Routes -------------------

@app.route('/expenses', methods=['GET'])
def get_expenses():
    token = request.headers.get('Authorization')
    email = sessions.get(token)

    if not email:
        return jsonify({'error': 'Unauthorized'}), 401

    return jsonify(expenses[email])

@app.route('/expenses', methods=['POST'])
def add_expense():
    token = request.headers.get('Authorization')
    email = sessions.get(token)

    if not email:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.json
    new_expense = {
        'id': generate_id(),
        'title': data['title'],
        'amount': float(data['amount']),
        'date': data['date']
    }

    expenses[email].append(new_expense)
    return jsonify(new_expense)

@app.route('/expenses/<expense_id>', methods=['DELETE'])
def delete_expense(expense_id):
    token = request.headers.get('Authorization')
    email = sessions.get(token)

    if not email:
        return jsonify({'error': 'Unauthorized'}), 401

    updated = [e for e in expenses[email] if e['id'] != expense_id]
    expenses[email] = updated
    return jsonify({'message': 'Expense deleted'})

# ------------------- Run Server -------------------

if __name__ == '__main__':
    app.run(debug=True)
