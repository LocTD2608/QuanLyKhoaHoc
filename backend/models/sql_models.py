"""
models/sql_models.py — Định nghĩa các bảng Database chuẩn hóa với SQLAlchemy ORM.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy import (
    Column, Integer, String, Boolean, Float, Text, DateTime, ForeignKey, JSON
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(100), unique=True, index=True, nullable=False)
    password = Column(String(255), nullable=False)
    role = Column(String(50), default="user", nullable=False)  # admin, lead, user
    author_id = Column(Integer, ForeignKey("authors.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationship
    author = relationship("Author", back_populates="user_account")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "username": self.username,
            "role": self.role,
            "author_id": self.author_id,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class Author(Base):
    __tablename__ = "authors"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), index=True, nullable=False)
    email = Column(String(255), nullable=True)
    affiliation = Column(String(500), nullable=True)
    is_member = Column(Boolean, default=True, nullable=False)
    group_type = Column(String(50), nullable=True)     # NCS, NCKH, HN,...
    member_role = Column(String(50), nullable=True)    # GV, TS, PGS, GS,...
    academic_field = Column(String(255), nullable=True) # Công nghệ thông tin,...
    scholar_id = Column(String(100), nullable=True)
    scholar_citations = Column(Integer, default=0)
    scholar_h_index = Column(Integer, default=0)
    scholar_i10_index = Column(Integer, default=0)
    scholar_last_synced = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    user_account = relationship("User", back_populates="author", uselist=False)
    paper_links = relationship("PaperAuthor", back_populates="author", cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email or "",
            "affiliation": self.affiliation or "",
            "is_member": self.is_member,
            "group_type": self.group_type or "",
            "member_role": self.member_role or "",
            "academic_field": self.academic_field or "",
            "scholar_id": self.scholar_id,
            "scholar_citations": self.scholar_citations,
            "scholar_h_index": self.scholar_h_index,
            "scholar_i10_index": self.scholar_i10_index,
            "scholar_last_synced": self.scholar_last_synced.isoformat() if self.scholar_last_synced else None,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class PaperAuthor(Base):
    __tablename__ = "paper_authors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    paper_id = Column(Integer, ForeignKey("papers.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("authors.id", ondelete="CASCADE"), nullable=False, index=True)
    author_order = Column(Integer, default=1)
    role = Column(String(50), default="member")  # main, corresponding, member

    # Relationships
    paper = relationship("Paper", back_populates="author_links")
    author = relationship("Author", back_populates="paper_links")


class Paper(Base):
    __tablename__ = "papers"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(Text, index=True, nullable=False)
    journal_name = Column(String(500), index=True, nullable=False)
    doi = Column(String(255), index=True, nullable=True)
    year = Column(Integer, index=True, nullable=False)
    status = Column(String(50), default="in_review", nullable=False)  # in_review, published, rejected, accepted
    ranking = Column(String(50), nullable=True)                       # Q1, Q2, Q3, Q4, Vietnam,...
    sjr_score = Column(Float, nullable=True)
    issn = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    is_ai_verified = Column(Boolean, default=False)
    ai_mismatches = Column(JSON, default=list)                         # List of detected issues
    ai_metadata = Column(JSON, default=dict)                           # Full AI analysis payload
    main_author_id = Column(Integer, ForeignKey("authors.id", ondelete="SET NULL"), nullable=True)
    corresponding_author_id = Column(Integer, ForeignKey("authors.id", ondelete="SET NULL"), nullable=True)
    author_roles = Column(JSON, default=dict)                          # e.g. {"1": "main", "2": "corresponding"}
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    author_links = relationship("PaperAuthor", back_populates="paper", cascade="all, delete-orphan", order_by="PaperAuthor.author_order")

    def to_dict(self) -> Dict[str, Any]:
        author_ids = [link.author_id for link in self.author_links] if self.author_links else []
        return {
            "id": self.id,
            "title": self.title,
            "journal_name": self.journal_name,
            "doi": self.doi or "",
            "year": self.year,
            "status": self.status,
            "ranking": self.ranking,
            "sjr_score": self.sjr_score,
            "issn": self.issn or "",
            "notes": self.notes or "",
            "is_ai_verified": self.is_ai_verified,
            "ai_mismatches": self.ai_mismatches or [],
            "ai_metadata": self.ai_metadata or {},
            "main_author_id": self.main_author_id,
            "corresponding_author_id": self.corresponding_author_id,
            "author_ids": author_ids,
            "author_roles": self.author_roles or {},
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(255), unique=True, index=True, nullable=False)
    description = Column(Text, nullable=True)
    leader_id = Column(Integer, ForeignKey("authors.id", ondelete="SET NULL"), nullable=True)
    kpi_papers_per_year = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    members = relationship("TeamMember", back_populates="team", cascade="all, delete-orphan")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description or "",
            "leader_id": self.leader_id,
            "kpi_papers_per_year": self.kpi_papers_per_year,
            "members": [m.to_dict() for m in self.members] if self.members else [],
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(Integer, primary_key=True, autoincrement=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(Integer, ForeignKey("authors.id", ondelete="CASCADE"), nullable=False, index=True)
    team_role = Column(String(100), default="Thành viên")
    kpi_papers = Column(Integer, default=0)

    # Relationships
    team = relationship("Team", back_populates="members")
    author = relationship("Author")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "author_id": self.author_id,
            "team_role": self.team_role or "Thành viên",
            "kpi_papers": self.kpi_papers
        }


class Venue(Base):
    __tablename__ = "venues"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String(500), index=True, nullable=False)
    abbreviation = Column(String(100), nullable=True)
    type = Column(String(50), default="journal")          # journal, conference
    ranking = Column(String(50), nullable=True)           # Q1, Q2, Q3, Q4, CORE A*,...
    impact_factor = Column(Float, nullable=True)
    sjr_score = Column(Float, nullable=True)
    url = Column(String(500), nullable=True)
    deadline = Column(String(100), nullable=True)
    location = Column(String(255), nullable=True)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "abbreviation": self.abbreviation or "",
            "type": self.type,
            "ranking": self.ranking,
            "impact_factor": self.impact_factor,
            "sjr_score": self.sjr_score,
            "url": self.url or "",
            "deadline": self.deadline,
            "location": self.location or ""
        }
