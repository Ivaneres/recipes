# Quick Start Guide

## Prerequisites

- Python 3.8+
- Node.js 18+
- npm or yarn

## Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. (Optional) Create `.env` file for custom settings:
```env
DATABASE_URL=sqlite:///./recipes.db
SECRET_KEY=your-secret-key-change-in-production
```

5. Run the server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`
API documentation at `http://localhost:8000/docs`

## Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```env
VITE_API_URL=http://localhost:8000/api
```

4. Run the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## First Steps

1. Start both backend and frontend servers
2. Navigate to `http://localhost:5173`
3. Register a new account (defaults to READER role)
4. To make a user an admin, run:
   ```bash
   cd backend
   source venv/bin/activate
   python scripts/make_admin.py <username>
   ```
   
   For example, to make the "admin" user an admin:
   ```bash
   python scripts/make_admin.py admin
   ```

## Creating Your First Recipe

1. Login as an admin user
2. Click "Create Recipe" or navigate to `/recipes/new`
3. Fill in the recipe details
4. Use the rich text editor to add images anywhere in the description or instructions
5. Save the recipe

## Features Implemented

✅ User authentication (register/login)
✅ Role-based access control (Admin/Reader)
✅ Recipe CRUD operations (Admin only for create/edit/delete)
✅ Recipe list with search
✅ Recipe detail view
✅ Rich text editor with image support
✅ Image upload service
✅ Recipe import from URLs (basic)
✅ Comments, Notes, and Ratings API (Admin only)
✅ Meal Plans API

## Next Steps

See `MVP_PLAN.md` for the full implementation plan and remaining features.
