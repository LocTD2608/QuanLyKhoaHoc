"""
journal_scoring — Engine tính điểm tạp chí cho hệ thống xét chức danh GS/PGS.
"""

from .models import ArticleInput, ScoringResult, JournalRecord
from .engine import JournalScoringEngine

__all__ = [
    "ArticleInput",
    "ScoringResult",
    "JournalRecord",
    "JournalScoringEngine",
]
