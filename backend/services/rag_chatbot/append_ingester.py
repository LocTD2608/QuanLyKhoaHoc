import json
import logging
from pathlib import Path
from dataclasses import dataclass, field
from config import RAGConfig
from openai import OpenAI
import argparse

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

EMBED_MODEL = "text-embedding-3-small"

def embed_texts(texts: list[str]) -> list[list[float]]:
    conf = RAGConfig()
    client = OpenAI(api_key=conf.OPENAI_API_KEY)
    embeddings = []
    batch_size = 500
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        res = client.embeddings.create(input=batch, model=EMBED_MODEL)
        embeddings.extend([d.embedding for d in res.data])
        logger.info(f"  Embedded {len(embeddings)}/{len(texts)}...")
    return embeddings

def append_ingestion(input_path: Path, output_path: Path):
    if not input_path.exists():
        logger.error(f"File {input_path} không tồn tại.")
        return

    with open(input_path, "r", encoding="utf-8") as f:
        new_data = json.load(f)

    logger.info(f"Đang xử lý {len(new_data)} records từ {input_path.name}")
    
    texts = [item["description_for_rag"] for item in new_data]
    embeddings = embed_texts(texts)

    new_chunks = []
    for i, item in enumerate(new_data):
        chunk = {
            "content": item["description_for_rag"],
            "metadata": item.get("metadata", {}),
            "embedding": embeddings[i]
        }
        new_chunks.append(chunk)

    if output_path.exists():
        logger.info(f"Đang đọc dữ liệu cũ từ {output_path.name}...")
        with open(output_path, "r", encoding="utf-8") as f:
            old_chunks = json.load(f)
        logger.info(f"Đã đọc {len(old_chunks)} chunks cũ.")
        all_chunks = old_chunks + new_chunks
    else:
        all_chunks = new_chunks

    logger.info(f"Đang lưu {len(all_chunks)} chunks vào {output_path.name}...")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(all_chunks, f, ensure_ascii=False, indent=2)
    
    logger.info("✅ Hoàn thành cập nhật vector database.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=str, default="data/danh_muc_tap_chi_2026.json")
    parser.add_argument("--output", type=str, default="data/chunks_embedded.json")
    args = parser.parse_args()
    
    append_ingestion(Path(args.input), Path(args.output))
