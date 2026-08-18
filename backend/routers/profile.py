from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from core.db import load_db, save_db
from core.dependencies import get_current_user, scoring_engine
from services.scoring.models import ArticleInput, AuthorRole, ScoringStatus
from core.schemas import ScholarSyncRequest
from services.api_integration.scholar_client import ScholarClient
from services.ai_extraction.author_disambiguation import match_author_names
from thefuzz import fuzz

router = APIRouter()

@router.get("")
def get_profile(user=Depends(get_current_user)):
    db = load_db()
    author = next((a for a in db["authors"] if a["id"] == user.get("author_id")), None)
    
    if not author:
        return {"user": user, "papers": [], "totals": {}, "pgs": {}, "gs": {}}
        
    papers = [p for p in db["papers"] if author["id"] in p.get("author_ids", [])]
    
    # Calculate detailed scores
    # Filter for active papers (published, in_review) to count points
    active_papers = [p for p in papers if p.get("status") in ("published", "in_review")]
    
    academic_field = author.get("academic_field") or "Công nghệ thông tin"
    eval_year = 2026
    
    # Standard ArticleInput objects for PGS and GS evaluations
    inputs_pgs = []
    inputs_gs = []
    
    for p in active_papers:
        is_main = (p.get("main_author_id") == author["id"])
        role = AuthorRole.MAIN if is_main else AuthorRole.MEMBER
        
        num_authors = len(p.get("author_ids", []))
        if num_authors == 0:
            num_authors = 1
            
        pub_year = p.get("year") or 2026
        issn_val = p.get("issn") or ""
        
        inp_pgs = ArticleInput(
            journal_name=p.get("journal_name", ""),
            issn=issn_val,
            author_role=role,
            num_authors=num_authors,
            academic_field=academic_field,
            pub_year=pub_year,
            eval_year=eval_year,
            target_title="PGS"
        )
        inp_gs = ArticleInput(
            journal_name=p.get("journal_name", ""),
            issn=issn_val,
            author_role=role,
            num_authors=num_authors,
            academic_field=academic_field,
            pub_year=pub_year,
            eval_year=eval_year,
            target_title="GS"
        )
        inputs_pgs.append(inp_pgs)
        inputs_gs.append(inp_gs)
        
    # Calculate evaluations
    eval_pgs = scoring_engine.validate_eligibility(inputs_pgs) if inputs_pgs else {
        "total_score": 0.0, "last3_score": 0.0, "specialized_score": 0.0, "main_count": 0,
        "all_pass": False, "checks": {"ok_total": [False], "ok_last3": [False], "ok_main": [False], "ok_spec": [False]},
        "standards": {"min_total": 10.0, "min_last3": 2.5, "min_main": 3, "min_specialized": 6.0},
        "results": []
    }
    
    eval_gs = scoring_engine.validate_eligibility(inputs_gs) if inputs_gs else {
        "total_score": 0.0, "last3_score": 0.0, "specialized_score": 0.0, "main_count": 0,
        "all_pass": False, "checks": {"ok_total": [False], "ok_last3": [False], "ok_main": [False], "ok_spec": [False]},
        "standards": {"min_total": 20.0, "min_last3": 5.0, "min_main": 5, "min_specialized": 12.0},
        "results": []
    }
    
    # Calculate journal vs conference breakdown
    journal_score = 0.0
    conference_score = 0.0
    
    if "results" in eval_pgs:
        for r in eval_pgs["results"]:
            is_conf = False
            if r.journal and r.journal.category.value.startswith("conf"):
                is_conf = True
            elif r.article.journal_name and ("conference" in r.article.journal_name.lower() or "hội nghị" in r.article.journal_name.lower() or "hội thảo" in r.article.journal_name.lower() or "symposium" in r.article.journal_name.lower() or "workshop" in r.article.journal_name.lower()):
                is_conf = True
                
            if is_conf:
                conference_score += r.final_score
            else:
                journal_score += r.final_score
                
    # Add calculated scores to each paper object to display in the frontend list
    results_list = eval_pgs.get("results", [])
    active_results = {}
    for i, p in enumerate(active_papers):
        if i < len(results_list):
            active_results[p["id"]] = results_list[i]

    scored_papers = []
    for p in papers:
        p_copy = dict(p)
        if p.get("status") in ("published", "in_review"):
            r_res = active_results.get(p["id"])
            p_copy["calculated_score"] = round(r_res.final_score, 2) if r_res else 0.0
            p_copy["max_score"] = round(r_res.max_score, 2) if r_res else 0.0
            p_copy["is_within_3_years"] = r_res.is_in_last_3_years if r_res else False
        else:
            p_copy["calculated_score"] = 0.0
            p_copy["max_score"] = 0.0
            p_copy["is_within_3_years"] = False
        scored_papers.append(p_copy)

    total_papers = len(papers)
    scored_count = sum(1 for p in scored_papers if p.get("status") in ("published", "in_review") and p.get("calculated_score", 0.0) > 0.0)
    
    totals = {
        "total_score": round(eval_pgs.get("total_score", 0.0), 2),
        "last3_score": round(eval_pgs.get("last3_score", 0.0), 2),
        "journal_score": round(journal_score, 2),
        "conference_score": round(conference_score, 2),
        "main_author_papers_count": eval_pgs.get("main_count", 0),
        "total_papers_count": total_papers,
        "scored_papers_count": scored_count
    }
    
    pgs_data = {
        "eligible": eval_pgs.get("all_pass", False),
        "total_score_current": round(eval_pgs.get("total_score", 0.0), 2),
        "total_score_required": eval_pgs.get("standards", {}).get("min_total", 10.0),
        "total_score_pass": eval_pgs.get("checks", {}).get("ok_total", [False])[0],
        
        "last3_score_current": round(eval_pgs.get("last3_score", 0.0), 2),
        "last3_score_required": eval_pgs.get("standards", {}).get("min_last3", 2.5),
        "last3_score_pass": eval_pgs.get("checks", {}).get("ok_last3", [False])[0],
        
        "journal_score_current": round(journal_score, 2),
        "journal_score_required": eval_pgs.get("standards", {}).get("min_specialized", 6.0),
        "journal_score_pass": eval_pgs.get("checks", {}).get("ok_spec", [False])[0],
        
        "main_author_current": eval_pgs.get("main_count", 0),
        "main_author_required": eval_pgs.get("standards", {}).get("min_main", 3),
        "main_author_pass": eval_pgs.get("checks", {}).get("ok_main", [False])[0],
    }
    
    gs_data = {
        "eligible": eval_gs.get("all_pass", False),
        "total_score_current": round(eval_gs.get("total_score", 0.0), 2),
        "total_score_required": eval_gs.get("standards", {}).get("min_total", 20.0),
        "total_score_pass": eval_gs.get("checks", {}).get("ok_total", [False])[0],
        
        "last3_score_current": round(eval_gs.get("last3_score", 0.0), 2),
        "last3_score_required": eval_gs.get("standards", {}).get("min_last3", 5.0),
        "last3_score_pass": eval_gs.get("checks", {}).get("ok_last3", [False])[0],
        
        "journal_score_current": round(journal_score, 2),
        "journal_score_required": eval_gs.get("standards", {}).get("min_specialized", 12.0),
        "journal_score_pass": eval_gs.get("checks", {}).get("ok_spec", [False])[0],
        
        "main_author_current": eval_gs.get("main_count", 0),
        "main_author_required": eval_gs.get("standards", {}).get("min_main", 5),
        "main_author_pass": eval_gs.get("checks", {}).get("ok_main", [False])[0],
    }
    
    return {
        "user": {**user, "author": author},
        "papers": scored_papers,
        "totals": totals,
        "pgs": pgs_data,
        "gs": gs_data
    }

