from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite:///./recipes.db"
    
    # Security
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 10080  # 7 days (can be overridden via ACCESS_TOKEN_EXPIRE_MINUTES env var)
    
    # File Upload
    upload_dir: str = "./uploads"
    max_upload_size: int = 10 * 1024 * 1024  # 10MB
    allowed_image_extensions: list = [".jpg", ".jpeg", ".png", ".gif", ".webp"]
    
    # CORS
    cors_origins: list = ["http://localhost:3000", "http://localhost:5173"]
    
    class Config:
        env_file = ".env"


settings = Settings()
