import os
import uuid
from pathlib import Path
from typing import Optional
from fastapi import UploadFile
from PIL import Image
import aiofiles
from app.config import settings


def ensure_upload_dir():
    """Ensure upload directory exists"""
    upload_path = Path(settings.upload_dir)
    upload_path.mkdir(parents=True, exist_ok=True)
    return upload_path


def validate_image(file: UploadFile) -> bool:
    """Validate that uploaded file is an image"""
    if not file.filename:
        return False
    ext = Path(file.filename).suffix.lower()
    return ext in settings.allowed_image_extensions


async def save_uploaded_image(file: UploadFile) -> Optional[str]:
    """Save uploaded image file and return the file path"""
    if not validate_image(file):
        return None
    
    upload_path = ensure_upload_dir()
    
    # Generate unique filename
    ext = Path(file.filename).suffix.lower()
    filename = f"{uuid.uuid4()}{ext}"
    file_path = upload_path / filename
    
    # Read and save file
    async with aiofiles.open(file_path, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    # Validate it's actually an image
    try:
        with Image.open(file_path) as img:
            img.verify()
    except Exception:
        # Not a valid image, delete it
        os.remove(file_path)
        return None
    
    # Return relative path
    return f"/uploads/{filename}"


def get_image_url(image_path: str) -> str:
    """Convert image path to URL"""
    if image_path.startswith("http"):
        return image_path
    return image_path