@router.get("/scholar-search")
def search_scholar_authors(query: str, user=Depends(get_current_user)):
    """
    Search for authors across OpenAlex and Semantic Scholar by name or affiliation.
    """
    if not query or len(query.strip()) < 2:
        return []
    client = ScholarClient()
    return client.search_authors(query.strip())

@router.post("/scholar-preview")
def preview_scholar_profile(req: ScholarSyncRequest, user=Depends(get_current_user)):
    """
    Preview academic profile, yearly citation chart, topics, co-authors,
    and analyze paper list (Q1-Q4, duplicate status, PGS points) before importing.
    """
    db = load_db()
    author = next((a for a in db["authors"] if a["id"] == user.get("author_id")), None)
    if not author:
        raise HTTPException(status_code=400, detail="Tài khoản người dùng chưa liên kết với hồ sơ tác giả nào.")

    client = ScholarClient()
    profile = client.get_author_profile(req.scholar_id, source=req.source)
    if not profile:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông tin tác giả từ liên kết hoặc ID đã cung cấp.")

    all_existing_papers = db.get("papers", [])
    academic_field = author.get("academic_field") or "Công nghệ thông tin"
    candidate_name = author["name"]
    eval_year = 2026

    analyzed_papers = []
    for sp in profile.get("papers", []):
        sp_title_lower = (sp.get("title") or "").lower().strip()
        sp_doi = (sp.get("doi") or "").lower().strip()
        sp_year = sp.get("year") or 0
        journal_name = sp.get("journal_name") or ""
        issn_val = sp.get("issn") or ""
        authors = sp.get("authors") or []

        # Check duplicate
        is_duplicate = False
        duplicate_id = None
        for ep in all_existing_papers:
            ep_title_lower = (ep.get("title") or "").lower().strip()
            ep_doi = (ep.get("doi") or "").lower().strip()
            if sp_doi and ep_doi and sp_doi == ep_doi:
                is_duplicate = True
                duplicate_id = ep.get("id")
                break
            if fuzz.ratio(sp_title_lower, ep_title_lower) > 85:
                is_duplicate = True
                duplicate_id = ep.get("id")
                break

        # Determine role
        role = AuthorRole.MAIN
        if authors:
            found_idx = -1
            for idx, a_name in enumerate(authors):
                if match_author_names(candidate_name, a_name):
                    found_idx = idx
                    break
            if found_idx > 0:
                role = AuthorRole.MEMBER

        # Calculate score & Scimago ranking
        ranking = "Q1"
        sjr_score = 1.0
        final_score = 0.0
        try:
            inp = ArticleInput(
                journal_name=journal_name,
                issn=issn_val,
                author_role=role,
                num_authors=len(authors) if authors else 1,
                academic_field=academic_field,
                pub_year=sp_year or eval_year,
                eval_year=eval_year,
                target_title="PGS"
            )
            res = scoring_engine.calculate_score(inp)
            j = res.journal
            ranking = (j.sjr_quartile or j.domestic_rank or "Q1") if j else "Q1"
            if j and j.category.value.startswith("conf"):
                ranking = j.category.value
            sjr_score = (j.jcr_if or 1.0) if j else 1.0
            final_score = round(res.final_score, 2)
        except Exception:
            pass

        is_in_3_years = (eval_year - 3) <= sp_year <= (eval_year - 1) if sp_year else False

        analyzed_papers.append({
            **sp,
            "is_duplicate": is_duplicate,
            "duplicate_id": duplicate_id,
            "ranking": ranking,
            "sjr_score": sjr_score,
            "estimated_score": final_score,
            "author_role": "main" if role == AuthorRole.MAIN else "member",
            "is_within_3_years": is_in_3_years
        })

    return {
        "scholar_id": profile.get("scholar_id") or req.scholar_id,
        "name": profile.get("name"),
        "affiliation": profile.get("affiliation"),
        "citations": profile.get("citations"),
        "h_index": profile.get("h_index"),
        "i10_index": profile.get("i10_index"),
        "source": profile.get("source"),
        "yearly_citations": profile.get("yearly_citations", []),
        "topics": profile.get("topics", []),
        "co_authors": profile.get("co_authors", []),
        "papers": analyzed_papers
    }

