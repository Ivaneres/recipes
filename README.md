# Recipe Tracking App

A web application for collecting, managing, and planning recipes with role-based access control and meal planning capabilities.

## Features

- **Recipe Management**: Create, edit, and organize recipes
- **Recipe Import**: Extract recipes from URLs (Instagram, websites, etc.)
- **User Roles**: Admin (create/edit) and Reader (view only)
- **Admin Features**: Comments, notes, and ratings on recipes
- **Meal Planning**: Create meal plans with aggregated ingredient lists and time summaries

## Tech Stack

- **Backend**: Python + FastAPI
- **Frontend**: React + TypeScript
- **Database**: SQLite (MVP) / PostgreSQL (production)

## Project Structure

```
recipes-app/
├── backend/          # Python FastAPI backend
├── frontend/         # React TypeScript frontend
├── MVP_PLAN.md       # Detailed MVP implementation plan
└── README.md         # This file
```

## Getting Started

See `MVP_PLAN.md` for detailed implementation plan and phases.

## Development Status

✅ **Phase 1 Complete**: Foundation and core features implemented
- Backend API with FastAPI
- Frontend with React + TypeScript
- Authentication and authorization
- Basic recipe management
- Rich text editor with image support

🚧 **In Progress**: Additional features and UI improvements

See `QUICKSTART.md` for setup instructions and `MVP_PLAN.md` for full feature list.
