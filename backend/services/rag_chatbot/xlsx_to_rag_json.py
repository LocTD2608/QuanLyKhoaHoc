import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Any

import openpyxl
from openpyxl.utils import range_boundaries

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Core helpers
# ---------------------------------------------------------------------------
def expand_merged_cells(ws) -> dict[tuple[int, int], Any]:
    """
    Trả về dict (row, col) → value đã fill đầy đủ cho các ô bị merge.
    Merged cells trong openpyxl chỉ có giá trị ở ô đầu tiên (top-left).
    """
    cell_map: dict[tuple[int, int], Any] = {}
    # 1. Đọc tất cả giá trị thông thường
    for row in ws.iter_rows():
        for cell in row:
            cell_map[(cell.row, cell.column)] = cell.value

    # 2. Propagate giá trị của merged range xuống các ô còn lại
    for merged_range in ws.merged_cells.ranges:
        min_col, min_row, max_col, max_row = range_boundaries(str(merged_range))
        anchor_value = cell_map.get((min_row, min_col))
        for r in range(min_row, max_row + 1):
            for c in range(min_col, max_col + 1):
                cell_map[(r, c)] = anchor_value
    return cell_map

def detect_header_row(cell_map: dict, max_row: int, max_col: int, hint: int = 1) -> int:
    """
    Tìm header row: ưu tiên `hint`, nếu hint trống thì tìm hàng đầu tiên có
    ít nhất 50% số cột có dữ liệu.
    """
    # Kiểm tra hint trước
    non_empty = sum(
        1 for c in range(1, max_col + 1)
        if cell_map.get((hint, c)) not in (None, "")
    )
    if non_empty > 0:
        return hint

    # Fallback: quét từ trên xuống
    for r in range(1, min(max_row + 1, 20)):
        non_empty = sum(
            1 for c in range(1, max_col + 1)
            if cell_map.get((r, c)) not in (None, "")
        )
        if non_empty >= max(1, max_col * 0.5):
            return r
    return 1

def clean_value(v: Any) -> str:
    """Chuẩn hoá giá trị ô thành string sạch."""
    if v is None:
        return ""
    return str(v).strip()

def is_logical_row(row_data: dict[str, str]) -> bool:
    """
    Hàng hợp lệ (is_logical=True) khi có ít nhất một ô không rỗng
    và không phải header lặp.
    """
    values = [v for v in row_data.values() if v]
    return len(values) > 0

def build_description(row_data: dict[str, str], sheet_name: str) -> str:
    """
    Tổng hợp nội dung hàng thành câu mô tả ngắn gọn cho RAG embedding.
    Format: "Tiêu chí: <val>. Cột A: <val>. Cột B: <val>."
    """
    parts = []
    for col, val in row_data.items():
        if val:
            parts.append(f"{col}: {val}")
    if not parts:
        return f"[Hàng trống – sheet: {sheet_name}]"
    return ". ".join(parts) + "."

