"""
repositories/paper_repo.py — Quản lý truy vấn bài báo khoa học.
"""

from typing import List, Optional, Dict, Any
from repositories.json_repo import JSONRepository

class PaperRepository(JSONRepository):
    def __init__(self):
        super().__init__("papers")

    def get_by_author(self, author_id: int) -> List[Dict[str, Any]]:
        return self.filter(lambda p: author_id in p.get("author_ids", []))

    def get_by_year(self, year: int) -> List[Dict[str, Any]]:
        return self.filter(lambda p: p.get("year") == year)

    def get_by_status(self, status: str) -> List[Dict[str, Any]]:
        return self.filter(lambda p: p.get("status") == status)

    def search_by_title_or_doi(self, query: str) -> List[Dict[str, Any]]:
        q = query.lower().strip()
        return self.filter(lambda p: q in p.get("title", "").lower() or q in p.get("doi", "").lower())
