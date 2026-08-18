"""
data_processor.py — Chuẩn hóa và gộp dữ liệu tạp chí thành Master Database.

Đọc từ file `Dữ liệu tổng hợp.json` và xây dựng một dictionary tra cứu nhanh
theo ISSN và theo tên tạp chí (đã chuẩn hóa).
"""

from __future__ import annotations

import csv
import json
import logging
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from .models import JournalCategory, JournalRecord

logger = logging.getLogger(__name__)


def normalize_url(url: Optional[str]) -> Optional[str]:
    """
    Chuẩn hóa URL để đảm bảo link luôn hợp lệ:
    - Xóa khoảng trắng thừa.
    - Thêm https:// nếu thiếu.
    - Trả về None nếu không có hoặc không hợp lệ.
    """
    if not url:
        return None
    url = str(url).strip()
    if not url or url.lower() in ("nan", "null", "none", "n/a"):
        return None
    # Nếu thiếu scheme, tự động chèn https://
    if not (url.startswith("http://") or url.startswith("https://")):
        url = "https://" + url
    return url


def _pick_url(*values: Optional[str]) -> Optional[str]:
    """Lấy URL đầu tiên hợp lệ từ các field metadata."""
    for raw in values:
        if not raw:
            continue
        for part in str(raw).splitlines():
            candidate = part.strip().rstrip(".,)")
            if not candidate or candidate.lower() in ("nan", "null", "none", "n/a"):
                continue
            norm = normalize_url(candidate)
            if norm:
                return norm
    return None

# ─────────────────────────────────────────────
# ISSN Normalization
# ─────────────────────────────────────────────

def normalize_issn(raw: Optional[str]) -> Optional[str]:
    """
    Chuẩn hóa ISSN về dạng ``XXXX-XXXX``.

    >>> normalize_issn("1234 5678")
    '1234-5678'
    >>> normalize_issn("12345678")
    '1234-5678'
    >>> normalize_issn(None)
    """
    if not raw or not isinstance(raw, str):
        return None
    digits = re.sub(r"[^0-9Xx]", "", raw.strip())
    if len(digits) == 8:
        return f"{digits[:4]}-{digits[4:]}"
    return None


def normalize_name(name: str) -> str:
    """Chuẩn hóa tên tạp chí để so khớp."""
    name = str(name).upper().strip()
    # Loại bỏ prefix phổ biến
    name = re.sub(r"^(THE\s+|TẠP CHÍ\s+)", "", name)
    # Giữ lại chữ cái, số và khoảng trắng
    name = re.sub(r"[^A-Z0-9\s]", " ", name)
    return re.sub(r"\s+", " ", name).strip()


# ─────────────────────────────────────────────
# Q-Rank Mapping
# ─────────────────────────────────────────────

_QRANK_MAP: Dict[str, JournalCategory] = {
    "Q1": JournalCategory.ISI_SCOPUS_Q1,
    "Q2": JournalCategory.ISI_SCOPUS_Q2,
    "Q3": JournalCategory.ISI_SCOPUS_Q3,
    "Q4": JournalCategory.ISI_SCOPUS_Q4,
}


def _parse_qrank(raw: Optional[str]) -> JournalCategory:
    if not raw:
        return JournalCategory.UNKNOWN
    raw_upper = str(raw).upper().strip()
    return _QRANK_MAP.get(raw_upper, JournalCategory.UNKNOWN)


def _parse_float(raw: Optional[str]) -> Optional[float]:
    """Trích xuất số thực từ chuỗi."""
    if raw is None:
        return None
    raw = str(raw).replace(",", ".")
    match = re.search(r"(\d+\.?\d*)", raw)
    return float(match.group(1)) if match else None


# ─────────────────────────────────────────────
# Master Database Builder
# ─────────────────────────────────────────────

