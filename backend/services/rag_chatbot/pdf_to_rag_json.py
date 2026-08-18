import pdfplumber
import json
import logging
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

PDF_PATH = "/home/ubuntu/Desktop/dungdq/QuanLyKhoaHoc/services/rag_chatbot/data/Danh mục tap chi dat tieu chuan khoa hoc Viet Nam_Trinh ky ban hanh.pdf"
OUTPUT_PATH = "/home/ubuntu/Desktop/dungdq/QuanLyKhoaHoc/services/rag_chatbot/data/danh_muc_tap_chi_2026.json"

def clean_text(text):
    if text is None:
        return ""
    return str(text).replace("\n", " ").strip()

def process_pdf():
    all_records = []
    current_category = "Chưa phân loại"
    
    logger.info(f"Đang mở file PDF: {PDF_PATH}")
    
    with pdfplumber.open(PDF_PATH) as pdf:
        for page_num, page in enumerate(pdf.pages):
            logger.info(f"Đang xử lý trang {page_num + 1}/{len(pdf.pages)}...")
            tables = page.extract_tables()
            
            for table in tables:
                for row in table:
                    # Kiểm tra xem có phải là hàng header hoặc hàng trống không
                    if not any(row):
                        continue
                        
                    # Làm sạch dữ liệu các cột
                    cols = [clean_text(c) for c in row]
                    
                    # Nếu hàng chỉ có 1 cột dữ liệu (hoặc các cột khác trống) -> Đây có thể là Category
                    # Ví dụ: ['TẠP CHÍ ĐƯỢC CHỈ MỤC QUỐC TẾ (SCOPUS, WoS)', '', '']
                    non_empty_cols = [c for c in cols if c]
                    if len(non_empty_cols) == 1 and not cols[0].isdigit():
                        # Bỏ qua tiêu đề chính ở trang 1
                        if "DANH MỤC TẠP CHÍ" in cols[0].upper():
                            continue
                        # Bỏ qua header hàng 'STT'
                        if cols[0].upper() == "STT":
                            continue
                        current_category = cols[0]
                        logger.info(f"  → Chuyển sang danh mục: {current_category}")
                        continue
                    
                    # Nếu hàng có STT (là số) thì đây là một bản ghi tạp chí
                    if cols[0].isdigit() and len(cols) >= 3:
                        stt = cols[0]
                        ten_tap_chi = cols[1]
                        co_quan = cols[2]
                        
                        if ten_tap_chi:
                            description = f"Tên tạp chí: {ten_tap_chi}. Cơ quan chủ quản: {co_quan}. Danh mục: {current_category}."
                            metadata = {
                                "stt": stt,
                                "ten_tap_chi": ten_tap_chi,
                                "co_quan_chu_quan": co_quan,
                                "danh_muc": current_category,
                                "source": Path(PDF_PATH).name
                            }
                            all_records.append({
                                "description_for_rag": description,
                                "is_logical": True,
                                "row_type": "data",
                                "metadata": metadata
                            })

    logger.info(f"Tổng cộng đã trích xuất được {len(all_records)} tạp chí.")
    
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(all_records, f, ensure_ascii=False, indent=2)
    
    logger.info(f"✅ Đã lưu kết quả vào: {OUTPUT_PATH}")

if __name__ == "__main__":
    process_pdf()
