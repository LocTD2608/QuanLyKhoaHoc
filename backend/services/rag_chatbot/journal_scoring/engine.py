"""
engine.py — Compliance Engine tính điểm & thẩm định hồ sơ GS/PGS.

Hard Rules:
1. check_field_match()  — Domain Rule: sai ngành → điểm chuyên ngành = 0
2. check_timeline()     — 3-Year Window: [target-3, target-1]
3. validate_eligibility() — AND-checklist trước khi kết luận
4. generate_response()  — 4-part standardized output
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from .data_processor import MasterJournalDB
from .lookup import lookup_journal
from .models import (
    ArticleInput, AuthorRole, BatchResult,
    JournalCategory, JournalRecord, ScoringResult, ScoringStatus,
)

logger = logging.getLogger(__name__)


# ════════════════════════════════════════════════════════════════
# Weighted Contribution Mapping — Core Mathematical Logic
# ════════════════════════════════════════════════════════════════

def calculate_weighted_author_score(
    max_score: float,
    total_authors: int,
    is_first_author: bool,
    is_corresponding_author: bool,
    has_distinct_corresponding_author: bool,
) -> Dict:
    """
    Phân rã điểm công trình quy đổi theo thuật toán Weighted Contribution Mapping.

    Args:
        max_score: Điểm tối đa của tạp chí (từ bảng HDGSNN).
        total_authors: Tổng số tác giả trong bài.
        is_first_author: Ứng viên có phải tác giả đầu không.
        is_corresponding_author: Ứng viên có phải tác giả liên hệ không.
        has_distinct_corresponding_author: Bài có tác giả liên hệ riêng biệt
            khác với tác giả đầu không.

    Returns:
        Dict chứa user_score và calculation_breakdown chi tiết.
    """
    total_authors = max(total_authors, 1)

    # 1. Xác định số tác giả chính trong bài
    #    - Nếu tác giả đầu đồng thời là tác giả liên hệ → chỉ 1 người
    #    - Nếu 2 người khác nhau → 2 người
    if has_distinct_corresponding_author:
        num_main_authors = 2
    else:
        num_main_authors = 1

    # 2. Quỹ điểm
    main_pool_score   = max_score * (1 / 3)   # 1/3 dành cho tác giả chính
    global_pool_score = max_score * (2 / 3)   # 2/3 dành cho mọi người

    # 3. Đóng góp cá nhân
    is_main = is_first_author or is_corresponding_author
    if is_main:
        user_main_pool_share = main_pool_score / num_main_authors
    else:
        user_main_pool_share = 0.0

    user_global_pool_share = global_pool_score / total_authors

    final_user_score = round(user_main_pool_share + user_global_pool_share, 2)

    explanation_parts = [
        f"Bài báo đạt tối đa {max_score:.2f} điểm.",
        f"Quỹ tác giả chính (1/3) chia cho {num_main_authors} người, "
        f"bạn nhận {user_main_pool_share:.2f} điểm.",
        f"Quỹ đồng tác giả (2/3) chia cho {total_authors} người, "
        f"bạn nhận {user_global_pool_share:.2f} điểm.",
        f"Tổng điểm của bạn là {final_user_score:.2f} điểm.",
    ]

    return {
        "status": "success",
        "data": {
            "journal_max_score": max_score,
            "user_score": final_user_score,
            "calculation_breakdown": {
                "main_pool_score":       round(main_pool_score, 4),
                "num_main_authors":      num_main_authors,
                "user_main_pool_share": round(user_main_pool_share, 2),
                "global_pool_score":     round(global_pool_score, 4),
                "total_authors":         total_authors,
                "user_global_pool_share": round(user_global_pool_share, 2),
            },
            "explanation_text": " ".join(explanation_parts),
        },
    }


def _format_link(url: Optional[str], label: str = "Mở liên kết") -> Optional[str]:
    if not url:
        return None
    return f"[{label}]({url})"

# ── Bảng điểm tối đa (Nguồn: HĐGSNN) ───────────────────────────
MAX_SCORE_TABLE: Dict[JournalCategory, float] = {
    JournalCategory.ISI_SCOPUS_Q1: 2.0,
    JournalCategory.ISI_SCOPUS_Q2: 1.5,
    JournalCategory.ISI_SCOPUS_Q3: 1.25,
    JournalCategory.ISI_SCOPUS_Q4: 1.0,
    JournalCategory.INTERNATIONAL_OTHER_ONLINE: 1.0,
    JournalCategory.INTERNATIONAL_OTHER_OFFLINE: 0.75,
    JournalCategory.DOMESTIC_A: 1.0,
    JournalCategory.DOMESTIC_B: 0.5,
    JournalCategory.CONFERENCE_INTL_PRESTIGIOUS: 1.0,
    JournalCategory.CONFERENCE_INTL_SPECIALIZED: 0.75,
    JournalCategory.CONFERENCE_INTL_SMALL: 0.5,
    JournalCategory.CONFERENCE_DOMESTIC_MINISTRY: 0.5,
    JournalCategory.CONFERENCE_DOMESTIC_UNIVERSITY: 0.4,
    JournalCategory.BOOK_MONOGRAPH: 3.0,
    JournalCategory.BOOK_TEXTBOOK: 2.0,
    JournalCategory.BOOK_REFERENCE: 1.5,
    JournalCategory.BOOK_GUIDEBOOK: 1.0,
    JournalCategory.PATENT: 3.0,
    JournalCategory.UTILITY_SOLUTION: 2.0,
}

IF_OUTSTANDING_THRESHOLD = 5.0
IF_BONUS_RATE = 0.5
IF_BONUS_CAP = 1.0

# ── Tiêu chuẩn GS/PGS (Hard Requirements) ───────────────────────
STANDARDS = {
    "PGS": {"min_total": 10.0, "min_last3": 2.5, "min_main": 3, "min_specialized": 6.0},
    "GS":  {"min_total": 20.0, "min_last3": 5.0, "min_main": 5, "min_specialized": 12.0},
}
TECH_KEYWORDS = [
    "CÔNG NGHỆ", "KỸ THUẬT", "Y HỌC", "Y DƯỢC", "DƯỢC",
    "TỰ NHIÊN", "VẬT LÝ", "HÓA HỌC", "SINH HỌC", "TOÁN",
]


# ════════════════════════════════════════════════════════════════
class JournalScoringEngine:
    """Compliance Engine: tính điểm + validate_eligibility + generate_response."""

    def __init__(self, db: MasterJournalDB) -> None:
        self.db = db

    @classmethod
    def from_default(cls) -> "JournalScoringEngine":
        path = Path(__file__).resolve().parent.parent / "data" / "Dữ liệu tổng hợp.json"
        return cls(MasterJournalDB.from_json(path))

    # ── 1. CROSS-VALIDATION PRIMITIVES ──────────────────────────

    @staticmethod
    def check_field_match(user_field: str, journal_field: str) -> bool:
        """
        Kiểm tra ngành: True nếu khớp, False → điểm chuyên ngành = 0.
        Logic: case-insensitive substring match (2 chiều) kèm ánh xạ từ đồng nghĩa Việt-Anh.
        """
        if not user_field or not journal_field:
            return True          # Không có thông tin → không phạt
        uf = user_field.upper().strip()
        jf = journal_field.upper().strip()
        
        # Substring match cơ bản
        if uf in jf or jf in uf:
            return True
            
        # Ánh xạ từ đồng nghĩa Việt - Anh cho các ngành phổ biến
        synonyms = {
            "CÔNG NGHỆ THÔNG TIN": ["COMPUTER SCIENCE", "INFORMATION", "TELECOMMUNICATIONS", "ELECTRICAL", "TIN HỌC"],
            "TIN HỌC": ["COMPUTER SCIENCE", "INFORMATION", "TELECOMMUNICATIONS", "ELECTRICAL", "CÔNG NGHỆ THÔNG TIN"],
            "TOÁN": ["MATHEMATICS", "STATISTICS", "TOÁN HỌC"],
            "VẬT LÝ": ["PHYSICS", "ASTRONOMY", "VẬT LÍ"],
            "HÓA HỌC": ["CHEMISTRY", "CHEMICAL"],
            "SINH HỌC": ["BIOLOGY", "BIOCHEMISTRY", "BIOMEDICAL", "BOTANY", "ZOOLOGY", "PLANT SCIENCES"],
            "CƠ HỌC": ["MECHANICS", "ENGINEERING, MECHANICAL"],
            "ĐIỆN": ["ELECTRICAL", "ELECTRONIC", "POWER"],
        }
        
        for vi_field, en_fields in synonyms.items():
            # Nếu user_field chứa từ khóa tiếng Việt
            if vi_field in uf:
                # Và journal_field chứa từ khóa tiếng Anh hoặc tiếng Việt tương ứng
                if any(en_f in jf for en_f in en_fields) or vi_field in jf:
                    return True
            # Ngược lại, nếu journal_field chứa từ khóa tiếng Việt và user_field chứa tiếng Anh tương ứng
            if vi_field in jf:
                if any(en_f in uf for en_f in en_fields) or vi_field in uf:
                    return True
                    
        return False

    @staticmethod
    def check_timeline(target_year: int, paper_year: int) -> bool:
        """
        Kiểm tra 3 năm cuối: [target-3, target-2, target-1].
        True → bài nằm trong cửa sổ thời gian hợp lệ.
        """
        return paper_year in range(target_year - 3, target_year)

    # ── 2. SINGLE ARTICLE SCORING ───────────────────────────────

    def calculate_score(self, article: ArticleInput) -> ScoringResult:
        """Tính điểm 1 bài báo với đầy đủ cross-validation."""
        result = ScoringResult(article=article)

        # Tra cứu
        journal = lookup_journal(self.db, article.journal_name, article.issn)
        if journal is None:
            # ── NEW: Fallback sang Web Search ──
            try:
                import sys
                from pathlib import Path
                sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
                from rag_chatbot.web_search import search_journal_online_dict
                
                web_data = search_journal_online_dict(article.journal_name, article.issn or "")
                if web_data and web_data.get("found"):
                    qrank_str = web_data.get("rank")
                    cat = JournalCategory.UNKNOWN
                    if qrank_str == "Q1": cat = JournalCategory.ISI_SCOPUS_Q1
                    elif qrank_str == "Q2": cat = JournalCategory.ISI_SCOPUS_Q2
                    elif qrank_str == "Q3": cat = JournalCategory.ISI_SCOPUS_Q3
                    elif qrank_str == "Q4": cat = JournalCategory.ISI_SCOPUS_Q4
                    
                    journal = JournalRecord(
                        name=web_data.get("journal_name", article.journal_name),
                        issn=web_data.get("issn"),
                        e_issn=web_data.get("e_issn"),
                        category=cat,
                        sjr_quartile=qrank_str if cat != JournalCategory.UNKNOWN else None,
                        h_index=web_data.get("h_index"),
                        jcr_if=web_data.get("jcr_if"),
                        source="Nguồn: Internet (OpenAlex + ScimagoJR)",
                        url=web_data.get("journal_url"),
                    )
            except Exception as e:
                logger.error("Lỗi khi fallback sang web search trong calculate_score: %s", e)

        if journal is None:
            if article.custom_max_score is not None and article.custom_max_score > 0:
                journal = JournalRecord(
                    name=article.journal_name or "Bài báo quy đổi",
                    category=JournalCategory.UNKNOWN,
                    score_range=str(article.custom_max_score),
                    source="Định mức hội đồng cung cấp"
                )
            else:
                result.status = ScoringStatus.MANUAL_CHECK_REQUIRED
                result.explanation = (
                    f"⚠️ [{article.journal_name}] — Không tìm thấy trong database (kể cả Web). "
                    f"CẦN KIỂM TRA THỦ CÔNG."
                )
                return result

        result.journal = journal

        # ── Method 1: Override category using historical ranking if provided ──
        if article.ranking_history and str(article.pub_year) in article.ranking_history:
            q_by_year = article.ranking_history[str(article.pub_year)]
            cat = JournalCategory.UNKNOWN
            if q_by_year == "Q1": cat = JournalCategory.ISI_SCOPUS_Q1
            elif q_by_year == "Q2": cat = JournalCategory.ISI_SCOPUS_Q2
            elif q_by_year == "Q3": cat = JournalCategory.ISI_SCOPUS_Q3
            elif q_by_year == "Q4": cat = JournalCategory.ISI_SCOPUS_Q4
            
            if cat != JournalCategory.UNKNOWN:
                from dataclasses import replace
                journal = replace(journal, category=cat, sjr_quartile=q_by_year)

        # Max score
        if article.custom_max_score is not None and article.custom_max_score > 0:
            max_score = float(article.custom_max_score)
        else:
            max_score = MAX_SCORE_TABLE.get(journal.category, 0.0)
            if max_score == 0.0 and journal.category == JournalCategory.UNKNOWN:
                result.status = ScoringStatus.MANUAL_CHECK_REQUIRED
                result.max_score = 0.0
                result.explanation = (
                    f"⚠️ [{journal.name}] — Tìm thấy nhưng chưa có phân hạng Q. "
                    f"CẦN KIỂM TRA THỦ CÔNG."
                )
                return result
        result.max_score = max_score

        # Timeline
        result.is_in_last_3_years = self.check_timeline(article.eval_year, article.pub_year)

        # Domain check
        domain_match = self.check_field_match(
            article.academic_field or "", journal.field or ""
        )
        if article.academic_field and journal.field and not domain_match:
            result.status = ScoringStatus.FIELD_MISMATCH
            result.final_score = 0.0
            result.contribution_factor = 0.0
            result.explanation = (
                f"❌ DOMAIN MISMATCH: Tạp chí [{journal.name}] thuộc ngành "
                f"[{journal.field}]. Không tính vào 6.0 điểm chuyên ngành "
                f"bắt buộc của ngành [{article.academic_field}]."
            )
            return result

        # Contribution factor using Weighted Contribution Mapping
        is_first  = article.author_role == AuthorRole.MAIN
        is_corr   = article.author_role == AuthorRole.CORRESPONDING

        # ── Method 1: Advanced Role Disambiguation using lists and aliases ──
        candidate_id = article.candidate_id or 1
        
        # Explicit lists check
        if article.co_first_authors and (candidate_id in article.co_first_authors or str(candidate_id) in article.co_first_authors):
            is_first = True
        if article.corresponding_authors and (candidate_id in article.corresponding_authors or str(candidate_id) in article.corresponding_authors):
            is_corr = True

        # Candidate name aliases matching in authors list
        if article.author_aliases and article.authors_list:
            matched_index = -1
            for alias in article.author_aliases:
                normalized_alias = alias.lower().replace(" ", "").replace(".", "")
                for idx, author_name in enumerate(article.authors_list):
                    normalized_author = author_name.lower().replace(" ", "").replace(".", "")
                    if normalized_alias == normalized_author or normalized_alias in normalized_author or normalized_author in normalized_alias:
                        matched_index = idx
                        break
                if matched_index != -1:
                    break
            
            if matched_index == 0:  # First Author
                is_first = True
            elif matched_index > 0 and not is_corr:
                # If they are matched in list but not at index 0, they are member by default unless explicit corresponding author flag matches
                pass

        breakdown = calculate_weighted_author_score(
            max_score=max_score,
            total_authors=article.num_authors,
            is_first_author=is_first,
            is_corresponding_author=is_corr,
            has_distinct_corresponding_author=article.has_distinct_corresponding_author,
        )
        weighted_score = breakdown["data"]["user_score"]
        # Contribution factor = weighted_score / max_score (for backward compat with validate_eligibility)
        cf = round(weighted_score / max_score, 4) if max_score else 0.0
        result.contribution_factor = cf
        result.weighted_breakdown  = breakdown  # type: ignore[attr-defined]

        # IF bonus
        if_bonus = 0.0
        if journal.jcr_if and journal.jcr_if >= IF_OUTSTANDING_THRESHOLD:
            if_bonus = min(max_score * IF_BONUS_RATE, IF_BONUS_CAP)
        result.if_bonus = if_bonus

        # Final score = weighted contribution + IF bonus
        final = round(weighted_score + if_bonus, 4)
        result.final_score = final
        result.status = ScoringStatus.SUCCESS
        result.explanation = ""   # Filled by generate_response()
        return result

    # ── 3. VALIDATE ELIGIBILITY ─────────────────────────────────

    def validate_eligibility(
        self,
        articles: List[ArticleInput],
    ) -> Dict:
        """
        Chạy toàn bộ danh sách bài báo qua vòng lặp cross-validation
        trước khi đưa ra kết luận. Trả về dict kết quả đầy đủ.
        """
        target_title = articles[0].target_title if articles else "PGS"
        user_field   = articles[0].academic_field or ""
        eval_year    = articles[0].eval_year

        std = STANDARDS.get(target_title, STANDARDS["PGS"])
        is_tech = any(k in user_field.upper() for k in TECH_KEYWORDS)

        # Tích lũy
        total_score       = 0.0
        last3_score       = 0.0
        specialized_score = 0.0   # Điểm chuyên ngành (domain match required)
        main_count        = 0

        results: List[ScoringResult] = []

        for article in articles:
            r = self.calculate_score(article)
            results.append(r)

            total_score += r.final_score

            if r.is_in_last_3_years:
                last3_score += r.final_score

            if article.author_role in (AuthorRole.MAIN, AuthorRole.CORRESPONDING):
                if article.pub_year >= 2020:    # Quy định từ 1/1/2020
                    main_count += 1

            # Chuyên ngành chỉ tính khi domain khớp
            if r.status == ScoringStatus.SUCCESS:
                specialized_score += r.final_score

        # Hard Requirements (AND)
        ok_total     = total_score       >= std["min_total"]
        ok_last3     = last3_score       >= std["min_last3"]
        ok_main      = main_count        >= std["min_main"]
        ok_spec      = (specialized_score >= std["min_specialized"]) if is_tech else True

        all_pass = ok_total and ok_last3 and ok_main and ok_spec

        return {
            "results":            results,
            "target_title":       target_title,
            "user_field":         user_field,
            "eval_year":          eval_year,
            "total_score":        total_score,
            "last3_score":        last3_score,
            "specialized_score":  specialized_score,
            "main_count":         main_count,
            "is_tech":            is_tech,
            "standards":          std,
            "checks": {
                "ok_total":  (ok_total,  total_score,       std["min_total"]),
                "ok_last3":  (ok_last3,  last3_score,       std["min_last3"]),
                "ok_main":   (ok_main,   main_count,        std["min_main"]),
                "ok_spec":   (ok_spec,   specialized_score, std["min_specialized"] if is_tech else None),
            },
            "all_pass": all_pass,
        }

    # ── 4. GENERATE RESPONSE (4-part structured output) ─────────

    def generate_response(
        self,
        articles: List[ArticleInput],
        guided_masters: int = 0,
        guided_phds: int = 0,
    ) -> str:
        """
        Sinh phản hồi thẩm định PGS/GS rút gọn, ngắn gọn và trực diện theo yêu cầu.
        guided_masters: số ThS đã bảo vệ thành công (hướng dẫn chính)
        guided_phds:    số TS đã bảo vệ thành công (hướng dẫn chính)
        """
        v = self.validate_eligibility(articles)
        results    = v["results"]
        user_field = v["user_field"]
        eval_year  = v["eval_year"]
        target     = v["target_title"]
        std        = v["standards"]
        is_tech    = v["is_tech"]
        checks     = v["checks"]

        # ── Tính tiêu chí hướng dẫn học viên ──────────────────────
        # PGS: cần ≥2 ThS HOẶC ≥1 TS (1 TS = 2 ThS). Thay thế thiếu = 1 công trình KH mỗi học viên.
        # GS:  cần ≥2 TS. Thay thế thiếu = 3 công trình KH mỗi NCS.
        if target == "PGS":
            ok_students = (guided_masters >= 2) or (guided_phds >= 1)
            if ok_students:
                students_shortfall = 0
                fallback_credit = 0.0
                student_status_note = (
                    f"✅ ĐẠT — {guided_phds} TS / {guided_masters} ThS "
                    f"(1 TS hướng dẫn chính ≡ đủ tiêu chí)"
                    if guided_phds >= 1
                    else f"✅ ĐẠT — {guided_masters} ThS hướng dẫn chính"
                )
            else:
                # Thiếu: 1 ThS = 1 công trình; tính số ThS còn thiếu
                students_shortfall = max(0, 2 - guided_masters - guided_phds * 2)
                fallback_credit = students_shortfall * 1.0
                student_status_note = (
                    f"❌ CHƯA ĐẠT — {guided_phds} TS / {guided_masters} ThS "
                    f"(cần ≥2 ThS hoặc ≥1 TS). "
                    f"Thiếu {students_shortfall} học viên → cần thêm {fallback_credit:.0f} công trình KH thay thế."
                )
        else:  # GS
            ok_students = (guided_phds >= 2)
            if ok_students:
                students_shortfall = 0
                fallback_credit = 0.0
                student_status_note = f"✅ ĐẠT — {guided_phds} NCS tiến sĩ hướng dẫn chính"
            else:
                students_shortfall = max(0, 2 - guided_phds)
                fallback_credit = students_shortfall * 3.0
                student_status_note = (
                    f"❌ CHƯA ĐẠT — {guided_phds} NCS (cần ≥2 TS). "
                    f"Thiếu {students_shortfall} NCS → cần thêm {fallback_credit:.0f} công trình KH thay thế."
                )

        # Nếu có thay thế bằng công trình → điều chỉnh ngưỡng tổng điểm
        min_total_adj = std["min_total"] + fallback_credit

        # Recalculate ok_total with adjusted threshold
        ok_total_adj = v["total_score"] >= min_total_adj
        all_pass = ok_total_adj and checks["ok_last3"][0] and checks["ok_main"][0] and (checks["ok_spec"][0] if is_tech else True) and ok_students

        lines: List[str] = [
            f"## ⚖️ KẾT QUẢ THẨM ĐỊNH HỒ SƠ {target} ({eval_year})",
            f"**Ngành:** {user_field or 'Không xác định'} | **Kết luận sơ bộ:** {'✅ ĐẠT' if all_pass else '❌ CHƯA ĐẠT'}",
            "",
            "### 🎯 Thẻ điểm điều kiện (Scorecard)",
            "",
            "| Tiêu chí | Hiện tại | Yêu cầu | Trạng thái |",
            "|----------|----------|---------|------------|",
        ]
        
        def _status(ok: bool) -> str:
            return "✅ ĐẠT" if ok else "❌ CHƯA ĐẠT"

        ok_total_orig, cur_total, min_total = checks["ok_total"]
        ok_last3, cur_last3, min_last3 = checks["ok_last3"]
        ok_main,  cur_main,  min_main  = checks["ok_main"]
        ok_spec,  cur_spec,  min_spec  = checks["ok_spec"]

        # Tổng điểm: nếu có fallback, hiển thị ngưỡng điều chỉnh
        if fallback_credit > 0:
            lines.append(f"| Tổng điểm quy đổi | **{cur_total:.2f}** | {min_total_adj} ({min_total}+{fallback_credit:.0f} bù học viên) | {_status(ok_total_adj)} |")
        else:
            lines.append(f"| Tổng điểm quy đổi | **{cur_total:.2f}** | {min_total} | {_status(ok_total_orig)} |")
        lines.append(f"| Bài Tác giả chính (từ 2020) | **{cur_main}** | {min_main} | {_status(ok_main)} |")
        lines.append(f"| Điểm 3 năm cuối | **{cur_last3:.2f}** | {min_last3} | {_status(ok_last3)} |")
        if is_tech:
            lines.append(f"| Điểm công trình chuyên ngành | **{cur_spec:.2f}** | {min_spec} | {_status(ok_spec)} |")

        # Hướng dẫn học viên
        if target == "PGS":
            lines.append(f"| Hướng dẫn học viên (ThS/TS) | {guided_phds} TS / {guided_masters} ThS | ≥2 ThS hoặc ≥1 TS | {student_status_note} |")
        else:
            lines.append(f"| Hướng dẫn NCS tiến sĩ | {guided_phds} NCS | ≥2 NCS | {student_status_note} |")

        # Phân tích thiếu hụt & Khuyến nghị
        lines.append("")
        if all_pass:
            lines.append("🎉 **Hồ sơ đáp ứng đủ tất cả tiêu chí tối thiểu!** Hãy chuẩn bị minh chứng để nộp.")
        else:
            lines.append("### 🔬 Điểm thiếu hụt & Khuyến nghị bổ sung:")
            gaps = []
            if not ok_total_adj:
                need = min_total_adj - cur_total
                gaps.append(f"- **Thiếu {need:.2f} tổng điểm**: Cần công bố thêm bài báo hoặc biên soạn sách.")
            if not ok_last3:
                need = min_last3 - cur_last3
                gaps.append(f"- **Thiếu {need:.2f} điểm 3 năm cuối**: Cần công bố thêm công trình.")
            if not ok_main:
                need = min_main - cur_main
                gaps.append(f"- **Thiếu {need} bài Tác giả chính**: Cần viết thêm bài với vai trò tác giả chính/liên hệ.")
            if is_tech and not ok_spec:
                need = (min_spec or 0) - cur_spec
                gaps.append(f"- **Thiếu {need:.2f} điểm chuyên ngành**: Cần thêm bài báo thuộc đúng ngành `{user_field}`.")
            if not ok_students:
                if target == "PGS":
                    gaps.append(f"- **Hướng dẫn học viên**: {guided_phds} TS / {guided_masters} ThS — cần ≥1 TS hoặc ≥2 ThS. Thiếu {students_shortfall} học viên → thay thế bằng {fallback_credit:.0f} công trình KH.")
                else:
                    gaps.append(f"- **Hướng dẫn NCS**: {guided_phds}/2 NCS tiến sĩ — thiếu {students_shortfall} NCS → thay thế bằng {fallback_credit:.0f} công trình KH.")
            lines.extend(gaps)

        lines.append("\n---")
        lines.append(f"*Báo cáo được tạo tự động bởi Compliance Engine — Căn cứ: Thông tư 04/2024 & QĐ 37/2018*")
        return "\n".join(lines)

    # ── BATCH (backward compat) ──────────────────────────────────

    def calculate_batch(self, articles: List[ArticleInput]) -> BatchResult:
        """Backward-compatible: gọi generate_response bên trong."""
        batch = BatchResult()
        v = self.validate_eligibility(articles)
        batch.results    = v["results"]
        batch.total_score = v["total_score"]
        batch.summary    = self.generate_response(articles)
        return batch

    # ── LOOKUP WRAPPERS ──────────────────────────────────────────

    def get_journal_info(self, journal_name: str, issn: Optional[str] = None) -> str:
        """Trả về thông tin tạp chí dạng JSON string để LLM có thể đọc đúng URL."""
        import json as _json
        record = lookup_journal(self.db, journal_name, issn)
        if not record:
            result = {
                "found": False,
                "journal_name": journal_name,
                "issn": issn or "N/A",
                "message": "Không tìm thấy trong cơ sở dữ liệu. Cần kiểm tra thủ công.",
            }
            return _json.dumps(result, ensure_ascii=False)

        max_score = MAX_SCORE_TABLE.get(record.category, None)
        result = {
            "found": True,
            "journal_name": record.name,
            "issn": record.issn or "N/A",
            "e_issn": record.e_issn or "N/A",
            "rank": record.sjr_quartile or record.domestic_rank or "Chưa rõ",
            "field": record.field or "N/A",
            "h_index": record.h_index,
            "source": record.source or "N/A",
            "journal_url": record.url or None,
            "jcr_if": record.jcr_if,
            "max_score": max_score,
            "score_range": record.score_range,
        }
        return _json.dumps(result, ensure_ascii=False)

    def list_journals(self, keyword: str = "", category: str = "") -> str:
        results: List[str] = []
        seen: set = set()
        terms = [t.upper().strip() for t in [keyword, category] if t]
        if not terms:
            return "Vui lòng cung cấp từ khóa."
        for record in self.db._records:
            search_str = " ".join(filter(None, [
                record.name, record.issn, record.e_issn,
                record.sjr_quartile, record.field, record.source,
                record.domestic_rank, record.category.value,
            ])).upper()
            for term in terms:
                if term in search_str and record.name not in seen:
                    s = MAX_SCORE_TABLE.get(record.category)
                    score_str = f"{s}" if s else (record.score_range or "N/A")
                    line = (
                        f"- {record.name} | {record.sjr_quartile or record.domestic_rank or 'N/A'} "
                        f"| Điểm max: {score_str}"
                    )
                    link = _format_link(record.url, "Link")
                    if link:
                        line += f" | {link}"
                    results.append(line)
                    seen.add(record.name)
                    break
        if not results:
            return f"Không tìm thấy tạp chí khớp với '{' '.join(terms)}'."
        count = len(results)
        if count > 60:
            return f"Tìm thấy {count}. 60 kết quả đầu:\n" + "\n".join(results[:60]) + f"\n... và {count-60} kết quả khác."
        return f"Tìm thấy {count} tạp chí:\n" + "\n".join(results)

    # ── PRIVATE ──────────────────────────────────────────────────

    @staticmethod
    def _calc_contribution(role: AuthorRole, num_authors: int) -> float:
        """Legacy helper — kept for backward compatibility with old callers."""
        if role in (AuthorRole.MAIN, AuthorRole.CORRESPONDING):
            return 1.0
        return round(1.0 / max(num_authors, 1), 4)
