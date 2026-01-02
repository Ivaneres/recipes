from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.schemas.recipe import RecipeResponse


class MealPlanBase(BaseModel):
    name: str


class MealPlanCreate(MealPlanBase):
    pass


class MealPlanUpdate(BaseModel):
    name: Optional[str] = None


class MealPlanResponse(MealPlanBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    recipes: Optional[List[RecipeResponse]] = None

    class Config:
        from_attributes = True


class MealPlan(MealPlanResponse):
    pass


class MealPlanSummary(BaseModel):
    total_prep_time: Optional[int] = None
    total_cook_time: Optional[int] = None
    total_servings: Optional[int] = None
    recipe_count: int
    combined_ingredients: List[dict] = []
