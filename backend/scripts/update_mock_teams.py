import json
from pathlib import Path

db_path = Path(__file__).parent.parent / "data" / "db.json"
with open(db_path, "r", encoding="utf-8") as f:
    data = json.load(f)

# Ensure authors list has 6 rich members
authors = [
    {
        "id": 1,
        "name": "Nguyễn Văn An",
        "email": "nvan@ptit.edu.vn",
        "affiliation": "Học viện Công nghệ Bưu chính Viễn thông",
        "is_member": True,
        "group_type": "NCS",
        "member_role": "GV",
        "created_at": "2024-01-01T00:00:00",
        "academic_field": "Công nghệ thông tin",
        "scholar_id": "2072354336",
        "scholar_citations": 28,
        "scholar_h_index": 3,
        "scholar_i10_index": 2,
        "scholar_last_synced": "2026-06-26T13:11:32"
    },
    {
        "id": 2,
        "name": "Trần Thị Bình",
        "email": "ttbinh@ptit.edu.vn",
        "affiliation": "Học viện Công nghệ Bưu chính Viễn thông",
        "is_member": True,
        "group_type": "NCKH",
        "member_role": "TS",
        "academic_field": "Trí tuệ nhân tạo",
        "created_at": "2024-01-02T00:00:00"
    },
    {
        "id": 3,
        "name": "Lê Văn Cường",
        "email": "lvcuong@hust.edu.vn",
        "affiliation": "Đại học Bách khoa Hà Nội",
        "is_member": True,
        "group_type": "HN",
        "member_role": "PGS",
        "academic_field": "An toàn thông tin",
        "created_at": "2024-01-03T00:00:00"
    },
    {
        "id": 4,
        "name": "Phạm Minh Đức",
        "email": "pmduc@vnu.edu.vn",
        "affiliation": "Đại học Quốc gia Hà Nội",
        "is_member": True,
        "group_type": "HN",
        "member_role": "GS",
        "academic_field": "Mạng & Truyền thông",
        "created_at": "2024-01-04T00:00:00"
    },
    {
        "id": 5,
        "name": "Hoàng Thị Mai",
        "email": "htmai@ptit.edu.vn",
        "affiliation": "Học viện Công nghệ Bưu chính Viễn thông",
        "is_member": True,
        "group_type": "NCS",
        "member_role": "TS",
        "academic_field": "Khoa học máy tính",
        "created_at": "2024-02-01T00:00:00"
    },
    {
        "id": 6,
        "name": "Vũ Anh Tuấn",
        "email": "vatuan@ptit.edu.vn",
        "affiliation": "Học viện Công nghệ Bưu chính Viễn thông",
        "is_member": True,
        "group_type": "NCKH",
        "member_role": "SV",
        "academic_field": "Công nghệ phần mềm",
        "created_at": "2024-03-01T00:00:00"
    }
]
data["authors"] = authors

# Teams
teams = [
    {
        "id": 1,
        "name": "Nhóm Trí Tuệ Nhân Tạo & Xử Lý Ngôn Ngữ Tự Nhiên (AI & NLP Lab)",
        "description": "Nghiên cứu mô hình ngôn ngữ lớn (LLM), sinh dữ liệu tiếng Việt và thị giác máy tính.",
        "leader_id": 2,
        "kpi_papers_per_year": 6,
        "members": [
            {"author_id": 2, "team_role": "Trưởng nhóm (Leader)", "kpi_papers": 3},
            {"author_id": 1, "team_role": "Nghiên cứu viên chính", "kpi_papers": 2},
            {"author_id": 5, "team_role": "Nghiên cứu sinh", "kpi_papers": 2},
            {"author_id": 6, "team_role": "Sinh viên NCKH", "kpi_papers": 1}
        ]
    },
    {
        "id": 2,
        "name": "Nhóm Mạng Không Dây & Internet of Things (Wireless & IoT Lab)",
        "description": "Nghiên cứu giao thức mạng 5G/6G, định tuyến tiết kiệm năng lượng và tính toán biên.",
        "leader_id": 4,
        "kpi_papers_per_year": 5,
        "members": [
            {"author_id": 4, "team_role": "Trưởng nhóm (Leader)", "kpi_papers": 2},
            {"author_id": 3, "team_role": "Thành viên chủ chốt", "kpi_papers": 2},
            {"author_id": 1, "team_role": "Thành viên", "kpi_papers": 2}
        ]
    },
    {
        "id": 3,
        "name": "Nhóm An Toàn Thông Tin & Mật Mã Học (Cybersecurity Lab)",
        "description": "Nghiên cứu an toàn mạng máy tính, mật mã ứng dụng và kiến trúc phân tán Blockchain.",
        "leader_id": 3,
        "kpi_papers_per_year": 4,
        "members": [
            {"author_id": 3, "team_role": "Trưởng nhóm (Leader)", "kpi_papers": 2},
            {"author_id": 1, "team_role": "Thành viên", "kpi_papers": 2},
            {"author_id": 5, "team_role": "Thành viên", "kpi_papers": 1}
        ]
    }
]
data["teams"] = teams

# Make sure collaborative papers exist
for p in data.get("papers", []):
    pid = p.get("id")
    if pid == 53: # Energy Efficient Routing
        p["author_ids"] = [1, 4]
        p["main_author_id"] = 1
        p["corresponding_author_id"] = 4
        p["author_roles"] = {"1": "main", "4": "corresponding"}
    elif pid == 54: # SDN Security
        p["author_ids"] = [1, 3]
        p["main_author_id"] = 1
        p["author_roles"] = {"1": "main", "3": "member"}
    elif pid == 55: # IoT Interoperability
        p["author_ids"] = [1, 2]
        p["main_author_id"] = 1
        p["author_roles"] = {"1": "main", "2": "corresponding"}
    elif pid == 61: # Blockchain IoT
        p["author_ids"] = [1, 3, 5]
        p["main_author_id"] = 1
        p["author_roles"] = {"1": "main", "3": "corresponding", "5": "member"}
    elif pid == 62: # Deep Learning NLP
        p["author_ids"] = [1, 2, 5, 6]
        p["main_author_id"] = 2
        p["corresponding_author_id"] = 1
        p["author_roles"] = {"2": "main", "1": "corresponding", "5": "member", "6": "member"}
    elif pid == 63: # Security Edge Computing
        p["author_ids"] = [1, 3]
        p["main_author_id"] = 3
        p["author_roles"] = {"3": "main", "1": "member"}

with open(db_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Updated db.json successfully!")

# Also sync to SQLite database if app.db exists
try:
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from core.database import SessionLocal, init_db
    from scripts.migrate_from_json import migrate_data
    init_db()
    session = SessionLocal()
    migrate_data(session, db_path)
    session.close()
    print("Synced to SQLite database successfully!")
except Exception as e:
    print(f"SQLite sync note: {e}")
