"""
Tests for auth API: register, login, /me.
"""
import pytest
from fastapi.testclient import TestClient


def test_register_success(client: TestClient):
    response = client.post(
        "/api/auth/register",
        json={
            "username": "testuser",
            "email": "test@example.com",
            "password": "securepass123",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["username"] == "testuser"
    assert data["email"] == "test@example.com"
    assert data["role"] == "reader"
    assert "id" in data
    assert "password" not in data


def test_register_duplicate_username(client: TestClient):
    client.post(
        "/api/auth/register",
        json={"username": "alice", "email": "alice@example.com", "password": "pass123"},
    )
    response = client.post(
        "/api/auth/register",
        json={"username": "alice", "email": "other@example.com", "password": "other123"},
    )
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"].lower()


def test_register_duplicate_email(client: TestClient):
    client.post(
        "/api/auth/register",
        json={"username": "user1", "email": "same@example.com", "password": "pass123"},
    )
    response = client.post(
        "/api/auth/register",
        json={"username": "user2", "email": "same@example.com", "password": "pass456"},
    )
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"].lower()


def test_login_success(client: TestClient):
    client.post(
        "/api/auth/register",
        json={"username": "loginuser", "email": "login@example.com", "password": "mypass"},
    )
    response = client.post(
        "/api/auth/login",
        json={"username": "loginuser", "password": "mypass"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["token_type"] == "bearer"
    assert "access_token" in data
    assert len(data["access_token"]) > 0


def test_login_wrong_password(client: TestClient):
    client.post(
        "/api/auth/register",
        json={"username": "u", "email": "u@x.com", "password": "correct"},
    )
    response = client.post(
        "/api/auth/login",
        json={"username": "u", "password": "wrong"},
    )
    assert response.status_code == 401
    assert "incorrect" in response.json()["detail"].lower()


def test_login_nonexistent_user(client: TestClient):
    response = client.post(
        "/api/auth/login",
        json={"username": "nobody", "password": "any"},
    )
    assert response.status_code == 401


def test_me_requires_auth(client: TestClient):
    response = client.get("/api/auth/me")
    assert response.status_code == 401


def test_me_returns_user(client: TestClient):
    client.post(
        "/api/auth/register",
        json={"username": "meuser", "email": "me@example.com", "password": "secret"},
    )
    login_resp = client.post(
        "/api/auth/login",
        json={"username": "meuser", "password": "secret"},
    )
    token = login_resp.json()["access_token"]
    response = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "meuser"
    assert data["email"] == "me@example.com"
