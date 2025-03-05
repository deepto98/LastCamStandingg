import os
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
import logging

logging.basicConfig(level=logging.DEBUG)

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev_secret_key")

# Configure SQLite database
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///camera.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db.init_app(app)

# Import models after db initialization
from models import MediaFile

# Constants
UPLOAD_FOLDER = 'uploads'
MAX_STORAGE_PER_IP = 100 * 1024 * 1024  # 100MB
EXPIRATION_HOURS = 24

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/gallery')
def gallery():
    return render_template('gallery.html')

@app.route('/api/upload', methods=['POST'])
def upload_media():
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400

    file = request.files['file']
    media_type = request.form.get('type', 'image')
    client_ip = request.remote_addr

    # Check storage quota
    used_storage = db.session.query(db.func.sum(MediaFile.file_size))\
        .filter_by(ip_address=client_ip)\
        .scalar() or 0

    if used_storage + len(file.read()) > MAX_STORAGE_PER_IP:
        return jsonify({'error': 'Storage quota exceeded'}), 400
    
    file.seek(0)  # Reset file pointer after reading

    # Generate unique filename
    filename = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{os.urandom(4).hex()}"
    file_path = os.path.join(UPLOAD_FOLDER, filename)
    
    # Save file
    file.save(file_path)
    
    # Create database entry
    media_file = MediaFile(
        filename=filename,
        file_path=file_path,
        media_type=media_type,
        ip_address=client_ip,
        file_size=os.path.getsize(file_path),
        expiration_time=datetime.now() + timedelta(hours=EXPIRATION_HOURS)
    )
    
    db.session.add(media_file)
    db.session.commit()

    return jsonify({
        'id': media_file.id,
        'url': f'/media/{media_file.id}'
    })

@app.route('/api/media')
def get_media_list():
    client_ip = request.remote_addr
    media_files = MediaFile.query.filter_by(ip_address=client_ip).all()
    
    return jsonify([{
        'id': media.id,
        'type': media.media_type,
        'url': f'/media/{media.id}',
        'expiration_time': media.expiration_time.isoformat()
    } for media in media_files])

@app.route('/media/<int:media_id>')
def get_media(media_id):
    media = MediaFile.query.get_or_404(media_id)
    
    if datetime.now() > media.expiration_time:
        return jsonify({'error': 'Media has expired'}), 410
    
    return send_file(media.file_path)

# Cleanup expired files
@app.before_request
def cleanup_expired():
    expired_files = MediaFile.query.filter(MediaFile.expiration_time < datetime.now()).all()
    
    for media in expired_files:
        try:
            os.remove(media.file_path)
            db.session.delete(media)
        except OSError:
            pass
    
    db.session.commit()

with app.app_context():
    db.create_all()
