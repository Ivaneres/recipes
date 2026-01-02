from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class RatingBase(BaseModel):
    rating: int = Field(..., ge=1, le=5)


class RatingCreate(RatingBase):
    recipe_id: int


class RatingUpdate(BaseModel):
    rating: Optional[int] = Field(None, ge=1, le=5)


class RatingResponse(RatingBase):
    id: int
    recipe_id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Rating(RatingResponse):
    pass
