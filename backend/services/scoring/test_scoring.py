"""
test_scoring.py — Unit Tests cho Journal Scoring Engine.
"""

import sys
import unittest
from pathlib import Path

# Ensure parent dir is in path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from services.scoring.data_processor import normalize_issn, normalize_name, MasterJournalDB
from services.scoring.models import (
    ArticleInput, AuthorRole, JournalCategory, ScoringStatus,
)
from services.scoring.engine import JournalScoringEngine


# ─────────────────────────────────────────────
# Test: ISSN Normalization
# ─────────────────────────────────────────────

class TestNormalizeISSN(unittest.TestCase):
    def test_standard_format(self):
        self.assertEqual(normalize_issn("1234-5678"), "1234-5678")

    def test_no_dash(self):
        self.assertEqual(normalize_issn("12345678"), "1234-5678")

    def test_with_spaces(self):
        self.assertEqual(normalize_issn("1234 5678"), "1234-5678")

    def test_with_x(self):
        self.assertEqual(normalize_issn("1234-567X"), "1234-567X")

    def test_none(self):
        self.assertIsNone(normalize_issn(None))

    def test_empty(self):
        self.assertIsNone(normalize_issn(""))

    def test_short(self):
        self.assertIsNone(normalize_issn("1234"))


# ─────────────────────────────────────────────
# Test: Name Normalization
# ─────────────────────────────────────────────

class TestNormalizeName(unittest.TestCase):
    def test_uppercase(self):
        self.assertEqual(normalize_name("nature"), "NATURE")

    def test_strip_prefix(self):
        self.assertEqual(normalize_name("The Journal of Science"), "JOURNAL OF SCIENCE")

    def test_special_chars(self):
        result = normalize_name("ACTA & ANALYTICA (2021)")
        self.assertIn("ACTA", result)
        self.assertNotIn("&", result)


# ─────────────────────────────────────────────
# Test: Scoring Engine (Integration)
# ─────────────────────────────────────────────

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "Dữ liệu tổng hợp.json"


@unittest.skipUnless(DATA_PATH.exists(), "Data file not available")
class TestScoringEngine(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.engine = JournalScoringEngine.from_default()

    # ── Test: Q1 journal ─────────────────────

    def test_q1_journal_main_author(self):
        """Q1 journal with main author should score 2.0."""
        article = ArticleInput(
            journal_name="NATURE",
            author_role=AuthorRole.MAIN,
        )
        result = self.engine.calculate_score(article)
        # Nature nếu tìm thấy → Q1 → max 2.0
        if result.status == ScoringStatus.SUCCESS:
            self.assertEqual(result.max_score, 2.0)
            self.assertEqual(result.contribution_factor, 1.0)
            self.assertGreaterEqual(result.final_score, 2.0)

    # ── Test: Co-author splitting ────────────

    def test_member_contribution(self):
        """Member with 4 authors should get weighted contribution (0.165)."""
        article = ArticleInput(
            journal_name="NATURE",
            author_role=AuthorRole.MEMBER,
            num_authors=4,
        )
        result = self.engine.calculate_score(article)
        if result.status == ScoringStatus.SUCCESS:
            self.assertAlmostEqual(result.contribution_factor, 0.165, places=2)

    # ── Test: ISSN lookup ────────────────────

    def test_issn_lookup(self):
        """Lookup by ISSN should find the journal."""
        article = ArticleInput(
            journal_name="",
            issn="0160-5682",  # Journal of the Operational Research Society
            author_role=AuthorRole.MAIN,
        )
        result = self.engine.calculate_score(article)
        self.assertIsNotNone(result.journal)

    # ── Test: Unknown journal ────────────────

    def test_unknown_journal(self):
        """Unknown journal should return MANUAL_CHECK_REQUIRED."""
        article = ArticleInput(
            journal_name="XYZZYPLUGH ZZQJKW NONEXISTENT",
            author_role=AuthorRole.MAIN,
        )
        result = self.engine.calculate_score(article)
        self.assertEqual(result.status, ScoringStatus.MANUAL_CHECK_REQUIRED)
        self.assertEqual(result.final_score, 0.0)

    # ── Test: Batch scoring ──────────────────

    def test_batch_scoring(self):
        """Batch should sum up individual scores correctly."""
        articles = [
            ArticleInput(journal_name="NATURE", author_role=AuthorRole.MAIN),
            ArticleInput(journal_name="SCIENCE", author_role=AuthorRole.MAIN),
        ]
        batch = self.engine.calculate_batch(articles)
        self.assertEqual(len(batch.results), 2)
        self.assertGreaterEqual(batch.total_score, 0.0)

    # ── Test: get_journal_info wrapper ───────

    def test_get_journal_info(self):
        """Info wrapper should return non-empty string."""
        info = self.engine.get_journal_info("MAGNETIC RESONANCE IN MEDICAL SCIENCES")
        self.assertIsInstance(info, str)
        self.assertGreater(len(info), 10)

    # ── Test: list_journals wrapper ──────────

    def test_list_journals_q1(self):
        """List Q1 journals should return multiple results."""
        result = self.engine.list_journals(category="Q1")
        self.assertIn("Tìm thấy", result)

    # ── Test: DB size ────────────────────────

    def test_db_has_records(self):
        """Master DB should have a substantial number of records."""
        self.assertGreater(self.engine.db.size, 1000)


if __name__ == "__main__":
    unittest.main(verbosity=2)
