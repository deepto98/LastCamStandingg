from app import db
from datetime import datetime

class MediaFile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    file_path = db.Column(db.String(512), nullable=False)
    media_type = db.Column(db.String(10), nullable=False)  # 'image' or 'video'
    ip_address = db.Column(db.String(45), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)
    expiration_time = db.Column(db.DateTime, nullable=False)
