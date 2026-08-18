"""
retriever.py — Hybrid Retrieval + Cross-Encoder Re-ranking cho RAG Chatbot
"""

import json
import logging
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional

try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import ScoredPoint
except ImportError:
    QdrantClient = None
    ScoredPoint = None

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

# ────────────────────────────────────────────────────────────
# Configuration
# ────────────────────────────────────────────────────────────
QDRANT_URL      = "http://localhost:6333"
COLLECTION_NAME = "legal_data"
EMBED_MODEL     = "text-embedding-3-small"
OLLAMA_HOST     = "http://localhost:11434"

class LLMBackend(str, Enum):
    GEMINI = "gemini"
    OLLAMA = "ollama"

@dataclass
class RetrieverConfig:
    qdrant_url      : str        = QDRANT_URL
    collection_name : str        = COLLECTION_NAME
    embed_model     : str        = EMBED_MODEL
    ollama_host     : str        = OLLAMA_HOST
    top_k_retrieve  : int        = 20
    top_n_rerank    : int        = 10
    llm_backend     : LLMBackend = LLMBackend.OLLAMA
    ollama_llm_model: str        = "gemma3:12b"
    gemini_api_key  : str        = ""
    gemini_model    : str        = "gemini-2.0-flash"
    rerank_threshold: float      = 3.0

# ────────────────────────────────────────────────────────────
# Result model
# ────────────────────────────────────────────────────────────
@dataclass
class RetrievedChunk:
    rank            : int
    qdrant_score    : float
    rerank_score    : float
    content         : str
    metadata        : dict

    @classmethod
    def from_scored_point(cls, rank: int, point: ScoredPoint, rerank_score: float = 0.0):
        p = point.payload or {}
        
        # Cleanly extract all dynamic keys directly from the Qdrant payload
        meta = {}
        if isinstance(p.get("metadata"), dict):
            meta.update(p["metadata"])
        for k, v in p.items():
            if k not in ("content", "metadata"):
                meta[k] = v
                
        # Remove old architectural fields
        for field_to_remove in ("so_hieu", "dieu_so", "chuong_so"):
            meta.pop(field_to_remove, None)
            
        return cls(
            rank         = rank,
            qdrant_score = round(point.score, 4),
            rerank_score = rerank_score,
            content      = p.get("content", ""),
            metadata     = meta
        )

# ────────────────────────────────────────────────────────────
# Step 1: Embed query
# ────────────────────────────────────────────────────────────
def embed_query(query: str, config: RetrieverConfig) -> list[float]:
    try:
        from openai import OpenAI
        try:
            from services.rag_chatbot.config import RAGConfig
        except ImportError:
            try:
                from .config import RAGConfig
            except ImportError:
                from core.config import settings
                class RAGConfig:
                    OPENAI_API_KEY = settings.OPENAI_API_KEY
                    OPENAI_MODEL = settings.OPENAI_MODEL
                    BATCH_SIZE = settings.RAG_BATCH_SIZE
    except ImportError:
        raise RuntimeError("Package 'openai' chưa cài.")

    rag_conf = RAGConfig()
    if not rag_conf.OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY chưa được thiết lập.")
        return []
        
    try:
        client = OpenAI(api_key=rag_conf.OPENAI_API_KEY, timeout=5.0)
        response = client.embeddings.create(input=[query], model=config.embed_model)
        vector = response.data[0].embedding
        logger.info("  🔢 Embedded query with OpenAI | dim=%d", len(vector))
        return vector
    except Exception as e:
        logger.warning("  ⚠️ Bỏ qua OpenAI embedding do lỗi/timeout: %s", e)
        return []

# ────────────────────────────────────────────────────────────
# Step 2: Dense Retrieval từ Qdrant
# ────────────────────────────────────────────────────────────
def retrieve_top_k(query_vector: list[float], config: RetrieverConfig) -> list[ScoredPoint]:
    if not query_vector or QdrantClient is None:
        return []
    try:
        client = QdrantClient(url=config.qdrant_url, timeout=3.0)
        response = client.query_points(
            collection_name=config.collection_name,
            query=query_vector,
            limit=config.top_k_retrieve,
            with_payload=True,
        )
        results = response.points
        logger.info("  🔍 Qdrant retrieval: lấy được %d ứng viên (top_k=%d)", len(results), config.top_k_retrieve)
        return results
    except Exception as e:
        logger.warning("  ⚠️ Không thể kết nối Qdrant (%s): %s", config.qdrant_url, e)
        return []

