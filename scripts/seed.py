#!/usr/bin/env python3
"""Seed script to populate the database with test data."""

import asyncio
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path

# Add the project root to the Python path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from sqlmodel import Session, create_engine, select
from apps.api.models import User, Project, ApiKey, Budget
from apps.api.database import get_engine

async def seed_database():
    """Seed the database with test data."""
    engine = get_engine()
    
    with Session(engine) as session:
        # Create test user
        user = User(
            email="test@lensai.dev",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        session.add(user)
        session.commit()
        session.refresh(user)
        
        print(f"Created user: {user.email} (ID: {user.id})")
        
        # Create test project
        project = Project(
            owner_id=user.id,
            name="Test Project",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        session.add(project)
        session.commit()
        session.refresh(project)
        
        print(f"Created project: {project.name} (ID: {project.id})")
        
        # Create test API key
        api_key = ApiKey(
            project_id=project.id,
            name="Test API Key",
            prefix="test_",
            hash="test_hash_placeholder",  # In real app, this would be hashed
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=365)
        )
        session.add(api_key)
        session.commit()
        session.refresh(api_key)
        
        print(f"Created API key: {api_key.name} (ID: {api_key.id})")
        
        # Create test budget
        budget = Budget(
            project_id=project.id,
            limit_usd=100.00,
            period="monthly",
            hard_stop=True,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        session.add(budget)
        session.commit()
        session.refresh(budget)
        
        print(f"Created budget: ${budget.limit_usd} {budget.period} (ID: {budget.id})")
        
        print("\nSeed data created successfully!")
        print(f"User: {user.email}")
        print(f"Project: {project.name}")
        print(f"API Key: {api_key.name}")
        print(f"Budget: ${budget.limit_usd} {budget.period}")

def main():
    """Main entry point."""
    print("Seeding LensAI database...")
    
    # Check if database is available
    try:
        engine = get_engine()
        with Session(engine) as session:
            # Test connection
            session.execute("SELECT 1")
    except Exception as e:
        print(f"Error connecting to database: {e}")
        print("Make sure the database is running with: make infra.up")
        sys.exit(1)
    
    # Run the seed
    asyncio.run(seed_database())

if __name__ == "__main__":
    main()
