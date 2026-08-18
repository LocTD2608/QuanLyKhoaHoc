import csv
from pathlib import Path
from typing import List, Optional
from fastapi import APIRouter, Depends
from thefuzz import fuzz

from core.dependencies import get_current_user, integrity_checker

router = APIRouter()

_journals_cache: Optional[List[dict]] = None

def load_journals() -> List[dict]:
    global _journals_cache
    if _journals_cache is not None:
        return _journals_cache

    csv_path = Path(__file__).parent.parent / "data" / "vietnam_standard_journals.csv"
    _journals_cache = []

    if not csv_path.exists():
        return []

    # Build title-to-issn mapping from integrity checker rankings
    scimago_by_title = {}
    for issn, year_data in integrity_checker.rankings.items():
        latest_year = max(year_data.keys()) if year_data else None
        if latest_year:
            s_data = year_data[latest_year]
            title = s_data.get("title")
            if title:
                scimago_by_title[title.lower().strip()] = (issn, s_data)

    try:
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                stt = row.get("stt", "")
                name = row.get("name", "").strip()
                org = row.get("governing_body", "").strip()
                is_intl = row.get("is_international_indexed", "") == "True"
                field = row.get("council", "").strip()
                points = row.get("max_score", "").strip()

                # Programmatic fixes for split entries due to commas:
                if stt == "5" or name == "ADVANCES IN NATURAL SCIENCES: NANOSCIENCE AND":
                    name = "ADVANCES IN NATURAL SCIENCES: NANOSCIENCE AND NANOTECHNOLOGY"
                    org = "VIỆN HÀN LÂM KHOA HỌC VÀ CÔNG NGHỆ VIỆT NAM"
                elif stt == "11" or name == "EAI ENDORSED TRANSACTION ON INDUSTRIAL":
                    name = "EAI ENDORSED TRANSACTION ON INDUSTRIAL NETWORKS AND INTELLIGENT SYSTEMS"
                    org = "ĐẠI HỌC DUY TÂN"
                elif stt == "23" or name == "TẠP CHÍ LÝ LUẬN CHÍNH TRỊ VÀ TRUYỀN THÔNG":
                    org = "HỌC VIỆN BÁO CHÍ VÀ TUYÊN TRUYỀN, HỌC VIỆN CHÍNH TRỊ QUỐC GIA HỒ CHÍ MINH"
                elif stt == "24" or name == "TẠP CHÍ ĐIỆN TỬ LÝ LUẬN CHÍNH TRỊ VÀ TRUYỀN THÔNG":
                    org = "HỌC VIỆN BÁO CHÍ VÀ TUYÊN TRUYỀN, HỌC VIỆN CHÍNH TRỊ QUỐC GIA HỒ CHÍ MINH"

                # Match Scimago for enrichment
                issn_val = None
                quartile = None
                sjr_score = None
                h_index = None
                notes = ""

                name_lower = name.lower()
                match_data = None
                matched_issn = None

                if name_lower in scimago_by_title:
                    matched_issn, match_data = scimago_by_title[name_lower]
                elif is_intl:
                    best_score = 0
                    for s_title, (s_issn, s_val) in scimago_by_title.items():
                        score = fuzz.ratio(name_lower, s_title)
                        if score > 90 and score > best_score:
                            best_score = score
                            matched_issn = s_issn
                            match_data = s_val

                if match_data:
                    if matched_issn and len(matched_issn) == 8:
                        issn_val = f"{matched_issn[:4]}-{matched_issn[4:]}"
                    else:
                        issn_val = matched_issn
                    quartile = match_data.get("quartile")
                    sjr_score = match_data.get("sjr_score")
                    h_index = match_data.get("h_index")
                    notes = f"Matched Scimago: {match_data.get('title')}"

                list_type = "quoc_te,isi" if is_intl else "quoc_gia"

                _journals_cache.append({
                    "id": int(stt) if stt.isdigit() else None,
                    "name": name,
                    "issn": issn_val,
                    "organization": org,
                    "list_type": list_type,
                    "sources": list_type,
                    "field": field,
                    "points": points,
                    "quartile": quartile,
                    "jcr_score": sjr_score,
                    "sjr_score": sjr_score,
                    "h_index": int(h_index) if h_index and str(h_index).isdigit() else None,
                    "notes": notes,
                    "type": "journal"
                })
    except Exception as e:
        print(f"Error loading journals: {e}")
        _journals_cache = []

    return _journals_cache

@router.get("")
def list_journals(search: str = "", list_type: str = "", quartile: str = "",
                  field: str = "", page: int = 1, limit: int = 50,
                  sort_by: str = "name", sort_dir: str = "asc",
                  user=Depends(get_current_user)):
    data = load_journals()
    # Filter
    if search:
        s = search.lower()
        data = [j for j in data if s in j.get("name", "").lower()
                or s in (j.get("issn") or "").lower()
                or s in (j.get("eissn") or "").lower()]
    if list_type:
        data = [j for j in data if list_type in (j.get("list_type") or j.get("sources") or "")]
    if quartile:
        data = [j for j in data if j.get("quartile") == quartile]
    if field:
        data = [j for j in data if field in (j.get("field") or "")]
    # Sort
    reverse = sort_dir == "desc"
    def get_sort_key(j):
        val = j.get(sort_by)
        if val is None:
            return "" if sort_by in ("name", "quartile", "list_type", "field") else -999999.0
        if isinstance(val, (int, float)):
            return float(val)
        if isinstance(val, str):
            try:
                clean_val = val.strip().replace(",", ".")
                if "-" in clean_val:
                    parts = clean_val.split("-")
                    return float(parts[-1].strip())
                return float(clean_val)
            except ValueError:
                return val.lower()
        return str(val).lower()

    data = sorted(data, key=get_sort_key, reverse=reverse)
    total = len(data)
    pages = max(1, (total + limit - 1) // limit)
    start = (page - 1) * limit
    return {"data": data[start:start+limit], "total": total, "pages": pages, "page": page}

@router.get("/fields")
def list_journal_fields(list_type: str = "", user=Depends(get_current_user)):
    data = load_journals()
    if list_type:
        data = [j for j in data if list_type in (j.get("list_type") or j.get("sources") or "")]
    fields = sorted(set(j["field"] for j in data if j.get("field")))
    return fields