@router.post("/sync-scholar")
def sync_scholar(req: ScholarSyncRequest, user=Depends(get_current_user)):
    db = load_db()
    author = next((a for a in db["authors"] if a["id"] == user.get("author_id")), None)
    if not author:
        raise HTTPException(status_code=400, detail="Tài khoản người dùng chưa liên kết với hồ sơ tác giả nào.")
    
    client = ScholarClient()
    profile = client.get_author_profile(req.scholar_id, source=req.source)
    if not profile:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông tin tác giả từ Scholar ID cung cấp.")
    
    # --- Cập nhật chỉ số học thuật ---
    clean_id = profile.get("scholar_id") or req.scholar_id
    author["scholar_id"] = clean_id
    author["scholar_citations"] = profile["citations"]
    author["scholar_h_index"] = profile["h_index"]
    author["scholar_i10_index"] = profile["i10_index"]
    author["scholar_last_synced"] = datetime.now().isoformat()
    if profile.get("yearly_citations"):
        author["scholar_yearly_citations"] = profile["yearly_citations"]
    if profile.get("topics"):
        author["scholar_topics"] = profile["topics"]
    if profile.get("co_authors"):
        author["scholar_co_authors"] = profile["co_authors"]
    
    # --- Tự động import bài báo mới ---
    existing_papers = db.get("papers", [])
    candidate_name = author["name"]
    academic_field = author.get("academic_field") or "Công nghệ thông tin"
    eval_year = 2026
    
    # Tạo next_id cho paper mới
    next_id = max((p["id"] for p in existing_papers), default=0) + 1
    
    imported_count = 0
    skipped_count = 0
    imported_titles = []

    for sp in profile.get("papers", []):
        sp_title_lower = (sp.get("title") or "").lower().strip()
        sp_doi = (sp.get("doi") or "").lower().strip()
        sp_year = sp.get("year") or 0
        journal_name = sp.get("journal_name") or ""
        issn_val = sp.get("issn") or ""
        authors = sp.get("authors") or []

        # Bỏ qua bài không có tiêu đề hoặc năm
        if not sp_title_lower or sp_year == 0:
            skipped_count += 1
            continue

        # Kiểm tra trùng lặp trong toàn bộ DB (không chỉ bài của author)
        matched = False
        for ep in existing_papers:
            ep_title_lower = (ep.get("title") or "").lower().strip()
            ep_doi = (ep.get("doi") or "").lower().strip()

            if sp_doi and ep_doi and sp_doi == ep_doi:
                matched = True
                break
            if fuzz.ratio(sp_title_lower, ep_title_lower) > 85:
                matched = True
                break

        if matched:
            skipped_count += 1
            continue

        # Xác định vai trò tác giả
        role = AuthorRole.MAIN
        role_str = "main"
        if authors:
            found_idx = -1
            for idx, a_name in enumerate(authors):
                if match_author_names(candidate_name, a_name):
                    found_idx = idx
                    break
            if found_idx > 0:
                role = AuthorRole.MEMBER
                role_str = "member"

        # Tính toán Scimago rank và điểm quy đổi ban đầu
        ranking = "Q1"
        sjr_score = 1.0
        final_score = 0.0
        try:
            inp = ArticleInput(
                journal_name=journal_name,
                issn=issn_val,
                author_role=role,
                num_authors=len(authors) if authors else 1,
                academic_field=academic_field,
                pub_year=sp_year,
                eval_year=eval_year,
                target_title="PGS"
            )
            res = scoring_engine.calculate_score(inp)
            j = res.journal
            ranking = (j.sjr_quartile or j.domestic_rank or "Q1") if j else "Q1"
            if j and j.category.value.startswith("conf"):
                ranking = j.category.value
            sjr_score = (j.jcr_if or 1.0) if j else 1.0
            final_score = round(res.final_score, 2)
        except Exception:
            pass

        # Tạo bản ghi bài báo mới với đầy đủ metadata
        new_paper = {
            "id": next_id,
            "title": sp.get("title", "Untitled"),
            "journal_name": journal_name,
            "issn": issn_val,
            "doi": sp.get("doi") or "",
            "year": sp_year,
            "status": "published",
            "author_ids": [author["id"]],
            "main_author_id": author["id"] if role_str == "main" else None,
            "corresponding_author_id": None,
            "author_roles": {str(author["id"]): role_str},
            "ranking": ranking,
            "sjr_score": sjr_score,
            "notes": f"[Đồng bộ từ Scholar - {profile.get('source', 'auto')}] Điểm quy đổi: {final_score}",
            "is_ai_verified": bool(sp.get("doi")),
            "ai_mismatches": [],
            "ai_metadata": None,
            "scholar_citations": sp.get("citations") or 0,
            "scholar_authors": authors,
            "created_at": datetime.now().isoformat()
        }

        db["papers"].append(new_paper)
        imported_titles.append(sp.get("title", "Untitled"))
        next_id += 1
        imported_count += 1

    save_db(db)
    
    return {
        "status": "success",
        "message": f"Đồng bộ thành công. Đã import {imported_count} bài báo mới, bỏ qua {skipped_count} bài đã tồn tại.",
        "author": author,
        "profile": {
            "scholar_id": clean_id,
            "name": profile["name"],
            "affiliation": profile["affiliation"],
            "citations": profile["citations"],
            "h_index": profile["h_index"],
            "i10_index": profile["i10_index"],
            "source": profile["source"],
            "yearly_citations": profile.get("yearly_citations", []),
            "topics": profile.get("topics", []),
            "co_authors": profile.get("co_authors", [])
        },
        "import_summary": {
            "imported": imported_count,
            "skipped": skipped_count,
            "imported_titles": imported_titles
        }
    }

