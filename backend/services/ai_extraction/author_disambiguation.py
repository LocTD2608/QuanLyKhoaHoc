import os
import re
import json
import requests
import unicodedata
from thefuzz import fuzz
from typing import List, Optional, Dict
from pydantic import BaseModel

def remove_accents(input_str: str) -> str:
    if not input_str:
        return ""
    nfkd_form = unicodedata.normalize('NFKD', input_str)
    without_diacritics = "".join([c for c in nfkd_form if not unicodedata.combining(c)])
    return without_diacritics.replace('đ', 'd').replace('Đ', 'D')

def clean_name(name: str) -> str:
    name = remove_accents(name).lower()
    name = re.sub(r'[^a-z\s]', ' ', name)
    return " ".join(name.split())

def match_author_names(candidate_name: str, meta_name: str) -> bool:
    c_clean = clean_name(candidate_name)
    m_clean = clean_name(meta_name)
    if not c_clean or not m_clean:
        return False
    
    if c_clean == m_clean:
        return True
    
    c_flat = c_clean.replace(" ", "")
    m_flat = m_clean.replace(" ", "")
    if c_flat == m_flat:
        return True
        
    c_tokens = c_clean.split()
    m_tokens = m_clean.split()
    
    if fuzz.token_sort_ratio(c_clean, m_clean) >= 85:
        return True
        
    m_full = [t for t in m_tokens if len(t) > 1]
    m_initials = [t for t in m_tokens if len(t) == 1]
    
    matched_c_tokens = set()
    for mw in m_full:
        found = False
        for cw in c_tokens:
            if cw in matched_c_tokens:
                continue
            if fuzz.ratio(mw, cw) >= 85:
                matched_c_tokens.add(cw)
                found = True
                break
        if not found:
            return False
            
    remaining_c_tokens = [cw for cw in c_tokens if cw not in matched_c_tokens]
    c_starts = [t[0] for t in remaining_c_tokens]
    
    from collections import Counter
    c_counts = Counter(c_starts)
    m_counts = Counter(m_initials)
    
    for k, v in m_counts.items():
        if c_counts[k] < v:
            return False
            
    if len(m_tokens) == 1 and len(c_tokens) > 1:
        return False
        
    return True

class AuthorRole(BaseModel):
    name: str
    is_present: bool = False
    is_first_author: bool = False
    is_corresponding_author: bool = False
    affiliation: Optional[str] = None
    contribution_summary: Optional[str] = None
    symbol_found: Optional[str] = None
    reason: Optional[str] = None

