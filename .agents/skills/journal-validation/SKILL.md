---
name: journal-validation
description: |
  Validates scientific journal integrity, performs ISSN/publisher checks, classifies OECD scientific fields using LLM, and matches author affiliations semantically. Use this skill when asked to check if a journal is predatory, verify a publication's ranking (Q1-Q4), cross-check paper titles, or validate author affiliation history.
---

# Scientific Journal Integrity and Ranking Validation

This skill outlines how to inspect, debug, and execute journal integrity checks and metadata validation workflows using the internal `IntegrityChecker` system.

## 📋 Core Capabilities

1. **Journal Integrity Check (`check_journal_integrity`)**:
   - Cross-checks ISSNs and journal names against standard ranking lists (e.g., `scimagojr 2025.csv`), the Vietnamese HĐGSNN standard journal database (`vietnam_standard_journals.csv`), and Beall's predatory journal/publisher blacklists.
   - Integrates external API checks via DOAJ and OpenAlex to fetch real-time metadata.
2. **Title Similarity Matching**:
   - Fuzzy string matching for structural comparison.
   - Semantic LLM comparison using the local Ollama `gemma3:12b` model to verify if a Vietnamese translated title is semantically equivalent to its English original.
3. **OECD Scientific Field Classification**:
   - Classifies an article's field of study into standard OECD branches (Natural Sciences, Engineering/Tech, Medical/Health, Agriculture, Social Sciences, Humanities) using LLM-based abstract/title analysis.
4. **Semantic Affiliation Checking**:
   - Compares the organization string extracted from a paper to the historical affiliation records of the candidate using semantic translation and abbreviation matching.

## 🛠️ Operational Guide

### 1. Direct Python Interaction
You can invoke the service programmatically for testing:
```python
import asyncio
from services.validation_engine.integrity_checker import IntegrityChecker

async def run_check():
    checker = IntegrityChecker()
    
    # 1. Verify journal status and ranking
    result = checker.check_journal_integrity(
        journal_name="Nature",
        issn_list=["0028-0836", "1476-4687"],
        year=2024
    )
    print("Journal Result:", result)

    # 2. Check title translation similarity semantically
    similarity = await checker.correlate_titles_with_llm(
        english_title="A new approach for secure cloud data storage",
        vn_title="Phương pháp mới nhằm lưu trữ dữ liệu đám mây bảo mật"
    )
    print("Similarity Score:", similarity)

asyncio.run(run_check())
```

### 2. FastAPI API Endpoints
The following REST endpoints serve this skill:
- **POST `/api/v1/check/journal`**: Returns ranking metadata, predatory warning status, and DOAJ listings.
- **POST `/api/v1/check/title-similarity`**: Returns similarity score (0-100).
- **POST `/api/v1/classify/field`**: Classifies text into main/sub fields under OECD hierarchy.
- **POST `/api/v1/match/affiliation`**: Verifies whether candidate affiliation matches the paper affiliation.

### 🔍 Debugging & Troubleshooting
- **Missing CSV Data**: Ensure csv data lists are present under `backend/data/`. The paths are resolved relative to the package root.
- **Ollama Offline**: If the LLM throws connection errors, make sure Ollama is running (`lsof -i:11434` or check `systemctl status ollama`) and the `gemma3:12b` model is pulled (`ollama pull gemma3:12b`).
