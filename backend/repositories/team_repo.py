"""
repositories/team_repo.py — Quản lý các nhóm nghiên cứu (Research Teams).
"""

from typing import List, Optional, Dict, Any
from repositories.json_repo import JSONRepository

class TeamRepository(JSONRepository):
    def __init__(self):
        super().__init__("teams")

    def add_member(self, team_id: int, author_id: int, kpi_papers: int = 0, team_role: str = "Thành viên") -> Optional[Dict[str, Any]]:
        db = self._get_db()
        teams = db.get("teams", [])
        team = next((t for t in teams if t.get("id") == team_id), None)
        if not team:
            return None
        # Check if already member
        existing = next((m for m in team.get("members", []) if m.get("author_id") == author_id), None)
        if existing:
            existing["kpi_papers"] = kpi_papers
            if team_role:
                existing["team_role"] = team_role
        else:
            team.setdefault("members", []).append({
                "author_id": author_id,
                "team_role": team_role or "Thành viên",
                "kpi_papers": kpi_papers
            })
        self._save_db(db)
        return team

    def update_member_kpi(self, team_id: int, author_id: int, kpi_papers: Optional[int] = None, team_role: Optional[str] = None) -> Optional[Dict[str, Any]]:
        db = self._get_db()
        teams = db.get("teams", [])
        team = next((t for t in teams if t.get("id") == team_id), None)
        if not team:
            return None
        for m in team.get("members", []):
            if m.get("author_id") == author_id:
                if kpi_papers is not None:
                    m["kpi_papers"] = kpi_papers
                if team_role is not None:
                    m["team_role"] = team_role
        self._save_db(db)
        return team

    def remove_member(self, team_id: int, author_id: int) -> Optional[Dict[str, Any]]:
        db = self._get_db()
        teams = db.get("teams", [])
        team = next((t for t in teams if t.get("id") == team_id), None)
        if not team:
            return None
        team["members"] = [m for m in team.get("members", []) if m.get("author_id") != author_id]
        self._save_db(db)
        return team
