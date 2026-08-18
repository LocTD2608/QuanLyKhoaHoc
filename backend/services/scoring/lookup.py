"""
lookup.py — Tra cứu tạp chí theo ISSN (exact) hoặc tên (fuzzy matching).
"""

from __future__ import annotations

import logging
from typing import Optional

from .data_processor import MasterJournalDB, normalize_issn, normalize_name
from .models import JournalRecord

logger = logging.getLogger(__name__)


def lookup_journal(
    db: MasterJournalDB,
    journal_name: Optional[str] = None,
    issn: Optional[str] = None,
) -> Optional[JournalRecord]:
    """
    Tra cứu tạp chí trong Master DB.

    Chiến lược:
    1. Ưu tiên tìm bằng ISSN (exact match) — nhanh và chính xác nhất.
    2. Fallback: tìm bằng tên đã chuẩn hóa (exact normalized match).
    3. Fallback: tìm bằng substring match (tên chứa trong tên DB hoặc ngược lại).
    4. Fallback (nếu có thefuzz): fuzzy matching với threshold ≥ 85%.

    Args:
        db: Master Journal Database.
        journal_name: Tên tạp chí.
        issn: Mã ISSN.

    Returns:
        JournalRecord nếu tìm thấy, None nếu không.
    """
    # ── Step 1: ISSN exact match ─────────────
    if issn:
        norm_issn = normalize_issn(issn)
        if norm_issn and norm_issn in db.by_issn:
            record = db.by_issn[norm_issn]
            logger.info("  ✅ Tìm thấy bằng ISSN: %s → %s", norm_issn, record.name)
            return record

    if not journal_name:
        return None

    # ── Step 2: Normalized name exact match ──
    norm_name = normalize_name(journal_name)
    if norm_name in db.by_name:
        record = db.by_name[norm_name]
        logger.info("  ✅ Tìm thấy bằng tên (exact): %s", record.name)
        return record

    # ── Step 3: Substring match ──────────────
    if len(norm_name) >= 5:
        for db_name, record in db.by_name.items():
            if norm_name in db_name:
                logger.info("  ✅ Tìm thấy bằng tên (substring): %s", record.name)
                return record

    # ── Step 4: Fuzzy matching ───────────────
    try:
        from thefuzz import fuzz  # type: ignore
    except ImportError:
        try:
            from fuzzywuzzy import fuzz  # type: ignore
        except ImportError:
            logger.debug("Thư viện fuzzy matching chưa cài. Bỏ qua bước fuzzy.")
            return None

    best_score = 0
    best_record: Optional[JournalRecord] = None

    for db_name, record in db.by_name.items():
        score = fuzz.ratio(norm_name, db_name)
        if score > best_score:
            best_score = score
            best_record = record

    if best_score >= 85 and best_record is not None:
        logger.info(
            "  ✅ Tìm thấy bằng fuzzy (%.0f%%): %s",
            best_score, best_record.name,
        )
        return best_record

    logger.warning("  ⚠️ Không tìm thấy tạp chí: %s (ISSN: %s)", journal_name, issn)
    return None
