---
name: rag-chatbot-ops
description: |
  Manages, runs, indexes, and queries the Agentic RAG Chatbot. Use this skill when asked to run the chatbot server, index fresh scientific documents, manage the Qdrant vector store, perform hybrid retrieval and cross-encoder re-ranking using Ollama/Gemini, or customize chatbot system prompts.
---

# Agentic RAG Chatbot Operations

This skill outlines instructions for running, indexing, modifying, and querying the Agentic RAG Chatbot system.

## 📋 System Architecture

1. **Vector Search Engine (Qdrant)**:
   - Port: `6333`
   - Collection name: `legal_data`
   - Embedding model: `text-embedding-3-small` (OpenAI API)
2. **Hybrid Retrieval + Re-ranking Engine (`retriever.py`)**:
   - Performs dense retrieval of top-$K$ candidates (default: 20).
   - Re-ranks candidates using a Local LLM (Ollama `gemma3:12b`) or Google Gemini (`gemini-2.0-flash`) as a Cross-Encoder to calculate relevance scores (0-10).
   - Filters out candidates below a relevance score threshold (default: 3.0).
3. **Fast-Track Detection Mode**:
   - Automatically detects simple search/lookup queries (e.g., *"Nature thuộc Q mấy?"*).
   - Bypasses the heavy Cross-Encoder re-ranking step, directly serving responses from database indexes in under 2 seconds.
4. **Agentic Router & Tool Executor (`chatbot_engine.py`)**:
   - Uses OpenAI Function Calling (`gpt-4o`) to dynamically trigger tools like `get_journal_info`, `calculate_score`, or `list_journals` depending on the user's intent.

## 🛠️ Operational Guide

### 1. Starting the Chatbot Server
Start the dedicated RAG chatbot server on port `10002`:
```bash
python3 backend/services/rag_chatbot/app_web.py
```
The server logs will be written to `web_app.log`.

### 2. running Ingestion and Indexing
If you need to load or refresh scientific documents and regulations into the vector database, run the following commands:
- **XLSX Ingestion**:
  ```bash
  python3 backend/services/rag_chatbot/xlsx_to_rag_json.py
  ```
- **PDF Ingestion**:
  ```bash
  python3 backend/services/rag_chatbot/pdf_to_rag_json.py
  ```
- **Push Indexes to Qdrant**:
  ```bash
  python3 backend/services/rag_chatbot/ingester.py
  ```

### 3. CLI Retrieval Testing
Test the retrieval-re-ranking pipeline directly from the command line:
```bash
# Test with Ollama (default)
python3 backend/services/rag_chatbot/retriever.py "Tiêu chí thẩm định PGS ngành CNTT là gì?"

# Test with Gemini Re-ranker
export GOOGLE_API_KEY="your-api-key"
python3 backend/services/rag_chatbot/retriever.py "Tiêu chí thẩm định PGS ngành CNTT là gì?" --backend gemini
```

### 🔍 Debugging & Troubleshooting
- **No OpenAI API Key**: The embedding step requires `OPENAI_API_KEY` defined in `backend/services/rag_chatbot/config.py`. Make sure it has a valid active key.
- **Qdrant Connection Refused**: Ensure Qdrant is running. You can start it locally or via docker-compose:
  ```bash
  docker-compose -f backend/services/rag_chatbot/docker-compose.yml up -d
  ```
- **Slow LLM Responses**: Ensure you're utilizing the `Fast-Track` detection for search-only queries. If Ollama is running on CPU, consider switching the re-ranker backend to `gemini` in `RetrieverConfig` to leverage high-performance cloud processing.
