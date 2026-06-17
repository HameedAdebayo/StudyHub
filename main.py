from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import os
import uuid
import pg8000
from datetime import datetime
import cloudinary
import cloudinary.uploader
import cloudinary.api

# Cloudinary config
cloudinary.config(
    cloud_name="dgc1s5qha",
    api_key="574412939974831",
    api_secret="d6HCN3DXh08jLM90GEmuBCSzGOc"
)

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'studyhub-secret-key-change-in-production')

# Session config for cross-origin cookies
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SECURE'] = True

# CORS - allow your Netlify frontend
CORS(app, supports_credentials=True, resources={
    r"/api/*": {
        "origins": [
            "https://stellular-heliotrope-8bb980.netlify.app",
            "http://localhost:5500",
            "http://127.0.0.1:5500",
            "http://localhost:5000",
            "http://127.0.0.1:5000"
        ],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# Database URL from Render
DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://studyhub_db_391e_user:cmmV6TF5rliapeTbezWQxI8bNMj9Ec4D@dpg-d8p9ihj6sc1c73cgvblg-a/studyhub_db_391e')

def get_db():
    conn = pg8000.dbapi.connect(DATABASE_URL)
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id VARCHAR(255) PRIMARY KEY,
            first_name VARCHAR(255) NOT NULL,
            last_name VARCHAR(255) NOT NULL,
            user_name VARCHAR(255) UNIQUE NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            phone VARCHAR(255),
            password VARCHAR(255) NOT NULL,
            created_at TIMESTAMP NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS materials (
            id VARCHAR(255) PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            course_name VARCHAR(255) NOT NULL,
            course_code VARCHAR(255) NOT NULL,
            category VARCHAR(255) NOT NULL,
            description TEXT,
            file_name VARCHAR(255) NOT NULL,
            file_type VARCHAR(255),
            file_size INTEGER,
            cloudinary_url VARCHAR(500) NOT NULL,
            cloudinary_public_id VARCHAR(255),
            uploader_id VARCHAR(255) NOT NULL,
            uploader_name VARCHAR(255),
            upload_date TIMESTAMP NOT NULL,
            downloads INTEGER DEFAULT 0
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS study_groups (
            id VARCHAR(255) PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            members INTEGER DEFAULT 0,
            created_at TIMESTAMP NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS group_memberships (
            user_id VARCHAR(255) NOT NULL,
            group_id VARCHAR(255) NOT NULL,
            joined_at TIMESTAMP NOT NULL,
            PRIMARY KEY (user_id, group_id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS contact_messages (
            id VARCHAR(255) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            sent_at TIMESTAMP NOT NULL
        )
    """)

    cursor.execute("SELECT COUNT(*) FROM study_groups")
    if cursor.fetchone()[0] == 0:
        default_groups = [
            (str(uuid.uuid4()), "CSC Study Group", "Weekly algorithm & coding challenges. All levels welcome!", 0, datetime.now()),
            (str(uuid.uuid4()), "ECO Study Group", "Micro & Macro economics discussions + past question solving.", 0, datetime.now()),
            (str(uuid.uuid4()), "Math Problem Solving", "Calculus, Algebra, Statistics help every Tuesday 7PM.", 0, datetime.now()),
        ]
        cursor.executemany(
            "INSERT INTO study_groups (id, title, description, members, created_at) VALUES (%s, %s, %s, %s, %s)",
            default_groups
        )

    conn.commit()
    cursor.close()
    conn.close()

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.get_json()
    required = ['first_name', 'last_name', 'user_name', 'email', 'password']
    for field in required:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE user_name = %s OR email = %s", (data['user_name'], data['email']))
    if cursor.fetchone():
        cursor.close()
        conn.close()
        return jsonify({'error': 'Username or email already exists'}), 409

    user_id = str(uuid.uuid4())
    hashed_password = generate_password_hash(data['password'])

    cursor.execute("""
        INSERT INTO users (user_id, first_name, last_name, user_name, email, phone, password, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (user_id, data['first_name'], data['last_name'], data['user_name'],
          data['email'], data.get('phone', ''), hashed_password, datetime.now()))

    conn.commit()
    cursor.close()
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
    cursor.execute("SELECT * FROM users WHERE user_name = %s OR email = %s", (identifier, identifier))
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    if not user or not check_password_hash(user[6], password):
        return jsonify({'error': 'Invalid credentials'}), 401

    session['user_id'] = user[0]
    session['user_name'] = user[3]
    session.permanent = True

    return jsonify({'message': 'Login successful', 'user': {
        'user_id': user[0], 'first_name': user[1],
        'last_name': user[2], 'user_name': user[3],
        'email': user[4], 'phone': user[5]
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
    cursor.execute("SELECT * FROM users WHERE user_id = %s", (session['user_id'],))
    user = cursor.fetchone()
    cursor.close()
    conn.close()

    if not user:
        session.clear()
        return jsonify({'user': None}), 401

    return jsonify({'user': {
        'user_id': user[0], 'first_name': user[1],
        'last_name': user[2], 'user_name': user[3],
        'email': user[4], 'phone': user[5]
    }})

@app.route('/api/materials', methods=['GET'])
def get_materials():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM materials ORDER BY upload_date DESC")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    materials = []
    for row in rows:
        materials.append({
            'id': row[0], 'title': row[1], 'courseName': row[2],
            'courseCode': row[3], 'category': row[4],
            'description': row[5], 'fileName': row[6],
            'fileType': row[7], 'fileSize': row[8],
            'downloadURL': row[9], 'cloudinaryPublicId': row[10],
            'uploaderId': row[11], 'uploaderName': row[12],
            'uploadDate': row[13].isoformat() if row[13] else None, 'downloads': row[14]
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

    title = request.form.get('title')
    course_name = request.form.get('courseName')
    course_code = request.form.get('courseCode')
    category = request.form.get('category')
    description = request.form.get('description', '')

    if not all([title, course_name, course_code, category]):
        return jsonify({'error': 'Missing required fields'}), 400

    # Upload to Cloudinary
    try:
        upload_result = cloudinary.uploader.upload(
            file,
            resource_type="auto",
            folder="studyhub"
        )
        cloudinary_url = upload_result['secure_url']
        public_id = upload_result['public_id']
    except Exception as e:
        return jsonify({'error': f'Cloudinary upload failed: {str(e)}'}), 500

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT first_name, last_name FROM users WHERE user_id = %s", (session['user_id'],))
    user = cursor.fetchone()
    uploader_name = f"{user[0]} {user[1]}" if user else "Anonymous"

    material_id = str(uuid.uuid4())
    cursor.execute("""
        INSERT INTO materials (id, title, course_name, course_code, category, description,
            file_name, file_type, file_size, cloudinary_url, cloudinary_public_id, uploader_id, uploader_name, upload_date, downloads)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """, (material_id, title, course_name, course_code, category, description,
          file.filename, file.content_type, 0, cloudinary_url, public_id,
          session['user_id'], uploader_name, datetime.now(), 0))

    conn.commit()
    cursor.close()
    conn.close()

    return jsonify({'message': 'Upload successful', 'material': {'id': material_id, 'title': title}})

@app.route('/api/materials/<material_id>/download', methods=['POST'])
def increment_download(material_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE materials SET downloads = downloads + 1 WHERE id = %s", (material_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({'message': 'Download counted'})

@app.route('/api/materials/<material_id>', methods=['DELETE'])
def delete_material(material_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Please login'}), 401

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM materials WHERE id = %s", (material_id,))
    material = cursor.fetchone()

    if not material:
        cursor.close()
        conn.close()
        return jsonify({'error': 'Material not found'}), 404
    if material[11] != session['user_id']:
        cursor.close()
        conn.close()
        return jsonify({'error': 'Not authorized'}), 403

    # Delete from Cloudinary
    try:
        cloudinary.uploader.destroy(material[10])
    except:
        pass

    cursor.execute("DELETE FROM materials WHERE id = %s", (material_id,))
    conn.commit()
    cursor.close()
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
        cursor.execute("SELECT group_id FROM group_memberships WHERE user_id = %s", (user_id,))
        joined_groups = {row[0] for row in cursor.fetchall()}

    cursor.close()
    conn.close()

    groups = []
    for row in rows:
        groups.append({'id': row[0], 'title': row[1], 'description': row[2],
                       'members': row[3], 'joined': row[0] in joined_groups})
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
    cursor.execute("INSERT INTO study_groups (id, title, description, members, created_at) VALUES (%s, %s, %s, %s, %s)",
                   (group_id, name, "Newly created group - be the first to join!", 1, datetime.now()))
    cursor.execute("INSERT INTO group_memberships (user_id, group_id, joined_at) VALUES (%s, %s, %s)",
                   (session['user_id'], group_id, datetime.now()))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({'message': 'Group created', 'group': {'id': group_id, 'title': name}})

@app.route('/api/groups/<group_id>/join', methods=['POST'])
def join_group(group_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Please login'}), 401

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM group_memberships WHERE user_id = %s AND group_id = %s",
                   (session['user_id'], group_id))
    if cursor.fetchone():
        cursor.close()
        conn.close()
        return jsonify({'error': 'Already joined'}), 409

    cursor.execute("INSERT INTO group_memberships (user_id, group_id, joined_at) VALUES (%s, %s, %s)",
                   (session['user_id'], group_id, datetime.now()))
    cursor.execute("UPDATE study_groups SET members = members + 1 WHERE id = %s", (group_id,))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({'message': 'Joined group'})

@app.route('/api/groups/<group_id>/leave', methods=['POST'])
def leave_group(group_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Please login'}), 401

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM group_memberships WHERE user_id = %s AND group_id = %s",
                   (session['user_id'], group_id))
    if cursor.rowcount > 0:
        cursor.execute("UPDATE study_groups SET members = members - 1 WHERE id = %s", (group_id,))
    conn.commit()
    cursor.close()
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
    cursor.execute("INSERT INTO contact_messages (id, name, email, message, sent_at) VALUES (%s, %s, %s, %s, %s)",
                   (str(uuid.uuid4()), name, email, message, datetime.now()))
    conn.commit()
    cursor.close()
    conn.close()
    return jsonify({'message': 'Message sent successfully'})

@app.route('/api/contact/messages', methods=['GET'])
def get_contact_messages():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM contact_messages ORDER BY sent_at DESC")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    messages = []
    for row in rows:
        messages.append({'id': row[0], 'name': row[1], 'email': row[2],
                         'message': row[3], 'sent_at': row[4].isoformat() if row[4] else None})
    return jsonify({'messages': messages})

@app.route('/api/export/users', methods=['GET'])
def export_users_json():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT user_id, first_name, last_name, user_name, email, phone, created_at FROM users")
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    users = []
    for row in rows:
        users.append({'user_id': row[0], 'first_name': row[1],
                      'last_name': row[2], 'user_name': row[3],
                      'email': row[4], 'phone': row[5], 'created_at': row[6].isoformat() if row[6] else None})
    return jsonify({'users': users})

@app.route('/api/export/user/<user_id>', methods=['GET'])
def export_user_json(user_id):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE user_id = %s", (user_id,))
    user = cursor.fetchone()

    if not user:
        cursor.close()
        conn.close()
        return jsonify({'error': 'User not found'}), 404

    cursor.execute("SELECT id FROM materials WHERE uploader_id = %s", (user_id,))
    materials = [row[0] for row in cursor.fetchall()]
    cursor.close()
    conn.close()

    return jsonify({
        'user_id': user[0], 'first_name': user[1],
        'last_name': user[2], 'user_name': user[3],
        'email': user[4], 'phone': user[5],
        'created_at': user[6].isoformat() if user[6] else None, 'materials_id': materials
    })

if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)