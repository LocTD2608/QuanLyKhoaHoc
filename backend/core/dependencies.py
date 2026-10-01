import os
import sys
import logging
from typing import Optional

# Ensure the root of backend is in the path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi import Header, HTTPException
from core.db import load_db
from core.constants import CUSTOM_VENUES
from services.validation_engine.integrity_checker import IntegrityChecker
from workflows.article_validation_flow import ArticleValidationFlow
from services.scoring.engine import JournalScoringEngine
from services.scoring.models import JournalCategory, JournalRecord
from services.scoring.data_processor import normalize_name

logger = logging.getLogger(__name__)

from services.ai_extraction.ocr_vision_service import ocr_vision_service

# ── Service Singletons ─────────────────────────────────────
integrity_checker = IntegrityChecker()
validation_flow = ArticleValidationFlow()
scoring_engine = JournalScoringEngine.from_default()


# ── Custom Venues Registration ─────────────────────────────
def register_custom_venues():
    for cv in CUSTOM_VENUES:
        name = cv["name"]
        norm = normalize_name(name)
        if norm not in scoring_engine.db.by_name:
            cat_enum_val = cv.get("category_enum")
            category = getattr(JournalCategory, cat_enum_val, JournalCategory.CONFERENCE_INTL_SPECIALIZED)
            rec = JournalRecord(
                name=name,
                category=category,
                issn=None,
                field=cv.get("field", "Công nghệ thông tin"),
                source="Custom Venues"
            )
            scoring_engine.db.by_name[norm] = rec
            scoring_engine.db._records.append(rec)

register_custom_venues()

# ── Chatbot Singleton (Lazy Loaded with Fallback) ──────────
_chatbot = None

def get_chatbot():
    global _chatbot
    if _chatbot is None:
        try:
            from services.rag_chatbot.chatbot_engine import RAGChatbot
            _chatbot = RAGChatbot()
        except Exception as e:
            logger.warning("Không thể khởi tạo RAGChatbot: %s", e)
            class MockChatbot:
                def query(self, message: str, history=None):
                    return "Chatbot RAG hiện đang trong quá trình bảo trì hoặc thiếu cấu hình LLM.", []
            _chatbot = MockChatbot()
    return _chatbot

# ── Auth Dependency ─────────────────────────────────────────
def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Không có token xác thực")
    token = authorization.split(" ", 1)[1]
    db = load_db()
    user = next((u for u in db.get("users", []) if u["username"] == token), None)
    if not user:
        raise HTTPException(status_code=401, detail="Token không hợp lệ")
    return user
