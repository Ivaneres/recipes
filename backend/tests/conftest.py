"""
Pytest configuration and fixtures for API tests.
Uses an in-memory SQLite database and dependency override so the real DB is never touched.
"""
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from fastapi.testclient import TestClient

# Create test engine and tables before importing app (app.main creates tables on default engine)
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def get_test_db():
    """Yield a test DB session that rolls back after each request (used per-test)."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


# Import after engine so we can create_all on test engine
from app.database import Base, get_db
from app.main import app

# Create all tables on the test engine
Base.metadata.create_all(bind=test_engine)


@pytest.fixture(scope="function")
def db_session():
    """Provide a transactional session that rolls back after the test."""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = Session(bind=connection)
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def client(db_session: Session):
    """Provide a test client with get_db overridden to use the test session."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


