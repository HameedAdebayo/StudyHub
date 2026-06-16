from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import sqlite3
import os
import uuid
from datetime import datetime

app = Flask(__name__)
app.secret_key = 'studyhub-secret-key-change-in-production'

# CRITICAL: Session cookie config for cross-origin (frontend on different port)
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = False

# CORS configuration - allow all localhost ports for development
from flask_cors import cross_origin

# We'll use after_request to dynamically set CORS headers for localhost
@app.after_request
def after_request(response):
    origin = request.headers.get('Origin')
    if origin and ('localhost' in origin or '127.0.0.1' in origin):
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    return response

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'txt', 'zip'}
MAX_CONTENT_LENGTH = 25 * 1024 * 1024

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def get_db():
    conn = sqlite3.connect('studyhub.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            user_name TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            phone TEXT,
            password TEXT NOT NULL,
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS materials (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            course_name TEXT NOT NULL,
            course_code TEXT NOT NULL,
            category TEXT NOT NULL,
            description TEXT,
            file_name TEXT NOT NULL,
            file_type TEXT,
            file_size INTEGER,
            storage_path TEXT NOT NULL,
            uploader_id TEXT NOT NULL,
            uploader_name TEXT,
            upload_date TEXT NOT NULL,
            downloads INTEGER DEFAULT 0
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS study_groups (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            members INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS group_memberships (
            user_id TEXT NOT NULL,
            group_id TEXT NOT NULL,
            joined_at TEXT NOT NULL,
            PRIMARY KEY (user_id, group_id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS contact_messages (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            message TEXT NOT NULL,
            sent_at TEXT NOT NULL
        )
    """)

    cursor.execute("SELECT COUNT(*) FROM study_groups")
    if cursor.fetchone()[0] == 0:
        default_groups = [
            (str(uuid.uuid4()), "CSC Study Group", "Weekly algorithm & coding challenges. All levels welcome!", 0, datetime.now().isoformat()),
            (str(uuid.uuid4()), "ECO Study Group", "Micro & Macro economics discussions + past question solving.", 0, datetime.now().isoformat()),
            (str(uuid.uuid4()), "Math Problem Solving", "Calculus, Algebra, Statistics help every Tuesday 7PM.", 0, datetime.now().isoformat()),
        ]
        cursor.executemany(
            "INSERT INTO study_groups (id, title, description, members, created_at) VALUES (?, ?, ?, ?, ?)",
            default_groups
        )

    conn.commit()
    conn.close()

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    required = ['first_name', 'last_name', 'user_name', 'email', 'password']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE user_name = ? OR email = ?", (data['user_name'], data['email']))
    if cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Username or email already exists'}), 409

    user_id = str(uuid.uuid4())
    hashed_password = generate_password_hash(data['password'])

    cursor.execute("""
        INSERT INTO users (user_id, first_name, last_name, user_name, email, phone, password, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (user_id, data['first_name'], data['last_name'], data['user_name'],
          data['email'], data.get('phone', ''), hashed_password, datetime.now().isoformat()))

    conn.commit()
    conn.close()

    return jsonify({'message': 'Account created successfully', 'user': {'user_id': user_id, 'user_name': data['user_name'], 'email': data['email']}}), 201

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    identifier = data.get('identifier')
    password = data.get('password')

    if not identifier or not password:
        return jsonify({'error': 'Username/email and password are required'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE user_name = ? OR email = ?", (identifier, identifier))
    user = cursor.fetchone()
    conn.close()

    if not user or not check_password_hash(user['password'], password):
        return jsonify({'error': 'Invalid credentials'}), 401

    session['user_id'] = user['user_id']
    session['user_name'] = user['user_name']
    session.permanent = True

    return jsonify({'message': 'Login successful', 'user': {
        'user_id': user['user_id'], 'first_name': user['first_name'],
        'last_name': user['last_name'], 'user_name': user['user_name'],
        'email': user['email'], 'phone': user['phone']
    }})

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out successfully'})

@app.route('/api/me', methods=['GET'])
def get_current_user():
    if 'user_id' not in session:
        return jsonify({'user': None}), 401

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE user_id = ?", (session['user_id'],))
    user = cursor.fetchone()
    conn.close()

    if not user:
        session.clear()
        return jsonify({'user': None}), 401

    return jsonify({'user': {
        'user_id': user['user_id'], 'first_name': user['first_name'],
        'last_name': user['last_name'], 'user_name': user['user_name'],
        'email': user['email'], 'phone': user['phone']
    }})

@app.route('/api/materials', methods=['GET'])
def get_materials():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM materials ORDER BY upload_date DESC")
    rows = cursor.fetchall()
    conn.close()

    materials = []
    for row in rows:
        materials.append({
            'id': row['id'], 'title': row['title'], 'courseName': row['course_name'],
            'courseCode': row['course_code'], 'category': row['category'],
            'description': row['description'], 'fileName': row['file_name'],
            'fileType': row['file_type'], 'fileSize': row['file_size'],
            'storagePath': row['storage_path'], 'downloadURL': f"/api/download/{row['storage_path']}",
            'uploaderId': row['uploader_id'], 'uploaderName': row['uploader_name'],
            'uploadDate': row['upload_date'], 'downloads': row['downloads']
        })
    return jsonify({'materials': materials})

@app.route('/api/upload', methods=['POST'])
def upload_material():
    if 'user_id' not in session:
        return jsonify({'error': 'Please login to upload'}), 401

    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed'}), 400

    title = request.form.get('title')
    course_name = request.form.get('courseName')
    course_code = request.form.get('courseCode')
    category = request.form.get('category')
    description = request.form.get('description', '')

    if not all([title, course_name, course_code, category]):
        return jsonify({'error': 'Missing required fields'}), 400

    filename = secure_filename(file.filename)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    unique_filename = f"{timestamp}_{filename}"
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
    file.save(file_path)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT first_name, last_name FROM users WHERE user_id = ?", (session['user_id'],))
    user = cursor.fetchone()
    uploader_name = f"{user['first_name']} {user['last_name']}" if user else "Anonymous"

    material_id = str(uuid.uuid4())
    cursor.execute("""
        INSERT INTO materials (id, title, course_name, course_code, category, description,
            file_name, file_type, file_size, storage_path, uploader_id, uploader_name, upload_date, downloads)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (material_id, title, course_name, course_code, category, description,
          filename, file.content_type, os.path.getsize(file_path), unique_filename,
          session['user_id'], uploader_name, datetime.now().isoformat(), 0))

    conn.commit()
    conn.close()

    return jsonify({'message': 'Upload successful', 'material': {'id': material_id, 'title': title}})

@app.route('/api/download/<path:filename>')
def download_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename, as_attachment=True)

@app.route('/api/materials/<material_id>/download', methods=['POST'])
def increment_download(material_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE materials SET downloads = downloads + 1 WHERE id = ?", (material_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Download counted'})

@app.route('/api/materials/<material_id>', methods=['DELETE'])
def delete_material(material_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Please login'}), 401

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM materials WHERE id = ?", (material_id,))
    material = cursor.fetchone()

    if not material:
        conn.close()
        return jsonify({'error': 'Material not found'}), 404
    if material['uploader_id'] != session['user_id']:
        conn.close()
        return jsonify({'error': 'Not authorized'}), 403

    file_path = os.path.join(app.config['UPLOAD_FOLDER'], material['storage_path'])
    if os.path.exists(file_path):
        os.remove(file_path)

    cursor.execute("DELETE FROM materials WHERE id = ?", (material_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Material deleted'})

@app.route('/api/groups', methods=['GET'])
def get_groups():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM study_groups ORDER BY created_at DESC")
    rows = cursor.fetchall()

    user_id = session.get('user_id')
    joined_groups = set()
    if user_id:
        cursor.execute("SELECT group_id FROM group_memberships WHERE user_id = ?", (user_id,))
        joined_groups = {row['group_id'] for row in cursor.fetchall()}

    conn.close()

    groups = []
    for row in rows:
        groups.append({'id': row['id'], 'title': row['title'], 'description': row['description'],
                       'members': row['members'], 'joined': row['id'] in joined_groups})
    return jsonify({'groups': groups})

@app.route('/api/groups', methods=['POST'])
def create_group():
    if 'user_id' not in session:
        return jsonify({'error': 'Please login to create a group'}), 401

    data = request.get_json()
    name = data.get('name')
    if not name:
        return jsonify({'error': 'Group name is required'}), 400

    group_id = str(uuid.uuid4())
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO study_groups (id, title, description, members, created_at) VALUES (?, ?, ?, ?, ?)",
                   (group_id, name, "Newly created group - be the first to join!", 1, datetime.now().isoformat()))
    cursor.execute("INSERT INTO group_memberships (user_id, group_id, joined_at) VALUES (?, ?, ?)",
                   (session['user_id'], group_id, datetime.now().isoformat()))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Group created', 'group': {'id': group_id, 'title': name}})

@app.route('/api/groups/<group_id>/join', methods=['POST'])
def join_group(group_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Please login'}), 401

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM group_memberships WHERE user_id = ? AND group_id = ?",
                   (session['user_id'], group_id))
    if cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Already joined'}), 409

    cursor.execute("INSERT INTO group_memberships (user_id, group_id, joined_at) VALUES (?, ?, ?)",
                   (session['user_id'], group_id, datetime.now().isoformat()))
    cursor.execute("UPDATE study_groups SET members = members + 1 WHERE id = ?", (group_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Joined group'})

@app.route('/api/groups/<group_id>/leave', methods=['POST'])
def leave_group(group_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Please login'}), 401

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM group_memberships WHERE user_id = ? AND group_id = ?",
                   (session['user_id'], group_id))
    if cursor.rowcount > 0:
        cursor.execute("UPDATE study_groups SET members = members - 1 WHERE id = ?", (group_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Left group'})

@app.route('/api/contact', methods=['POST'])
def contact():
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    message = data.get('message')

    if not all([name, email, message]):
        return jsonify({'error': 'All fields are required'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO contact_messages (id, name, email, message, sent_at) VALUES (?, ?, ?, ?, ?)",
                   (str(uuid.uuid4()), name, email, message, datetime.now().isoformat()))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Message sent successfully'})

@app.route('/api/contact/messages', methods=['GET'])
def get_contact_messages():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM contact_messages ORDER BY sent_at DESC")
    rows = cursor.fetchall()
    conn.close()

    messages = []
    for row in rows:
        messages.append({'id': row['id'], 'name': row['name'], 'email': row['email'],
                         'message': row['message'], 'sent_at': row['sent_at']})
    return jsonify({'messages': messages})

@app.route('/api/export/users', methods=['GET'])
def export_users_json():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT user_id, first_name, last_name, user_name, email, phone, created_at FROM users")
    rows = cursor.fetchall()
    conn.close()

    users = []
    for row in rows:
        users.append({'user_id': row['user_id'], 'first_name': row['first_name'],
                      'last_name': row['last_name'], 'user_name': row['user_name'],
                      'email': row['email'], 'phone': row['phone'], 'created_at': row['created_at']})
    return jsonify({'users': users})

@app.route('/api/export/user/<user_id>', methods=['GET'])
def export_user_json(user_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE user_id = ?", (user_id,))
    user = cursor.fetchone()

    if not user:
        conn.close()
        return jsonify({'error': 'User not found'}), 404

    cursor.execute("SELECT id FROM materials WHERE uploader_id = ?", (user_id,))
    materials = [row['id'] for row in cursor.fetchall()]
    conn.close()

    return jsonify({
        'user_id': user['user_id'], 'first_name': user['first_name'],
        'last_name': user['last_name'], 'user_name': user['user_name'],
        'email': user['email'], 'phone': user['phone'],
        'created_at': user['created_at'], 'materials_id': materials
    })

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)





