from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Recipe(Base):
    __tablename__ = "recipes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False, index=True)
    cover_image = Column(String)  # URL or path to cover image
    description = Column(Text)  # Rich text with embedded images
    ingredients = Column(JSON)  # List of {name, quantity, unit}
    instructions = Column(Text)  # Rich text with embedded images
    prep_time_minutes = Column(Integer)
    cook_time_minutes = Column(Integer)
    servings = Column(Integer)
    source_url = Column(String)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    creator = relationship("User", back_populates="recipes")
    tags = relationship("RecipeTag", back_populates="recipe", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="recipe", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="recipe", cascade="all, delete-orphan")
    ratings = relationship("Rating", back_populates="recipe", cascade="all, delete-orphan")
    meal_plan_recipes = relationship("MealPlanRecipe", back_populates="recipe")


class RecipeTag(Base):
    __tablename__ = "recipe_tags"

    id = Column(Integer, primary_key=True, index=True)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    tag = Column(String, nullable=False, index=True)

    # Relationships
    recipe = relationship("Recipe", back_populates="tags")
