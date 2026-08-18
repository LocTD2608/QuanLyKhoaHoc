---
name: gs-pgs-scoring
description: |
  Simulates profile scoring and checks HĐGSNN compliance rules for GS (Professor) and PGS (Associate Professor) candidates. Use this skill when asked to evaluate a scientific profile, run compliance validation on an academic record, compute total points, check the 3-year window requirements, calculate candidate author contributions, or print standard evaluation report scorecard.
---

# GS/PGS Candidate Academic Profile Scoring and Compliance Evaluation

This skill packages domain-specific knowledge and procedural steps to calculate, audit, and generate professional HĐGSNN-compliant reports for Associate Professor (PGS) and Professor (GS) candidates using the `JournalScoringEngine`.

## 📋 Core Standards & Criteria

| Target Title | Min Total Points | Min 3-Year Window Points | Min Main/Corresponding Author Papers | Min Specialized Domain Points |
| :--- | :--- | :--- | :--- | :--- |
| **PGS** (Associate Professor) | 10.0 | 2.5 | 3 papers (published from 01/01/2020) | 6.0 (for Technical/Scientific fields) |
| **GS** (Professor) | 20.0 | 5.0 | 3 papers (published from 01/01/2020) | 12.0 (for Technical/Scientific fields) |

### ⚖️ Hard Compliance Rules

1. **Domain Rule (Field Matching)**:
   - The candidate's registered academic field (e.g., *Công nghệ thông tin*) must match the journal's indexed field of study (substring match, case-insensitive).
   - If there is a **Field Mismatch**, the paper is flagged and **excluded** from the mandatory specialized domain score (points = 0.0 for specialization).
2. **Timeline Rule (3-Year Window)**:
   - Evaluates whether publications fall within the `[target_year - 3, target_year)` window.
   - Example: For an evaluation in 2026, the 3-year window is `[2023, 2024, 2025]`. Papers published outside this window count towards the total score but *not* the 3-year window score.
3. **Contribution Factor (Co-author calculation)**:
   - First/Corresponding authors receive **1.0x** (100% of journal max points).
   - Co-authors/members receive **1.0 / N** of max points (where N is the total number of co-authors on the paper).
4. **JCR IF Outstanding Bonus**:
   - Journals with a JCR Impact Factor (IF) $\ge 5.0$ receive a bonus of **50% of the journal's max score**, capped at **+1.0 point**.
5. **No Paper Substitution for Minimum Prerequisites**:
   - **Teaching Seniority**: Teaching years and teaching hours are mandatory minimum prerequisites. Scientific publications CANNOT compensate for missing teaching seniority.
   - **Research Project Leadership**: Principal Investigator (PI) requirements (Institute/Ministry/National) are unbypassable prerequisites. High-scoring/Q1 papers CANNOT replace missing project leadership.
6. **Data Engineering & Compliance Rules (BR2 & Acceptance Evidence)**:
   - **BR2 Overlapping Employment**: Candidates with overlapping position history must retain the main appointment record referencing an official appointment decision file (`decision_file_id`) in `position_history`, converting secondary records to adjunct.
   - **Acceptance Letter Workflow**: Pre-publication papers with Acceptance Letters must upload proof to `evidence_file_id` in `publication`. Scores are **provisional** under `pending` status until verified by Administrators and approved by Council.


## 🛠️ Operational Guide

### 1. Direct Evaluation via Command Line / Test Scripts
You can run the interactive tests using Python:
```bash
python3 backend/services/rag_chatbot/journal_scoring/test_scoring.py
```

### 2. Programmatic Execution API
To manually evaluate a profile inside your code, prepare the payload of `ArticleInput`s and execute the engine:
```python
from services.rag_chatbot.journal_scoring.engine import JournalScoringEngine
from services.rag_chatbot.journal_scoring.models import ArticleInput, AuthorRole

engine = JournalScoringEngine.from_default()

# 1. Prepare article list
articles = [
    ArticleInput(
        journal_name="Nature",
        issn="0028-0836",
        author_role=AuthorRole.MAIN,
        num_authors=1,
        academic_field="Công nghệ thông tin",
        pub_year=2024,
        eval_year=2026,
        target_title="PGS"
    )
]

# 2. Run checklist validation
eval_result = engine.validate_eligibility(articles)
print("Passed all standards:", eval_result["all_pass"])
print("Total score:", eval_result["total_score"])

# 3. Generate standardized 4-part report
report_md = engine.generate_response(articles)
print(report_md)
```

### 🔍 Debugging & Troubleshooting
- **Database File Location**: The database defaults to `backend/services/rag_chatbot/data/Dữ liệu tổng hợp.json`. If it's missing or out of sync, ensure database files are located correctly.
- **Field Match Failures**: If a candidate fails technical minimums, check if the academic field was typed exactly or if it got filtered by `TECH_KEYWORDS` (e.g., CÔNG NGHỆ, KỸ THUẬT, Y HỌC, TỰ NHIÊN, TOÁN).
