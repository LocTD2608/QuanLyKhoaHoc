"""
scripts/migrate_from_json.py — Script nạp và đồng bộ dữ liệu từ db.json vào Database quan hệ (PostgreSQL / SQLite).
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, Any

# Ensure backend root is in sys.path
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from sqlalchemy.orm import Session
from models.sql_models import User, Author, Paper, PaperAuthor, Team, TeamMember, Venue

def parse_date(date_str):
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str)
    except Exception:
        return None

def migrate_data(session: Session, json_path: Path):
    """Đọc dữ liệu từ file json và insert vào DB."""
    if not json_path.exists():
        print(f"[Migration] File {json_path} does not exist.")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 1. Migrate Authors
    authors_data = data.get("authors", [])
    author_map = {}
    for a in authors_data:
        author = Author(
            id=a.get("id"),
            name=a.get("name", "Unknown"),
            email=a.get("email", ""),
            affiliation=a.get("affiliation", ""),
            is_member=a.get("is_member", True),
            group_type=a.get("group_type", ""),
            member_role=a.get("member_role", ""),
            academic_field=a.get("academic_field", ""),
            scholar_id=a.get("scholar_id"),
            scholar_citations=a.get("scholar_citations", 0),
            scholar_h_index=a.get("scholar_h_index", 0),
            scholar_i10_index=a.get("scholar_i10_index", 0),
            scholar_last_synced=parse_date(a.get("scholar_last_synced")),
            created_at=parse_date(a.get("created_at")) or datetime.utcnow()
        )
        session.merge(author)
        author_map[a.get("id")] = author
    session.commit()

    # 2. Migrate Users
    users_data = data.get("users", [])
    for u in users_data:
        user = User(
            id=u.get("id"),
            username=u.get("username"),
            password=u.get("password"),
            role=u.get("role", "user"),
            author_id=u.get("author_id"),
            created_at=datetime.utcnow()
        )
        session.merge(user)
    session.commit()

    # 3. Migrate Papers
    papers_data = data.get("papers", [])
    for p in papers_data:
        paper_id = p.get("id")
        paper = Paper(
            id=paper_id,
            title=p.get("title", ""),
            journal_name=p.get("journal_name", ""),
            doi=p.get("doi", ""),
            year=p.get("year", 2024),
            status=p.get("status", "in_review"),
            ranking=p.get("ranking"),
            sjr_score=p.get("sjr_score"),
            issn=p.get("issn", ""),
            notes=p.get("notes", ""),
            is_ai_verified=p.get("is_ai_verified", False),
            ai_mismatches=p.get("ai_mismatches", []),
            ai_metadata=p.get("ai_metadata", {}),
            main_author_id=p.get("main_author_id"),
            corresponding_author_id=p.get("corresponding_author_id"),
            author_roles=p.get("author_roles", {}),
            created_at=parse_date(p.get("created_at")) or datetime.utcnow(),
            updated_at=parse_date(p.get("updated_at")) or datetime.utcnow()
        )
        session.merge(paper)
        session.flush()

        # Delete existing author links for paper
        session.query(PaperAuthor).filter(PaperAuthor.paper_id == paper_id).delete()
        author_ids = p.get("author_ids", [])
        author_roles = p.get("author_roles", {})
        for idx, a_id in enumerate(author_ids):
            role = author_roles.get(str(a_id), "member")
            link = PaperAuthor(
                paper_id=paper_id,
                author_id=a_id,
                author_order=idx + 1,
                role=role
            )
            session.add(link)
    session.commit()

    # 4. Migrate Teams
    teams_data = data.get("teams", [])
    for t in teams_data:
        team_id = t.get("id")
        team = Team(
            id=team_id,
            name=t.get("name"),
            description=t.get("description", ""),
            leader_id=t.get("leader_id"),
            kpi_papers_per_year=t.get("kpi_papers_per_year", 0),
            created_at=datetime.utcnow()
        )
        session.merge(team)
        session.flush()

        session.query(TeamMember).filter(TeamMember.team_id == team_id).delete()
        for m in t.get("members", []):
            member = TeamMember(
                team_id=team_id,
                author_id=m.get("author_id"),
                team_role=m.get("team_role", "Thành viên"),
                kpi_papers=m.get("kpi_papers", 0)
            )
            session.add(member)
    session.commit()

    # 5. Migrate Venues
    venues_data = data.get("venues", [])
    for v in venues_data:
        venue = Venue(
            id=v.get("id"),
            name=v.get("name"),
            abbreviation=v.get("abbreviation", ""),
            type=v.get("type", "journal"),
            ranking=v.get("ranking"),
            impact_factor=v.get("impact_factor"),
            sjr_score=v.get("sjr_score"),
            url=v.get("url", ""),
            deadline=v.get("deadline"),
            location=v.get("location", "")
        )
        session.merge(venue)
    session.commit()
    print(f"[Migration] Successfully seeded data into Database!")


def sync_dict_to_sql(session: Session, data: Dict[str, Any]):
    """Sync data dictionary to SQL tables."""
    import tempfile
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
        temp_json = Path(f.name)
    try:
        migrate_data(session, temp_json)
    finally:
        if temp_json.exists():
            temp_json.unlink()


if __name__ == "__main__":
    from core.database import SessionLocal, init_db
    init_db()
    db = SessionLocal()
    json_p = Path(__file__).parent.parent / "data" / "db.json"
    migrate_data(db, json_p)
    db.close()
