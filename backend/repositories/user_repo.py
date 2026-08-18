"""
repositories/user_repo.py — Quản lý tài khoản người dùng và xác thực.
"""

from typing import Optional, Dict, Any
from repositories.json_repo import JSONRepository

class UserRepository(JSONRepository):
    def __init__(self):
        super().__init__("users")

    def get_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        return self.find_one(lambda u: u.get("username") == username)

    def verify_credentials(self, username: str, password: str) -> Optional[Dict[str, Any]]:
        return self.find_one(lambda u: u.get("username") == username and u.get("password") == password)
