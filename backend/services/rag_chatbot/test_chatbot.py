import sys
import logging
from chatbot_engine import RAGChatbot

# Configure logging to see the pipeline outputs
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

def main():
    print("Khởi tạo RAG Chatbot Engine...")
    chatbot = RAGChatbot()
    
    print("\nNhập câu hỏi của bạn (hoặc gõ 'exit' để thoát):")
    while True:
        try:
            query = input("\nBạn: ")
            if query.strip().lower() in ["exit", "quit", "q"]:
                break
                
            if not query.strip():
                continue
                
            print("Chatbot: Đang suy nghĩ...\n")
            result = chatbot.get_answer(query)
            
            print("="*60)
            print("🔹 CÂU TRẢ LỜI:")
            print(result["answer"])
            print("-" * 60)
            if result["citations"]:
                print("🔹 TRÍCH DẪN & NGUỒN TÀI LIỆU:")
                for c in result["citations"]:
                    meta_str = " | ".join([f"{k}: {v}" for k, v in c.get("metadata", {}).items()])
                    print(f"  [{c['rank']}] {meta_str}. Điểm relevance: {c['rerank_score']}")
            else:
                print("Không có trích dẫn nào.")
            print("="*60)
            
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f"\nLỗi: {e}")

if __name__ == "__main__":
    main()
