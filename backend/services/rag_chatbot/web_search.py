"""
web_search.py — Tra cứu thông tin tạp chí / bài báo từ Internet.

Sử dụng OpenAlex API (miễn phí, không cần API key) để lấy dữ liệu.
Kết quả được gắn nhãn rõ ràng là "Nguồn: Web (OpenAlex)" để phân biệt
với dữ liệu nội bộ HĐGSNN.
"""

from __future__ import annotations

import json
import logging
import re
import urllib.request
import urllib.parse
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────

OPENALEX_BASE = "https://api.openalex.org"
USER_AGENT = "QuanLyKhoaHoc/1.0 (mailto:admin@quanlykhahoc.vn)"
REQUEST_TIMEOUT = 15  # seconds

# SJR Quartile mapping from ScimagoJR (approximate, based on percentile)
# OpenAlex doesn't provide Q-rank directly, but we can estimate from
# cited_by_count percentile or use our local ScimagoJR data

# ─────────────────────────────────────────────
# HTTP Helper
# ─────────────────────────────────────────────

def _fetch_json(url: str) -> Optional[dict]:
    """Gọi API và trả về JSON, hoặc None nếu lỗi."""
    try:
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        logger.warning("Lỗi khi gọi API %s: %s", url, e)
        return None


# ─────────────────────────────────────────────
# ScimagoJR Q-Rank Lookup (from local CSV)
# ─────────────────────────────────────────────

_scimago_cache: Optional[Dict[str, str]] = None


def _normalize_issn(raw: str) -> Optional[str]:
    digits = re.sub(r'[^0-9Xx]', '', raw.strip())
    if len(digits) == 8:
        return f'{digits[:4]}-{digits[4:]}'
    return None


def _get_scimago_lookup() -> Dict[str, str]:
    """Load ScimagoJR ISSN → Q-rank lookup (cached)."""
    global _scimago_cache
    if _scimago_cache is not None:
        return _scimago_cache

    import csv
    from pathlib import Path

    _scimago_cache = {}
    csv_path = Path(__file__).resolve().parent.parent.parent / "data" / "scimagojr 2025.csv"
    if not csv_path.exists():
        logger.warning("ScimagoJR CSV không tìm thấy: %s", csv_path)
        return _scimago_cache

    try:
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f, delimiter=";")
            for row in reader:
                qrank = (row.get("SJR Best Quartile") or "").strip()
                raw_issns = (row.get("Issn") or "").replace('"', '')
                for part in raw_issns.split(","):
                    normed = _normalize_issn(part.strip())
                    if normed and qrank:
                        _scimago_cache[normed] = qrank
        logger.info("ScimagoJR Q-rank lookup: %d ISSN.", len(_scimago_cache))
    except Exception as e:
        logger.error("Lỗi đọc ScimagoJR CSV: %s", e)

    return _scimago_cache


def _lookup_qrank(issns: List[str]) -> Optional[str]:
    """Tra cứu Q-rank từ ScimagoJR bằng ISSN."""
    lookup = _get_scimago_lookup()
    for issn in issns:
        normed = _normalize_issn(issn)
        if normed and normed in lookup:
            return lookup[normed]
    return None


# ─────────────────────────────────────────────
# MAX_SCORE mapping (mirrored from engine.py)
# ─────────────────────────────────────────────

_QRANK_SCORE = {
    "Q1": 2.0,
    "Q2": 1.5,
    "Q3": 1.25,
    "Q4": 1.0,
}


# ─────────────────────────────────────────────
# Public API: Search Journal Online
# ─────────────────────────────────────────────

def search_journal_online(
    journal_name: str = "",
    issn: str = "",
) -> str:
    """
    Tra cứu thông tin tạp chí từ Internet (OpenAlex + ScimagoJR local).

    Ưu tiên tra cứu bằng ISSN. Nếu không có ISSN, tìm theo tên.
    Kết quả luôn gắn nhãn "Nguồn: Web" để phân biệt với data nội bộ.

    Returns:
        Chuỗi Markdown mô tả kết quả tra cứu.
    """
    logger.info(f"🌐 Web search: journal_name='{journal_name}', issn='{issn}'")

    source = None

    # 1. Tra cứu bằng ISSN trước (chính xác hơn)
    if issn:
        normed = _normalize_issn(issn)
        if normed:
            url = f"{OPENALEX_BASE}/sources/issn:{normed}"
            source = _fetch_json(url)

    # 2. Nếu không có ISSN hoặc ISSN không tìm thấy → tìm theo tên
    if source is None and journal_name:
        encoded = urllib.parse.quote(journal_name)
        url = f"{OPENALEX_BASE}/sources?search={encoded}&per_page=5"
        data = _fetch_json(url)
        if data and data.get("results"):
            results = data["results"]
            # Chọn kết quả match tốt nhất
            source = _pick_best_match(results, journal_name)

    if source is None:
        return (
            f"🌐 **Kết quả từ Internet:** Không tìm thấy tạp chí "
            f"'{journal_name or issn}' trên OpenAlex.\n\n"
            f"⚠️ Lưu ý: Dữ liệu nội bộ HĐGSNN cũng không có thông tin. "
            f"Tạp chí này có thể chưa được lập chỉ mục hoặc không nằm trong "
            f"danh mục ISI/Scopus."
        )

    return _format_openalex_result(source)