@router.get("/scholar-papers")
def get_scholar_papers(scholar_id: str, source: str = "auto", user=Depends(get_current_user)):
    db = load_db()
    author = next((a for a in db["authors"] if a["id"] == user.get("author_id")), None)
    if not author:
        raise HTTPException(status_code=400, detail="Tài khoản người dùng chưa liên kết với hồ sơ tác giả nào.")
    
    client = ScholarClient()
    profile = client.get_author_profile(scholar_id, source=source)
    if not profile:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông tin bài viết từ Scholar ID.")
    
    existing_papers = [p for p in db["papers"] if author["id"] in p.get("author_ids", [])]
    all_existing_papers = db.get("papers", [])
    academic_field = author.get("academic_field") or "Công nghệ thông tin"
    candidate_name = author["name"]
    eval_year = 2026

    unimported_papers = []
    for sp in profile.get("papers", []):
        matched = False
        sp_title_lower = sp.get("title", "").lower().strip()
        sp_doi = sp.get("doi", "").lower().strip()
        sp_year = sp.get("year") or 0
        journal_name = sp.get("journal_name") or ""
        issn_val = sp.get("issn") or ""
        authors = sp.get("authors") or []
        
        for ep in all_existing_papers:
            ep_title_lower = ep.get("title", "").lower().strip()
            ep_doi = ep.get("doi", "").lower().strip()
            
            if sp_doi and ep_doi and sp_doi == ep_doi:
                matched = True
                break
                
            if fuzz.ratio(sp_title_lower, ep_title_lower) > 85:
                matched = True
                break
                
        if not matched:
            role = AuthorRole.MAIN
            if authors:
                found_idx = -1
                for idx, a_name in enumerate(authors):
                    if match_author_names(candidate_name, a_name):
                        found_idx = idx
                        break
                if found_idx > 0:
                    role = AuthorRole.MEMBER

            ranking = "Q1"
            sjr_score = 1.0
            final_score = 0.0
            try:
                inp = ArticleInput(
                    journal_name=journal_name,
                    issn=issn_val,
                    author_role=role,
                    num_authors=len(authors) if authors else 1,
                    academic_field=academic_field,
                    pub_year=sp_year or eval_year,
                    eval_year=eval_year,
                    target_title="PGS"
                )
                res = scoring_engine.calculate_score(inp)
                j = res.journal
                ranking = (j.sjr_quartile or j.domestic_rank or "Q1") if j else "Q1"
                if j and j.category.value.startswith("conf"):
                    ranking = j.category.value
                sjr_score = (j.jcr_if or 1.0) if j else 1.0
                final_score = round(res.final_score, 2)
            except Exception:
                pass

            is_in_3_years = (eval_year - 3) <= sp_year <= (eval_year - 1) if sp_year else False

            unimported_papers.append({
                **sp,
                "ranking": ranking,
                "sjr_score": sjr_score,
                "estimated_score": final_score,
                "author_role": "main" if role == AuthorRole.MAIN else "member",
                "is_within_3_years": is_in_3_years
            })
            
    return {
        "scholar_id": profile.get("scholar_id") or scholar_id,
        "source": profile.get("source", "auto"),
        "papers": unimported_papers
    }

