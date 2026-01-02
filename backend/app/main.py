from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import engine, Base
from app.config import settings
from app.api.routes import auth, recipes, comments, notes, ratings, meal_plans
import os

# Create database tables
Base.metadata.create_all(bind=engine)

# Ensure uploads directory exists
os.makedirs(settings.upload_dir, exist_ok=True)

app = FastAPI(title="Recipe Tracking API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(recipes.router, prefix="/api")
app.include_router(comments.router, prefix="/api")
app.include_router(notes.router, prefix="/api")
app.include_router(ratings.router, prefix="/api")
app.include_router(meal_plans.router, prefix="/api")


@app.get("/")
def root():
    return {"message": "Recipe Tracking API"}


@app.get("/health")
def health():
    return {"status": "healthy"}