def search_journal_online_dict(
    journal_name: str = "",
    issn: str = "",
) -> Optional[dict]:
    """Trả về raw data dictionary thay vì markdown string."""
    source = None
    if issn:
        normed = _normalize_issn(issn)
        if normed:
            url = f"{OPENALEX_BASE}/sources/issn:{normed}"
            source = _fetch_json(url)

    if source is None and journal_name:
        encoded = urllib.parse.quote(journal_name)
        url = f"{OPENALEX_BASE}/sources?search={encoded}&per_page=5"
        data = _fetch_json(url)
        if data and data.get("results"):
            source = _pick_best_match(data["results"], journal_name)

    if not source:
        return None

    issns = source.get("issn", []) or []
    qrank = _lookup_qrank(issns) if issns else None
    max_score = _QRANK_SCORE.get(qrank, None) if qrank else None

    return {
        "found": True,
        "journal_name": source.get("display_name", journal_name),
        "issn": issns[0] if issns else "N/A",
        "e_issn": issns[1] if len(issns) > 1 else "N/A",
        "rank": qrank or "Chưa rõ (Web)",
        "field": "N/A (Web)",
        "h_index": source.get("summary_stats", {}).get("h_index"),
        "source": "Web (OpenAlex + ScimagoJR)",
        "journal_url": source.get("homepage_url"),
        "jcr_if": source.get("summary_stats", {}).get("2yr_mean_citedness"),
        "max_score": max_score,
        "score_range": f"{max_score}" if max_score else None,
    }


def _pick_best_match(results: List[dict], query: str) -> Optional[dict]:
    """Chọn tạp chí match tốt nhất từ danh sách kết quả OpenAlex."""
    if not results:
        return None

    query_upper = query.upper().strip()

    # Exact match
    for r in results:
        name = (r.get("display_name") or "").upper().strip()
        if name == query_upper:
            return r

    # Substring match
    for r in results:
        name = (r.get("display_name") or "").upper().strip()
        if query_upper in name or name in query_upper:
            return r

    # Fallback: trả về kết quả đầu tiên
    return results[0]


def _format_openalex_result(source: dict) -> str:
    """Format kết quả OpenAlex thành Markdown có gắn nhãn nguồn."""
    name = source.get("display_name", "N/A")
    issns = source.get("issn", []) or []
    host_org = source.get("host_organization_name", "N/A")
    homepage = source.get("homepage_url")
    works_count = source.get("works_count", 0)
    cited_by = source.get("cited_by_count", 0)
    source_type = source.get("type", "unknown")

    stats = source.get("summary_stats", {})
    h_index = stats.get("h_index")
    impact_factor = stats.get("2yr_mean_citedness")

    # Tra cứu Q-rank từ ScimagoJR local
    qrank = _lookup_qrank(issns) if issns else None
    max_score = _QRANK_SCORE.get(qrank, None) if qrank else None

    # ── Build output ──
    lines = [
        f"🌐 **Kết quả từ Internet (OpenAlex + ScimagoJR):**",
        f"",
        f"📰 **Tên tạp chí:** {name}",
        f"- **Loại:** {source_type.capitalize()}",
    ]

    if issns:
        lines.append(f"- **ISSN:** {', '.join(issns)}")

    lines.append(f"- **Nhà xuất bản:** {host_org}")

    if qrank:
        lines.append(f"- **Phân hạng SJR (ScimagoJR 2025):** **{qrank}**")
        if max_score is not None:
            lines.append(f"- **Điểm tối đa HĐGSNN tương ứng:** **{max_score} điểm**")
    else:
        lines.append(f"- **Phân hạng SJR:** Chưa xác định (không tìm thấy trong ScimagoJR)")

    if h_index is not None:
        lines.append(f"- **H-index:** {h_index}")

    if impact_factor is not None:
        lines.append(f"- **Impact Factor (2yr mean citedness):** {impact_factor:.2f}")

    lines.append(f"- **Tổng số bài báo:** {works_count:,}")
    lines.append(f"- **Tổng trích dẫn:** {cited_by:,}")

    if homepage:
        lines.append(f"- **Website:** [{name}]({homepage})")

    # ── Cảnh báo nguồn dữ liệu ──
    lines.extend([
        "",
        "---",
        "⚠️ **LƯU Ý QUAN TRỌNG:**",
        "- Dữ liệu trên được lấy từ **Internet (OpenAlex + ScimagoJR)**, "
        "KHÔNG phải từ cơ sở dữ liệu nội bộ HĐGSNN.",
    ])

    if qrank:
        lines.append(
            f"- Phân hạng **{qrank}** được tra cứu từ **ScimagoJR 2025** (dữ liệu chính thống). "
            f"Điểm tối đa **{max_score}** được tính theo Bảng điểm HĐGSNN tiêu chuẩn."
        )
        lines.append(
            "- ✅ Kết quả này **có thể dùng để tính điểm** tương đương dữ liệu nội bộ."
        )
    else:
        lines.append(
            "- ❌ KHÔNG xác định được phân hạng Q. **Không thể tính điểm chính xác.** "
            "Cần kiểm tra thủ công trên ScimagoJR hoặc Web of Science."
        )

    return "\n".join(lines)


