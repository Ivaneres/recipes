from pydantic import BaseModel, HttpUrl
from typing import Optional, List, Dict
from datetime import datetime


class Ingredient(BaseModel):
    name: str
    quantity: Optional[float] = None
    unit: Optional[str] = None


class RecipeBase(BaseModel):
    title: str
    cover_image: Optional[str] = None  # URL or path to cover image
    description: Optional[str] = None  # Rich text with embedded images
    ingredients: Optional[List[Ingredient]] = None
    instructions: Optional[str] = None  # Rich text with embedded images
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None
    servings: Optional[int] = None
    source_url: Optional[HttpUrl] = None
    tags: Optional[List[str]] = None


class RecipeCreate(RecipeBase):
    pass


class RecipeUpdate(BaseModel):
    title: Optional[str] = None
    cover_image: Optional[str] = None
    description: Optional[str] = None
    ingredients: Optional[List[Ingredient]] = None
    instructions: Optional[str] = None
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None
    servings: Optional[int] = None
    source_url: Optional[HttpUrl] = None
    tags: Optional[List[str]] = None


class RecipeResponse(RecipeBase):
    id: int
    created_by: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Recipe(RecipeResponse):
    pass
