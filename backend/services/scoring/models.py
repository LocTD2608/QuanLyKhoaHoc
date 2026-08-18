"""
models.py — Cấu trúc dữ liệu cho Journal Scoring Engine.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, List


# ─────────────────────────────────────────────
# Enums
# ─────────────────────────────────────────────

class AuthorRole(str, Enum):
    """Vai trò tác giả trong bài báo."""
    MAIN = "main"              # Tác giả chính / Tác giả đầu / Tác giả liên hệ
    CORRESPONDING = "corresponding"  # Tác giả liên hệ (corresponding)
    MEMBER = "member"          # Thành viên / Đồng tác giả


class JournalCategory(str, Enum):
    """Phân loại tạp chí theo nguồn."""
    ISI_SCOPUS_Q1 = "Q1"
    ISI_SCOPUS_Q2 = "Q2"
    ISI_SCOPUS_Q3 = "Q3"
    ISI_SCOPUS_Q4 = "Q4"
    INTERNATIONAL_OTHER_ONLINE = "intl_other_online"
    INTERNATIONAL_OTHER_OFFLINE = "intl_other_offline"
    DOMESTIC_A = "domestic_A"
    DOMESTIC_B = "domestic_B"
    CONFERENCE_INTL_PRESTIGIOUS = "conf_intl_prestigious"
    CONFERENCE_INTL_SPECIALIZED = "conf_intl_specialized"
    CONFERENCE_INTL_SMALL = "conf_intl_small"
    CONFERENCE_DOMESTIC_MINISTRY = "conf_domestic_ministry"
    CONFERENCE_DOMESTIC_UNIVERSITY = "conf_domestic_univ"
    BOOK_MONOGRAPH = "book_monograph"
    BOOK_TEXTBOOK = "book_textbook"
    BOOK_REFERENCE = "book_reference"
    BOOK_GUIDEBOOK = "book_guidebook"
    PATENT = "patent"
    UTILITY_SOLUTION = "utility_solution"
    UNKNOWN = "unknown"


class ScoringStatus(str, Enum):
    """Trạng thái kết quả tính điểm."""
    SUCCESS = "success"
    MANUAL_CHECK_REQUIRED = "manual_check"
    FIELD_MISMATCH = "field_mismatch"
    NOT_FOUND = "not_found"


# ─────────────────────────────────────────────
# Data Models
# ─────────────────────────────────────────────

@dataclass
class JournalRecord:
    """Bản ghi tạp chí trong Master Database."""
    name: str
    issn: Optional[str] = None
    e_issn: Optional[str] = None
    category: JournalCategory = JournalCategory.UNKNOWN
    sjr_quartile: Optional[str] = None        # Q1, Q2, Q3, Q4
    jcr_if: Optional[float] = None            # Impact Factor
    h_index: Optional[float] = None
    field: Optional[str] = None               # Ngành / Liên ngành
    source: Optional[str] = None              # Nguồn dữ liệu (sheet_source)
    publisher: Optional[str] = None           # Cơ quan xuất bản
    domestic_rank: Optional[str] = None       # Loại A / Loại B (tạp chí trong nước)
    score_range: Optional[str] = None         # Khung điểm quy đổi gốc
    url: Optional[str] = None                 # Link tạp chí / nguồn dữ liệu chính thức


@dataclass
class ArticleInput:
    """Dữ liệu đầu vào cho một bài báo / công trình cần tính điểm."""
    journal_name: str
    issn: Optional[str] = None
    author_role: AuthorRole = AuthorRole.MAIN
    num_authors: int = 1
    academic_field: Optional[str] = None      # Ngành xét duyệt (VD: "Công nghệ thông tin")
    pub_year: int = 2023                      # Năm xuất bản
    eval_year: int = 2024                     # Năm xét duyệt
    target_title: str = "PGS"                 # GS hoặc PGS
    publication_type: str = "article"         # article, conference, book, patent
    # Weighted Contribution Mapping (Quyết định số tác giả chính trong bài)
    has_distinct_corresponding_author: bool = False  # Tác giả liên hệ là người riêng biệt với tác giả đầu
    co_first_authors: Optional[List[str | int]] = None
    corresponding_authors: Optional[List[str | int]] = None
    ranking_history: Optional[dict] = None
    author_aliases: Optional[List[str]] = None
    authors_list: Optional[List[str]] = None
    candidate_id: Optional[str | int] = None
    custom_max_score: Optional[float] = None  # Điểm tối đa giả định do người dùng/hội đồng cung cấp (VD: 1.0, 1.5)


@dataclass
class ScoringResult:
    """Kết quả tính điểm cho một bài báo / công trình."""
    article: ArticleInput
    journal: Optional[JournalRecord] = None
    max_score: float = 0.0
    contribution_factor: float = 1.0
    if_bonus: float = 0.0
    final_score: float = 0.0
    is_in_last_3_years: bool = False
    status: ScoringStatus = ScoringStatus.SUCCESS
    explanation: str = ""


@dataclass
class BatchResult:
    """Kết quả tính điểm cho danh sách bài báo."""
    results: List[ScoringResult] = field(default_factory=list)
    total_score: float = 0.0
    summary: str = ""
