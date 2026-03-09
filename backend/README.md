# Recipe Tracking Backend

FastAPI backend for the recipe tracking application.

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file (optional, defaults are provided):
```env
DATABASE_URL=sqlite:///./recipes.db
SECRET_KEY=your-secret-key-change-in-production
```

4. Run the server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`
API documentation at `http://localhost:8000/docs`

## Testing

Tests use an in-memory SQLite database (the real DB is never touched). Install test dependencies (included in `requirements.txt`) and run:

```bash
source venv/bin/activate
pip install -r requirements.txt   # includes pytest, pytest-cov, httpx
pytest
```

Or with coverage:

```bash
pytest --cov=app --cov-report=term-missing
```

## Project Structure

- `app/main.py` - FastAPI application entry point
- `app/models/` - SQLAlchemy database models
- `app/schemas/` - Pydantic schemas for request/response validation
- `app/api/routes/` - API route handlers
- `app/services/` - Business logic services
- `app/config.py` - Configuration settings
- `app/database.py` - Database connection and session management