class MasterJournalDB:
    """
    Kho dữ liệu tổng hợp tạp chí, hỗ trợ tra cứu theo ISSN và theo tên.

    Attributes:
        by_issn:  Dict mapping ``normalized_issn`` → ``JournalRecord``
        by_name:  Dict mapping ``normalized_name`` → ``JournalRecord``
        fields:   Danh sách 28 ngành / liên ngành HĐGSNN
    """

    def __init__(self) -> None:
        self.by_issn: Dict[str, JournalRecord] = {}
        self.by_name: Dict[str, JournalRecord] = {}
        self.fields: List[str] = []
        self._records: List[JournalRecord] = []

    @property
    def size(self) -> int:
        return len(self._records)

    # ── Build from JSON ──────────────────────

    @classmethod
    def from_json(cls, path: str | Path) -> "MasterJournalDB":
        """Xây dựng Master DB từ file ``Dữ liệu tổng hợp.json``."""
        db = cls()
        path = Path(path)
        if not path.exists():
            logger.error("Không tìm thấy file: %s", path)
            return db

        with open(path, "r", encoding="utf-8") as f:
            data: List[dict] = json.load(f)

        logger.info("Đang xây dựng Master Journal DB từ %d bản ghi...", len(data))

        for item in data:
            meta = item.get("metadata", {})
            source = meta.get("sheet_source", "")

            if source == "Danh mục ngànhliên ngành":
                db._process_field(meta)
            elif source in ("Draft Tạp chí Quốc tế", "DS tạp chí quốc tế", "DS tạp chí ISI"):
                db._process_international(meta, source)
            elif source == "DS tạp chí quốc gia":
                db._process_domestic(meta)

        logger.info(
            "Master DB sẵn sàng: %d tạp chí | %d ISSN | %d ngành",
            db.size, len(db.by_issn), len(db.fields),
        )

        # Enrich ISI journals with Q-rank from ScimagoJR
        scimago_path = path.parent.parent.parent / "data" / "scimagojr 2025.csv"
        if not scimago_path.exists():
            # Fallback: try sibling of rag_chatbot/data
            scimago_path = path.parent.parent.parent.parent / "data" / "scimagojr 2025.csv"
        db._enrich_from_scimago(scimago_path)

        return db

    # ── Processing methods ───────────────────

    def _process_field(self, meta: dict) -> None:
        """Xử lý bản ghi ngành/liên ngành."""
        field_name = (
            meta.get("Ngành/Liên ngành")
            or meta.get("Tên ngành")
            or meta.get("Ngành")
        )
        if field_name and field_name not in self.fields:
            self.fields.append(str(field_name).strip())

    def _process_international(self, meta: dict, source: str) -> None:
        """Xử lý tạp chí quốc tế (ISI, Scopus, Draft)."""
        name = meta.get("Tạp chí") or meta.get("Tên tạp chí/hội nghị") or ""
        if not name:
            return

        issn = normalize_issn(meta.get("ISSN"))
        e_issn = normalize_issn(meta.get("e-ISSN") or meta.get("eISSN"))
        sjr = meta.get("SJR")
        category = _parse_qrank(sjr)
        jcr_if = _parse_float(meta.get("JCR"))
        h_index = _parse_float(meta.get("H-index"))
        field = meta.get("Ngành/Liên ngành")
        url = _pick_url(
            meta.get("Nguồn dữ liệu (Trang chính thức)"),
            meta.get("Link tạp chí/hội nghị"),
            meta.get("Link"),
            meta.get("URL"),
        )

        # Nếu là DS tạp chí ISI mà chưa có SJR → mặc định category ISI
        if category == JournalCategory.UNKNOWN and source == "DS tạp chí ISI":
            category = JournalCategory.ISI_SCOPUS_Q4  # Mặc định ISI tối thiểu Q4

        record = JournalRecord(
            name=str(name).strip(),
            issn=issn,
            e_issn=e_issn,
            category=category,
            sjr_quartile=str(sjr).strip() if sjr else None,
            jcr_if=jcr_if,
            h_index=h_index,
            field=str(field).strip() if field else None,
            source=source,
            url=url,
        )
        self._add_record(record)

    def _process_domestic(self, meta: dict) -> None:
        """Xử lý tạp chí quốc gia (trong nước)."""
        name = meta.get("Tên tạp chí/hội nghị") or ""
        if not name:
            return

        # Xác định loại A / B từ dữ liệu
        raw_type = str(meta.get("Loại", "")).upper()
        score_range = meta.get("Quy đổi điểm", "")
        field = meta.get("Ngành/Liên ngành")
        publisher = meta.get("Cơ quan xuất bản")
        url = _pick_url(
            meta.get("Link tạp chí/hội nghị"),
            meta.get("Nguồn dữ liệu (Trang chính thức)"),
            meta.get("Link"),
            meta.get("URL"),
        )

        # Heuristic: nếu điểm max >= 1.0 → loại A, ngược lại → loại B
        domestic_rank = "A"
        max_score = _parse_float(score_range)
        if max_score is not None and max_score < 1.0:
            domestic_rank = "B"

        category = (
            JournalCategory.DOMESTIC_A if domestic_rank == "A"
            else JournalCategory.DOMESTIC_B
        )

        record = JournalRecord(
            name=str(name).strip(),
            category=category,
            field=str(field).strip() if field else None,
            source="DS tạp chí quốc gia",
            publisher=str(publisher).strip() if publisher else None,
            domestic_rank=domestic_rank,
            score_range=str(score_range).strip() if score_range else None,
            url=url,
        )
        self._add_record(record)

    # ── Helpers ──────────────────────────────

    def _add_record(self, record: JournalRecord) -> None:
        """Thêm record vào DB, ưu tiên bản ghi có nhiều thông tin hơn và merge thông tin."""
        norm = normalize_name(record.name)
        if not norm:
            return

        existing = self.by_name.get(norm)
        if existing:
            # Hợp nhất thông tin giữa các record trùng tên để tránh mất dữ liệu (ví dụ: mất cột field hoặc url)
            if not existing.field and record.field:
                existing.field = record.field
            if not existing.url and record.url:
                existing.url = record.url
            if not existing.publisher and record.publisher:
                existing.publisher = record.publisher
            if not existing.e_issn and record.e_issn:
                existing.e_issn = record.e_issn
            if not existing.issn and record.issn:
                existing.issn = record.issn
            if existing.h_index is None and record.h_index is not None:
                existing.h_index = record.h_index
            if not existing.sjr_quartile and record.sjr_quartile:
                existing.sjr_quartile = record.sjr_quartile

            # Prioritize higher-ranked/more prestigious categories when merging
            cat_priority = {
                JournalCategory.ISI_SCOPUS_Q1: 100,
                JournalCategory.ISI_SCOPUS_Q2: 90,
                JournalCategory.ISI_SCOPUS_Q3: 80,
                JournalCategory.ISI_SCOPUS_Q4: 70,
                JournalCategory.DOMESTIC_A: 65,
                JournalCategory.INTERNATIONAL_OTHER_ONLINE: 60,
                JournalCategory.BOOK_MONOGRAPH: 55,
                JournalCategory.BOOK_TEXTBOOK: 50,
                JournalCategory.PATENT: 45,
                JournalCategory.UTILITY_SOLUTION: 40,
                JournalCategory.INTERNATIONAL_OTHER_OFFLINE: 35,
                JournalCategory.CONFERENCE_INTL_PRESTIGIOUS: 30,
                JournalCategory.CONFERENCE_INTL_SPECIALIZED: 25,
                JournalCategory.DOMESTIC_B: 20,
                JournalCategory.BOOK_REFERENCE: 15,
                JournalCategory.BOOK_GUIDEBOOK: 10,
                JournalCategory.CONFERENCE_INTL_SMALL: 5,
                JournalCategory.CONFERENCE_DOMESTIC_MINISTRY: 4,
                JournalCategory.CONFERENCE_DOMESTIC_UNIVERSITY: 3,
                JournalCategory.UNKNOWN: 0
            }
            if cat_priority.get(record.category, 0) > cat_priority.get(existing.category, 0):
                existing.category = record.category

            # Index thêm các mã ISSN mới của record trùng tên
            for issn_val in (record.issn, record.e_issn):
                if issn_val and issn_val not in self.by_issn:
                    self.by_issn[issn_val] = existing
            return

        self._records.append(record)
        self.by_name[norm] = record

        # Index theo ISSN
        for issn_val in (record.issn, record.e_issn):
            if issn_val:
                # Chỉ ghi đè nếu record mới có thông tin tốt hơn
                if issn_val not in self.by_issn or record.category != JournalCategory.UNKNOWN:
                    self.by_issn[issn_val] = record

    # ── ScimagoJR Enrichment ────────────────

    def _enrich_from_scimago(self, scimago_path: Path) -> None:
        """
        Bổ sung phân hạng Q cho các tạp chí ISI bị thiếu SJR bằng cách
        cross-reference ISSN từ file ScimagoJR.
        """
        scimago_path = Path(scimago_path)
        if not scimago_path.exists():
            logger.warning("Không tìm thấy file ScimagoJR: %s — bỏ qua enrichment.", scimago_path)
            return

        # 1. Build ISSN → Q-rank lookup từ ScimagoJR
        scimago_lookup: Dict[str, str] = {}
        try:
            with open(scimago_path, "r", encoding="utf-8") as f:
                reader = csv.DictReader(f, delimiter=";")
                for row in reader:
                    qrank = (row.get("SJR Best Quartile") or "").strip()
                    raw_issns = (row.get("Issn") or "").replace('"', '')
                    for part in raw_issns.split(","):
                        normed = normalize_issn(part.strip())
                        if normed and qrank:
                            scimago_lookup[normed] = qrank
        except Exception as e:
            logger.error("Lỗi khi đọc ScimagoJR: %s", e)
            return

        logger.info("ScimagoJR lookup: %d ISSN.", len(scimago_lookup))

        # 2. Enrich các record ISI bị thiếu Q-rank (đang mặc định Q4)
        enriched = 0
        for rec in self._records:
            # Chỉ xử lý tạp chí ISI bị fallback xuống Q4 vì thiếu SJR
            if rec.source != "DS tạp chí ISI":
                continue
            if rec.category != JournalCategory.ISI_SCOPUS_Q4:
                continue  # Đã có Q-rank chính xác rồi
            if rec.sjr_quartile and rec.sjr_quartile not in ("None", "nan", ""):
                continue  # Đã có sjr_quartile gốc, không cần enrich

            # Tìm Q-rank từ ScimagoJR
            qrank = None
            for issn_val in (rec.issn, rec.e_issn):
                if issn_val and issn_val in scimago_lookup:
                    qrank = scimago_lookup[issn_val]
                    break

            if qrank:
                new_cat = _parse_qrank(qrank)
                if new_cat != JournalCategory.UNKNOWN:
                    rec.category = new_cat
                    rec.sjr_quartile = qrank
                    enriched += 1

        logger.info(
            "ScimagoJR enrichment hoàn tất: %d/%d tạp chí ISI đã được bổ sung Q-rank.",
            enriched, sum(1 for r in self._records if r.source == "DS tạp chí ISI"),
        )