class AuthorDisambiguation:
    def __init__(self, ollama_url: str = "http://localhost:11434/api/chat"):
        self.ollama_url = ollama_url
        self.model = "gemma3:12b"

    def extract_role_by_regex(self, html_snippet: str, candidate_name: str) -> AuthorRole:
        """
        Regex-based identification for common corresponding author symbols next to names.
        """
        is_present = False
        if html_snippet:
            norm_snippet = remove_accents(html_snippet).lower()
            norm_name = remove_accents(candidate_name).lower()
            if norm_name in norm_snippet:
                is_present = True
            else:
                parts = [p for p in norm_name.split() if len(p) > 1]
                if parts and all(p in norm_snippet for p in parts):
                    is_present = True

        role = AuthorRole(name=candidate_name, is_present=is_present)
        if is_present and html_snippet:
            if re.search(rf"{re.escape(candidate_name)}.*?[*†✉]", html_snippet, re.IGNORECASE):
                role.is_corresponding_author = True
                role.symbol_found = "Found symbol near name via Regex"
        return role

    def _get_optimized_context(self, full_text: str, candidate_name: str) -> str:
        """
        Trích xuất các đoạn văn bản có khả năng chứa thông tin tác giả:
        - 4000 ký tự đầu (Abstract, Title, Authors)
        - 5000 ký tự cuối (Footnotes, Acknowledgments)
        - Đoạn chứa từ khóa: Correspondence, Affiliation, Author information.
        """
        if not full_text:
            return ""

        context_parts = []
        context_parts.append(f"--- [Top Section] ---\n{full_text[:4000]}")
        
        # Tìm các section quan trọng
        for keyword in ["Author information", "Affiliation", "Correspondence", "Author contribution"]:
            # Tìm đoạn văn bản chứa từ khóa này và 2000 ký tự sau đó
            idx = full_text.lower().find(keyword.lower())
            if idx != -1:
                context_parts.append(f"\n--- [Keyword Section: {keyword}] ---\n{full_text[idx:idx+2500]}")

        # Tìm đoạn chứa tên ứng viên
        match = re.search(rf".{{0,1000}}{re.escape(candidate_name)}.{{0,1000}}", full_text, re.IGNORECASE | re.DOTALL)
        if match:
            context_parts.append(f"\n--- [Candidate Mention Section] ---\n{match.group(0)}")

        context_parts.append(f"\n--- [Bottom Section] ---\n{full_text[-5000:]}")

        return "\n".join(context_parts)

    async def extract_role_with_llm(self, full_text: str, candidate_name: str) -> AuthorRole:
        """
        Sử dụng LLM để phân tích vai trò, affiliation và đóng góp của tác giả với ngữ cảnh tối ưu.
        """
        context = self._get_optimized_context(full_text, candidate_name)
        
        prompt = f"""
    Bạn là một chuyên gia phân tích bài báo khoa học chuẩn quốc tế. 
    Nhiệm vụ: Trích xuất thông tin chi tiết của tác giả '{candidate_name}' từ văn bản bài báo được cung cấp.

    YÊU CẦU QUAN TRỌNG VỀ ĐỘ CHÍNH XÁC (TRÁNH NHẦM LẪN):
    1. Nếu tên tác giả '{candidate_name}' (hoặc tên không dấu, hoặc viết tắt như 'An N. V.', 'V. A. Nguyen') KHÔNG xuất hiện trong danh sách tác giả hoặc nội dung bài báo, bạn PHẢI đặt:
       - "is_present": false
       - "is_first_author": false
       - "is_corresponding_author": false
       - "affiliation": null
       - "contribution_summary": null
       - "reason": "Giải thích rõ không tìm thấy tên tác giả '{candidate_name}' trong bài báo."
       TUYỆT ĐỐI KHÔNG lấy thông tin của tác giả khác để gán cho '{candidate_name}'.

    2. Chỉ khi xác nhận tác giả '{candidate_name}' thực sự có trong bài báo, bạn mới trích xuất các thông tin khác:
       - 'is_first_author': Kiểm tra xem tác giả có đứng đầu danh sách không HOẶC có ghi chú đồng tác giả thứ nhất không.
       - 'is_corresponding_author': Kiểm tra xem tác giả có phải là tác giả liên hệ (có ký hiệu * hoặc email tương ứng) hay không.
       - 'affiliation': Trích xuất đầy đủ địa chỉ đơn vị công tác của tác giả này.
       - 'contribution_summary': Tóm tắt ngắn gọn đóng góp của tác giả này.

    Trả về kết quả duy nhất dưới định dạng JSON:
    {{
    "is_present": true/false,
    "is_first_author": true/false,
    "is_corresponding_author": true/false,
    "affiliation": "tên đầy đủ các đơn vị hoặc null",
    "contribution_summary": "tóm tắt đóng góp hoặc null",
    "reason": "Giải thích chi tiết và trung thực tại sao bạn xác định như vậy"
    }}

    Nội dung bài báo (Đã được trích lọc các phần quan trọng):
    ---
    {context}
    ---
    """
            
        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "stream": False,
            "format": "json"
        }

        try:
            # Using httpx for better performance/reliability if available, falling back to requests
            import httpx
            async with httpx.AsyncClient() as client:
                response = await client.post(self.ollama_url, json=payload, timeout=90)
                if response.status_code == 200:
                    result_content = response.json().get("message", {}).get("content", "")
                    data = json.loads(result_content)
                    
                    aff = data.get("affiliation")
                    if isinstance(aff, list):
                        aff = "; ".join(aff) if aff else None
                    
                    return AuthorRole(
                        name=candidate_name,
                        is_present=data.get("is_present", False),
                        is_first_author=data.get("is_first_author", False),
                        is_corresponding_author=data.get("is_corresponding_author", False),
                        affiliation=str(aff) if aff else None,
                        contribution_summary=data.get("contribution_summary"),
                        reason=data.get("reason", "")
                    )
        except ImportError:
            # Fallback to requests if httpx is not installed (though it should be per requirements.txt)
            import requests
            response = requests.post(self.ollama_url, json=payload, timeout=90)
            if response.status_code == 200:
                result_content = response.json().get("message", {}).get("content", "")
                data = json.loads(result_content)
                return AuthorRole(
                    name=candidate_name,
                    is_present=data.get("is_present", False),
                    is_first_author=data.get("is_first_author", False),
                    is_corresponding_author=data.get("is_corresponding_author", False),
                    affiliation=data.get("affiliation"),
                    contribution_summary=data.get("contribution_summary"),
                    reason=data.get("reason", "")
                )
        except Exception as e:
            print(f"Author Extraction Error: {str(e)}")
            return self.extract_role_by_regex(full_text, candidate_name)
        
        return self.extract_role_by_regex(full_text, candidate_name)

if __name__ == "__main__":
    import asyncio
    ad = AuthorDisambiguation()
    test_text = "Authors: John Doe*, Jane Smith, Bob Wilson. *Corresponding author."
    # Chạy thử bằng sync wrapper cho main đơn giản
    async def test():
        role = await ad.extract_role_with_llm(test_text, "John Doe")
        print(role.model_dump())
    
    asyncio.run(test())
