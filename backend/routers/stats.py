from fastapi import APIRouter, Depends
from core.dependencies import get_current_user
from repositories import paper_repo, author_repo, team_repo

router = APIRouter()

@router.get("/overview")
def stats_overview(user=Depends(get_current_user)):
    papers = paper_repo.get_all()
    authors = author_repo.get_all()
    teams = team_repo.get_all()
    return {
        "total_papers": len(papers),
        "published": sum(1 for p in papers if p.get("status") == "published"),
        "in_review": sum(1 for p in papers if p.get("status") == "in_review"),
        "q1_papers": sum(1 for p in papers if (p.get("ranking") or "").upper() == "Q1"),
        "authors": len(authors),
        "teams": len(teams),
        "papers_by_year": _papers_by_year(papers),
        "papers_by_ranking": _papers_by_ranking(papers),
    }

def _papers_by_year(papers):
    result = {}
    for p in papers:
        y = str(p.get("year", "")).strip()
        if not y or y == "0" or y == "None":
            continue
        result[y] = result.get(y, 0) + 1
    return [{"year": k, "count": v} for k, v in sorted(result.items())]

def _papers_by_ranking(papers):
    result = {}
    for p in papers:
        r = (p.get("ranking") or "").strip() or "Other"
        result[r] = result.get(r, 0) + 1
    return [{"ranking": k, "count": v} for k, v in result.items()]
