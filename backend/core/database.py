"""
core/database.py — Quản lý kết nối Database qua SQLAlchemy Engine & Session.
"""

from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from core.config import settings
from models.sql_models import Base

# Determine connect_args based on DB type
connect_args = {}
db_url = settings.DATABASE_URL

# Fallback if db_url is pointing to a json file
if db_url.endswith(".json") or settings.DB_TYPE == "json":
    from pathlib import Path
    workspace_root = Path(__file__).parent.parent.parent
    sqlite_file = (workspace_root / "backend/data/app.db").resolve()
    sqlite_file.parent.mkdir(parents=True, exist_ok=True)
    db_url = f"sqlite:///{sqlite_file}"

if db_url.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    db_url,
    echo=False,
    connect_args=connect_args,
    pool_pre_ping=True if not db_url.startswith("sqlite") else False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Tạo tất cả các bảng nếu chưa tồn tại"""
    Base.metadata.create_all(bind=engine)

def get_db() -> Generator[Session, None, None]:
    """Dependency injection cho FastAPI routes"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
