"""
repositories — Data Access Layer cho Hệ thống Quản lý Khoa học
"""

from .base import BaseRepository
from .json_repo import JSONRepository
from .paper_repo import PaperRepository
from .author_repo import AuthorRepository
from .team_repo import TeamRepository
from .venue_repo import VenueRepository
from .user_repo import UserRepository

paper_repo = PaperRepository()
author_repo = AuthorRepository()
team_repo = TeamRepository()
venue_repo = VenueRepository()
user_repo = UserRepository()

__all__ = [
    "BaseRepository",
    "JSONRepository",
    "PaperRepository",
    "AuthorRepository",
    "TeamRepository",
    "VenueRepository",
    "UserRepository",
    "paper_repo",
    "author_repo",
    "team_repo",
    "venue_repo",
    "user_repo",
]
