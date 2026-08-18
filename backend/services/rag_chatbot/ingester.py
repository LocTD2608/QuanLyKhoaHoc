"""
RAG Ingester - Parse structured JSON data
"""

import json
import logging
from pathlib import Path
from dataclasses import dataclass, field, asdict
from config import RAGConfig
from openai import OpenAI

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────
# Configuration
# ────────────────────────────────────────────────────────────
DATA_DIR = Path(__file__).parent / "data"
OUTPUT_JSON = Path(__file__).parent / "data" / "chunks_embedded.json"

EMBED_MODEL = "text-embedding-3-small"

@dataclass
class JsonChunk:
    content: str
    metadata: dict = field(default_factory=dict)
    embedding: list = field(default_factory=list)

def embed_chunks(chunks: list[JsonChunk]) -> list[JsonChunk]:
    conf = RAGConfig()
    try:
        client = OpenAI(api_key=conf.OPENAI_API_KEY)
    except Exception as e:
        logger.warning(f"Lỗi khởi tạo OpenAI API: {e}")
        return chunks

    # Batch embeddings for OpenAI limits
    batch_size = 500
    total = len(chunks)
    for i in range(0, total, batch_size):
        batch = chunks[i: i + batch_size]
        texts = [c.content for c in batch]
        try:
            res = client.embeddings.create(input=texts, model=EMBED_MODEL)
            for j, data in enumerate(res.data):
                batch[j].embedding = data.embedding
            logger.info("  Embedded batch %d/%d (total: %d)...", i // batch_size + 1, (total - 1) // batch_size + 1, total)
        except Exception as e:
            logger.error("  Lỗi embed batch %d: %s", i // batch_size + 1, e)
            for c in batch:
                c.embedding = []

    return chunks

def save_to_json(chunks: list[JsonChunk], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    data = [asdict(c) for c in chunks]
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    logger.info("✅ Đã lưu %d chunks vào: %s", len(data), output_path)

def run_ingestion(data_dir: Path = DATA_DIR, embed: bool = True) -> list[JsonChunk]:
    json_files = sorted(data_dir.glob("*.json"))
    
    # Bỏ qua các file json output nội bộ
    json_files = [f for f in json_files if f.name not in ["chunks_embedded.json", "data_final.json"]]
    
    if not json_files:
        logger.warning("Không tìm thấy file .json hợp lệ nào trong: %s", data_dir)
        return []

    all_chunks: list[JsonChunk] = []

    for json_file in json_files:
        logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        logger.info("📄 Đang xử lý: %s", json_file.name)

        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        for row in data:
            desc = row.get("description_for_rag", "")
            if not desc:
                continue
            
            meta = row.get("metadata", {})
            meta["source_file"] = json_file.name
            
            all_chunks.append(JsonChunk(content=desc, metadata=meta))

        logger.info("  → Tổng chunks: %d", len(all_chunks))

    if embed and all_chunks:
        logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        logger.info("🔢 Bắt đầu embedding với model: %s", EMBED_MODEL)
        all_chunks = embed_chunks(all_chunks)

    save_to_json(all_chunks, OUTPUT_JSON)

    # In preview
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logger.info("📋 Preview 2 chunks đầu tiên:")
    for chunk in all_chunks[:2]:
        print("\n" + "=" * 60)
        print(chunk.content[:600])
        print(f"\n[Metadata]: {json.dumps(chunk.metadata, ensure_ascii=False, indent=2)}")
        print(f"[Embedding dim]: {len(chunk.embedding)}")

    return all_chunks

if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="RAG Ingester - Parse JSON data")
    parser.add_argument(
        "--no-embed",
        action="store_true",
        help="Bỏ qua bước embedding",
    )
    parser.add_argument(
        "--data-dir",
        type=str,
        default=str(DATA_DIR),
        help="Đường dẫn tới thư mục chứa file .json",
    )
    args = parser.parse_args()

    run_ingestion(
        data_dir=Path(args.data_dir),
        embed=not args.no_embed,
    )
