# OCR Paper Page & Declaration Form Validation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Xây dựng tính năng trích xuất thông minh từ ảnh chụp trang đầu bài báo (First Page / Cover Page) hoặc Tờ khai công trình khoa học (Declaration Form) bằng Multimodal Vision / OCR, hoạt động song song với luồng xác thực bằng mã DOI hiện tại, tự động điền form và thẩm định liêm chính bài báo.

**Architecture:** 
1. **Backend Vision Service**: Nhận file ảnh (JPG, PNG, WebP) hoặc PDF trang 1, phân tích bằng Gemini / OpenAI Multimodal Vision với Structured JSON output.
2. **Dual-Path Routing & Verification Engine**:
   - Nếu phát hiện mã DOI trên ảnh: Tự động kích hoạt đối soát chéo kép (Double Verification) giữa thông tin trên ảnh scan và siêu dữ liệu chuẩn từ Crossref API.
   - Nếu không có DOI: Thẩm định trực tiếp dựa trên Title, Journal, ISSN, Author order & affiliations với CSDL HĐGSNN và Scimago.
3. **Frontend Hybrid UI**: Cho phép chuyển đổi linh hoạt giữa "Nhập DOI" và "📸 Quét ảnh / Kéo thả file / Paste clipboard", kèm xem trước ảnh scan, kiểm tra kết quả và tự động điền (Auto-fill) vào modal thêm bài báo và trang thẩm định.

**Tech Stack:** 
- Backend: FastAPI, Pydantic, OpenAI / Google Generative AI (Gemini Vision), python-multipart, Pillow / pdfplumber.
- Frontend: React 18, TypeScript, Vite, CSS Glassmorphism & Drag-and-Drop UI.

---

### Task 1: Định nghĩa Pydantic Schemas cho OCR & Vision Result

**Files:**
- Modify: `backend/core/schemas.py`
- Test: `backend/scripts/test_ocr_schemas.py`

**Step 1: Write test for schemas**
Tạo test đảm bảo các schema nhận diện đúng cấu trúc bài báo và tờ khai.

**Step 2: Implement schemas in `backend/core/schemas.py`**
- `OCRExtractedAuthor`: Tên, email, affiliation, thứ tự tác giả, `is_first_author`, `is_corresponding`, `is_co_first`.
- `OCRArticleExtractResponse`: Dữ liệu bóc tách trang đầu bài báo (title_en, title_vn, journal_name, issn, year, volume, issue, pages, doi, authors list, raw_text_summary).
- `OCRDeclarationItem`: Từng mục công trình trong tờ khai HĐGSNN.
- `OCRDeclarationResponse`: Danh sách công trình tự kê khai.
- `OCRValidationResponse`: Kết quả kết hợp giữa OCR và thẩm định liêm chính HĐGSNN.

---

### Task 2: Xây dựng OCR & Vision Service (`ocr_vision_service.py`)

**Files:**
- Create: `backend/services/ai_extraction/ocr_vision_service.py`
- Test: `backend/scripts/test_ocr_service.py`

**Step 1: Implement `OCRVisionService`**
- Hỗ trợ nạp ảnh trực tiếp qua Base64 hoặc Binary.
- Hỗ trợ chuyển đổi trang đầu nếu file tải lên là PDF.
- Kết nối tới Gemini API (`gemini-1.5-flash` / `gemini-2.0-flash`) hoặc OpenAI Vision (`gpt-4o-mini` / `gpt-4o`).
- Prompt định hướng trích xuất chuyên sâu học thuật:
  - Bắt buộc tìm kiếm mã DOI in trên header/footer/sidebar của trang đầu.
  - Phân tích vị trí tên tác giả, ký hiệu dấu sao (`*`), dấu thập (`†`), footnote "contributed equally" để xác định chính xác First Author / Corresponding / Co-first.
  - Trích xuất Đơn vị công tác (Affiliation) chuẩn xác.

**Step 2: Viết test script kiểm thử bóc tách**
Kiểm tra khả năng parse JSON và xử lý khi ảnh thiếu thông tin hoặc không có DOI.

---

### Task 3: Xây dựng API Endpoints trong Backend Router

**Files:**
- Modify: `backend/routers/validation.py`
- Modify: `backend/core/dependencies.py`

