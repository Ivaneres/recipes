"""
Tests for recipes API: list, get, create, update.
Uses authenticated client fixtures (admin and reader) and guest (no token).
"""
import pytest
from fastapi.testclient import TestClient


def _auth_headers(client: TestClient, username: str, password: str) -> dict:
    """Register if needed, login, return Authorization headers."""
    client.post(
        "/api/auth/register",
        json={"username": username, "email": f"{username}@test.com", "password": password},
    )
    r = client.post("/api/auth/login", json={"username": username, "password": password})
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_recipes_list_empty(client: TestClient):
    response = client.get("/api/recipes")
    assert response.status_code == 200
    assert response.json() == []


def test_recipes_list_returns_public_recipe(client: TestClient):
    # Create user and recipe via API (need auth for create)
    headers = _auth_headers(client, "creator", "pass")
    client.post(
        "/api/recipes",
        json={
            "title": "Public Soup",
            "description": "A soup",
            "is_private": False,
        },
        headers=headers,
    )
    # Guest can see public recipes
    response = client.get("/api/recipes")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["title"] == "Public Soup"
    assert data[0]["is_private"] is False


def test_recipes_list_hides_private_from_guest(client: TestClient):
    headers = _auth_headers(client, "creator", "pass")
    client.post(
        "/api/recipes",
        json={"title": "Secret", "is_private": True},
        headers=headers,
    )
    response = client.get("/api/recipes")
    assert response.status_code == 200
    assert len(response.json()) == 0


def test_recipe_create_requires_auth(client: TestClient):
    response = client.post(
        "/api/recipes",
        json={"title": "No Auth Recipe"},
    )
    assert response.status_code == 401


def test_recipe_create_success(client: TestClient):
    headers = _auth_headers(client, "cook", "pass")
    response = client.post(
        "/api/recipes",
        json={
            "title": "Pasta",
            "description": "Good pasta",
            "prep_time_minutes": 10,
            "cook_time_minutes": 20,
            "servings": 2,
            "tags": ["italian", "dinner"],
        },
        headers=headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Pasta"
    assert data["description"] == "Good pasta"
    assert data["prep_time_minutes"] == 10
    assert data["cook_time_minutes"] == 20
    assert data["servings"] == 2
    assert data["tags"] == ["italian", "dinner"]
    assert "id" in data
    assert data["created_by"] > 0


def test_recipe_get_by_id(client: TestClient):
    headers = _auth_headers(client, "author", "pass")
    create_resp = client.post(
        "/api/recipes",
        json={"title": "Get Me", "description": "Recipe to fetch"},
        headers=headers,
    )
    rid = create_resp.json()["id"]
    response = client.get(f"/api/recipes/{rid}")
    assert response.status_code == 200
    assert response.json()["title"] == "Get Me"


def test_recipe_get_404(client: TestClient):
    response = client.get("/api/recipes/99999")
    assert response.status_code == 404


def test_recipe_update_success(client: TestClient):
    headers = _auth_headers(client, "updater", "pass")
    create_resp = client.post(
        "/api/recipes",
        json={"title": "Original", "description": "Before"},
        headers=headers,
    )
    rid = create_resp.json()["id"]
    response = client.put(
        f"/api/recipes/{rid}",
        json={"title": "Updated Title", "description": "After"},
        headers=headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["title"] == "Updated Title"
    assert data["description"] == "After"


def test_recipe_update_requires_auth(client: TestClient):
    headers = _auth_headers(client, "creator", "pass")
    create_resp = client.post(
        "/api/recipes",
        json={"title": "Mine"},
        headers=headers,
    )
    rid = create_resp.json()["id"]
    response = client.put(
        f"/api/recipes/{rid}",
        json={"title": "Hacked"},
    )
    assert response.status_code == 401


def test_recipe_update_403_when_not_owner(client: TestClient):
    # User A creates recipe
    headers_a = _auth_headers(client, "usera", "pass")
    create_resp = client.post(
        "/api/recipes",
        json={"title": "A's Recipe"},
        headers=headers_a,
    )
    rid = create_resp.json()["id"]
    # User B tries to update
    headers_b = _auth_headers(client, "userb", "pass")
    response = client.put(
        f"/api/recipes/{rid}",
        json={"title": "B's Takeover"},
        headers=headers_b,
    )
    assert response.status_code == 403
