import os
import uuid
from pathlib import Path
from typing import Optional
from fastapi import UploadFile
from PIL import Image
import aiofiles
import httpx
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


async def save_image_from_url(image_url: str) -> Optional[str]:
    """Download image from URL and save to uploads; return relative path or None."""
    if not image_url or not image_url.startswith("http"):
        return None
    ensure_upload_dir()
    ext = Path(image_url).suffix.lower().split("?")[0]
    if ext not in settings.allowed_image_extensions:
        ext = ".jpg"
    filename = f"{uuid.uuid4()}{ext}"
    file_path = Path(settings.upload_dir) / filename
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(image_url, timeout=15.0, follow_redirects=True)
            response.raise_for_status()
            content = response.content
        async with aiofiles.open(file_path, "wb") as f:
            await f.write(content)
        with Image.open(file_path) as img:
            img.verify()
        return f"/uploads/{filename}"
    except Exception:
        if file_path.exists():
            try:
                os.remove(file_path)
            except OSError:
                pass
        return None


def get_image_url(image_path: str) -> str:
    """Convert image path to URL"""
    if image_path.startswith("http"):
        return image_path
    return image_path