**Step 1: Thêm endpoint xử lý file upload**
- `POST /api/v1/ocr/extract-page`: Nhận file upload (`UploadFile = File(...)`, `doc_type = Form("auto")`), gọi `OCRVisionService` và trả về thông tin bóc tách.
- `POST /api/v1/ocr/validate-from-image`: Nhận file ảnh + tên ứng viên + chức danh/ngành:
  - Tự động bóc tách trang đầu.
  - Nếu có DOI: Chạy qua `validation_flow.run_validation(extracted_doi, ...)`.
  - Thực hiện đối soát kép: So khớp tiêu đề và danh sách tác giả giữa bản in scan và metadata Crossref.
  - Nếu không có DOI: Thẩm định trực tiếp với CSDL HĐGSNN.

---

### Task 4: Nâng cấp Frontend Client & Types

**Files:**
- Modify: `frontend/src/api/client.ts` (Hỗ trợ multipart/form-data)
- Modify: `frontend/src/api/index.ts` (Thêm các hàm gọi API OCR)
- Modify: `frontend/src/types/index.ts` (Thêm types cho kết quả OCR)

**Step 1: Cập nhật `client.ts`**
Xử lý tự động bỏ header `Content-Type: application/json` khi `body instanceof FormData` để trình duyệt tự tạo boundary multipart.

**Step 2: Định nghĩa API functions**
- `ocrApi.extractPage(file: File, docType?: string)`
- `ocrApi.validateFromImage(file: File, candidateName: string, candidateTitleVn?: string)`

---

### Task 5: Nâng cấp Giao diện Trang Thẩm định (`Validation.tsx`)

**Files:**
- Modify: `frontend/src/components/Validation.tsx`
- Modify: `frontend/style.css` (Style cho Dropzone, Image preview, Scan badge)

**Step 1: Thêm Tab Chuyển đổi (Segment Control)**
- Tab 1: `🔗 Nhập mã DOI / URL` (Phương thức hiện tại).
- Tab 2: `📸 Quét ảnh trang đầu bài báo / Tờ khai` (Phương thức mới).

**Step 2: Thiết kế Dropzone tải ảnh trực quan**
- Hỗ trợ Drag & Drop, bấm chọn file, hoặc Paste ảnh trực tiếp từ Clipboard (`Ctrl+V`).
- Xem trước ảnh tải lên (Thumbnail/Preview) kèm nút đổi ảnh hoặc phóng to.
- Hiển thị thông báo trạng thái: "Đang phân tích thị giác AI (Vision OCR)...".

**Step 3: Hiển thị kết quả bóc tách song song với kết quả thẩm định**
- Nếu tìm thấy DOI trên ảnh: Hiển thị Badge xanh lá `"Đã phát hiện DOI trên trang 1: 10.xxxx/yyyy"` và hiển thị kết quả đối soát kép (Double Check).
- Hiển thị vai trò tác giả, các dấu hiệu nhận dạng (`*`, email, affiliation).
- Cho phép chỉnh sửa nhanh các trường nếu ảnh chụp bị mờ trước khi bấm "Lưu vào hệ thống".

---

### Task 6: Tích hợp Quét ảnh vào Modal Thêm Bài báo (`PaperFormModal.tsx`)

**Files:**
- Modify: `frontend/src/components/modules/papers/modals/PaperFormModal.tsx`

**Step 1: Thêm nút "Quét từ ảnh" (Scan Image Autofill)**
- Đặt cạnh ô nhập DOI hiện tại.
- Khi người dùng tải ảnh lên, modal tự động gọi OCR API, điền toàn bộ:
  - Tên bài báo, Tạp chí, Năm, ISSN, Mã DOI (nếu có), Xếp hạng.
  - Tự động so khớp và chọn tác giả trong danh sách dropdown.
- Hiển thị Toast thông báo các trường đã được tự động điền thành công.

---

### Task 7: Kiểm thử Toàn diện & Hoàn thiện

**Files:**
- Run test backend scripts.
- Kiểm thử build frontend (`npm run build`).
- Xác nhận các kịch bản:
  1. Bài báo quốc tế có DOI trên trang 1 (IEEE / Springer / Elsevier).
  2. Bài báo trong nước không có DOI (Tạp chí KH&CN / HĐGSNN).
  3. Tờ khai công trình dạng danh mục bảng.