# ---------------------------------------------------------------------------
# Sheet processor
# ---------------------------------------------------------------------------
def process_sheet(
    ws,
    sheet_name: str,
    header_row_hint: int = 1,
) -> list[dict]:
    """Chuyển một worksheet thành danh sách JSON record."""
    max_row = ws.max_row
    max_col = ws.max_column
    if max_row is None or max_col is None or max_row == 0:
        log.warning("Sheet '%s' rỗng, bỏ qua.", sheet_name)
        return []
    log.info("Đang xử lý sheet: '%s' (%d rows × %d cols)", sheet_name, max_row, max_col)
    cell_map = expand_merged_cells(ws)
    header_row = detect_header_row(cell_map, max_row, max_col, hint=header_row_hint)
    # Tìm các cột thực sự có dữ liệu (có header hoặc có dữ liệu ở hàng nào đó)
    valid_cols = []
    headers_map = {}
    for c in range(1, max_col + 1):
        header_raw = clean_value(cell_map.get((header_row, c)))
        has_data = bool(header_raw)
        if not has_data:
            # Nếu header trống, thử kiểm tra các hàng bên dưới
            for r in range(header_row + 1, max_row + 1):
                if clean_value(cell_map.get((r, c))):
                    has_data = True
                    break
        
        if has_data:
            valid_cols.append(c)
            headers_map[c] = header_raw if header_raw else f"Col_{c}"

    log.info("  Header row: %d | Columns: %s", header_row, list(headers_map.values()))
    records: list[dict] = []
    for r in range(header_row + 1, max_row + 1):
        row_data: dict[str, str] = {}
        for c in valid_cols:
            val = clean_value(cell_map.get((r, c)))
            if val:  # Chỉ đưa vào dict nếu cell có dữ liệu
                row_data[headers_map[c]] = val
        logical = is_logical_row(row_data)
        description = build_description(row_data, sheet_name)
        metadata = {**row_data, "sheet_source": sheet_name}
        record = {
            "description_for_rag": description,
            "is_logical": logical,
            "row_type": "data" if logical else "empty",
            "metadata": metadata,
        }
        records.append(record)
    log.info("  → %d records (%d logical)", len(records), sum(r["is_logical"] for r in records))
    return records

# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def convert(
    input_path: str,
    output_path: str,
    sheet_names: list[str] | None = None,
    header_row: int = 1,
    skip_empty: bool = True,
) -> None:
    input_file = Path(input_path)
    if not input_file.exists():
        log.error("File không tồn tại: %s", input_path)
        sys.exit(1)
    log.info("Đang mở workbook: %s", input_file.name)
    wb = openpyxl.load_workbook(input_path, data_only=True)
    target_sheets = sheet_names if sheet_names else wb.sheetnames
    log.info("Sheets sẽ xử lý: %s", target_sheets)
    all_records: list[dict] = []
    for name in target_sheets:
        if name not in wb.sheetnames:
            log.warning("Sheet '%s' không tồn tại trong workbook, bỏ qua.", name)
            continue
        ws = wb[name]
        records = process_sheet(ws, sheet_name=name, header_row_hint=header_row)
        if skip_empty:
            records = [r for r in records if r["is_logical"]]
        all_records.extend(records)
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(all_records, f, ensure_ascii=False, indent=2)
    log.info("✅ Đã xuất %d records → %s", len(all_records), output_file)

def main():
    parser = argparse.ArgumentParser(
        description="Chuyển đổi file Excel (.xlsx) sang JSON định dạng RAG training."
    )
    parser.add_argument(
        "--input",
        default="services/rag_chatbot/data/Dữ liệu tổng hợp.xlsx",
        help="Đường dẫn file .xlsx đầu vào (mặc định: services/rag_chatbot/data/Dữ liệu tổng hợp.xlsx)",
    )
    parser.add_argument(
        "--output",
        default="services/rag_chatbot/data/Dữ liệu tổng hợp.json",
        help="Đường dẫn file .json đầu ra (mặc định: services/rag_chatbot/data/Dữ liệu tổng hợp.json)",
    )
    parser.add_argument(
        "--sheets",
        default=None,
        help="Danh sách tên sheet cần xử lý, phân cách bởi dấu phẩy (mặc định: tất cả sheet)",
    )
    parser.add_argument(
        "--header-row",
        type=int,
        default=1,
        help="Số thứ tự hàng chứa header (mặc định: 1)",
    )
    parser.add_argument(
        "--keep-empty",
        action="store_true",
        help="Giữ lại các hàng rỗng trong output JSON (mặc định là sẽ xoá bỏ)",
    )
    args = parser.parse_args()
    sheets = [s.strip() for s in args.sheets.split(",")] if args.sheets else None
    convert(
        input_path=args.input,
        output_path=args.output,
        sheet_names=sheets,
        header_row=args.header_row,
        skip_empty=not args.keep_empty,
    )

if __name__ == "__main__":
    main()
