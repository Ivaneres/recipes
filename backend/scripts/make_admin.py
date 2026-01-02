#!/usr/bin/env python3
"""
Script to make a user an admin.
Usage: python scripts/make_admin.py <username>
"""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal
from app.models.user import User, UserRole


def make_admin(username: str):
    """Make a user an admin"""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.username == username).first()
        if not user:
            print(f"Error: User '{username}' not found")
            return False
        
        if user.role == UserRole.ADMIN:
            print(f"User '{username}' is already an admin")
            return True
        
        user.role = UserRole.ADMIN
        db.commit()
        print(f"Successfully made '{username}' an admin")
        return True
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
        return False
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python scripts/make_admin.py <username>")
        sys.exit(1)
    
    username = sys.argv[1]
    success = make_admin(username)
    sys.exit(0 if success else 1)