# ────────────────────────────────────────────────────────────
# Step 3: Build Re-ranking Prompt
# ────────────────────────────────────────────────────────────
RERANK_PROMPT_TEMPLATE = """Bạn là chuyên gia phân tích dữ liệu.

Câu truy vấn của người dùng:
```
{query}
```

Dưới đây là {n} đoạn dữ liệu ứng viên. Hãy đánh giá mức độ liên quan của từng đoạn dữ liệu với câu truy vấn trên, sử dụng thang điểm từ 0 đến 10:
- 0–2: Hoàn toàn không liên quan
- 3–5: Có liên quan một phần
- 6–8: Liên quan rõ ràng
- 9–10: Cực kỳ liên quan, trả lời trực tiếp câu hỏi

{candidates}

**YÊU CẦU OUTPUT**:
Trả về JSON hợp lệ theo định dạng sau, KHÔNG thêm markdown hay giải thích:
{{
  "scores": [
    {{"index": 0, "score": <float 0-10>, "reason": "<giải thích ngắn 1 câu>"}},
    {{"index": 1, "score": <float 0-10>, "reason": "<giải thích ngắn 1 câu>"}},
    ...
  ]
}}"""

def build_candidates_text(candidates: list[ScoredPoint]) -> str:
    parts = []
    for i, point in enumerate(candidates):
        p = point.payload or {}
        snippet = p.get("content", "")[:600].replace("\n", " ")
        meta = p.get("metadata", {})
        meta_str = " | ".join([f"{k}: {v}" for k, v in meta.items()])
        parts.append(f"[{i}] {meta_str}\n    {snippet}...")
    return "\n\n".join(parts)

# ────────────────────────────────────────────────────────────
# Step 4: LLM Re-ranking
# ────────────────────────────────────────────────────────────
def _parse_rerank_response(raw: str, n_candidates: int) -> list[float]:
    json_match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not json_match:
        logger.warning("  ⚠️  LLM không trả về JSON hợp lệ. Raw:\n%s", raw[:400])
        return [0.0] * n_candidates

    try:
        data = json.loads(json_match.group())
        scores_raw = data.get("scores", [])
        scores = [0.0] * n_candidates
        for item in scores_raw:
            idx = item.get("index", -1)
            score = float(item.get("score", 0.0))
            if 0 <= idx < n_candidates:
                scores[idx] = score
                logger.info("    Candidate [%d] score=%.1f | %s", idx, score, item.get("reason", ""))
        return scores
    except (json.JSONDecodeError, ValueError) as e:
        logger.warning("  ⚠️  Parse lỗi: %s\nRaw: %s", e, raw[:400])
        return [0.0] * n_candidates

def rerank_with_ollama(prompt: str, config: RetrieverConfig, n_candidates: int) -> list[float]:
    try:
        import ollama  # type: ignore
    except ImportError:
        raise RuntimeError("pip install ollama")

    client = ollama.Client(host=config.ollama_host)
    logger.info("  🤖 Re-ranking với Ollama model: %s", config.ollama_llm_model)

    response = client.chat(
        model=config.ollama_llm_model,
        messages=[{"role": "user", "content": prompt}],
        options={"temperature": 0.1},
    )
    raw = response["message"]["content"]
    return _parse_rerank_response(raw, n_candidates)

def rerank_with_gemini(prompt: str, config: RetrieverConfig, n_candidates: int) -> list[float]:
    import os
    api_key = config.gemini_api_key or os.getenv("GOOGLE_API_KEY", "")
    if not api_key:
        raise RuntimeError("GOOGLE_API_KEY chưa được set.")
    try:
        import google.generativeai as genai  # type: ignore
    except ImportError:
        raise RuntimeError("pip install google-generativeai")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel(config.gemini_model)
    logger.info("  🤖 Re-ranking với Gemini model: %s", config.gemini_model)

    response = model.generate_content(
        prompt,
        generation_config=genai.GenerationConfig(
            temperature=0.1,
            response_mime_type="application/json",
        ),
    )
    raw = response.text
    return _parse_rerank_response(raw, n_candidates)