# ─────────────────────────────────────────────
# DOI Direct Lookup & HĐGSNN Cross-check
# ─────────────────────────────────────────────

def fetch_paper_by_doi(doi: str) -> dict:
    """
    Tra cứu siêu dữ liệu chi tiết của một bài báo khoa học dựa trên mã DOI (Digital Object Identifier).
    Sử dụng kết hợp Crossref API (chính xác về venue/container title) & OpenAlex Works API.
    """
    clean_doi = doi.strip()
    if clean_doi.startswith("http://") or clean_doi.startswith("https://"):
        clean_doi = clean_doi.split("doi.org/")[-1]
    clean_doi = clean_doi.replace("doi:", "").strip()

    logger.info(f"🌐 DOI fetch: '{clean_doi}'")

    # 1. Tra cứu qua Crossref API
    crossref_url = f"https://api.crossref.org/works/{urllib.parse.quote(clean_doi)}"
    cross_data = _fetch_json(crossref_url)
    cross_msg = cross_data.get("message", {}) if cross_data else {}

    # 2. Tra cứu qua OpenAlex Works API
    openalex_url = f"{OPENALEX_BASE}/works/https://doi.org/{urllib.parse.quote(clean_doi)}"
    openalex_data = _fetch_json(openalex_url) or {}

    if not cross_msg and not openalex_data:
        return {
            "found": False,
            "doi": clean_doi,
            "message": f"Không tìm thấy bài báo với mã DOI: {clean_doi}",
        }

    # Resolve Title
    title = None
    if cross_msg.get("title"):
        title = cross_msg["title"][0]
    elif openalex_data.get("title"):
        title = openalex_data["title"]
    title = title or "N/A"

    # Resolve Venue
    venue = None
    if cross_msg.get("container-title") and cross_msg["container-title"]:
        venue = cross_msg["container-title"][0]
    loc = openalex_data.get("primary_location") or {}
    src = loc.get("source") or {}
    if not venue or venue.startswith("http"):
        venue = src.get("display_name") or venue or "N/A"

    # Resolve Authors
    authors = []
    if cross_msg.get("author"):
        authors = [
            f"{a.get('given', '')} {a.get('family', '')}".strip()
            for a in cross_msg["author"]
            if a.get("given") or a.get("family")
        ]
    elif openalex_data.get("authorships"):
        authors = [
            a.get("author", {}).get("display_name")
            for a in openalex_data["authorships"]
            if a.get("author", {}).get("display_name")
        ]

    # Resolve Publisher
    publisher = cross_msg.get("publisher") or openalex_data.get("host_venue", {}).get("publisher") or src.get("host_organization_name") or "ACM"

    # Resolve Pub Year
    pub_year = None
    pub_date = cross_msg.get("published-print") or cross_msg.get("published-online") or {}
    if pub_date.get("date-parts") and pub_date["date-parts"][0]:
        pub_year = pub_date["date-parts"][0][0]
    if not pub_year and openalex_data.get("publication_year"):
        pub_year = openalex_data["publication_year"]

    # Resolve Type
    pub_type = cross_msg.get("type") or openalex_data.get("type") or "article"

    # Resolve ISSN
    issn_list = cross_msg.get("ISSN") or src.get("issn") or []

    qrank = _lookup_qrank(issn_list) if issn_list else None
    max_score = _QRANK_SCORE.get(qrank) if qrank else None

    return {
        "found": True,
        "doi": clean_doi,
        "doi_url": f"https://doi.org/{clean_doi}",
        "title": title,
        "authors": authors,
        "author_count": len(authors),
        "venue": venue,
        "publisher": publisher,
        "pub_year": pub_year,
        "issn": issn_list,
        "publication_type": pub_type,
        "qrank": qrank,
        "max_score": max_score,
        "source": "Crossref + OpenAlex API",
    }


