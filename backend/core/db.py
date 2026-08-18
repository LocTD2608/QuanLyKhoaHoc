import json
from pathlib import Path
from abc import ABC, abstractmethod
from core.config import settings

class DatabaseDriver(ABC):
    @abstractmethod
    def load_db(self) -> dict:
        pass

    @abstractmethod
    def save_db(self, data: dict):
        pass

class JSONDatabaseDriver(DatabaseDriver):
    def __init__(self, filepath: str):
        self.filepath = Path(filepath)

    def load_db(self) -> dict:
        if not self.filepath.exists():
            return {"users": [], "authors": [], "papers": [], "teams": [], "venues": []}
        with open(self.filepath, "r", encoding="utf-8") as f:
            return json.load(f)

    def save_db(self, data: dict):
        self.filepath.parent.mkdir(parents=True, exist_ok=True)
        with open(self.filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)


class SQLDatabaseDriver(DatabaseDriver):
    """Driver cho PostgreSQL / SQLite sử dụng SQLAlchemy ORM & Auto-Sync."""
    def __init__(self):
        from core.database import init_db, SessionLocal
        from models.sql_models import User, Author, Paper, PaperAuthor, Team, TeamMember, Venue
        self.SessionLocal = SessionLocal
        self.models = {
            "users": User,
            "authors": Author,
            "papers": Paper,
            "teams": Team,
            "venues": Venue
        }
        init_db()
        self._seed_if_empty()

    def _seed_if_empty(self):
        """Nếu DB trống, tự động nạp từ db.json"""
        from models.sql_models import Author, User
        db = self.SessionLocal()
        try:
            author_count = db.query(Author).count()
            if author_count == 0:
                json_path = Path(__file__).parent.parent / "data" / "db.json"
                if json_path.exists():
                    from scripts.migrate_from_json import migrate_data
                    migrate_data(db, json_path)
        except Exception as e:
            print(f"[SQLDatabaseDriver] Seed warning: {e}")
        finally:
            db.close()

    def load_db(self) -> dict:
        from models.sql_models import User, Author, Paper, Team, Venue
        session = self.SessionLocal()
        try:
            users = [u.to_dict() for u in session.query(User).all()]
            # Add password to user dict for auth logic
            for u_dict, u_obj in zip(users, session.query(User).all()):
                u_dict["password"] = u_obj.password

            authors = [a.to_dict() for a in session.query(Author).all()]
            papers = [p.to_dict() for p in session.query(Paper).all()]
            teams = [t.to_dict() for t in session.query(Team).all()]
            venues = [v.to_dict() for v in session.query(Venue).all()]

            max_id = lambda items: max([item.get("id", 0) for item in items] or [0]) + 1
            next_ids = {
                "users": max_id(users),
                "authors": max_id(authors),
                "papers": max_id(papers),
                "teams": max_id(teams),
                "venues": max_id(venues),
            }

            return {
                "users": users,
                "authors": authors,
                "papers": papers,
                "teams": teams,
                "venues": venues,
                "next_ids": next_ids
            }
        finally:
            session.close()

    def save_db(self, data: dict):
        """Đồng bộ từ dictionary vào database quan hệ"""
        from scripts.migrate_from_json import sync_dict_to_sql
        session = self.SessionLocal()
        try:
            sync_dict_to_sql(session, data)
        finally:
            session.close()


_active_driver = None

def get_db_driver() -> DatabaseDriver:
    global _active_driver
    if _active_driver is None:
        if settings.DB_TYPE in ["postgres", "postgresql", "sqlite"]:
            try:
                _active_driver = SQLDatabaseDriver()
            except Exception as e:
                print(f"[DatabaseDriver] Error loading SQL driver, falling back to JSON: {e}")
                json_path = settings.DATA_DIR / "db.json"
                _active_driver = JSONDatabaseDriver(str(json_path))
        elif settings.DB_TYPE == "json":
            _active_driver = JSONDatabaseDriver(settings.DATABASE_URL)
        else:
            _active_driver = JSONDatabaseDriver(str(settings.DATA_DIR / "db.json"))
    return _active_driver

def load_db() -> dict:
    return get_db_driver().load_db()

def save_db(data: dict):
    get_db_driver().save_db(data)

def next_id(db: dict, table: str) -> int:
    nid = db.setdefault("next_ids", {}).get(table, 1)
    db["next_ids"][table] = nid + 1
    return nid
