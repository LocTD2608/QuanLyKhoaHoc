---
name: project-development
description: |
  Guideline for developing and extending the Scientific Management system across frontend (HTML/CSS/JS), backend (FastAPI), and database (local JSON/CSV datasets and Qdrant vector store). Use this skill when asked to add a new API endpoint, build or modify a frontend dashboard component, enrich or modify the database schemas, or implement new data flows.
---

# Full-Stack Project Development Guidelines (Frontend, Backend, Database)

This skill provides modular instructions, file paths, and architectural patterns to guide developers and AI agents in extending and developing the Scientific Management System.

---

## 🎨 1. Frontend Development (`/frontend/`)

The frontend is a lightweight, high-performance static SPA (Single Page Application) that serves a dark-themed, glassmorphic UI.

### 📂 File Structure
*   `frontend/index.html`: Holds the page skeleton, sidebar navigation, form inputs (candidate information, articles list), and reporting dashboards.
*   `frontend/style.css`: Implements a modern dark color palette (HSL-based), glassmorphism, responsive grids, custom buttons, and micro-animations.
*   `frontend/app.js`: Coordinates state management, dynamic article form row addition/deletion, calling backend API endpoints, and rendering Markdown scorecards.

### 🛠️ Development Guidelines
1.  **State Management**: Keep the list of article inputs in a global array in memory within `app.js`. Re-render the articles input table dynamically when rows are added, updated, or removed.
2.  **API Requests**: Always point AJAX requests to the backend server (`http://localhost:10000/api/v1/...`). Handle private network requests by allowing CORS headers.
3.  **UI Consistency**: Follow the dark styling variables in `style.css`. Avoid adding inline styling or ad-hoc Tailwind classes. Use CSS glassmorphic backgrounds for overlays:
    ```css
    background: rgba(20, 20, 25, 0.7);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    ```

---

## ⚙️ 2. Backend Development (`/backend/`)

The backend is built with FastAPI, using Pydantic models for request/response serialization and validation.

### 📂 File Structure
*   `backend/main.py`: The application gateway defining CORS, middleware, API routes, and initializing core services.
*   `backend/services/`: Modular libraries encapsulating pure logic:
    *   `validation_engine/`: Deals with journal integrity checks and fuzzy string metrics.
    *   `rag_chatbot/`: Orchestrates retriever, LLM prompts, and chatbot tools.
    *   `scraper_engine/`: Manages headless scraping and proxy rotation.
    *   `ai_extraction/`: Extracting structured metadata from raw text/HTML.
*   `backend/workflows/`: Coordinates compound tasks or multi-step execution flows (e.g., `article_validation_flow.py`).

### 🛠️ Development Guidelines
1.  **Adding a New Endpoint**:
    - Add a new Pydantic request model in `backend/main.py`.
    - Define a new `@app.post("/api/v1/your-endpoint")` route.
    - Keep endpoints thin; delegate actual processing logic to a dedicated service or workflow under `backend/services/` or `backend/workflows/`.
2.  **Error Handling**: Wrap route handlers in `try-except` blocks. Return informative HTTP 500 status codes with clear error messages using `HTTPException` rather than exposing raw stack traces.
3.  **Async/Sync Conventions**: Use `async def` for I/O bound endpoints calling external APIs or local LLMs (via `httpx.AsyncClient`). For CPU-bound rules (like the scoring scorecard), standard synchronous `def` is preferred.

---

## 📊 3. Database Layer (`/backend/data/` & Qdrant)

The system leverages a hybrid database architecture: a relational-like Master Database stored locally, alongside a Vector Database for legal text retrievals.

### 📂 File Structure & Data Types
1.  **CSV Metadata Stores** (`backend/data/`):
    *   `scimagojr 2025.csv`: SJR rankings, h-index, and country classifications. Delimited by `;`.
    *   `vietnam_standard_journals.csv`: Standard domestic scientific journals recognized by HĐGSNN, indexed by Vietnamese names.
    *   `predatory_journals.csv` & `predatory_publishers.csv`: Lists of known fake/predatory scientific journals and publishers.
2.  **Master Database JSON** (`backend/services/rag_chatbot/data/`):
    *   `Dữ liệu tổng hợp.json`: The principal database of consolidated international and local scientific journals.
3.  **Qdrant Vector Database**:
    *   URL: `http://localhost:6333`
    *   Collection: `legal_data`
    *   Embeddings: 1536-dimensional vectors created via OpenAI `text-embedding-3-small`.

### 🛠️ Development Guidelines
1.  **Reading Master Databases**:
    Use the `MasterJournalDB` class under `backend/services/rag_chatbot/journal_scoring/data_processor.py` to interact with journal lists:
    ```python
    from services.rag_chatbot.journal_scoring.data_processor import MasterJournalDB
    db = MasterJournalDB.from_json("path/to/Dữ liệu tổng hợp.json")
    ```
2.  **Re-indexing & Migration**:
    When regulations change, update the source documents in the data folder, convert them to chunked JSON format (`pdf_to_rag_json.py` or `xlsx_to_rag_json.py`), and run the ingester to push embeddings to Qdrant:
    ```bash
    python3 backend/services/rag_chatbot/ingester.py
    ```
3.  **Vector Queries**:
    Always perform dense queries using the unified `search_and_rerank` interface in `retriever.py`, which supports both `gemma3:12b` (Ollama) and `gemini-2.0-flash` rerankers.
