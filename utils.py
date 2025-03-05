import os
import logging
from datetime import datetime
import magic
from werkzeug.utils import secure_filename

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Constants
ALLOWED_IMAGE_MIMETYPES = {'image/jpeg', 'image/png', 'image/gif'}
ALLOWED_VIDEO_MIMETYPES = {'video/mp4', 'video/webm', 'video/x-matroska'}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB per file

class StorageError(Exception):
    """Custom exception for storage-related errors"""
    pass

def get_file_mimetype(file_path):
    """
    Detect file mimetype using python-magic
    """
    try:
        mime = magic.Magic(mime=True)
        return mime.from_file(file_path)
    except Exception as e:
        logger.error(f"Error detecting mimetype: {e}")
        return None

def validate_file(file_path, media_type):
    """
    Validate file type and size
    """
    # Check file size
    file_size = os.path.getsize(file_path)
    if file_size > MAX_FILE_SIZE:
        raise StorageError(f"File size exceeds maximum limit of {MAX_FILE_SIZE/1024/1024}MB")

    # Check mimetype
    mimetype = get_file_mimetype(file_path)
    if not mimetype:
        raise StorageError("Could not determine file type")

    if media_type == 'image' and mimetype not in ALLOWED_IMAGE_MIMETYPES:
        raise StorageError(f"Invalid image format. Allowed types: {ALLOWED_IMAGE_MIMETYPES}")
    elif media_type == 'video' and mimetype not in ALLOWED_VIDEO_MIMETYPES:
        raise StorageError(f"Invalid video format. Allowed types: {ALLOWED_VIDEO_MIMETYPES}")

def get_safe_filename(filename):
    """
    Generate a safe filename while preserving extension
    """
    name, ext = os.path.splitext(filename)
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    safe_name = secure_filename(f"{name}_{timestamp}{ext}")
    return safe_name

def calculate_storage_usage(ip_address, db_session, MediaFile):
    """
    Calculate current storage usage for an IP address
    """
    try:
        total_size = db_session.query(db_session.func.sum(MediaFile.file_size))\
            .filter_by(ip_address=ip_address)\
            .scalar() or 0
        return total_size
    except Exception as e:
        logger.error(f"Error calculating storage usage: {e}")
        return 0

def cleanup_expired_files(upload_folder, db_session, MediaFile):
    """
    Clean up expired files and their database entries
    """
    try:
        expired_files = MediaFile.query.filter(MediaFile.expiration_time < datetime.now()).all()
        cleaned_count = 0
        
        for media in expired_files:
            file_path = os.path.join(upload_folder, media.filename)
            try:
                if os.path.exists(file_path):
                    os.remove(file_path)
                db_session.delete(media)
                cleaned_count += 1
            except OSError as e:
                logger.error(f"Error deleting file {file_path}: {e}")
                continue
        
        db_session.commit()
        logger.info(f"Cleaned up {cleaned_count} expired files")
        
    except Exception as e:
        logger.error(f"Error during cleanup: {e}")
        db_session.rollback()

def format_file_size(size_bytes):
    """
    Format file size in human-readable format
    """
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"

def ensure_upload_directory(upload_folder):
    """
    Ensure upload directory exists and is writable
    """
    if not os.path.exists(upload_folder):
        try:
            os.makedirs(upload_folder, mode=0o755)
        except OSError as e:
            logger.error(f"Error creating upload directory: {e}")
            raise StorageError("Could not create upload directory")
    
    if not os.access(upload_folder, os.W_OK):
        raise StorageError("Upload directory is not writable")

def get_file_extension(mimetype):
    """
    Get appropriate file extension based on mimetype
    """
    extension_map = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'video/mp4': '.mp4',
        'video/webm': '.webm',
        'video/x-matroska': '.mkv'
    }
    return extension_map.get(mimetype, '')
