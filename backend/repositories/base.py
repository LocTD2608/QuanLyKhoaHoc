"""
repositories/base.py — Interface định nghĩa cho các Repository.
"""

from abc import ABC, abstractmethod
from typing import Generic, TypeVar, List, Optional, Dict, Any

T = TypeVar("T")

class BaseRepository(ABC, Generic[T]):
    @abstractmethod
    def get_all(self) -> List[T]:
        pass

    @abstractmethod
    def get_by_id(self, id: int) -> Optional[T]:
        pass

    @abstractmethod
    def create(self, item: Dict[str, Any]) -> T:
        pass

    @abstractmethod
    def update(self, id: int, item: Dict[str, Any]) -> Optional[T]:
        pass

    @abstractmethod
    def delete(self, id: int) -> bool:
        pass
