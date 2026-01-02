from sqlalchemy import Column, Integer, String, DateTime, Enum
from sqlalchemy.orm import relationship
import enum
from datetime import datetime
from app.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    READER = "reader"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.READER, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    recipes = relationship("Recipe", back_populates="creator")
    comments = relationship("Comment", back_populates="user")
    notes = relationship("Note", back_populates="user")
    ratings = relationship("Rating", back_populates="user")
    meal_plans = relationship("MealPlan", back_populates="user")
