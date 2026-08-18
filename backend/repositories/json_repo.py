"""
repositories/json_repo.py — Generic JSON Repository cho db.json
"""

from typing import List, Optional, Dict, Any, Callable
from core.db import load_db, save_db, next_id
from repositories.base import BaseRepository

class JSONRepository(BaseRepository[Dict[str, Any]]):
    def __init__(self, collection_name: str):
        self.collection_name = collection_name

    def _get_db(self) -> dict:
        return load_db()

    def _save_db(self, db: dict) -> None:
        save_db(db)

    def get_all(self) -> List[Dict[str, Any]]:
        db = self._get_db()
        return list(db.get(self.collection_name, []))

    def filter(self, predicate: Callable[[Dict[str, Any]], bool]) -> List[Dict[str, Any]]:
        db = self._get_db()
        return [item for item in db.get(self.collection_name, []) if predicate(item)]

    def get_by_id(self, id: int) -> Optional[Dict[str, Any]]:
        db = self._get_db()
        return next((item for item in db.get(self.collection_name, []) if item.get("id") == id), None)

    def find_one(self, predicate: Callable[[Dict[str, Any]], bool]) -> Optional[Dict[str, Any]]:
        db = self._get_db()
        return next((item for item in db.get(self.collection_name, []) if predicate(item)), None)

    def create(self, item: Dict[str, Any]) -> Dict[str, Any]:
        db = self._get_db()
        if "id" not in item or item["id"] is None:
            item["id"] = next_id(db, self.collection_name)
        db.setdefault(self.collection_name, []).append(item)
        self._save_db(db)
        return item

    def update(self, id: int, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        db = self._get_db()
        items = db.get(self.collection_name, [])
        idx = next((i for i, it in enumerate(items) if it.get("id") == id), None)
        if idx is None:
            return None
        existing = items[idx]
        existing.update(updates)
        existing["id"] = id
        db[self.collection_name][idx] = existing
        self._save_db(db)
        return existing

    def delete(self, id: int) -> bool:
        db = self._get_db()
        items = db.get(self.collection_name, [])
        new_items = [it for it in items if it.get("id") != id]
        if len(new_items) == len(items):
            return False
        db[self.collection_name] = new_items
        self._save_db(db)
        return True
