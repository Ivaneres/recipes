from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.models.recipe import Recipe
from app.models.rating import Rating
from app.schemas.rating import RatingCreate, RatingUpdate, RatingResponse

router = APIRouter(prefix="/ratings", tags=["ratings"])


@router.get("/recipe/{recipe_id}", response_model=List[RatingResponse])
def get_recipe_ratings(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all ratings for a recipe (All users)"""
    ratings = db.query(Rating).filter(Rating.recipe_id == recipe_id).all()
    return ratings


@router.get("/recipe/{recipe_id}/average")
def get_recipe_average_rating(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get average rating for a recipe (All users)"""
    result = db.query(func.avg(Rating.rating)).filter(Rating.recipe_id == recipe_id).scalar()
    count = db.query(Rating).filter(Rating.recipe_id == recipe_id).count()
    return {
        "average": float(result) if result else None,
        "count": count
    }


@router.post("", response_model=RatingResponse, status_code=status.HTTP_201_CREATED)
def create_rating(
    rating_data: RatingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create or update a rating (All users)"""
    # Verify recipe exists
    recipe = db.query(Recipe).filter(Recipe.id == rating_data.recipe_id).first()
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found"
        )
    
    # Check if rating already exists
    existing_rating = db.query(Rating).filter(
        Rating.recipe_id == rating_data.recipe_id,
        Rating.user_id == current_user.id
    ).first()
    
    if existing_rating:
        # Update existing rating
        existing_rating.rating = rating_data.rating
        db.commit()
        db.refresh(existing_rating)
        return existing_rating
    
    # Create new rating
    rating = Rating(
        recipe_id=rating_data.recipe_id,
        user_id=current_user.id,
        rating=rating_data.rating
    )
    db.add(rating)
    db.commit()
    db.refresh(rating)
    return rating


@router.put("/{rating_id}", response_model=RatingResponse)
def update_rating(
    rating_id: int,
    rating_data: RatingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a rating (Own ratings only)"""
    rating = db.query(Rating).filter(Rating.id == rating_id).first()
    if not rating:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rating not found"
        )
    
    if rating.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this rating"
        )
    
    if rating_data.rating:
        rating.rating = rating_data.rating
    
    db.commit()
    db.refresh(rating)
    return rating


@router.delete("/{rating_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rating(
    rating_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a rating (Own ratings only)"""
    rating = db.query(Rating).filter(Rating.id == rating_id).first()
    if not rating:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Rating not found"
        )
    
    if rating.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this rating"
        )
    
    db.delete(rating)
    db.commit()
    return None
