from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.api.dependencies import get_current_user
from app.models.user import User
from app.models.meal_plan import MealPlan, MealPlanRecipe
from app.models.recipe import Recipe
from app.schemas.meal_plan import MealPlanCreate, MealPlanUpdate, MealPlanResponse, MealPlanSummary
from app.schemas.recipe import Ingredient

router = APIRouter(prefix="/meal-plans", tags=["meal-plans"])


@router.get("", response_model=List[MealPlanResponse])
def get_meal_plans(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all meal plans for current user"""
    from sqlalchemy.orm import joinedload
    from app.schemas.recipe import RecipeResponse
    
    meal_plans = db.query(MealPlan).options(
        joinedload(MealPlan.recipes).joinedload(MealPlanRecipe.recipe)
    ).filter(MealPlan.user_id == current_user.id).all()
    
    # Manually construct responses with recipes extracted from MealPlanRecipe
    result = []
    for meal_plan in meal_plans:
        recipes = []
        for meal_plan_recipe in meal_plan.recipes:
            recipe = meal_plan_recipe.recipe
            # Get tags for the recipe
            tags = [tag.tag for tag in recipe.tags]
            recipe_dict = {
                "id": recipe.id,
                "title": recipe.title,
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
                "tags": tags
            }
            recipes.append(recipe_dict)
        
        result.append({
            "id": meal_plan.id,
            "name": meal_plan.name,
            "user_id": meal_plan.user_id,
            "created_at": meal_plan.created_at,
            "updated_at": meal_plan.updated_at,
            "recipes": recipes
        })
    
    return result


@router.get("/{meal_plan_id}", response_model=MealPlanResponse)
def get_meal_plan(
    meal_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a single meal plan"""
    from sqlalchemy.orm import joinedload
    
    meal_plan = db.query(MealPlan).options(
        joinedload(MealPlan.recipes).joinedload(MealPlanRecipe.recipe)
    ).filter(
        MealPlan.id == meal_plan_id,
        MealPlan.user_id == current_user.id
    ).first()
    if not meal_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meal plan not found"
        )
    
    # Manually construct response with recipes extracted from MealPlanRecipe
    recipes = []
    for meal_plan_recipe in meal_plan.recipes:
        recipe = meal_plan_recipe.recipe
        # Get tags for the recipe
        tags = [tag.tag for tag in recipe.tags]
        recipe_dict = {
            "id": recipe.id,
            "title": recipe.title,
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
            "tags": tags
        }
        recipes.append(recipe_dict)
    
    return {
        "id": meal_plan.id,
        "name": meal_plan.name,
        "user_id": meal_plan.user_id,
        "created_at": meal_plan.created_at,
        "updated_at": meal_plan.updated_at,
        "recipes": recipes
    }


