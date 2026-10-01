from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from thefuzz import fuzz
from services.ai_extraction.author_disambiguation import match_author_names

from core.db import load_db, save_db, next_id
from core.dependencies import get_current_user, validation_flow, scoring_engine
from core.schemas import PaperCreate, PaperSubmitAIRequest, BulkPaperImportRequest
from services.scoring.models import ArticleInput, AuthorRole

router = APIRouter()


def _compare_with_ai(user_data: dict, ai_metadata: dict, ai_ranking: str) -> list:
    """Compare user-submitted fields against AI-extracted metadata.
    Returns a list of field names that have mismatches."""
    mismatches = []

    def _norm(v):
        return str(v).strip().lower() if v else ""

    ai_title = ai_metadata.get("title", "")
    ai_journal = ai_metadata.get("journal", "")
    ai_issn_list = ai_metadata.get("issn", [])
    ai_issn = ai_issn_list[0] if ai_issn_list else ""
    ai_year = ai_metadata.get("year") or 0

    comparisons = [
        ("title", user_data.get("title", ""), ai_title),
        ("journal_name", user_data.get("journal_name", ""), ai_journal),
        ("issn", user_data.get("issn", ""), ai_issn),
        ("year", str(user_data.get("year", "")), str(ai_year)),
        ("ranking", user_data.get("ranking", ""), ai_ranking),
    ]

    for field, user_val, ai_val in comparisons:
        u = _norm(user_val)
        a = _norm(ai_val)
        # Only flag mismatch if user provided a non-empty value that differs
        if u and a and u != a:
            mismatches.append(field)

    return mismatches


@router.get("")
def list_papers(user=Depends(get_current_user)):
    db = load_db()
    papers = db["papers"]
    authors = {a["id"]: a for a in db["authors"]}
    result = []
    for p in papers:
        p2 = dict(p)
        p2["authors"] = [authors[aid] for aid in p.get("author_ids", []) if aid in authors]
        p2["main_author"] = authors.get(p.get("main_author_id"))
        result.append(p2)
    return result

@router.get("/{paper_id}")
def get_paper(paper_id: int, user=Depends(get_current_user)):
    db = load_db()
    paper = next((p for p in db["papers"] if p["id"] == paper_id), None)
    if not paper:
        raise HTTPException(404, "Không tìm thấy bài báo")
    authors = {a["id"]: a for a in db["authors"]}
    p2 = dict(paper)
    p2["authors"] = [authors[aid] for aid in paper.get("author_ids", []) if aid in authors]
    p2["main_author"] = authors.get(paper.get("main_author_id"))
    p2["activities"] = [a for a in db.get("paper_activities", []) if a["paper_id"] == paper_id]
    return p2

