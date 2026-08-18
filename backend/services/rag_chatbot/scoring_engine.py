"""
scoring_engine.py — Bridge module: chatbot ↔ JournalScoringEngine.
Hàm calculate_score() bây giờ gọi generate_response() để sinh output 4-phần chuẩn hóa.
"""
from __future__ import annotations

import logging
from typing import Dict, List, Optional

try:
    from services.scoring.engine import JournalScoringEngine
    from services.scoring.models import ArticleInput, AuthorRole
    from services.rag_chatbot.web_search import search_journal_online
except ImportError:
    try:
        from .journal_scoring.engine import JournalScoringEngine
        from .journal_scoring.models import ArticleInput, AuthorRole
        from .web_search import search_journal_online
    except ImportError:
        from journal_scoring.engine import JournalScoringEngine
        from journal_scoring.models import ArticleInput, AuthorRole
        from web_search import search_journal_online

logger = logging.getLogger(__name__)

_engine: Optional[JournalScoringEngine] = None


def _get_engine() -> JournalScoringEngine:
    global _engine
    if _engine is None:
        logger.info("Khởi tạo JournalScoringEngine...")
        _engine = JournalScoringEngine.from_default()
        logger.info(
            "Engine sẵn sàng: %d tạp chí | %d ISSN | %d ngành",
            _engine.db.size, len(_engine.db.by_issn), len(_engine.db.fields),
        )
    return _engine


# ── Public API (gọi bởi OpenAI Function Calling) ─────────────────

def get_journal_info(journal_name: str, issn: str = "") -> str:
    """Tra cứu thông tin chi tiết của một tạp chí. Tự động fallback sang Web nếu không có trong DB."""
    import json
    from .web_search import search_journal_online_dict
    internal_result_str = _get_engine().get_journal_info(journal_name, issn or None)
    try:
        data = json.loads(internal_result_str)
        if not data.get("found"):
            logger.info("Tự động fallback sang Web Search cho: %s", journal_name)
            web_dict = search_journal_online_dict(journal_name, issn)
            if web_dict:
                return json.dumps(web_dict, ensure_ascii=False)
    except Exception as e:
        logger.error("Lỗi khi parse get_journal_info: %s", e)
    
    return internal_result_str


def calculate_score(
    items: List[Dict[str, str]],
    academic_field: Optional[str] = None,
    eval_year: int = 2024,
    target_title: str = "PGS",
) -> str:
    """
    Tính điểm và thẩm định hồ sơ.
    Trả về phản hồi 4 phần chuẩn hóa (Markdown).

    items: danh sách dict với keys:
      - name: Tên tạp chí
      - role: "main" | "co-author"
      - pub_year: Năm xuất bản
      - issn: (optional)
      - num_authors: (optional, default 1)
    """
    engine = _get_engine()
    articles: List[ArticleInput] = []

    for item in items:
        role_str = str(item.get("role", "co_author")).lower()
        if role_str in ("first_author", "first", "lead", "tác giả đầu"):
            role = AuthorRole.MAIN
        elif role_str in ("corresponding_author", "corresponding", "tác giả liên hệ"):
            role = AuthorRole.CORRESPONDING
        elif role_str in ("first_and_corresponding", "main", "tác giả chính"):
            role = AuthorRole.MAIN
        else:
            role = AuthorRole.MEMBER
        num_authors = max(int(item.get("num_authors", 1)), 1)
        pub_year    = int(item.get("pub_year", eval_year - 1))

        custom_max = item.get("max_score") or item.get("custom_max_score") or item.get("points")
        custom_max_score = float(custom_max) if custom_max is not None else None

        articles.append(ArticleInput(
            journal_name  = str(item.get("name", "")),
            issn          = item.get("issn") or None,
            author_role   = role,
            num_authors   = num_authors,
            academic_field= academic_field,
            pub_year      = pub_year,
            eval_year     = eval_year,
            target_title  = target_title,
            publication_type = str(item.get("type", "article")),
            has_distinct_corresponding_author = item.get("has_distinct_corresponding_author", True if role == AuthorRole.CORRESPONDING and num_authors > 1 else False),
            co_first_authors = item.get("co_first_authors"),
            corresponding_authors = item.get("corresponding_authors"),
            ranking_history = item.get("ranking_history"),
            author_aliases = item.get("author_aliases"),
            authors_list = item.get("authors_list"),
            candidate_id = item.get("candidate_id"),
            custom_max_score = custom_max_score,
        ))

    if not articles:
        return "Không có bài báo nào để tính điểm."

    results_md = []
    for idx, art in enumerate(articles, 1):
        res = engine.calculate_score(art)
        
        md = f"**Bài {idx}: {art.journal_name}**\n"
        if res.journal:
            md += f"- **Tạp chí hợp lệ:** {res.journal.name} (Phân hạng: {res.journal.category.value})\n"
            md += f"- **Điểm tối đa của tạp chí:** {res.max_score}\n"
        else:
            md += "- **Tạp chí:** Không tìm thấy hoặc chưa rõ thông tin.\n"
        
        if getattr(res, "weighted_breakdown", None):
            wb = res.weighted_breakdown["data"]
            md += f"- **Số tác giả:** {art.num_authors} | **Vai trò:** {'Tác giả chính/liên hệ' if art.author_role.value in ('main', 'corresponding') else 'Đồng tác giả'}\n"
            md += f"- **Giải thích chia điểm:** {wb['explanation_text']}\n"
        else:
            md += f"- **Hệ số đóng góp:** {res.contribution_factor}\n"
            
        md += f"- **Điểm thưởng IF:** {res.if_bonus}\n"
        md += f"- **ĐIỂM QUY ĐỔI CUỐI CÙNG:** {res.final_score}\n"
        results_md.append(md)

    return "\n\n".join(results_md)


