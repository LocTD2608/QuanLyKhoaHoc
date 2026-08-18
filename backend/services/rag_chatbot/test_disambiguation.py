import sys
import os
from pathlib import Path

# Add backend directory to sys.path
backend_dir = str(Path(__file__).resolve().parent.parent.parent)
sys.path.insert(0, backend_dir)
sys.path.insert(0, str(Path(backend_dir) / "services" / "rag_chatbot"))

from chatbot_engine import run_compliance_rule_engine

def test_disambiguation():
    print("=== CHẠY KIỂM THỬ TỰ ĐỘNG PHƯƠNG PHÁP 1: SCHEMA-DRIVEN DISAMBIGUATION ===")

    # Mock candidate profile with advanced schema
    candidate_profile = {
        "Nam_xet": 2024,
        "target_title": "PGS",
        "author_id": 1,
        "author_aliases": ["Nguyễn Văn An", "Nguyen Van An", "V. A. Nguyen", "An N. V."],
        "academic_field": "Công nghệ thông tin",
        "inputs": {
            "guided_masters": 2,
            "guided_phds": 0
        },
        "papers": [
            # Paper 1: Test ranking_history và co_first_authors
            {
                "title": "A Pneumonia Outbreak Associated with a New Coronavirus",
                "journal_name": "COMPUTER NETWORKS",
                "issn": "1389-1286",
                "pub_year": 2021,
                "ranking": "Q3", # Hạng hiện tại là Q3
                "ranking_history": {
                    "2021": "Q1", # Nhưng năm xuất bản 2021 là Q1
                    "2024": "Q3"
                },
                "co_first_authors": [1], # Ứng viên là đồng tác giả thứ nhất
                "authors_list": ["Nguyen Van An", "Tran Thi B"],
                "role": "co_author"
            },
            # Paper 2: Test author_aliases và corresponding_authors
            {
                "title": "Advanced WSN Routing Protocols",
                "journal_name": "COMPUTER COMMUNICATIONS",
                "issn": "0140-3664",
                "pub_year": 2022,
                "ranking": "Q2",
                "corresponding_authors": [1], # Ứng viên là tác giả liên hệ
                "authors_list": ["Tran Binh", "V. A. Nguyen"], # Tên viết tắt khớp alias
                "role": "co_author"
            }
        ]
    }

    result = run_compliance_rule_engine(candidate_profile)

    print(f"\nChức danh xét duyệt: {result['target_title']}")
    print(f"Tổng điểm quy đổi: {result['total_score']} điểm (Yêu cầu PGS: >= 10.0)")
    print(f"Số bài Tác giả chính: {result['main_author_count']} bài (Yêu cầu PGS: >= 3)")
    print(f"Đủ điều kiện xét duyệt: {'ĐẠT ✅' if result['eligible'] else 'CHƯA ĐẠT ❌'}")

    print("\nChi tiết từng bài báo sau khi đối soát:")
    for idx, pub in enumerate(result['publications'], 1):
        print(f"\nBài báo {idx}: {pub['title']}")
        print(f"  - Phân hạng nhận dạng được: {pub['ranking']}")
        print(f"  - Vai trò nhận dạng được: {pub['role']}")
        print(f"  - Điểm quy đổi: {pub['calculated_score']}")
        print(f"  - Trạng thái: {pub['status_nganh']}")

    # Assertions
    # Paper 1: must be Q1 (2.0 pts) because 2021 in ranking_history is Q1 and co_first_authors contains 1 (making them main author)
    # Paper 2: must be Q2 (1.5 pts) because corresponding_authors contains 1 (making them main author)
    p1 = result['publications'][0]
    p2 = result['publications'][1]

    assert p1['ranking'] == 'Q1', f"Error: Paper 1 ranking should be Q1, got {p1['ranking']}"
    assert p1['role'] == 'Tác giả chính', f"Error: Paper 1 role should be Tác giả chính, got {p1['role']}"
    assert p1['calculated_score'] == 2.0, f"Error: Paper 1 score should be 2.0, got {p1['calculated_score']}"

    assert p2['role'] == 'Tác giả chính', f"Error: Paper 2 role should be Tác giả chính, got {p2['role']}"
    assert p2['calculated_score'] == 1.5, f"Error: Paper 2 score should be 1.5, got {p2['calculated_score']}"

    print("\n=== TẤT CẢ KIỂM THỬ ĐÃ VƯỢT QUA THÀNH CÔNG! ===")

if __name__ == "__main__":
    test_disambiguation()