@router.post("", status_code=201)
async def create_paper(req: PaperCreate, user=Depends(get_current_user)):
    db = load_db()
    paper = req.dict()
    if paper.get("sjr_score") is not None:
        try:
            paper["sjr_score"] = float(str(paper["sjr_score"]).replace(",", ".").strip())
        except Exception:
            paper["sjr_score"] = 1.0
    
    if paper["status"] == "published":
        author = next((a for a in db["authors"] if a["id"] == user.get("author_id")), None)
        if not author:
            raise HTTPException(400, "Tài khoản người dùng chưa liên kết với hồ sơ tác giả nào.")
            
        candidate_name = author["name"]
        candidate_history = [author.get("affiliation", "")]
        has_doi = bool(paper.get("doi") and paper["doi"].strip())

        if has_doi:
            try:
                report = await validation_flow.run_validation(
                    doi=paper["doi"].strip(),
                    url="",
                    candidate_name=candidate_name,
                    candidate_title_vn=paper.get("title", ""),
                    candidate_history=candidate_history
                )
            except Exception as e:
                report = {"metadata": None, "verification": {}}
        else:
            report = {"metadata": None, "verification": {}}
            
        metadata = report.get("metadata")
        if not metadata:
            if paper.get("title") and paper.get("journal_name"):
                metadata = {
                    "title": paper.get("title"),
                    "journal": paper.get("journal_name"),
                    "issn": [paper.get("issn")] if paper.get("issn") else [],
                    "year": paper.get("year") or datetime.now().year,
                    "authors": []
                }
            else:
                raise HTTPException(400, "Không thể tìm thấy siêu dữ liệu (metadata) của bài báo. Vui lòng cung cấp DOI hoặc tên bài báo và tạp chí.")
            
        verification = report.get("verification", {})
        integrity = verification.get("integrity", {})
        author_role_data = verification.get("author_role", {})
        
        # Determine role from user input or AI
        if paper.get("author_roles") and str(author["id"]) in paper["author_roles"]:
            user_assigned_role = paper["author_roles"][str(author["id"])]
            role = AuthorRole.MAIN if user_assigned_role in ("main", "corresponding") else AuthorRole.MEMBER
        else:
            role = AuthorRole.MAIN if author_role_data.get("is_main_author") else AuthorRole.MEMBER
            
        authors_meta = metadata.get("authors", [])
        
        # Compute AI-derived values for scoring
        ai_title = metadata.get("title", paper.get("title", "Untitled"))
        ai_journal = metadata.get("journal", paper.get("journal_name", "Unknown Journal"))
        ai_issn_list = metadata.get("issn", [])
        ai_issn = ai_issn_list[0] if ai_issn_list else paper.get("issn", "")
        ai_year = metadata.get("year") or paper.get("year") or datetime.now().year

        # Calculate score using AI metadata (always use AI data for scoring accuracy)
        academic_field = author.get("academic_field") or "Công nghệ thông tin"
        article_input = ArticleInput(
            journal_name=ai_journal,
            issn=ai_issn,
            author_role=role,
            num_authors=len(authors_meta) if authors_meta else (len(paper.get("author_ids", [])) or 1),
            academic_field=academic_field,
            pub_year=ai_year,
            eval_year=2026,
            target_title="PGS"
        )
        
        score_result = scoring_engine.calculate_score(article_input)
        j = score_result.journal
        ai_ranking = paper.get("ranking") or ((j.sjr_quartile or j.domestic_rank or "Q1") if j else "Q1")
        if j and j.category.value.startswith("conf"):
            ai_ranking = j.category.value
            
        sjr_score = paper.get("sjr_score") or ((j.jcr_if or 1.0) if j else 1.0)

        # Compare user-submitted data against AI metadata
        mismatches = _compare_with_ai(paper, metadata, ai_ranking)

        # Auto-fill empty fields with AI data (no mismatch for empty fields)
        if not paper.get("title", "").strip():
            paper["title"] = ai_title
        if not paper.get("journal_name", "").strip():
            paper["journal_name"] = ai_journal
        if not paper.get("issn", "").strip():
            paper["issn"] = ai_issn
        if not paper.get("year") or paper["year"] == datetime.now().year:
            paper["year"] = ai_year
        if not paper.get("ranking", "").strip():
            paper["ranking"] = ai_ranking

        # Store AI verification state
        paper["ai_mismatches"] = mismatches
        paper["is_ai_verified"] = len(mismatches) == 0
        paper["sjr_score"] = sjr_score
        paper["calculated_score"] = score_result.final_score
        paper["max_score"] = score_result.max_score
        paper["is_within_3_years"] = score_result.is_in_last_3_years
        
        # Store AI metadata for frontend reference
        paper["ai_metadata"] = {
            "title": ai_title,
            "journal_name": ai_journal,
            "issn": ai_issn,
            "year": ai_year,
            "ranking": ai_ranking,
        }
        
        # Map matched authors in system (by name)
        author_ids = list(paper.get("author_ids") or [])
        is_user_present = author_role_data.get("is_present", True)
        if is_user_present and author["id"] not in author_ids:
            author_ids.append(author["id"])

        for auth in authors_meta:
            full_name = f"{auth.get('given') or ''} {auth.get('family') or ''}".strip()
            if match_author_names(candidate_name, full_name):
                continue
            matched_auth = next((a for a in db["authors"] if match_author_names(a["name"], full_name)), None)
            if matched_auth:
                author_ids.append(matched_auth["id"])
                
        paper["author_ids"] = list(set(author_ids))

        # Determine roles
        if role == AuthorRole.MAIN:
            paper["main_author_id"] = author["id"]
        elif paper.get("main_author_id"):
            pass
        elif paper["author_ids"]:
            other_ids = [aid for aid in paper["author_ids"] if aid != author["id"]]
            paper["main_author_id"] = other_ids[0] if other_ids else author["id"]
        else:
            paper["main_author_id"] = None

        if author_role_data.get("is_corresponding_author") or (paper.get("author_roles") and paper["author_roles"].get(str(author["id"])) == "corresponding"):
            paper["corresponding_author_id"] = author["id"]
        elif not paper.get("corresponding_author_id"):
            paper["corresponding_author_id"] = None

        if mismatches:
            paper["notes"] = f"⚠️ Thẩm định AI phát hiện sai lệch: {', '.join(mismatches)}. Điểm quy đổi: {score_result.final_score}."
        else:
            paper["notes"] = f"Đăng và thẩm định bởi AI. Điểm quy đổi: {score_result.final_score}."

    # For non-published papers: derive main_author_id from author_roles if provided
    if paper["status"] != "published" and paper.get("author_roles"):
        roles = paper["author_roles"]  # dict str(id) -> role
        main_id = next((int(aid) for aid, r in roles.items() if r in ("main", "corresponding")), None)
        if main_id:
            paper["main_author_id"] = main_id
        corr_id = next((int(aid) for aid, r in roles.items() if r == "corresponding"), None)
        paper["corresponding_author_id"] = corr_id

    paper["id"] = next_id(db, "papers")
    paper["created_at"] = datetime.now().isoformat()
    db["papers"].append(paper)
    save_db(db)
    return paper

