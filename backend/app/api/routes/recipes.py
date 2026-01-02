from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.api.dependencies import get_current_user, get_current_admin_user
from app.models.user import User
from app.models.recipe import Recipe, RecipeTag
from app.schemas.recipe import RecipeCreate, RecipeUpdate, RecipeResponse
from app.services.image_service import save_uploaded_image
from app.services.recipe_extractor import extract_recipe_from_url

router = APIRouter(prefix="/recipes", tags=["recipes"])


@router.get("", response_model=List[RecipeResponse])
def get_recipes(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all recipes (with optional search)"""
    query = db.query(Recipe)
    
    if search:
        # Search in title, description, and tags
        # Use a subquery to find recipe IDs that match tags
        tag_matching_recipe_ids = db.query(RecipeTag.recipe_id).filter(
            RecipeTag.tag.ilike(f"%{search}%")
        ).distinct()
        
        query = query.filter(
            or_(
                Recipe.title.ilike(f"%{search}%"),
                Recipe.description.ilike(f"%{search}%"),
                Recipe.id.in_(tag_matching_recipe_ids)
            )
        )
    
    recipes = query.offset(skip).limit(limit).all()
    # Add tags to each recipe
    result = []
    for recipe in recipes:
        recipe_dict = {
            "id": recipe.id,
            "title": recipe.title,
            "cover_image": recipe.cover_image,
            "description": recipe.description,
            "ingredients": recipe.ingredients,
            "instructions": recipe.instructions,
            "prep_time_minutes": recipe.prep_time_minutes,
            "cook_time_minutes": recipe.cook_time_minutes,
            "servings": recipe.servings,
            "source_url": recipe.source_url,
            "created_by": recipe.created_by,
            "created_at": recipe.created_at,
            "updated_at": recipe.updated_at,
            "tags": [tag.tag for tag in recipe.tags]
        }
        result.append(recipe_dict)
    return result


@router.get("/{recipe_id}", response_model=RecipeResponse)
def get_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single recipe by ID"""
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found"
        )
    recipe_dict = {
        "id": recipe.id,
        "title": recipe.title,
        "cover_image": recipe.cover_image,
        "description": recipe.description,
        "ingredients": recipe.ingredients,
        "instructions": recipe.instructions,
        "prep_time_minutes": recipe.prep_time_minutes,
        "cook_time_minutes": recipe.cook_time_minutes,
        "servings": recipe.servings,
        "source_url": recipe.source_url,
        "created_by": recipe.created_by,
        "created_at": recipe.created_at,
        "updated_at": recipe.updated_at,
        "tags": [tag.tag for tag in recipe.tags]
    }
    return recipe_dict


@router.post("", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
def create_recipe(
    recipe_data: RecipeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Create a new recipe (Admin only)"""
    # Process ingredients
    ingredients_data = None
    if recipe_data.ingredients:
        ingredients_list = [ing.dict() if hasattr(ing, 'dict') else ing for ing in recipe_data.ingredients]
        ingredients_data = ingredients_list if ingredients_list else None
    
    # Create recipe
    db_recipe = Recipe(
        title=recipe_data.title,
        cover_image=recipe_data.cover_image,
        description=recipe_data.description,
        ingredients=ingredients_data,
        instructions=recipe_data.instructions,
        prep_time_minutes=recipe_data.prep_time_minutes,
        cook_time_minutes=recipe_data.cook_time_minutes,
        servings=recipe_data.servings,
        source_url=str(recipe_data.source_url) if recipe_data.source_url else None,
        created_by=current_user.id
    )
    db.add(db_recipe)
    db.commit()
    db.refresh(db_recipe)
    
    # Add tags
    if recipe_data.tags:
        for tag_name in recipe_data.tags:
            tag = RecipeTag(recipe_id=db_recipe.id, tag=tag_name)
            db.add(tag)
        db.commit()
    
    return {
        "id": db_recipe.id,
        "title": db_recipe.title,
        "cover_image": db_recipe.cover_image,
        "description": db_recipe.description,
        "ingredients": db_recipe.ingredients,
        "instructions": db_recipe.instructions,
        "prep_time_minutes": db_recipe.prep_time_minutes,
        "cook_time_minutes": db_recipe.cook_time_minutes,
        "servings": db_recipe.servings,
        "source_url": db_recipe.source_url,
        "created_by": db_recipe.created_by,
        "created_at": db_recipe.created_at,
        "updated_at": db_recipe.updated_at,
        "tags": [tag.tag for tag in db_recipe.tags]
    }


@router.put("/{recipe_id}", response_model=RecipeResponse)
def update_recipe(
    recipe_id: int,
    recipe_data: RecipeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Update a recipe (Admin only)"""
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found"
        )
    
    # Update fields
    update_data = recipe_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        if field == "ingredients":
            if value:
                ingredients_list = [ing if isinstance(ing, dict) else (ing.dict() if hasattr(ing, 'dict') else ing) for ing in value]
                setattr(recipe, field, ingredients_list if ingredients_list else None)
            else:
                setattr(recipe, field, None)
        elif field == "source_url":
            # Convert HttpUrl to string
            setattr(recipe, field, str(value) if value else None)
        elif field == "tags":
            # Always remove old tags first
            db.query(RecipeTag).filter(RecipeTag.recipe_id == recipe_id).delete()
            # Add new tags if any
            if value:
                for tag_name in value:
                    tag = RecipeTag(recipe_id=recipe_id, tag=tag_name)
                    db.add(tag)
        elif field != "tags":
            setattr(recipe, field, value)
    
    db.commit()
    db.refresh(recipe)
    return {
        "id": recipe.id,
        "title": recipe.title,
        "cover_image": recipe.cover_image,
        "description": recipe.description,
        "ingredients": recipe.ingredients,
        "instructions": recipe.instructions,
        "prep_time_minutes": recipe.prep_time_minutes,
        "cook_time_minutes": recipe.cook_time_minutes,
        "servings": recipe.servings,
        "source_url": recipe.source_url,
        "created_by": recipe.created_by,
        "created_at": recipe.created_at,
        "updated_at": recipe.updated_at,
        "tags": [tag.tag for tag in recipe.tags]
    }


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Delete a recipe (Admin only)"""
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found"
        )
    db.delete(recipe)
    db.commit()
    return None


@router.post("/import", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
async def import_recipe(
    url: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """Import a recipe from URL (Admin only)"""
    recipe_data = await extract_recipe_from_url(url)
    if not recipe_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not extract recipe from URL"
        )
    
    # Create recipe from extracted data
    db_recipe = Recipe(
        title=recipe_data.title,
        description=recipe_data.description,
        ingredients=[ing.dict() for ing in recipe_data.ingredients] if recipe_data.ingredients else None,
        instructions=recipe_data.instructions,
        prep_time_minutes=recipe_data.prep_time_minutes,
        cook_time_minutes=recipe_data.cook_time_minutes,
        servings=recipe_data.servings,
        source_url=str(recipe_data.source_url) if recipe_data.source_url else url,
        created_by=current_user.id
    )
    db.add(db_recipe)
    db.commit()
    db.refresh(db_recipe)
    
    return db_recipe


@router.post("/upload-image", status_code=status.HTTP_200_OK)
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_admin_user)
):
    """Upload an image file (Admin only)"""
    image_path = await save_uploaded_image(file)
    if not image_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image file"
        )
    return {"image_url": image_path}
