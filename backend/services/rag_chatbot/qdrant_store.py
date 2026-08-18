"""
qdrant_store.py — Quản lý Collection và Upsert dữ liệu lên Qdrant
"""
import json
import logging
import uuid
import hashlib
import argparse
from pathlib import Path
from typing import Optional

try:
    from qdrant_client import QdrantClient
    from qdrant_client.models import (
        Distance,
        VectorParams,
        PointStruct,
        CollectionInfo,
    )
except ImportError:
    QdrantClient = None
    Distance = None
    VectorParams = None
    PointStruct = None
    CollectionInfo = None

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

QDRANT_URL      = "http://localhost:6333"
COLLECTION_NAME = "legal_data"
VECTOR_DIM      = 1536
CHUNKS_JSON = Path(__file__).parent / "data" / "chunks_embedded.json"

def get_client(url: str = QDRANT_URL) -> QdrantClient:
    client = QdrantClient(url=url, timeout=30)
    logger.info("✅ Đã kết nối tới Qdrant tại %s", url)
    return client

def init_collection(
    client: QdrantClient,
    collection_name: str = COLLECTION_NAME,
    vector_dim: int = VECTOR_DIM,
    force_recreate: bool = False,
) -> None:
    existing = [c.name for c in client.get_collections().collections]

    if collection_name in existing:
        if force_recreate:
            logger.warning("⚠️  Đang XÓA collection '%s'...", collection_name)
            client.delete_collection(collection_name)
        else:
            logger.info("ℹ️  Collection '%s' đã tồn tại. Bỏ qua khởi tạo.", collection_name)
            return

    client.create_collection(
        collection_name=collection_name,
        vectors_config=VectorParams(size=vector_dim, distance=Distance.COSINE),
    )
    logger.info("✅ Đã tạo collection '%s' | dim=%d", collection_name, vector_dim)

def build_point(chunk_dict: dict) -> Optional[PointStruct]:
    embedding = chunk_dict.get("embedding", [])
    if not embedding:
        return None

    content = chunk_dict.get("content", "")
    meta = chunk_dict.get("metadata", {})
    
    payload = {
        "content" : content,
        "metadata": meta
    }

    # Deterministic UID based on content to avoid exact duplicates
    content_hash = hashlib.md5(content.encode('utf-8')).hexdigest()
    uid = str(uuid.uuid5(uuid.NAMESPACE_DNS, content_hash))

    return PointStruct(id=uid, vector=embedding, payload=payload)

def upsert_data(
    client: QdrantClient,
    chunks: list[dict],
    collection_name: str = COLLECTION_NAME,
    batch_size: int = 32,
) -> int:
    points: list[PointStruct] = []
    skipped = 0

    for chunk in chunks:
        point = build_point(chunk)
        if point:
            points.append(point)
        else:
            skipped += 1

    if not points:
        return 0

    logger.info("📦 Chuẩn bị upsert %d points (bỏ qua %d) với batch_size=%d", len(points), skipped, batch_size)

    total_upserted = 0
    for i in range(0, len(points), batch_size):
        batch = points[i : i + batch_size]
        client.upsert(collection_name=collection_name, points=batch)
        total_upserted += len(batch)
        logger.info("  ✔ Batch %d/%d — upserted %d points", i // batch_size + 1, (len(points) - 1) // batch_size + 1, len(batch))

    logger.info("✅ Upsert hoàn tất: %d/%d points thành công.", total_upserted, len(points))
    return total_upserted

def show_collection_info(client: QdrantClient, collection_name: str = COLLECTION_NAME) -> None:
    try:
        info: CollectionInfo = client.get_collection(collection_name)
        count = client.count(collection_name).count
        logger.info("📊 Collection: %s | Vectors count: %d | Status: %s", collection_name, count, info.status)
    except Exception as e:
        logger.error("Không thể lấy thông tin collection '%s': %s", collection_name, e)

def main() -> None:
    parser = argparse.ArgumentParser(description="Qdrant Store")
    parser.add_argument("--action", choices=["init", "upsert", "info"], default="upsert")
    parser.add_argument("--qdrant-url", default=QDRANT_URL)
    parser.add_argument("--chunks-json", default=str(CHUNKS_JSON))
    parser.add_argument("--force-recreate", action="store_true")
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--vector-dim", type=int, default=VECTOR_DIM)
    args = parser.parse_args()

    client = get_client(args.qdrant_url)

    if args.action == "info":
        show_collection_info(client)
        return

    init_collection(client, vector_dim=args.vector_dim, force_recreate=args.force_recreate)

    if args.action == "upsert":
        chunks_path = Path(args.chunks_json)
        if not chunks_path.exists():
            return
        with open(chunks_path, encoding="utf-8") as f:
            chunks = json.load(f)
        upsert_data(client, chunks, batch_size=args.batch_size)
        show_collection_info(client)

if __name__ == "__main__":
    main()
