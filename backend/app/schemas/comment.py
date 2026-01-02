from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class CommentBase(BaseModel):
    content: str


class CommentCreate(CommentBase):
    recipe_id: int


class CommentUpdate(BaseModel):
    content: Optional[str] = None


class CommentResponse(CommentBase):
    id: int
    recipe_id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Comment(CommentResponse):
    pass