@router.put("/{paper_id}")
async def update_paper(paper_id: int, req: PaperCreate, user=Depends(get_current_user)):
    db = load_db()
    idx = next((i for i, p in enumerate(db["papers"]) if p["id"] == paper_id), None)
    if idx is None:
        raise HTTPException(404, "Không tìm thấy bài báo")
    updated = req.dict()
    
    if updated["status"] == "published":
        if not updated.get("doi") or not updated["doi"].strip():
            raise HTTPException(400, "Bài báo đã xuất bản bắt buộc phải có mã DOI để xác thực.")
        
        author = next((a for a in db["authors"] if a["id"] == user.get("author_id")), None)
        if not author:
            raise HTTPException(400, "Tài khoản người dùng chưa liên kết với hồ sơ tác giả nào.")
            
        candidate_name = author["name"]
        candidate_history = [author.get("affiliation", "")]
        
        try:
            report = await validation_flow.run_validation(
                doi=updated["doi"].strip(),
                url="",
                candidate_name=candidate_name,
                candidate_title_vn=updated.get("title", ""),
                candidate_history=candidate_history
            )
        except Exception as e:
            raise HTTPException(500, f"Lỗi xác thực AI: {str(e)}")
            
        if not report.get("metadata"):
            raise HTTPException(400, "Không thể tìm thấy siêu dữ liệu (metadata) của bài báo từ DOI cung cấp.")
            
        metadata = report["metadata"]
        verification = report["verification"]
        integrity = verification.get("integrity", {})
        author_role_data = verification.get("author_role", {})
        
        role = AuthorRole.MAIN if author_role_data.get("is_main_author") else AuthorRole.MEMBER
        authors_meta = metadata.get("authors", [])
        
        # Compute AI-derived values for scoring
        ai_title = metadata.get("title", "Untitled")
        ai_journal = metadata.get("journal", "Unknown Journal")
        ai_issn_list = metadata.get("issn", [])
        ai_issn = ai_issn_list[0] if ai_issn_list else ""
        ai_year = metadata.get("year") or datetime.now().year

        # Calculate score using AI metadata (always use AI data for scoring accuracy)
        academic_field = author.get("academic_field") or "Công nghệ thông tin"
        article_input = ArticleInput(
            journal_name=ai_journal,
            issn=ai_issn,
            author_role=role,
            num_authors=len(authors_meta) if authors_meta else 1,
            academic_field=academic_field,
            pub_year=ai_year,
            eval_year=2026,
            target_title="PGS"
        )
        
        score_result = scoring_engine.calculate_score(article_input)
        j = score_result.journal
        ai_ranking = (j.sjr_quartile or j.domestic_rank or "Q1") if j else "Q1"
        if j and j.category.value.startswith("conf"):
            ai_ranking = j.category.value
            
        sjr_score = (j.jcr_if or 1.0) if j else 1.0

        # Compare user-submitted data against AI metadata
        mismatches = _compare_with_ai(updated, metadata, ai_ranking)

        # Auto-fill empty fields with AI data (no mismatch for empty fields)
        if not updated.get("title", "").strip():
            updated["title"] = ai_title
        if not updated.get("journal_name", "").strip():
            updated["journal_name"] = ai_journal
        if not updated.get("issn", "").strip():
            updated["issn"] = ai_issn
        if not updated.get("year") or updated["year"] == datetime.now().year:
            updated["year"] = ai_year
        if not updated.get("ranking", "").strip():
            updated["ranking"] = ai_ranking

        # Store AI verification state
        updated["ai_mismatches"] = mismatches
        updated["is_ai_verified"] = len(mismatches) == 0
        updated["sjr_score"] = sjr_score
        # Store AI metadata for frontend reference
        updated["ai_metadata"] = {
            "title": ai_title,
            "journal_name": ai_journal,
            "issn": ai_issn,
            "year": ai_year,
            "ranking": ai_ranking,
        }
        
        # Map matched authors in system (by name)
        author_ids = []
        is_user_present = author_role_data.get("is_present", False)
        if is_user_present:
            author_ids.append(author["id"])

        for auth in authors_meta:
            full_name = f"{auth.get('given') or ''} {auth.get('family') or ''}".strip()
            if match_author_names(candidate_name, full_name):
                continue
            matched_auth = next((a for a in db["authors"] if match_author_names(a["name"], full_name)), None)
            if matched_auth:
                author_ids.append(matched_auth["id"])
                
        updated["author_ids"] = list(set(author_ids))

        # Determine roles
        if is_user_present and role == AuthorRole.MAIN:
            updated["main_author_id"] = author["id"]
        elif updated["author_ids"]:
            other_ids = [aid for aid in updated["author_ids"] if aid != author["id"]]
            updated["main_author_id"] = other_ids[0] if other_ids else None
        else:
            updated["main_author_id"] = None

        if is_user_present and author_role_data.get("is_corresponding_author"):
            updated["corresponding_author_id"] = author["id"]
        else:
            updated["corresponding_author_id"] = None

        if mismatches:
            updated["notes"] = f"⚠️ Thẩm định AI phát hiện sai lệch: {', '.join(mismatches)}. Điểm quy đổi: {score_result.final_score}."
        else:
            updated["notes"] = f"Cập nhật và thẩm định bởi AI. Điểm quy đổi: {score_result.final_score}."
    else:
        # For non-published papers: derive main_author_id from author_roles if provided
        if updated.get("author_roles"):
            roles = updated["author_roles"]
            main_id = next((int(aid) for aid, r in roles.items() if r in ("main", "corresponding")), None)
            if main_id:
                updated["main_author_id"] = main_id
            corr_id = next((int(aid) for aid, r in roles.items() if r == "corresponding"), None)
            updated["corresponding_author_id"] = corr_id

    updated["id"] = paper_id
    updated["created_at"] = db["papers"][idx].get("created_at", datetime.now().isoformat())
    db["papers"][idx] = updated
    save_db(db)
    return updated