def fetch_paper_by_doi_markdown(doi: str) -> str:
    """Format thông tin tra cứu DOI kèm theo đối soát CSDL HĐGSNN & Hướng dẫn nộp minh chứng."""
    data = fetch_paper_by_doi(doi)
    if not data.get("found"):
        return f"🌐 **Tra cứu DOI ({doi}):** {data.get('message', 'Không tìm thấy thông tin.')}"

    title = data.get("title", "N/A")
    authors = data.get("authors", [])
    author_count = data.get("author_count", len(authors))
    authors_str = ", ".join(authors) if authors else "N/A"
    venue = data.get("venue", "N/A")
    publisher = data.get("publisher", "N/A")
    pub_year = data.get("pub_year", "N/A")
    doi_url = data.get("doi_url", f"https://doi.org/{doi}")
    pub_type = data.get("publication_type", "article")
    issns = data.get("issn", [])
    qrank = data.get("qrank")
    max_score = data.get("max_score")

    # Kiểm tra đối soát HĐGSNN
    is_conference = "proceeding" in pub_type.lower() or "symposium" in venue.lower() or "proceedings" in venue.lower() or "conference" in venue.lower()

    lines = [
        f"📄 **Thông tin bài báo từ DOI ({data.get('doi')}):**",
        f"",
        f"- 📝 **Tên bài báo:** **{title}**",
        f"- 👥 **Tác giả ({author_count} tác giả):** {authors_str}",
        f"- 🏛️ **Địa điểm xuất bản:** **{venue}**",
        f"- 🏢 **Nhà xuất bản:** {publisher}",
        f"- 📅 **Năm xuất bản:** {pub_year}",
        f"- 🔗 **DOI Link:** [{doi_url}]({doi_url})",
    ]

    if issns:
        lines.append(f"- 🆔 **ISSN:** {', '.join(issns)}")

    lines.extend([
        "",
        "---",
        "⚖️ **ĐỐI SOÁT QUY TẮC NGHIỆP VỤ HĐGSNN:**",
    ])

    if qrank and not is_conference:
        lines.append(f"- ✅ **Tạp chí thuộc ScimagoJR:** Phân hạng **{qrank}** | Điểm tối đa: **{max_score} điểm**.")
        lines.append("- ✅ Bài báo này nằm trong danh mục tạp chí được tự động tính điểm xét PGS/GS.")
    elif is_conference:
        lines.append(f"- ⚠️ **Loại hình xuất bản:** Kỷ yếu Hội nghị khoa học (*{venue}*).")
        lines.append("- ❌ **Quy định HĐGSNN:** Kỷ yếu hội nghị quốc tế/trong nước không thuộc danh mục tạp chí tự động tính điểm định mức chuẩn (Q1–Q4).")
        lines.append("- ⛔ **Kết luận:** Bài báo này **tạm thời KHÔNG THỂ tự động tính điểm xét PGS**.")
    else:
        lines.append(f"- ⚠️ Nơi xuất bản *{venue}* hiện không có thông tin phân hạng ISI/Scopus tự động trong danh mục CSDL HĐGSNN.")
        lines.append("- ⛔ **Kết luận:** Bài báo này **tạm thời KHÔNG THỂ tự động tính điểm xét PGS**.")

    lines.extend([
        "",
        "📌 **HƯỚNG DẪN NỘP MINH CHỨNG XÉT DUYỆT NGOẠI LỆ:**",
        "- Để Hội đồng cơ sở xem xét ngoại lệ hoặc cộng điểm công trình, thầy/cô vui lòng tạo bản ghi mới tại mục **Quản lý sơ yếu khoa học** (hoặc **Quản lý bài báo**).",
        "- Đính kèm file minh chứng (**bản thảo PDF / trang bìa bài báo - first page**) để Quản trị viên và Hội đồng kiểm duyệt trực tiếp.",
    ])

    return "\n".join(lines)

