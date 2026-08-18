from datetime import datetime
from fastapi import APIRouter, Depends
from core.dependencies import get_current_user
from core.schemas import TeamCreate, TeamMemberAdd, TeamMemberUpdate
from core.exceptions import NotFoundException
from repositories import team_repo, author_repo, paper_repo

router = APIRouter()

def _populate_team_members(team: dict) -> dict:
    authors = {a["id"]: a for a in author_repo.get_all()}
    papers = paper_repo.get_all()
    year = datetime.now().year
    
    t_copy = dict(team)
    members = []
    member_ids = set()
    
    for m in team.get("members", []):
        author_id = m.get("author_id")
        a = authors.get(author_id)
        if a:
            member_ids.add(author_id)
            author_papers = [p for p in papers if author_id in p.get("author_ids", [])]
            achieved = sum(1 for p in author_papers
                           if p.get("year") == year
                           and p.get("status") == "published")
            in_progress = sum(1 for p in author_papers
                              if p.get("status") in ["in_review", "accepted"])
            members.append({
                **a,
                "team_role": m.get("team_role", "Thành viên"),
                "kpi_papers": m.get("kpi_papers", 0),
                "achieved": achieved,
                "in_progress": in_progress,
                "total_papers": len(author_papers)
            })
            
    # Find all papers associated with this team (papers where at least 1 author is in this team)
    team_papers = []
    collaborative_papers = []
    for p in papers:
        p_authors = p.get("author_ids", [])
        shared_team_authors = [aid for aid in p_authors if aid in member_ids]
        if shared_team_authors:
            team_paper_info = {
                **p,
                "team_author_ids": shared_team_authors,
                "team_author_names": [authors[aid]["name"] for aid in shared_team_authors if aid in authors],
                "is_collaborative": len(shared_team_authors) >= 2
            }
            team_papers.append(team_paper_info)
            if len(shared_team_authors) >= 2:
                collaborative_papers.append(team_paper_info)
                
    # Sort papers by year desc, then id desc
    team_papers.sort(key=lambda x: (x.get("year", 0), x.get("id", 0)), reverse=True)
    
    # Calculate unique team published papers this year
    team_achieved_this_year = sum(1 for p in team_papers if p.get("year") == year and p.get("status") == "published")
    in_progress_count = sum(1 for p in team_papers if p.get("status") in ["in_review", "accepted"])
    
    # Leader info
    leader_id = team.get("leader_id")
    leader = authors.get(leader_id) if leader_id else None
    
    t_copy["members"] = members
    t_copy["papers"] = team_papers
    t_copy["total_papers_count"] = len(team_papers)
    t_copy["achieved"] = team_achieved_this_year
    t_copy["in_progress_count"] = in_progress_count
    t_copy["collaborative_count"] = len(collaborative_papers)
    t_copy["leader"] = leader
    return t_copy

@router.get("")
def list_teams(user=Depends(get_current_user)):
    teams = team_repo.get_all()
    return [_populate_team_members(t) for t in teams]

@router.get("/{team_id}")
def get_team(team_id: int, user=Depends(get_current_user)):
    t = team_repo.get_by_id(team_id)
    if not t:
        raise NotFoundException("Không tìm thấy nhóm")
    return _populate_team_members(t)

@router.post("", status_code=201)
def create_team(req: TeamCreate, user=Depends(get_current_user)):
    t_data = req.dict()
    t_data["members"] = []
    created = team_repo.create(t_data)
    return _populate_team_members(created)

@router.put("/{team_id}")
def update_team(team_id: int, req: TeamCreate, user=Depends(get_current_user)):
    existing = team_repo.get_by_id(team_id)
    if not existing:
        raise NotFoundException("Không tìm thấy nhóm")
    updated_data = req.dict()
    updated_data["members"] = existing.get("members", [])
    updated = team_repo.update(team_id, updated_data)
    return _populate_team_members(updated)

@router.delete("/{team_id}", status_code=204)
def delete_team(team_id: int, user=Depends(get_current_user)):
    if not team_repo.delete(team_id):
        raise NotFoundException("Không tìm thấy nhóm để xóa")

@router.post("/{team_id}/members")
def add_team_member(team_id: int, body: dict, user=Depends(get_current_user)):
    author_id = body.get("author_id")
    kpi_papers = body.get("kpi_papers", 0)
    team_role = body.get("team_role", "Thành viên")
    
    team = team_repo.add_member(team_id, author_id, kpi_papers, team_role)
    if not team:
        raise NotFoundException("Không tìm thấy nhóm")
    return _populate_team_members(team_repo.get_by_id(team_id))

@router.put("/{team_id}/members/{author_id}")
def update_team_member(team_id: int, author_id: int, body: dict, user=Depends(get_current_user)):
    kpi_papers = body.get("kpi_papers")
    team_role = body.get("team_role")
    team = team_repo.update_member_kpi(team_id, author_id, kpi_papers, team_role)
    if not team:
        raise NotFoundException("Không tìm thấy nhóm hoặc thành viên")
    return _populate_team_members(team_repo.get_by_id(team_id))

@router.delete("/{team_id}/members/{author_id}", status_code=204)
def remove_team_member(team_id: int, author_id: int, user=Depends(get_current_user)):
    team = team_repo.remove_member(team_id, author_id)
    if not team:
        raise NotFoundException("Không tìm thấy nhóm để xóa thành viên")

