from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class MealPlan(Base):
    __tablename__ = "meal_plans"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="meal_plans")
    recipes = relationship("MealPlanRecipe", back_populates="meal_plan", cascade="all, delete-orphan")


class MealPlanRecipe(Base):
    __tablename__ = "meal_plan_recipes"

    id = Column(Integer, primary_key=True, index=True)
    meal_plan_id = Column(Integer, ForeignKey("meal_plans.id"), nullable=False)
    recipe_id = Column(Integer, ForeignKey("recipes.id"), nullable=False)
    added_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    meal_plan = relationship("MealPlan", back_populates="recipes")
    recipe = relationship("Recipe", back_populates="meal_plan_recipes")