@router.delete("/{paper_id}", status_code=204)
def delete_paper(paper_id: int, user=Depends(get_current_user)):
    db = load_db()
    db["papers"] = [p for p in db["papers"] if p["id"] != paper_id]
    save_db(db)

@router.post("/{paper_id}/activity")
def add_activity(paper_id: int, body: dict, user=Depends(get_current_user)):
    db = load_db()
    act = {"id": len(db.get("paper_activities", [])) + 1,
           "paper_id": paper_id, "details": body.get("details", ""),
           "created_at": datetime.now().isoformat(), "user": user["username"]}
    db.setdefault("paper_activities", []).append(act)
    save_db(db)
    return act

@router.post("/submit-ai", status_code=201)
async def submit_paper_ai(req: PaperSubmitAIRequest, user=Depends(get_current_user)):
    db = load_db()
    author = next((a for a in db["authors"] if a["id"] == user.get("author_id")), None)
    if not author:
        raise HTTPException(400, "User has no associated author profile.")
        
    candidate_name = author["name"]
    candidate_history = [author.get("affiliation", "")]
    
    try:
        report = await validation_flow.run_validation(
            doi=req.doi.strip(),
            url=req.url.strip() if req.url else "",
            candidate_name=candidate_name,
            candidate_title_vn=req.candidate_title_vn or "",
            candidate_history=candidate_history
        )
    except Exception as e:
        raise HTTPException(500, f"Lỗi xác thực bài báo qua AI: {str(e)}")
        
    if not report.get("metadata"):
        raise HTTPException(400, "Không thể tìm thấy siêu dữ liệu (metadata) của bài báo từ DOI cung cấp.")
        
    metadata = report["metadata"]
    verification = report["verification"]
    integrity = verification.get("integrity", {})
    author_role_data = verification.get("author_role", {})
    
    title = metadata.get("title", "Untitled")
    journal_name = metadata.get("journal", "Unknown Journal")
    issn_list = metadata.get("issn", [])
    issn_val = issn_list[0] if issn_list else ""
    pub_year = metadata.get("year") or datetime.now().year
    
    role = AuthorRole.MAIN if author_role_data.get("is_main_author") else AuthorRole.MEMBER
    authors_meta = metadata.get("authors", [])
    num_authors = len(authors_meta) if authors_meta else 1
    
    # Calculate score
    academic_field = author.get("academic_field") or "Công nghệ thông tin"
    article_input = ArticleInput(
        journal_name=journal_name,
        issn=issn_val,
        author_role=role,
        num_authors=num_authors,
        academic_field=academic_field,
        pub_year=pub_year,
        eval_year=2026,
        target_title="PGS"
    )
    
    score_result = scoring_engine.calculate_score(article_input)
    
    j = score_result.journal
    ranking = (j.sjr_quartile or j.domestic_rank or "Q1") if j else "Q1"
    if j and j.category.value.startswith("conf"):
        ranking = j.category.value
        
    sjr_score = (j.jcr_if or 1.0) if j else 1.0
    
    # Map matched authors in system (by name)
    author_ids = []
    is_user_present = author_role_data.get("is_present", False)
    if is_user_present:
        author_ids.append(author["id"])

    for auth in authors_meta:
        full_name = f"{auth.get('given') or ''} {auth.get('family') or ''}".strip()
        if match_author_names(candidate_name, full_name):
            continue
        matched_auth = next((a for a in db["authors"] if match_author_names(a["name"], full_name)), None)
        if matched_auth:
            author_ids.append(matched_auth["id"])
            
    author_ids = list(set(author_ids))

    # Determine roles
    if is_user_present and role == AuthorRole.MAIN:
        main_author_id = author["id"]
    elif author_ids:
        other_ids = [aid for aid in author_ids if aid != author["id"]]
        main_author_id = other_ids[0] if other_ids else None
    else:
        main_author_id = None

    corresponding_author_id = author["id"] if (is_user_present and author_role_data.get("is_corresponding_author")) else None
    
    # Check if DOI already exists in papers
    doi_clean = req.doi.strip()
    existing_paper = next((p for p in db["papers"] if p.get("doi") == doi_clean), None)
    if existing_paper:
        raise HTTPException(400, f"Bài báo có DOI {doi_clean} đã tồn tại trong hệ thống.")
        
    # Create paper record
    new_paper = {
        "id": next_id(db, "papers"),
        "title": title,
        "journal_name": journal_name,
        "doi": doi_clean,
        "year": pub_year,
        "status": "published",
        "author_ids": author_ids,
        "main_author_id": main_author_id,
        "corresponding_author_id": corresponding_author_id,
        "ranking": ranking,
        "sjr_score": sjr_score,
        "issn": issn_val,
        "notes": f"Đăng tự động và thẩm định bởi AI. Điểm quy đổi: {score_result.final_score}.",
        "created_at": datetime.now().isoformat()
    }
    
    db["papers"].append(new_paper)
    
    activity = {
        "id": next_id(db, "paper_activities") if "paper_activities" in db else 1,
        "paper_id": new_paper["id"],
        "details": f"Đăng bài báo thành công qua AI: {title} (Thẩm định: {integrity.get('message', 'Hợp lệ')})",
        "created_at": datetime.now().isoformat()
    }
    if "paper_activities" not in db:
        db["paper_activities"] = []
    db["paper_activities"].append(activity)
    
    save_db(db)
    
    return {"paper": new_paper, "score": score_result.final_score, "report": report}

