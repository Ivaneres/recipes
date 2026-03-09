# Recipe Tracking App - MVP Plan

## Overview
A web application for collecting, managing, and planning recipes with user roles and meal planning capabilities.

## MVP Features

### 1. Core Recipe Management
- **Create/Edit Recipes** (Admin only)
  - Manual recipe entry with fields:
    - Title
    - Cover Image (separate field, displayed on recipe cards and detail page)
    - Description (rich text with embedded images)
    - Ingredients (list with quantities)
    - Instructions (rich text content with embedded images)
    - Prep time, cook time
    - Servings
    - Source URL (optional)
    - Tags/Categories
  - Edit existing recipes
  - Delete recipes (Admin only)
  - **Image Support**:
    - Cover image: Separate field for recipe card display
    - Content images: Images can be added anywhere in description/instructions via rich text editor
    - Support for image URLs or file uploads
    - Rich text editor (TipTap) with image insertion capability

- **Recipe Display** (All users)
  - View recipe details with cover image prominently displayed
  - Search and filter recipes (searches by title, description, and tags)
  - Browse by categories/tags
  - Modern, sleek UI with consistent theming

### 2. Recipe Import/Extraction
- **Manual URL Import** (Admin only)
  - Paste URL from Instagram, websites, etc.
  - Multi-strategy extraction:
    - `recipe-scrapers` library for common recipe sites
    - JSON-LD structured data parsing
    - Generic HTML parsing with multiple selectors
    - Fallback: Extract all main text content if smart extraction fails
  - Store original source URL
  - Extracted recipes can be edited after import

### 3. User Authentication & Authorization
- **User Roles**
  - Admin: Can create, edit, delete recipes
  - Regular User: Can view recipes, add comments, add ratings
- **Authentication**
  - User registration/login
  - JWT token-based authentication
  - Role-based access control

### 4. Recipe Interactions
- **Comments** (All authenticated users)
  - View comments on recipes
  - Add comments
  - Edit/delete own comments
  
- **Ratings** (All authenticated users)
  - View average rating
  - Add/update own rating (1-5 stars)
  - View rating count

- **Private Notes** (Recipe creators only)
  - Add private notes to recipes you created
  - View/edit/delete notes (only visible to recipe creator)
  - Not admin-only - any user can add notes to their own recipes

### 5. Meal Planning
- **Meal Plans** (All users)
  - Create meal plan collections
  - Add/remove recipes to/from meal plans
  - View meal plan summary:
    - Combined ingredient list (with quantities)
    - Total prep time, cook time
    - Total servings
    - Recipe count

## Technical Architecture

### Backend (Python)
- **Framework**: FastAPI (modern, async, auto-docs)
- **Database**: SQLite (MVP) or PostgreSQL (production-ready)
- **ORM**: SQLAlchemy
- **Authentication**: JWT tokens or session-based
- **File Storage**: 
  - Local file storage for MVP (uploads/ directory)
  - Support for image URLs (external sources)
  - Image validation and processing (Pillow)
  - Images embedded in rich text content (markdown/HTML format)
- **Recipe Extraction**: 
  - `recipe-scrapers` library for common recipe sites
  - `beautifulsoup4` for HTML parsing
  - Instagram: Use Instagram Basic Display API or manual entry (API limitations)

### Frontend (React)
- **Framework**: React with TypeScript
- **State Management**: React Context API
- **Routing**: React Router
- **UI Library**: Custom CSS with shared styles (no external UI library)
- **Styling**: Shared CSS utilities for consistent theming (buttons, inputs, cards, etc.)
- **HTTP Client**: Axios
- **Rich Text Editor**: 
  - TipTap with Placeholder extension
  - Support for image insertion anywhere in content
  - Image upload integration
  - Immediately editable (no click-to-edit required)

