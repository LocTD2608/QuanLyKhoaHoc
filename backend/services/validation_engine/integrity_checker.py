import os
import csv
import httpx
from thefuzz import fuzz
from typing import List, Dict, Optional, Set
import json
import asyncio

class IntegrityChecker:
    def __init__(self, data_dir: str = "data", ollama_url: str = "http://localhost:11434/api/chat"):
        self.ollama_url = ollama_url
        self.model = "gemma3:12b"
        # Resolve data_dir to be absolute to avoid relative path issues
        if not os.path.isabs(data_dir):
            # Base path is project root (two levels up from services/validation_engine/integrity_checker.py)
            base_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
            potential_data_dir = os.path.join(base_path, data_dir)
            if os.path.exists(potential_data_dir):
                self.data_dir = potential_data_dir
            else:
                self.data_dir = data_dir # Fallback to original
        else:
            self.data_dir = data_dir
        
        # Real data containers
        self.predatory_journals: List[str] = []
        self.predatory_publishers: List[str] = []
        self.rankings: Dict[str, Dict[str, Dict]] = {} # ISSN -> {Year -> RankingData}
        self.vietnam_journals: List[Dict] = []
        
        self.load_all_data()

    def load_all_data(self):
        """Loads predatory lists, rankings, and Vietnam standard journals."""
        self._load_predatory_list(os.path.join(self.data_dir, "predatory_journals.csv"), is_publisher=False)
        self._load_predatory_list(os.path.join(self.data_dir, "predatory_publishers.csv"), is_publisher=True)
        self._load_vietnam_journals(os.path.join(self.data_dir, "vietnam_standard_journals.csv"))
        
        if os.path.exists(self.data_dir):
            for filename in os.listdir(self.data_dir):
                if filename.startswith("scimagojr") and filename.endswith(".csv"):
                    # Handle both "scimagojr_2025.csv" and "scimagojr 2025.csv"
                    year_part = filename.replace("scimagojr", "").replace(".csv", "").strip()
                    year = year_part.replace("_", "").strip() if year_part else "unknown"
                    if not year: year = "unknown"
                    self._load_ranking_data(os.path.join(self.data_dir, filename), year)

    def _load_predatory_list(self, path: str, is_publisher: bool = False):
        if not os.path.exists(path):
            return
        try:
            with open(path, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    name = row.get('name')
                    if name:
                        if is_publisher:
                            self.predatory_publishers.append(name.strip())
                        else:
                            self.predatory_journals.append(name.strip())
            print(f"Loaded {len(self.predatory_journals if not is_publisher else self.predatory_publishers)} entries from {path}")
        except Exception as e:
            print(f"Error loading predatory list {path}: {e}")

    def _load_vietnam_journals(self, path: str):
        if not os.path.exists(path):
            return
        try:
            with open(path, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    self.vietnam_journals.append(row)
            print(f"Loaded {len(self.vietnam_journals)} Vietnam standard journals from {path}")
        except Exception as e:
            print(f"Error loading Vietnam journals {path}: {e}")

    def _load_ranking_data(self, path: str, year: str):
        if not os.path.exists(path):
            return
        try:
            with open(path, mode='r', encoding='utf-8') as f:
                reader = csv.DictReader(f, delimiter=';')
                count = 0
                for row in reader:
                    issns_str = row.get('Issn', '')
                    issns = [i.strip().replace('-', '') for i in issns_str.split(',')]
                    ranking_info = {
                        "title": row.get('Title'),
                        "quartile": row.get('SJR Best Quartile'),
                        "sjr_score": row.get('SJR'),
                        "h_index": row.get('H index'),
                        "publisher": row.get('Publisher'),
                        "country": row.get('Country'),
                        "categories": row.get('Categories'),
                        "year": year
                    }
                    for issn in issns:
                        if issn:
                            if issn not in self.rankings:
                                self.rankings[issn] = {}
                            self.rankings[issn][year] = ranking_info
                    count += 1
            print(f"Loaded {count} journal rankings from {path} (Year: {year})")
        except Exception as e:
            print(f"Error loading ranking data {path}: {e}")

    def check_journal_integrity(self, journal_name: str, issn_list: List[str], publisher: Optional[str] = None, year: Optional[int] = None) -> Dict:
        """
        Xác thực liêm chính của tạp chí dựa trên ISSN, tên và nhà xuất bản.
        Hỗ trợ tra cứu ranking quốc tế và danh mục chuẩn Việt Nam.
        Bổ sung tra cứu API (OpenAlex/DOAJ) để có dữ liệu rộng hơn.
        """
        is_trusted_international = False
        is_vietnam_standard = False
        ranking = None
        target_year = str(year) if year else "unknown"
        used_year = None
        vn_journal_info = None
        all_rankings = []
        
        # 0. API Integration (New)
        from services.api_integration.metadata_client import MetadataClient
        meta_client = MetadataClient()
        api_journal_meta = None
        is_in_doaj = False

        # 1. Check International Rankings (ISSN based)
        for issn in issn_list:
            clean_issn = issn.replace("-", "")
            
            # Tra cứu OpenAlex API để lấy dữ liệu rộng hơn
            if not api_journal_meta:
                api_journal_meta = meta_client.openalex.fetch_source_by_issn(clean_issn)
            
            # Tra cứu DOAJ
            if not is_in_doaj:
                is_in_doaj = meta_client.doaj.is_journal_in_doaj(clean_issn)

            if clean_issn in self.rankings:
                year_rankings = self.rankings[clean_issn]
                
                # Collect all rankings for this journal
                for yr, data in year_rankings.items():
                    if data not in all_rankings:
                        all_rankings.append(data)
                
                # Try exact year, then unknown, then closest
                if target_year in year_rankings:
                    ranking = year_rankings[target_year]
                    used_year = target_year
                elif "unknown" in year_rankings:
                    ranking = year_rankings["unknown"]
                    used_year = "unknown"
                elif year_rankings:
                    available_years = sorted(year_rankings.keys())
                    if target_year.isdigit():
                        closest_year = min(available_years, key=lambda x: abs(int(x)-int(target_year)) if x.isdigit() else 999)
                        ranking = year_rankings[closest_year]
                        used_year = closest_year
                    else:
                        used_year = available_years[-1]
                        ranking = year_rankings[used_year]
                
                if ranking:
                    is_trusted_international = True

        # Fallback to search by name if no ISSN or not found by ISSN in API
        if not api_journal_meta and journal_name:
            search_results = meta_client.openalex.search_source_by_name(journal_name)
            if search_results:
                api_journal_meta = search_results[0] # Take first match
                if not is_in_doaj and api_journal_meta.issn:
                    is_in_doaj = meta_client.doaj.is_journal_in_doaj(api_journal_meta.issn[0])

        # Sort all_rankings by year descending
        all_rankings.sort(key=lambda x: x.get('year', '0'), reverse=True)

        # 1.5 Determine Year Match Status
        is_year_match = (used_year == target_year)
        
        # 2. Check Vietnam Standard List (Name based fuzzy match)
        for vn_j in self.vietnam_journals:
            if fuzz.ratio(journal_name.lower(), vn_j['name'].lower()) > 92:
                is_vietnam_standard = True
                vn_journal_info = vn_j
                break

        is_predatory = False
        reason = ""
        
        # 3. Check Predatory List (only if not already trusted)
        # Journals in DOAJ or indexed in Scopus (trusted_international) are NOT predatory
        if not is_trusted_international and not is_vietnam_standard and not is_in_doaj:
            for pj in self.predatory_journals:
                if fuzz.ratio(journal_name.lower(), pj.lower()) > 90:
                    is_predatory = True
                    reason = f"Tên tạp chí khớp với danh sách giả mạo: {pj}"
                    break
                    
            if not is_predatory and publisher:
                for pp in self.predatory_publishers:
                    if fuzz.partial_ratio(publisher.lower(), pp.lower()) > 95:
                        is_predatory = True
                        reason = f"Nhà xuất bản khớp với danh sách giả mạo: {pp}"
                        break

        # Determine status and message
        status = "valid"
        if is_predatory: 
            status = "warning"
        elif is_trusted_international or is_vietnam_standard or is_in_doaj: 
            status = "trusted"
            
        messages = []
        if is_predatory:
            messages.append(reason)
        else:
            if is_trusted_international and ranking:
                q = ranking.get("quartile", "N/A")
                if is_year_match:
                    messages.append(f"Tạp chí quốc tế uy tín Hạng {q} (năm {used_year})")
                else:
                    messages.append(f"Tạp chí quốc tế uy tín Hạng {q} (Dữ liệu tạm tính {used_year}, thiếu dữ liệu {target_year})")
            elif is_in_doaj:
                messages.append("Tạp chí thuộc danh mục DOAJ (Mở uy tín)")
            
            if is_vietnam_standard:
                council = vn_journal_info.get('council', 'Liên ngành')
                max_score = vn_journal_info.get('max_score', '0.5')
                messages.append(f"🇻🇳 Tạp chí chuẩn Việt Nam (HĐGSNN) - Hội đồng {council} (Tối đa {max_score} điểm)")

        if not messages:
            display_message = "Tạp chí không thuộc danh mục theo dõi (SJR/Scopus/HĐGSNN/DOAJ)"
        else:
            display_message = " | ".join(messages)

        return {
            "status": status,
            "is_predatory": is_predatory,
            "is_trusted_indexed": is_trusted_international or is_in_doaj,
            "is_vietnam_standard": is_vietnam_standard,
            "ranking": ranking,
            "all_rankings": all_rankings,
            "vietnam_info": vn_journal_info,
            "api_metadata": api_journal_meta.model_dump() if api_journal_meta else None,
            "is_in_doaj": is_in_doaj,
            "year_used": used_year,
            "target_year": target_year,
            "is_year_match": is_year_match,
            "message": display_message
        }



    def get_journal_ranking_by_year(self, issn: str, year: int) -> Optional[str]:
        clean_issn = issn.replace("-", "")
        year_str = str(year)
        return self.rankings.get(clean_issn, {}).get(year_str, {}).get("quartile")

    def correlate_titles(self, target_title: str, source_title: str) -> float:
        """
        Compare the English title (from DOI) with candidate's title.
        """
        ratio = fuzz.token_sort_ratio(target_title.lower(), source_title.lower())
        return ratio

    async def correlate_titles_with_llm(self, english_title: str, vn_title: str) -> float:
        """
        Sử dụng LLM (Ollama) async để kiểm tra sự tương đồng ngữ nghĩa của tiêu đề.
        """
        prompt = f"""
Bạn là một chuyên gia ngôn ngữ khoa học. Hãy xác định xem tiêu đề tiếng Việt dưới đây có phải là bản dịch hoặc có cùng nội dung ý nghĩa với tiêu đề bài báo tiếng Anh không.

Tiêu đề tiếng Anh: "{english_title}"
Tiêu đề tiếng Việt: "{vn_title}"

Hãy trả về kết quả dưới dạng JSON:
{{
  "similarity_score": (số từ 0 đến 100),
  "reason": "Giải thích ngắn gọn"
}}
"""
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            "format": "json"
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.ollama_url, json=payload, timeout=60.0)
                if response.status_code == 200:
                    content = response.json().get("message", {}).get("content", "")
                    data = json.loads(content)
                    return float(data.get("similarity_score", 0))
            except Exception as e:
                print(f"LLM Title Correlation Error: {e}")
        
        return self.correlate_titles(english_title, vn_title)

    async def classify_scientific_field(self, title: str, abstract: str = "") -> Dict:
        """
        Sử dụng LLM để phân loại bài báo vào các lĩnh vực khoa học chuẩn (OECD).
        """
        prompt = f"""
Phân loại bài báo sau vào các lĩnh vực khoa học theo chuẩn OECD (Natural Sciences, Engineering and Technology, Medical and Health Sciences, Agricultural Sciences, Social Sciences, Humanities).

Tiêu đề: {title}
Tóm tắt: {abstract[:1000]}

Trả về JSON:
{{
  "main_field": "Tên lĩnh vực chính",
  "sub_fields": ["mục con 1", "mục con 2"],
  "confidence": 0-100
}}
"""
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            "format": "json"
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.ollama_url, json=payload, timeout=60.0)
                if response.status_code == 200:
                    content = response.json().get("message", {}).get("content", "")
                    return json.loads(content)
            except Exception as e:
                print(f"LLM Classification Error: {e}")
        return {"main_field": "Unknown", "sub_fields": [], "confidence": 0}

    async def semantic_affiliation_match(self, extracted_aff: str, historical_affs: List[str]) -> Dict:
        """
        Đối soát ngữ nghĩa giữa affiliation trích xuất từ bài báo và lịch sử công tác của ứng viên.
        """
        prompt = f"""
Hãy xác định xem đơn vị 'Extracted' có trùng khớp hoặc thuộc về một trong các đơn vị trong 'History' không. Lưu ý sự khác biệt về ngôn ngữ (Anh/Việt) và viết tắt.

Extracted: "{extracted_aff}"
History: {json.dumps(historical_affs, ensure_ascii=False)}

Trả về JSON:
{{
  "is_match": true/false,
  "matched_with": "tên đơn vị trong history nếu có",
  "reason": "giải thích tại sao khớp hoặc không khớp"
}}
"""
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            "format": "json"
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(self.ollama_url, json=payload, timeout=60.0)
                if response.status_code == 200:
                    content = response.json().get("message", {}).get("content", "")
                    return json.loads(content)
            except Exception as e:
                print(f"LLM Affiliation Match Error: {e}")
        return {"is_match": False, "matched_with": None, "reason": "Error calling LLM"}


# Test block update
async def main():
    checker = IntegrityChecker()
    
    # Test Journal checking
    print(f"Integrity Check: {checker.check_journal_integrity('Journal of Fake Sciences', ['1234-5678'])}")
    
    # Test Ranking logic
    print(f"Ranking for Nature (2020): {checker.get_journal_ranking_by_year('0028-0836', 2020)}")
    
    # Test Title correlation (Simple)
    t1 = "A new method for DNA sequencing"
    t2 = "Phương pháp mới cho giải trình tự DNA"
    score = await checker.correlate_titles_with_llm(t1, t2)
    print(f"LLM Similarity Score: {score}%")

if __name__ == "__main__":
    asyncio.run(main())
