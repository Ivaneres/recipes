from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.database import get_db
from app.api.dependencies import get_current_user, get_current_admin_user, get_current_user_optional
from app.models.user import User
from app.models.recipe import Recipe, RecipeTag
from app.schemas.recipe import (
    RecipeCreate,
    RecipeUpdate,
    RecipeResponse,
    ParseIngredientsRequest,
    ImportConfirmRequest,
    Ingredient,
)
from app.services.image_service import save_uploaded_image, save_image_from_url
from app.services.recipe_extractor import (
    extract_recipe_from_url,
    extract_recipe_preview_from_url,
    parse_ingredient_lines,
)

router = APIRouter(prefix="/recipes", tags=["recipes"])


@router.get("", response_model=List[RecipeResponse])
def get_recipes(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get all recipes (with optional search). Private recipes are only visible to their creators. Guests can only see public recipes."""
    query = db.query(Recipe)
    
    # Filter out private recipes that don't belong to the current user
    # If no user (guest), only show public recipes
    if current_user:
        query = query.filter(
            or_(
                Recipe.is_private == False,
                Recipe.created_by == current_user.id
            )
        )
    else:
        # Guest mode: only public recipes
        query = query.filter(Recipe.is_private == False)
    
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
            "is_private": recipe.is_private,
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
    current_user: Optional[User] = Depends(get_current_user_optional)
):
    """Get a single recipe by ID. Private recipes are only accessible to their creators. Guests can only access public recipes."""
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found"
        )
    
    # Check if recipe is private and user is not the creator
    if recipe.is_private:
        if not current_user or recipe.created_by != current_user.id:
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
        "is_private": recipe.is_private,
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
    current_user: User = Depends(get_current_user)
):
    """Create a new recipe (All authenticated users)"""
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
        is_private=recipe_data.is_private if recipe_data.is_private is not None else False,
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
        "is_private": db_recipe.is_private,
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
    current_user: User = Depends(get_current_user)
):
    """Update a recipe (Recipe creator or Admin)"""
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found"
        )
    
    # Check if user is the creator or admin
    from app.models.user import UserRole
    if recipe.created_by != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
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
        elif field == "is_private":
            setattr(recipe, field, value if value is not None else False)
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
        "is_private": recipe.is_private,
        "created_by": recipe.created_by,
        "created_at": recipe.created_at,
        "updated_at": recipe.updated_at,
        "tags": [tag.tag for tag in recipe.tags]
    }


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe(
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a recipe (Recipe creator or Admin)"""
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found"
        )
    
    # Check if user is the creator or admin
    from app.models.user import UserRole
    if recipe.created_by != current_user.id and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    db.delete(recipe)
    db.commit()
    return None


@router.get("/import/preview", status_code=status.HTTP_200_OK)
async def import_preview(
    url: str = Query(..., description="URL of the recipe to preview"),
    current_user: User = Depends(get_current_user),
):
    """Fetch URL and return parsed recipe plus raw ingredient lines and image URLs for the preview screen."""
    preview = await extract_recipe_preview_from_url(url)
    if not preview:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not extract recipe from URL",
        )
    return preview


@router.post("/import/parse-ingredients", status_code=status.HTTP_200_OK)
def import_parse_ingredients(
    body: ParseIngredientsRequest,
    current_user: User = Depends(get_current_user),
):
    """Re-parse raw ingredient lines with the given quantity pattern. Returns list of Ingredient."""
    ingredients = parse_ingredient_lines(body.raw_lines, body.pattern)
    return {"ingredients": [ing.model_dump() for ing in ingredients]}


@router.post("/import/confirm", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
async def import_confirm(
    body: ImportConfirmRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create recipe from preview payload. Optionally download cover image from URL."""
    recipe_data = body.recipe
    cover_path = None
    if body.cover_image_url:
        cover_path = await save_image_from_url(body.cover_image_url)
    ingredients_json = None
    if recipe_data.ingredients:
        ingredients_json = [
            ing.model_dump() if isinstance(ing, Ingredient) else ing
            for ing in recipe_data.ingredients
        ]
    # Prefer recipe.is_private from the preview payload so user adjustments in the UI are respected
    is_private = recipe_data.is_private if recipe_data.is_private is not None else body.is_private
    db_recipe = Recipe(
        title=recipe_data.title,
        description=recipe_data.description,
        ingredients=ingredients_json,
        instructions=recipe_data.instructions,
        prep_time_minutes=recipe_data.prep_time_minutes,
        cook_time_minutes=recipe_data.cook_time_minutes,
        servings=recipe_data.servings,
        source_url=str(recipe_data.source_url) if recipe_data.source_url else None,
        cover_image=cover_path,
        is_private=is_private,
        created_by=current_user.id,
    )
    db.add(db_recipe)
    db.commit()
    db.refresh(db_recipe)
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
        "is_private": db_recipe.is_private,
        "created_by": db_recipe.created_by,
        "created_at": db_recipe.created_at,
        "updated_at": db_recipe.updated_at,
        "tags": [tag.tag for tag in db_recipe.tags],
    }


@router.post("/import", response_model=RecipeResponse, status_code=status.HTTP_201_CREATED)
async def import_recipe(
    url: str = Query(..., description="URL of the recipe to import"),
    is_private: bool = Query(False, description="Whether the recipe should be private"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Import a recipe from URL (All authenticated users)"""
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
        is_private=is_private,
        created_by=current_user.id
    )
    db.add(db_recipe)
    db.commit()
    db.refresh(db_recipe)
    
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
        "is_private": db_recipe.is_private,
        "created_by": db_recipe.created_by,
        "created_at": db_recipe.created_at,
        "updated_at": db_recipe.updated_at,
        "tags": [tag.tag for tag in db_recipe.tags]
    }


@router.post("/upload-image", status_code=status.HTTP_200_OK)
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Upload an image file (All authenticated users)"""
    image_path = await save_uploaded_image(file)
    if not image_path:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image file"
        )
    return {"image_url": image_path}
