import os
from datetime import datetime, timedelta
from flask import Flask, render_template, request, jsonify, send_file
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
import logging
from threading import Lock

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

# Global storage tracker with thread safety
storage_tracker = {}
storage_lock = Lock()

def update_storage_usage(ip_address, file_size, action='add'):
    """
    Update storage usage for an IP address
    action: 'add' or 'remove'
    """
    with storage_lock:
        current_usage = storage_tracker.get(ip_address, 0)
        if action == 'add':
            storage_tracker[ip_address] = current_usage + file_size
        else:  # remove
            storage_tracker[ip_address] = max(0, current_usage - file_size)

def get_storage_usage(ip_address):
    """Get current storage usage for an IP address"""
    with storage_lock:
        return storage_tracker.get(ip_address, 0)

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

    # Check storage quota using the storage tracker
    current_usage = get_storage_usage(client_ip)
    file_size = len(file.read())

    if current_usage + file_size > MAX_STORAGE_PER_IP:
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
        file_size=file_size,
        expiration_time=datetime.now() + timedelta(hours=EXPIRATION_HOURS)
    )

    db.session.add(media_file)
    db.session.commit()

    # Update storage tracker
    update_storage_usage(client_ip, file_size, 'add')

    return jsonify({
        'id': media_file.id,
        'url': f'/media/{media_file.id}',
        'type': media_type,
        'size': media_file.file_size,
        'expiration_time': media_file.expiration_time.isoformat()
    })

@app.route('/api/media')
def get_media_list():
    client_ip = request.remote_addr
    media_ids = request.args.getlist('ids[]')

    # Get storage usage from tracker
    current_usage = get_storage_usage(client_ip)

    # Get media files by IDs if provided
    media_files = []
    if media_ids:
        try:
            # Convert IDs to integers and fetch only those files
            id_list = [int(id) for id in media_ids]
            media_files = MediaFile.query.filter(MediaFile.id.in_(id_list)).all()
        except ValueError:
            return jsonify({'error': 'Invalid media ID format'}), 400

    # Return both the requested media files and the storage info
    return jsonify({
        'files': [{
            'id': media.id,
            'type': media.media_type,
            'url': f'/media/{media.id}',
            'size': media.file_size,
            'expiration_time': media.expiration_time.isoformat()
        } for media in media_files],
        'storage': {
            'used': current_usage,
            'total': MAX_STORAGE_PER_IP,
            'percentage': (current_usage / MAX_STORAGE_PER_IP) * 100
        }
    })

@app.route('/media/<int:media_id>')
def get_media(media_id):
    media = MediaFile.query.get_or_404(media_id)

    if datetime.now() > media.expiration_time:
        return jsonify({'error': 'Media has expired'}), 410

    return send_file(media.file_path)

@app.route('/view/<int:media_id>')
def view_media(media_id):
    media = MediaFile.query.get_or_404(media_id)

    if datetime.now() > media.expiration_time:
        return jsonify({'error': 'Media has expired'}), 410

    return render_template('media_view.html', media=media)


# Cleanup expired files and update storage tracker
@app.before_request
def cleanup_expired():
    expired_files = MediaFile.query.filter(MediaFile.expiration_time < datetime.now()).all()

    for media in expired_files:
        try:
            # Update storage tracker before deleting
            update_storage_usage(media.ip_address, media.file_size, 'remove')

            os.remove(media.file_path)
            db.session.delete(media)
        except OSError:
            pass

    db.session.commit()

# Initialize storage tracker with existing files
with app.app_context():
    db.create_all()

    # Initialize storage tracker with existing files
    active_files = MediaFile.query.filter(MediaFile.expiration_time > datetime.now()).all()
    for media in active_files:
        update_storage_usage(media.ip_address, media.file_size, 'add')