### Project Structure
```
recipes-app/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── models/
│   │   │   ├── user.py
│   │   │   ├── recipe.py
│   │   │   ├── meal_plan.py
│   │   │   ├── comment.py
│   │   │   ├── note.py
│   │   │   └── rating.py
│   │   ├── schemas/
│   │   │   ├── user.py
│   │   │   ├── recipe.py
│   │   │   ├── meal_plan.py
│   │   │   ├── comment.py
│   │   │   ├── note.py
│   │   │   └── rating.py
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── auth.py
│   │   │   │   ├── recipes.py
│   │   │   │   ├── meal_plans.py
│   │   │   │   ├── comments.py
│   │   │   │   ├── notes.py
│   │   │   │   └── ratings.py
│   │   │   └── dependencies.py
│   │   ├── services/
│   │   │   ├── recipe_extractor.py
│   │   │   └── auth.py
│   │   ├── database.py
│   │   └── config.py
│   ├── scripts/
│   │   ├── make_admin.py
│   │   └── add_cover_image.py
│   ├── uploads/          # Image storage directory
│   ├── requirements.txt
│   └── README.md
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AdminFeatures.tsx (RecipeInteractions + Private Notes)
│   │   │   ├── RichTextEditor.tsx
│   │   │   └── Navigation.tsx
│   │   ├── pages/
│   │   │   ├── Home.tsx
│   │   │   ├── RecipeList.tsx
│   │   │   ├── RecipeDetail.tsx
│   │   │   ├── RecipeEdit.tsx
│   │   │   ├── RecipeImport.tsx
│   │   │   ├── MealPlans.tsx
│   │   │   ├── MealPlanDetail.tsx
│   │   │   └── Login.tsx
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── context/
│   │   │   └── AuthContext.tsx
│   │   ├── utils/
│   │   │   ├── styles.ts (shared CSS)
│   │   │   └── imageUrl.ts (image URL utilities)
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── README.md
├── MVP_PLAN.md
├── DEPLOYMENT.md
├── QUICKSTART.md
└── README.md
```

## Database Schema (MVP)

### Users
- id (PK)
- username (unique)
- email (unique)
- password_hash
- role (admin/reader)
- created_at

### Recipes
- id (PK)
- title
- cover_image_url (String) - Separate cover image for recipe cards and detail page
- description (text) - Rich text with embedded images
- ingredients (JSON) - List of {name, quantity, unit}
- instructions (text) - Rich text content with embedded images (can include images anywhere)
- prep_time_minutes
- cook_time_minutes
- servings
- source_url
- created_by (FK -> Users)
- created_at
- updated_at

**Note**: 
- Cover image: Separate field displayed on recipe cards and prominently on recipe detail page
- Content images: Embedded in rich text content (description and instructions) via TipTap editor
- Images can be stored as URLs or file paths (for uploaded images)

### Recipe_Tags (Many-to-Many)
- recipe_id (FK)
- tag (string)

### Comments
- id (PK)
- recipe_id (FK)
- user_id (FK)
- content
- created_at
- updated_at

### Notes
- id (PK)
- recipe_id (FK)
- user_id (FK)
- content
- created_at
- updated_at

**Note**: Notes are private to the recipe creator. Only the user who created the recipe can view/add/edit notes for that recipe.

### Ratings
- id (PK)
- recipe_id (FK)
- user_id (FK)
- rating (1-5)
- created_at
- updated_at

### Meal_Plans
- id (PK)
- name
- user_id (FK)
- created_at
- updated_at

### Meal_Plan_Recipes (Many-to-Many)
- meal_plan_id (FK)
- recipe_id (FK)
- added_at

## Implementation Phases

### Phase 1: Foundation
1. Set up backend project structure
2. Set up frontend project structure
3. Database models and migrations
4. Basic authentication (login/register)
5. User roles and authorization middleware

### Phase 2: Core Recipe Features
1. CRUD operations for recipes (Admin only)
2. Cover image support (separate field from content images)
3. Image upload and storage service
4. Rich text editor integration (TipTap with image insertion support)
5. Image embedding in recipe content (anywhere in description/instructions)
6. Recipe list and detail views with modern UI
7. Search and filter functionality (includes tag-based search)
8. Consistent theming and shared styles
9. Global navigation bar

### Phase 3: Recipe Import
1. URL extraction service (including image extraction)
2. Recipe import endpoint
3. UI for importing recipes
4. Extract and store images from imported recipes

### Phase 4: Recipe Interactions
1. Comments system (all authenticated users)
2. Ratings system (all authenticated users)
3. Private notes system (recipe creators only)
4. UI for interactions with modern styling

### Phase 5: Meal Planning
1. Meal plan CRUD
2. Add/remove recipes to meal plans
3. Meal plan summary calculation
4. Meal plan UI

### Phase 6: Polish & Testing
1. Error handling
2. Input validation
3. UI/UX improvements
4. Basic testing

## Out of Scope for MVP
- Advanced recipe extraction (Instagram API integration)
- Advanced image processing (resizing, optimization, CDN)
- Recipe sharing between users
- Shopping list generation
- Calendar view for meal plans
- Recipe scaling (serving size adjustments)
- Advanced search (full-text search, ingredient matching)

## Next Steps
1. Initialize backend project with FastAPI
2. Initialize frontend project with React + TypeScript
3. Set up database models
4. Implement authentication
5. Build core recipe CRUD
6. Add recipe import functionality
7. Implement admin features
8. Build meal planning feature
