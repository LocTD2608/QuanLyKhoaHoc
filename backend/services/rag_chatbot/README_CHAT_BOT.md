# 🧠 Tài liệu Hệ thống Trợ lý Khoa học AI (Agentic RAG Chatbot)

Hệ thống Chatbot RAG (Retrieval-Augmented Generation) được thiết kế chuyên biệt cho việc tra cứu danh mục tạp chí khoa học, tính điểm quy đổi chức danh GS/PGS và giải đáp các quy định pháp lý liên quan đến Quản lý Khoa học.

## 1. Tính năng chính
- **Tra cứu tạp chí thông minh**: Tìm kiếm trong database hơn 19,000 bản ghi (ISSN, Ngành, SJR, H-index).
- **Tính điểm GS/PGS tự động**: Tính điểm quy đổi bài báo dựa trên vai trò tác giả (Tác giả chính/phụ) và danh mục tạp chí.
- **Agentic Reasoning**: AI có khả năng tự động gọi các "Công cụ" (Tools) để thực hiện tính toán chính xác thay vì chỉ tạo văn bản ngẫu nhiên.
- **Giao diện Dashboard hiện đại**: Giao diện Web Premium với khả năng hiển thị trích dẫn nguồn tài liệu chi tiết.
- **Chế độ Fast-Track**: Tối ưu hóa tốc độ phản hồi cho các câu hỏi tra cứu đơn giản (dưới 3-5 giây).

## 2. Kiến trúc hệ thống
Hệ thống được xây dựng theo mô hình **Agentic RAG**, gồm các thành phần:

### ⚙️ Backend Core (`/services/rag_chatbot/`)
- `chatbot_engine.py`: Trình điều phối chính. Sử dụng OpenAI Function Calling để quyết định khi nào cần tra cứu database hoặc tính điểm.
- `scoring_engine.py`: Bộ máy tính toán và tra cứu database thực tế. Hoạt động độc lập với AI để đảm bảo tính chính xác tuyệt đối của con số.
- `retriever.py`: Thực hiện tìm kiếm Vector trên Qdrant. Sử dụng mô hình **Gemma 3:12B** (Ollama) để xếp hạng lại (Re-rank) các đoạn văn bản pháp lý.
- `app_web.py`: Bản chạy độc lập cũ của chatbot. Luồng chính hiện đã được tích hợp vào `backend/main.py`.

### 📊 Dữ liệu (Data)
- `danh_muc_tap_chi_2026_enriched.json`: Danh mục tạp chí mới nhất đã được làm giàu dữ liệu điểm.
- `Dữ liệu tổng hợp.json`: Kho dữ liệu khổng lồ chứa hàng vạn tạp chí quốc tế và quy định tính điểm.

### 🎨 Frontend (`/static/`)
- Giao diện được xây dựng bằng HTML/CSS/JS hiện đại, hỗ trợ Dark Mode, hiệu ứng Glassmorphism và hiển thị trích dẫn theo thời gian thực.

## 3. Hướng dẫn vận hành

### Backend API tích hợp
Chatbot hiện được tích hợp vào backend chính:
- Backend API: `http://localhost:10000`
- Chat endpoint: `POST /api/chat`
- Health endpoint: `GET /api/chat/health`
- Frontend UI: `http://localhost:10001`

### Luồng giao diện
Frontend React tại `http://localhost:10001` hiển thị chatbot trực tiếp trong widget nổi và gọi API qua Vite proxy tới backend `:10000`. Không còn cần `iframe` hoặc cổng `10002` cho luồng sử dụng chính.

### Trạng thái `app_web.py`
`services/rag_chatbot/app_web.py` hiện là entrypoint độc lập cũ, chỉ nên giữ để debug riêng. Luồng vận hành chính dùng `backend/main.py` và frontend React, không dùng `iframe` hoặc cổng `10002`.

## 4. Cơ chế tối ưu hóa tốc độ
Hệ thống sử dụng cơ chế **Fast-Track Detection**:
- Khi người dùng hỏi các câu tra cứu (ví dụ: "Tạp chí X thuộc Q mấy?"), hệ thống sẽ tự động bỏ qua bước Re-ranking nặng nề bằng AI và trả về kết quả trực tiếp từ database.
- Giảm số lượng đoạn văn bản nạp vào AI từ 50 xuống còn 15-20 đoạn để tăng tốc độ xử lý.

## 5. Cấu hình (Configuration)
Các thông số quan trọng nằm trong file `config.py` và `retriever.py`:
- `OPENAI_MODEL`: Mặc định là `gpt-4o`.
- `top_k_retrieve`: Số lượng đoạn văn bản lấy ra từ Vector DB (Mặc định: 20).
- `ollama_llm_model`: Mô hình Re-rank cục bộ (Mặc định: `gemma3:12b`).

---
