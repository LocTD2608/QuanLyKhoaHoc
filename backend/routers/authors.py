from datetime import datetime
from fastapi import APIRouter, Depends
from core.dependencies import get_current_user
from core.schemas import AuthorCreate
from core.exceptions import NotFoundException
from repositories import author_repo, paper_repo, team_repo

router = APIRouter()

def _populate_author_extras(author: dict, all_teams: list = None, all_papers: list = None, all_authors_map: dict = None) -> dict:
    if all_teams is None:
        all_teams = team_repo.get_all()
    if all_papers is None:
        all_papers = paper_repo.get_all()
    if all_authors_map is None:
        all_authors_map = {a["id"]: a["name"] for a in author_repo.get_all()}
        
    author_id = author.get("id")
    year = datetime.now().year
    
    # Belonging teams
    belonging_teams = []
    for t in all_teams:
        for m in t.get("members", []):
            if m.get("author_id") == author_id:
                belonging_teams.append({
                    "id": t["id"],
                    "name": t["name"],
                    "team_role": m.get("team_role", "Thành viên"),
                    "kpi_papers": m.get("kpi_papers", 0),
                    "is_leader": t.get("leader_id") == author_id
                })
                
    # Papers authored by this member
    author_papers = [p for p in all_papers if author_id in p.get("author_ids", [])]
    author_papers.sort(key=lambda x: (x.get("year", 0), x.get("id", 0)), reverse=True)
    
    # Top co-authors
    coauthor_counts = {}
    for p in author_papers:
        for ca_id in p.get("author_ids", []):
            if ca_id != author_id:
                ca_name = all_authors_map.get(ca_id, f"Tác giả #{ca_id}")
                if ca_id not in coauthor_counts:
                    coauthor_counts[ca_id] = {"id": ca_id, "name": ca_name, "count": 0}
                coauthor_counts[ca_id]["count"] += 1
                
    top_coauthors = sorted(coauthor_counts.values(), key=lambda x: x["count"], reverse=True)
    achieved_this_year = sum(1 for p in author_papers if p.get("year") == year and p.get("status") == "published")
    in_progress_count = sum(1 for p in author_papers if p.get("status") in ["in_review", "accepted"])
    
    return {
        **author,
        "teams": belonging_teams,
        "papers_count": len(author_papers),
        "achieved_this_year": achieved_this_year,
        "in_progress_count": in_progress_count,
        "top_coauthors": top_coauthors,
        "papers": author_papers
    }

@router.get("")
def list_authors(user=Depends(get_current_user)):
    authors = author_repo.get_all()
    all_teams = team_repo.get_all()
    all_papers = paper_repo.get_all()
    all_authors_map = {a["id"]: a["name"] for a in authors}
    return [_populate_author_extras(a, all_teams, all_papers, all_authors_map) for a in authors]

@router.get("/{author_id}")
def get_author(author_id: int, user=Depends(get_current_user)):
    a = author_repo.get_by_id(author_id)
    if not a:
        raise NotFoundException("Không tìm thấy tác giả")
    return _populate_author_extras(a)

@router.post("", status_code=201)
def create_author(req: AuthorCreate, user=Depends(get_current_user)):
    a = req.dict()
    a["created_at"] = datetime.now().isoformat()
    created = author_repo.create(a)
    return _populate_author_extras(created)

@router.put("/{author_id}")
def update_author(author_id: int, req: AuthorCreate, user=Depends(get_current_user)):
    existing = author_repo.get_by_id(author_id)
    if not existing:
        raise NotFoundException("Không tìm thấy tác giả")
    updated = req.dict()
    updated["created_at"] = existing.get("created_at", "")
    res = author_repo.update(author_id, updated)
    return _populate_author_extras(res)

@router.delete("/{author_id}", status_code=204)
def delete_author(author_id: int, user=Depends(get_current_user)):
    if not author_repo.delete(author_id):
        raise NotFoundException("Không tìm thấy tác giả để xóa")