@router.get("/{meal_plan_id}/summary", response_model=MealPlanSummary)
def get_meal_plan_summary(
    meal_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get summary information for a meal plan"""
    meal_plan = db.query(MealPlan).filter(
        MealPlan.id == meal_plan_id,
        MealPlan.user_id == current_user.id
    ).first()
    if not meal_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meal plan not found"
        )
    
    # Get all recipes in the meal plan
    meal_plan_recipes = db.query(MealPlanRecipe).filter(
        MealPlanRecipe.meal_plan_id == meal_plan_id
    ).all()
    
    recipe_ids = [mpr.recipe_id for mpr in meal_plan_recipes]
    recipes = db.query(Recipe).filter(Recipe.id.in_(recipe_ids)).all()
    
    # Calculate summary
    total_prep_time = sum(r.prep_time_minutes or 0 for r in recipes)
    total_cook_time = sum(r.cook_time_minutes or 0 for r in recipes)
    total_servings = sum(r.servings or 0 for r in recipes)
    
    # Combine ingredients
    combined_ingredients = {}
    for recipe in recipes:
        if recipe.ingredients:
            for ing in recipe.ingredients:
                name = ing.get("name", "")
                quantity = ing.get("quantity")
                unit = ing.get("unit", "")
                
                key = f"{name}|{unit}"
                if key in combined_ingredients:
                    if quantity:
                        combined_ingredients[key]["quantity"] = (
                            combined_ingredients[key].get("quantity", 0) + quantity
                        )
                else:
                    combined_ingredients[key] = {
                        "name": name,
                        "quantity": quantity,
                        "unit": unit
                    }
    
    return MealPlanSummary(
        total_prep_time=total_prep_time if total_prep_time > 0 else None,
        total_cook_time=total_cook_time if total_cook_time > 0 else None,
        total_servings=total_servings if total_servings > 0 else None,
        recipe_count=len(recipes),
        combined_ingredients=list(combined_ingredients.values())
    )


@router.post("", response_model=MealPlanResponse, status_code=status.HTTP_201_CREATED)
def create_meal_plan(
    meal_plan_data: MealPlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new meal plan"""
    meal_plan = MealPlan(
        name=meal_plan_data.name,
        user_id=current_user.id
    )
    db.add(meal_plan)
    db.commit()
    db.refresh(meal_plan)
    
    # Manually construct response with empty recipes list
    return {
        "id": meal_plan.id,
        "name": meal_plan.name,
        "user_id": meal_plan.user_id,
        "created_at": meal_plan.created_at,
        "updated_at": meal_plan.updated_at,
        "recipes": []
    }


@router.put("/{meal_plan_id}", response_model=MealPlanResponse)
def update_meal_plan(
    meal_plan_id: int,
    meal_plan_data: MealPlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a meal plan"""
    meal_plan = db.query(MealPlan).filter(
        MealPlan.id == meal_plan_id,
        MealPlan.user_id == current_user.id
    ).first()
    if not meal_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meal plan not found"
        )
    
    if meal_plan_data.name:
        meal_plan.name = meal_plan_data.name
    
    db.commit()
    db.refresh(meal_plan)
    return meal_plan


@router.delete("/{meal_plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_meal_plan(
    meal_plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a meal plan"""
    meal_plan = db.query(MealPlan).filter(
        MealPlan.id == meal_plan_id,
        MealPlan.user_id == current_user.id
    ).first()
    if not meal_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meal plan not found"
        )
    db.delete(meal_plan)
    db.commit()
    return None


@router.post("/{meal_plan_id}/recipes/{recipe_id}", status_code=status.HTTP_201_CREATED)
def add_recipe_to_meal_plan(
    meal_plan_id: int,
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add a recipe to a meal plan"""
    # Verify meal plan exists and belongs to user
    meal_plan = db.query(MealPlan).filter(
        MealPlan.id == meal_plan_id,
        MealPlan.user_id == current_user.id
    ).first()
    if not meal_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meal plan not found"
        )
    
    # Verify recipe exists
    recipe = db.query(Recipe).filter(Recipe.id == recipe_id).first()
    if not recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found"
        )
    
    # Check if already added
    existing = db.query(MealPlanRecipe).filter(
        MealPlanRecipe.meal_plan_id == meal_plan_id,
        MealPlanRecipe.recipe_id == recipe_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Recipe already in meal plan"
        )
    
    meal_plan_recipe = MealPlanRecipe(
        meal_plan_id=meal_plan_id,
        recipe_id=recipe_id
    )
    db.add(meal_plan_recipe)
    db.commit()
    db.refresh(meal_plan_recipe)
    return {"message": "Recipe added to meal plan"}


@router.delete("/{meal_plan_id}/recipes/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_recipe_from_meal_plan(
    meal_plan_id: int,
    recipe_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove a recipe from a meal plan"""
    # Verify meal plan exists and belongs to user
    meal_plan = db.query(MealPlan).filter(
        MealPlan.id == meal_plan_id,
        MealPlan.user_id == current_user.id
    ).first()
    if not meal_plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meal plan not found"
        )
    
    meal_plan_recipe = db.query(MealPlanRecipe).filter(
        MealPlanRecipe.meal_plan_id == meal_plan_id,
        MealPlanRecipe.recipe_id == recipe_id
    ).first()
    if not meal_plan_recipe:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipe not found in meal plan"
        )
    
    db.delete(meal_plan_recipe)
    db.commit()
    return None