# ────────────────────────────────────────────────────────────
# Main public API
# ────────────────────────────────────────────────────────────
def search_and_rerank(query_text: str, config: Optional[RetrieverConfig] = None) -> list[RetrievedChunk]:
    if config is None:
        config = RetrieverConfig()

    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logger.info("🔎 Query: %s", query_text)

    # NHẬN DIỆN CÂU HỎI TRA CỨU NHANH (FAST-TRACK)
    lookup_keywords = ["thuộc q mấy", "điểm", "tra cứu", "xếp hạng", "chỉ số", "hạng q", "quy đổi"]
    is_lookup = any(k in query_text.lower() for k in lookup_keywords)
    
    if is_lookup:
        logger.info("  ⚡ Phát hiện câu hỏi tra cứu - Kích hoạt chế độ Fast-Track (Bỏ qua Re-ranking)")
        query_vector = embed_query(query_text, config)
        # Chỉ lấy 5 ứng viên và không dùng AI re-rank
        candidates = retrieve_top_k(query_vector, config)
        # Bóp nhỏ danh sách xuống còn 5 để phản hồi siêu tốc
        candidates = candidates[:15]
        
        results: list[RetrievedChunk] = []
        for i, point in enumerate(candidates):
            chunk = RetrievedChunk.from_scored_point(rank=i+1, point=point, rerank_score=point.score * 10)
            results.append(chunk)
        
        logger.info("✅ Fast-Track xong: %d kết quả", len(results))
        logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        return results

    # CHẾ ĐỘ RAG THÔNG THƯỜNG (Có Re-ranking)
    query_vector = embed_query(query_text, config)
    candidates = retrieve_top_k(query_vector, config)
    if not candidates:
        logger.warning("Không tìm thấy kết quả nào trong Qdrant.")
        return []

    candidates_text = build_candidates_text(candidates)
    prompt = RERANK_PROMPT_TEMPLATE.format(query=query_text, n=len(candidates), candidates=candidates_text)

    logger.info("  📝 Đang re-rank %d ứng viên...", len(candidates))
    try:
        if config.llm_backend == LLMBackend.GEMINI:
            scores = rerank_with_gemini(prompt, config, len(candidates))
        else:
            scores = rerank_with_ollama(prompt, config, len(candidates))
    except Exception as e:
        logger.error("  ❌ Lỗi LLM re-ranking: %s. Fallback về Qdrant score.", e)
        scores = [p.score * 10 for p in candidates]

    results: list[RetrievedChunk] = []
    for i, (point, score) in enumerate(zip(candidates, scores)):
        chunk = RetrievedChunk.from_scored_point(rank=i, point=point, rerank_score=score)
        results.append(chunk)

    results.sort(key=lambda x: x.rerank_score, reverse=True)
    results = [r for r in results if r.rerank_score >= config.rerank_threshold][: config.top_n_rerank]
    for i, r in enumerate(results):
        r.rank = i + 1

    logger.info("✅ Re-rank xong: %d kết quả (threshold=%.1f, top_n=%d)", len(results), config.rerank_threshold, config.top_n_rerank)
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    return results

def _print_results(results: list[RetrievedChunk]) -> None:
    if not results:
        print("\n⚠️  Không tìm thấy kết quả phù hợp.")
        return

    for r in results:
        print(f"\n{'='*70}")
        print(f"🏆 Rank #{r.rank}  |  Re-rank score: {r.rerank_score:.1f}/10  |  Qdrant score: {r.qdrant_score:.4f}")
        meta_str = " | ".join([f"{k}: {v}" for k, v in r.metadata.items()])
        print(f"📄 {meta_str}")
        print(f"\n{'-'*70}")
        print(r.content[:800])
        if len(r.content) > 800:
            print("... [truncated]")

if __name__ == "__main__":
    import argparse
    import os

    parser = argparse.ArgumentParser(description="RAG Retriever")
    parser.add_argument("query", nargs="?", default="Tiêu chuẩn đạo đức là gì?")
    parser.add_argument("--backend", choices=["ollama", "gemini"], default="ollama")
    parser.add_argument("--ollama-model", default="gemma3:12b")
    parser.add_argument("--gemini-key", default=os.getenv("GOOGLE_API_KEY", ""))
    parser.add_argument("--top-k", type=int, default=10)
    parser.add_argument("--top-n", type=int, default=3)
    parser.add_argument("--threshold", type=float, default=3.0)
    args = parser.parse_args()

    config = RetrieverConfig(
        top_k_retrieve   = args.top_k,
        top_n_rerank     = args.top_n,
        rerank_threshold = args.threshold,
        llm_backend      = LLMBackend(args.backend),
        ollama_llm_model = args.ollama_model,
        gemini_api_key   = args.gemini_key,
    )

    results = search_and_rerank(args.query, config)
    _print_results(results)
