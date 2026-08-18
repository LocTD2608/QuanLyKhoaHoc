import os
from pathlib import Path
from dotenv import load_dotenv

# Load from backend/.env if present
env_path = Path(__file__).parent.parent / ".env"
load_dotenv(dotenv_path=env_path)

class Settings:
    ENV: str = os.getenv("ENV", "development")
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "10000"))
    
    # Database Configuration
    DB_TYPE: str = os.getenv("DB_TYPE", "sqlite")  # "postgres", "sqlite", "json"
    _db_url: str = os.getenv("DATABASE_URL", "sqlite:///backend/data/app.db")
    
    # Postgres specific params
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "postgres")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    POSTGRES_HOST: str = os.getenv("POSTGRES_HOST", "localhost")
    POSTGRES_PORT: int = int(os.getenv("POSTGRES_PORT", "5432"))
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "sci_management")

    @property
    def DATABASE_URL(self) -> str:
        # If postgres connection is specified via individual env vars or direct URL
        if self.DB_TYPE == "postgres" or self._db_url.startswith("postgresql://") or self._db_url.startswith("postgres://"):
            if self._db_url.startswith("postgresql://") or self._db_url.startswith("postgres://"):
                return self._db_url
            return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        
        # SQLite
        if self._db_url.startswith("sqlite:///"):
            sqlite_path = self._db_url.replace("sqlite:///", "")
            p = Path(sqlite_path)
            if not p.is_absolute():
                workspace_root = Path(__file__).parent.parent.parent
                p = (workspace_root / sqlite_path).resolve()
            p.parent.mkdir(parents=True, exist_ok=True)
            return f"sqlite:///{p}"
            
        p = Path(self._db_url)
        if p.is_absolute():
            return str(p)
        workspace_root = Path(__file__).parent.parent.parent
        resolved = workspace_root / self._db_url
        return str(resolved.resolve())

    @property
    def DATA_DIR(self) -> Path:
        return Path(__file__).parent.parent / "data"

    # OpenAI & LLM
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    OPENAI_MODEL: str = os.getenv("OPENAI_MODEL", "gpt-4o")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    
    # Qdrant Vector DB & RAG
    QDRANT_HOST: str = os.getenv("QDRANT_HOST", "localhost")
    QDRANT_PORT: int = int(os.getenv("QDRANT_PORT", "6333"))
    QDRANT_COLLECTION: str = os.getenv("QDRANT_COLLECTION", "scientific_papers")
    RAG_BATCH_SIZE: int = int(os.getenv("RAG_BATCH_SIZE", "10"))
    
    # Security
    SECRET_KEY: str = os.getenv("SECRET_KEY", "sci-management-secret-key-2026")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

settings = Settings()
