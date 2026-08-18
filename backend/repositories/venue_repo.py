"""
repositories/venue_repo.py — Quản lý venues (tạp chí, hội nghị).
"""

from typing import List, Optional, Dict, Any
from repositories.json_repo import JSONRepository

class VenueRepository(JSONRepository):
    def __init__(self):
        super().__init__("venues")

    def get_by_type(self, venue_type: str) -> List[Dict[str, Any]]:
        return self.filter(lambda v: v.get("type") == venue_type)

    def search_by_name(self, query: str) -> List[Dict[str, Any]]:
        q = query.lower().strip()
        return self.filter(lambda v: q in v.get("name", "").lower() or q in v.get("abbreviation", "").lower())
