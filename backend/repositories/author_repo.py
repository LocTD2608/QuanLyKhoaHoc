"""
repositories/author_repo.py — Quản lý tác giả, giảng viên, nghiên cứu viên.
"""

from typing import List, Optional, Dict, Any
from repositories.json_repo import JSONRepository

class AuthorRepository(JSONRepository):
    def __init__(self):
        super().__init__("authors")

    def get_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        return self.find_one(lambda a: a.get("email", "").lower() == email.lower())

    def get_members(self) -> List[Dict[str, Any]]:
        return self.filter(lambda a: a.get("is_member", True))