@router.post("/import-bulk")
async def import_bulk(req: BulkPaperImportRequest, user=Depends(get_current_user)):
    db = load_db()
    author = next((a for a in db["authors"] if a["id"] == user.get("author_id")), None)
    if not author:
        raise HTTPException(400, "Tài khoản người dùng chưa liên kết với hồ sơ tác giả nào.")
        
    imported_papers = []
    failed_papers = []
    
    from services.api_integration.scholar_client import ScholarClient
    scholar_client = ScholarClient()
    
    for item in req.papers:
        existing = False
        item_title_lower = item.title.lower().strip()
        item_doi = item.doi.lower().strip() if item.doi else ""
        
        for ep in db["papers"]:
            ep_title_lower = ep.get("title", "").lower().strip()
            ep_doi = ep.get("doi", "").lower().strip() if ep.get("doi") else ""
            if (item_doi and ep_doi and item_doi == ep_doi) or (fuzz.ratio(item_title_lower, ep_title_lower) > 85):
                existing = True
                break
        
        if existing:
            failed_papers.append({"title": item.title, "reason": "Bài báo đã tồn tại trong hệ thống."})
            continue
            
        resolved_doi = item.doi
        resolved_issn = item.issn
        resolved_journal = item.journal_name
        resolved_year = item.year
        resolved_authors = item.authors
        
        if not resolved_doi:
            resolved = scholar_client.resolve_paper_metadata(item.title, item.journal_name or "")
            if resolved:
                resolved_doi = resolved.get("doi") or ""
                resolved_issn = resolved.get("issn") or resolved_issn
                resolved_journal = resolved.get("journal_name") or resolved_journal
                resolved_year = resolved.get("year") or resolved_year
                resolved_authors = resolved.get("authors") or resolved_authors

        paper_dict = {
            "title": item.title,
            "journal_name": resolved_journal or item.journal_name or "Unknown Journal",
            "doi": resolved_doi or "",
            "year": resolved_year or item.year or datetime.now().year,
            "status": "published",
            "issn": resolved_issn or item.issn or "",
            "author_ids": [author["id"]],
            "main_author_id": author["id"],
            "corresponding_author_id": None,
            "author_roles": {str(author["id"]): "main"},
            "ranking": "Q1",
            "sjr_score": 1.0,
            "is_ai_verified": False,
            "ai_mismatches": [],
            "notes": ""
        }
        
        role = AuthorRole.MAIN
        num_authors = len(resolved_authors) if resolved_authors else (len(item.authors) if item.authors else 1)
        
        if resolved_authors or item.authors:
            author_names = resolved_authors if resolved_authors else item.authors
            candidate_name = author["name"]
            found_idx = -1
            for idx, auth_name in enumerate(author_names):
                if match_author_names(candidate_name, auth_name):
                    found_idx = idx
                    break
            
            if found_idx == 0:
                role = AuthorRole.MAIN
                paper_dict["author_roles"] = {str(author["id"]): "main"}
            elif found_idx > 0:
                role = AuthorRole.MEMBER
                paper_dict["author_roles"] = {str(author["id"]): "member"}
                paper_dict["main_author_id"] = None
        
        try:
            academic_field = author.get("academic_field") or "Công nghệ thông tin"
            article_input = ArticleInput(
                journal_name=paper_dict["journal_name"],
                issn=paper_dict["issn"],
                author_role=role,
                num_authors=num_authors,
                academic_field=academic_field,
                pub_year=paper_dict["year"],
                eval_year=2026,
                target_title="PGS"
            )
            score_result = scoring_engine.calculate_score(article_input)
            j = score_result.journal
            paper_dict["ranking"] = (j.sjr_quartile or j.domestic_rank or "Q1") if j else "Q1"
            if j and j.category.value.startswith("conf"):
                paper_dict["ranking"] = j.category.value
            paper_dict["sjr_score"] = (j.jcr_if or 1.0) if j else 1.0
            paper_dict["notes"] = f"Đồng bộ từ Scholar. Điểm quy đổi: {score_result.final_score}."
        except Exception as e:
            print(f"Error calculating score for imported paper {item.title}: {e}")
            paper_dict["notes"] = "Đồng bộ từ Scholar. Chưa tính được điểm."

        if resolved_doi:
            try:
                report = await validation_flow.run_validation(
                    doi=resolved_doi.strip(),
                    url="",
                    candidate_name=author["name"],
                    candidate_title_vn=item.title,
                    candidate_history=[author.get("affiliation", "")]
                )
                if report.get("metadata"):
                    metadata = report["metadata"]
                    verification = report["verification"]
                    author_role_data = verification.get("author_role", {})
                    
                    role = AuthorRole.MAIN if author_role_data.get("is_main_author") else AuthorRole.MEMBER
                    authors_meta = metadata.get("authors", [])
                    
                    paper_dict["title"] = metadata.get("title") or paper_dict["title"]
                    paper_dict["journal_name"] = metadata.get("journal") or paper_dict["journal_name"]
                    ai_issn_list = metadata.get("issn", [])
                    paper_dict["issn"] = ai_issn_list[0] if ai_issn_list else paper_dict["issn"]
                    paper_dict["year"] = metadata.get("year") or paper_dict["year"]
                    paper_dict["is_ai_verified"] = True
                    
                    article_input = ArticleInput(
                        journal_name=paper_dict["journal_name"],
                        issn=paper_dict["issn"],
                        author_role=role,
                        num_authors=len(authors_meta) if authors_meta else num_authors,
                        academic_field=academic_field,
                        pub_year=paper_dict["year"],
                        eval_year=2026,
                        target_title="PGS"
                    )
                    score_result = scoring_engine.calculate_score(article_input)
                    j = score_result.journal
                    paper_dict["ranking"] = (j.sjr_quartile or j.domestic_rank or "Q1") if j else "Q1"
                    paper_dict["sjr_score"] = (j.jcr_if or 1.0) if j else 1.0
                    paper_dict["notes"] = f"Đồng bộ từ Scholar và xác thực bởi AI. Điểm quy đổi: {score_result.final_score}."
                    
                    if author_role_data.get("is_present", False):
                        paper_dict["author_roles"] = {str(author["id"]): "main" if role == AuthorRole.MAIN else "member"}
                        if author_role_data.get("is_corresponding_author"):
                            paper_dict["author_roles"][str(author["id"])] = "corresponding"
                            paper_dict["corresponding_author_id"] = author["id"]
                            
            except Exception as e:
                print(f"AI validation skipped for {item.title} due to: {e}")

        paper_dict["id"] = next_id(db, "papers")
        paper_dict["created_at"] = datetime.now().isoformat()
        
        db["papers"].append(paper_dict)
        imported_papers.append(paper_dict)

        activity = {
            "id": next_id(db, "paper_activities") if "paper_activities" in db else 1,
            "paper_id": paper_dict["id"],
            "details": f"Đồng bộ thành công từ Google/Semantic Scholar: {item.title}",
            "created_at": datetime.now().isoformat()
        }
        if "paper_activities" not in db:
            db["paper_activities"] = []
        db["paper_activities"].append(activity)
        
    save_db(db)
    
    return {
        "status": "success",
        "imported_count": len(imported_papers),
        "imported": imported_papers,
        "failed": failed_papers
    }

