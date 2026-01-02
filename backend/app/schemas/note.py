from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class NoteBase(BaseModel):
    content: str


class NoteCreate(NoteBase):
    recipe_id: int


class NoteUpdate(BaseModel):
    content: Optional[str] = None


class NoteResponse(NoteBase):
    id: int
    recipe_id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Note(NoteResponse):
    pass