def validate_eligibility(
    items: List[Dict[str, str]],
    academic_field: Optional[str] = None,
    eval_year: int = 2024,
    target_title: str = "PGS",
    guided_masters: int = 0,
    guided_phds: int = 0,
) -> str:
    """
    Wrapper riêng cho validate_eligibility khi chatbot muốn kiểm tra
    điều kiện mà không cần in chi tiết từng bài.
    guided_masters: số ThS đã bảo vệ thành công (hướng dẫn chính)
    guided_phds:    số TS đã bảo vệ thành công (hướng dẫn chính); 1 TS = 2 ThS với PGS
    """
    engine = _get_engine()
    articles = _build_articles(items, academic_field, eval_year, target_title)
    if not articles:
        return "Không có dữ liệu để thẩm định."
    return engine.generate_response(
        articles,
        guided_masters=int(guided_masters or 0),
        guided_phds=int(guided_phds or 0),
    )


def list_journals(keyword: str = "", category: str = "") -> str:
    """Liệt kê tạp chí theo từ khóa hoặc danh mục."""
    return _get_engine().list_journals(keyword, category)


# ── Helper ───────────────────────────────────────────────────────

def _build_articles(
    items, academic_field, eval_year, target_title
) -> List[ArticleInput]:
    arts = []
    for item in items:
        role_str = str(item.get("role", "co_author")).lower()
        if role_str in ("first_author", "first", "lead", "tác giả đầu"):
            role = AuthorRole.MAIN
        elif role_str in ("corresponding_author", "corresponding", "tác giả liên hệ"):
            role = AuthorRole.CORRESPONDING
        elif role_str in ("first_and_corresponding", "main", "tác giả chính"):
            role = AuthorRole.MAIN
        else:
            role = AuthorRole.MEMBER
        arts.append(ArticleInput(
            journal_name   = str(item.get("name", "")),
            issn           = item.get("issn") or None,
            author_role    = role,
            num_authors    = max(int(item.get("num_authors", 1)), 1),
            academic_field = academic_field,
            pub_year       = int(item.get("pub_year", eval_year - 1)),
            eval_year      = eval_year,
            target_title   = target_title,
            publication_type = str(item.get("type", "article")),
            has_distinct_corresponding_author = item.get("has_distinct_corresponding_author", False),
            co_first_authors = item.get("co_first_authors"),
            corresponding_authors = item.get("corresponding_authors"),
            ranking_history = item.get("ranking_history"),
            author_aliases = item.get("author_aliases"),
            authors_list = item.get("authors_list"),
            candidate_id = item.get("candidate_id"),
        ))
    return arts
