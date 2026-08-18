import os
import sys
from typing import Dict

# Add project root to sys.path for direct execution
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import asyncio
import json
from services.api_integration.metadata_client import MetadataClient
from services.scraper_engine.crawl_scraper import crawl_paper
from services.ai_extraction.author_disambiguation import AuthorDisambiguation, AuthorRole, match_author_names
from services.validation_engine.integrity_checker import IntegrityChecker
from thefuzz import fuzz
from datetime import datetime

class ArticleValidationFlow:
    def __init__(self):
        self.metadata_client = MetadataClient()
        self.integrity_checker = IntegrityChecker()
        self.author_extractor = AuthorDisambiguation()

    async def run_validation(self, doi: str, url: str, candidate_name: str, candidate_title_vn: str, candidate_history: list = None):
        # Mock candidate profile (since user said they don't have sample data)
        if not candidate_history:
            candidate_history = [
                "Đại học Bách Khoa Hà Nội",
                "Hanoi University of Science and Technology",
                "Viện Vệ sinh Dịch tễ Trung ương"
            ]

        # 1. Fetch Metadata from DOI (Fastest)
        print(f"[*] Fetching metadata for DOI: {doi}...")
        meta = self.metadata_client.fetch_from_crossref(doi)
        
        report = {
            "input": {"doi": doi, "url": url, "candidate_name": candidate_name},
            "metadata": None,
            "verification": {
                "author_role": {
                    "is_present": False,
                    "is_first_author": False,
                    "is_corresponding_author": False,
                    "affiliation_captured": None,
                    "affiliation_match": None,
                    "contribution_summary": None,
                    "reason": None
                },
                "integrity": {
                    "status": "pending",
                    "title_similarity_pct": 0,
                    "scientific_field": None
                }
            }
        }

        if meta:
            report["metadata"] = meta.model_dump()
            
            # 2. Integrity & Ranking check (Year-aware)
            print(f"[*] Checking journal integrity for year {meta.year}...")
            integrity_results = self.integrity_checker.check_journal_integrity(
                meta.journal, 
                meta.issn,
                year=meta.year
            )
            
            # Title correlation
            title_similarity = self.integrity_checker.correlate_titles(meta.title, candidate_title_vn)
            if title_similarity < 70:
                print(f"[*] Title similarity low ({title_similarity}%), verifying with LLM...")
                title_similarity = await self.integrity_checker.correlate_titles_with_llm(meta.title, candidate_title_vn)
            
            integrity_results["title_similarity_pct"] = title_similarity
            
            # Field Classification
            print(f"[*] Classifying scientific field for article...")
            field_data = await self.integrity_checker.classify_scientific_field(meta.title)
            integrity_results["scientific_field"] = field_data
            
            report["verification"]["integrity"] = integrity_results

            # Check if author exists in metadata
            for auth in meta.authors:
                full_name = f"{auth.given or ''} {auth.family or ''}".strip()
                if match_author_names(candidate_name, full_name):
                    report["verification"]["author_role"]["is_present"] = True
                    if auth.sequence == "first":
                        report["verification"]["author_role"]["is_first_author"] = True
                    if auth.is_corresponding:
                        report["verification"]["author_role"]["is_corresponding_author"] = True
                    if auth.affiliation:
                        report["verification"]["author_role"]["affiliation_captured"] = "; ".join(auth.affiliation)
                    break
        
        # 3. Author Role & Deep Extraction
        scraped_content = None
        if url:
            print(f"[*] Scraping full article text from: {url}...")
            scraped_content = await crawl_paper(url)
        
        # Determine role & extract affiliation
        print(f"[*] Analyzing author details for: {candidate_name}...")
        context = scraped_content if scraped_content else str(report["metadata"])
        role = await self.author_extractor.extract_role_with_llm(context, candidate_name)
        
        # Merge metadata findings with LLM findings
        author_report = report["verification"]["author_role"]
        if role.is_present:
            author_report["is_present"] = True
        
        author_report["is_corresponding_author"] = author_report.get("is_corresponding_author", False) or role.is_corresponding_author
        if role.is_first_author:
            author_report["is_first_author"] = True
        
        if role.affiliation:
            author_report["affiliation_captured"] = role.affiliation
        
        author_report["contribution_summary"] = role.contribution_summary
        
        metadata_reason = ""
        if author_report["is_corresponding_author"] and not role.is_corresponding_author:
            metadata_reason = " (Trạng thái tác giả liên hệ được xác định trực tiếp từ siêu dữ liệu bài báo)."
        
        author_report["reason"] = (role.reason or "") + metadata_reason
        
        # Enforce that if not present, they cannot have any author roles
        if not author_report["is_present"]:
            author_report["is_first_author"] = False
            author_report["is_corresponding_author"] = False
            author_report["is_main_author"] = False
        else:
            # Explicitly define "Main Author" (Tác giả chính = Tác giả thứ nhất HOẶC Tác giả liên hệ)
            author_report["is_main_author"] = author_report["is_first_author"] or author_report["is_corresponding_author"]
        
        # Semantic Affiliation Match
        if role.affiliation:
            print(f"[*] Verifying affiliation match...")
            match_result = await self.integrity_checker.semantic_affiliation_match(
                role.affiliation, 
                candidate_history
            )
            author_report["affiliation_match"] = match_result
        
        return report

    def generate_markdown_report(self, report: Dict) -> str:
        """
        Chuyển đổi dữ liệu JSON report sang định dạng Markdown đẹp mắt.
        """
        input_data = report.get("input", {})
        metadata = report.get("metadata", {})
        verification = report.get("verification", {})
        integrity = verification.get("integrity", {})
        author_role = verification.get("author_role", {})

        authors_list = ", ".join([f"{a.get('given', '')} {a.get('family', '')}" for a in metadata.get("authors", [])])
        
        # Determine display status
        display_status = "✅ Hợp lệ"
        if integrity.get("status") == "warning":
            display_status = "⚠️ Cảnh báo"
        elif integrity.get("is_vietnam_standard"):
            display_status = "🇻🇳 Chuẩn VN"
        elif integrity.get("is_trusted_indexed"):
            display_status = "💎 Quốc tế"

        md = f"""# 📄 Báo cáo Xác thực Bài báo Khoa học
*Ngày tạo: {datetime.now().strftime("%d/%m/%Y %H:%M:%S")}*

---

## ℹ️ Thông tin Tổng quan
- **DOI**: [{input_data.get('doi')}](https://doi.org/{input_data.get('doi')})
- **Tiêu đề (English)**: {metadata.get('title', 'N/A')}
- **Tác giả**: {authors_list[:500]}{'...' if len(authors_list) > 500 else ''}
- **Tạp chí**: {metadata.get('journal', 'N/A')} ({metadata.get('year', 'N/A')})
- **Thông tin xuất bản**: Tập {metadata.get('volume', 'N/A')}, Số {metadata.get('issue', 'N/A')}, Trang {metadata.get('pages', 'N/A')}
- **ISSN**: {", ".join(metadata.get('issn', []))}

---

## ✅ Kết quả Xác thực (Verification)

### 1. Liêm chính Tạp chí (Integrity)
| Tiêu chí | Kết quả |
| :--- | :--- |
| **Trạng thái** | {display_status} |
| **Thông điệp** | {integrity.get("message", "N/A")} |
| **Bản xếp hạng (SJR)** | {integrity.get("ranking", {}).get("sjr_score", "N/A") if integrity.get("ranking") else "N/A"} |
| **Năm bài báo** | {integrity.get("target_year") or "N/A"} |
| **Năm tra cứu thực tế** | {integrity.get("year_used") or "N/A"} {"⚠️ (Không khớp)" if not integrity.get("is_year_match") else "✅ (Khớp)"} |
| **Độ tương đồng tiêu đề** | {integrity.get("title_similarity_pct", 0)}% |
| **Phân loại lĩnh vực** | {integrity.get("scientific_field", {}).get("main_field", "N/A")} |
| **Độ tin cậy lĩnh vực** | {integrity.get("scientific_field", {}).get("confidence", 0)}% |

### 2. Vai trò Tác giả (Author Role)
**Ứng viên đối soát:** `{input_data.get('candidate_name')}`

- **Hiện diện trong bài báo**: {"✅ Có" if author_role.get("is_present") else "❌ Không"}
- **Là tác giả thứ nhất (First Author)**: {"✅ Đúng" if author_role.get("is_first_author") else "❌ Không"}
- **Là tác giả liên hệ (Corresponding Author)**: {"✅ Đúng" if author_role.get("is_corresponding_author") else "❌ Không"}
- **Đơn vị công tác trích xuất**: {author_role.get("affiliation_captured") or "Không tìm thấy"}
- **Tóm tắt đóng góp**: {author_role.get("contribution_summary") or "Không có thông tin"}

> [!NOTE]
> **Lý do/Ghi chú của AI**:  
> {author_role.get("reason", "N/A")}

---

### 3. Đối soát Đơn vị công tác (Affiliation Match)
{f'''| Kết quả | Chi tiết |
| :--- | :--- |
| **Trùng khớp** | {"✅ Khớp" if author_role.get("affiliation_match", {}).get("is_match") else "❌ Không khớp"} |
| **Khớp với đơn vị** | {author_role.get("affiliation_match", {}).get("matched_with", "N/A")} |
| **Giải thích** | {author_role.get("affiliation_match", {}).get("reason", "N/A")} |''' if author_role.get("affiliation_match") else "_Không có dữ liệu đối soát đơn vị._"}

---
*Báo cáo được tạo tự động bởi Hệ thống Quản lý Khoa học AI.*
"""
        return md

async def main():
    flow = ArticleValidationFlow()
    
    # Sample Mock Data
    test_doi = "10.1038/s41586-020-2012-7"
    test_url = "https://www.nature.com/articles/s41586-020-2012-7"
    candidate = "Zheng-Li Shi"
    title_vn = "Sự bùng phát viêm phổi liên quan đến một loại coronavirus mới có khả năng bắt nguồn từ dơi"
    
    report = await flow.run_validation(test_doi, test_url, candidate, title_vn)
    
    # Generate and save Markdown report
    md_report = flow.generate_markdown_report(report)
    
    report_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "latest_validation_report.md"))
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(md_report)
    
    print("\n" + "="*50)
    print(f"✅ REPORT GENERATED: {report_path}")
    print("="*50)
    print("\n--- PREVIEW (JSON Data) ---")
    print(json.dumps(report, indent=4, ensure_ascii=False)[:500] + "...")

if __name__ == "__main__":
    asyncio.run(main())
