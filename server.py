import os
import sqlite3
import json
import google.generativeai as genai
from functools import wraps
from flask import Flask, request, jsonify, send_from_directory, session
from flask_cors import CORS
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash
import urllib.parse

# Load environment variables
load_dotenv()

# Configure Gemini
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

app = Flask(__name__, static_folder='.')
app.secret_key = os.getenv('SECRET_KEY', 'dev-secret-change-in-production')
CORS(app, supports_credentials=True)

DB_PATH = os.getenv('DATABASE_PATH', 'expenses.db')
DATABASE_URL = os.getenv('DATABASE_URL')

# --- Database Abstraction ---

class DBConnection:
    def __init__(self, db_url=None):
        self.db_url = db_url
        self.conn = None
        self.is_postgres = bool(db_url)

    def __enter__(self):
        if self.is_postgres:
            import psycopg2
            from psycopg2.extras import RealDictCursor
            try:
                self.conn = psycopg2.connect(self.db_url, cursor_factory=RealDictCursor)
            except Exception as e:
                print(f"Error connecting to Postgres: {e}")
                raise
        else:
            self.conn = sqlite3.connect(DB_PATH)
            self.conn.row_factory = sqlite3.Row
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.conn:
            if exc_type:
                self.conn.rollback()
            else:
                self.conn.commit()
            self.conn.close()

    def execute(self, sql, params=None):
        if params is None:
            params = ()
        
        # Convert SQLite ? placeholders to Postgres %s if needed
        if self.is_postgres:
            sql = sql.replace('?', '%s')
        
        cursor = self.conn.cursor()
        try:
            cursor.execute(sql, params)
            return cursor
        except Exception as e:
            print(f"Query Error: {e} | SQL: {sql}")
            raise

def get_db():
    return DBConnection(DATABASE_URL)

def init_db():
    # Use the context manager to ensure commit/close
    with get_db() as db:
        if db.is_postgres:
            # PostgreSQL Schema
            db.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    role TEXT DEFAULT 'user',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            db.execute('''
                CREATE TABLE IF NOT EXISTS storage_new (
                    user_id INTEGER NOT NULL,
                    key TEXT NOT NULL,
                    value TEXT,
                    PRIMARY KEY (user_id, key),
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            ''')
        else:
             # SQLite Schema
            db.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    role TEXT DEFAULT 'user',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            db.execute('''
                CREATE TABLE IF NOT EXISTS storage_new (
                    user_id INTEGER NOT NULL,
                    key TEXT NOT NULL,
                    value TEXT,
                    PRIMARY KEY (user_id, key),
                    FOREIGN KEY (user_id) REFERENCES users(id)
                )
            ''')

# --- Auth Decorator ---

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated

# --- Static File Serving ---

@app.route('/')
def serve_index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory('.', path)

# --- Authentication Endpoints ---

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400
        
    try:
        with get_db() as db:
            db.execute(
                'INSERT INTO users (username, password_hash) VALUES (?, ?)',
                (username, generate_password_hash(password))
            )
            # Fetch the created user
            user = db.execute('SELECT id, username, role FROM users WHERE username = ?', (username,)).fetchone()
            # In Postgres RealDictCursor returns dict, SQLite returns Row (dict-like)
            # Standardize to dict
            user_dict = dict(user)
            
            # Set session
            session['user_id'] = user_dict['id']
            session['username'] = user_dict['username']
            
            return jsonify({"status": "success", "user": user_dict})
    except Exception as e:
        # Check for integrity error (duplicate username)
        if "UNIQUE constraint failed" in str(e) or "duplicate key value" in str(e):
             return jsonify({"error": "Username already exists"}), 400
        print(f"Register Error: {e}")
        return jsonify({"error": "Registration failed"}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    with get_db() as db:
        user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
        if user and check_password_hash(user['password_hash'], password):
            # Set session
            session['user_id'] = user['id']
            session['username'] = user['username']
            
            return jsonify({
                "status": "success",
                "user": {
                    "id": user['id'],
                    "username": user['username'],
                    "role": user['role']
                }
            })
    return jsonify({"error": "Invalid username or password"}), 401

@app.route('/api/auth/session', methods=['GET'])
def check_session():
    """Check if user has an active session"""
    if 'user_id' in session:
        return jsonify({
            "authenticated": True,
            "user": {
                "id": session['user_id'],
                "username": session['username']
            }
        })
    return jsonify({"authenticated": False}), 401

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"status": "success"})

# --- Storage Endpoints (Session-Protected) ---

@app.route('/api/storage/<key>', methods=['GET'])
@login_required
def get_data(key):
    user_id = session['user_id']
        
    with get_db() as db:
        row = db.execute('SELECT value FROM storage_new WHERE user_id = ? AND key = ?', (user_id, key)).fetchone()
        if row:
            return jsonify(json.loads(row['value']))
        return jsonify(None)

@app.route('/api/storage', methods=['POST'])
@login_required
def set_data():
    data = request.json
    key = data.get('key')
    value = json.dumps(data.get('value'))
    user_id = session['user_id']
        
    with get_db() as db:
        if db.is_postgres:
            # Postgres upsert
            db.execute('''
                INSERT INTO storage_new (user_id, key, value) 
                VALUES (?, ?, ?) 
                ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value
            ''', (user_id, key, value))
        else:
            # SQLite upsert
            db.execute('''
                INSERT INTO storage_new (user_id, key, value) 
                VALUES (?, ?, ?) 
                ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value
            ''', (user_id, key, value))
    return jsonify({"status": "success"})

@app.route('/api/storage/<key>', methods=['DELETE'])
@login_required
def remove_data(key):
    user_id = session['user_id']
        
    with get_db() as db:
        db.execute('DELETE FROM storage_new WHERE user_id = ? AND key = ?', (user_id, key))
    return jsonify({"status": "success"})

# --- AI Chat Endpoint ---

@app.route('/api/chat', methods=['POST'])
@login_required
def chat():
    if not GEMINI_API_KEY:
        return jsonify({"error": "Gemini API key not configured"}), 500
    
    data = request.json
    system_context = data.get('system_context', '')
    user_message = data.get('message', '')
    
    try:
        model = genai.GenerativeModel(
            model_name='gemini-flash-latest',
            system_instruction=system_context
        )
        response = model.generate_content(user_message)
        return jsonify({"response": response.text})
    except Exception as e:
        print(f"Gemini API Error: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    # Initialize DB creates tables if they don't exist
    try:
        init_db()
    except Exception as e:
        print(f"Database initialization error: {e}")

    port = int(os.getenv('PORT', 8080))
    debug = os.getenv('FLASK_ENV', 'development') == 'development'
    
    # If using Render, debug is likely False. 
    # If running locally with SQLite, we might want Debug=True
    
    print(f"WealthFlow Expense Tracker running at http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=debug)
