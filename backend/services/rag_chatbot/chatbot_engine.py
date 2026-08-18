import logging
import json
from typing import Dict, Any, List, Optional

# RAG components
try:
    from services.rag_chatbot.config import RAGConfig
    from services.rag_chatbot.retriever import search_and_rerank, RetrieverConfig, RetrievedChunk
    from services.rag_chatbot.prompts.rag_prompt import SYSTEM_PROMPT, USER_PROMPT, SYSTEM_PROMPT_SYNTHESIZER
    from services.rag_chatbot import scoring_engine
    from services.rag_chatbot.web_search import search_journal_online, fetch_paper_by_doi_markdown
except ImportError:
    try:
        from .config import RAGConfig
        from .retriever import search_and_rerank, RetrieverConfig, RetrievedChunk
        from .prompts.rag_prompt import SYSTEM_PROMPT, USER_PROMPT, SYSTEM_PROMPT_SYNTHESIZER
        from . import scoring_engine
        from .web_search import search_journal_online, fetch_paper_by_doi_markdown
    except Exception as e:
        logging.warning("Không thể import một số thành phần RAG: %s", e)
        RAGConfig = None
        search_and_rerank = None
        RetrieverConfig = None
        RetrievedChunk = None
        SYSTEM_PROMPT = ""
        USER_PROMPT = ""
        SYSTEM_PROMPT_SYNTHESIZER = ""
        scoring_engine = None
        search_journal_online = None
        fetch_paper_by_doi_markdown = None

# LLM 
try:
    from openai import OpenAI
except ImportError:
    OpenAI = None
    logging.warning("Package 'openai' not found. Please install it using 'pip install openai'.")

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# Tool Definitions for OpenAI Function Calling
# ─────────────────────────────────────────────

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_journal_info",
            "description": "Tra cứu điểm số, phân hạng Q, ISSN, ngành, và thông tin chi tiết của một tạp chí khoa học cụ thể.",
            "parameters": {
                "type": "object",
                "properties": {
                    "journal_name": {
                        "type": "string",
                        "description": "Tên đầy đủ của tạp chí cần tra cứu (ví dụ: 'Nature', 'Tạp chí Khoa học Đại học Hoa Sen')"
                    },
                    "issn": {
                        "type": "string",
                        "description": "Mã ISSN của tạp chí (ví dụ: '0028-0836'). Tùy chọn, nhưng nếu có sẽ chính xác hơn."
                    }
                },
                "required": ["journal_name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_score",
            "description": "Dùng khi người dùng chỉ muốn TÍNH ĐIỂM quy đổi của một hoặc nhiều công trình cụ thể, không cần thẩm định toàn bộ hồ sơ. Trả về thông tin điểm tối đa, điểm cá nhân, và giải thích thuật toán phân rã điểm.",
            "parameters": {
                "type": "object",
                "properties": {
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string", "description": "Tên tạp chí"},
                                "issn": {"type": "string", "description": "Mã ISSN (tùy chọn)"},
                                "pub_year": {"type": "integer", "description": "Năm xuất bản bài báo"},
                                "role": {
                                    "type": "string", 
                                    "enum": ["first_author", "corresponding_author", "first_and_corresponding", "co_author"],
                                    "description": "Vai trò: 'first_author' = tác giả đứng tên đầu tiên, 'corresponding_author' = tác giả liên hệ, 'first_and_corresponding' = VỪA là tác giả đầu VỪA là tác giả liên hệ, 'co_author' = thành viên/đồng tác giả bình thường."
                                },
                                "num_authors": {
                                    "type": "integer",
                                    "description": "Tổng số tác giả của bài báo (mặc định: 1)"
                                },
                                "has_distinct_corresponding_author": {
                                    "type": "boolean",
                                    "description": "Bằng true nếu bài báo có người liên hệ ĐỘC LẬP (người khác) so với người đứng tên đầu tiên. Bằng false nếu người đứng tên đầu cũng chính là người liên hệ (hoặc bài chỉ có 1 tác giả)."
                                },
                                "co_first_authors": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "description": "Danh sách tên hoặc ID của các đồng tác giả thứ nhất (Co-first authors) nếu có."
                                },
                                "corresponding_authors": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "description": "Danh sách tên hoặc ID của các tác giả liên hệ (Corresponding authors) nếu có."
                                },
                                "ranking_history": {
                                    "type": "object",
                                    "description": "Bản đồ lịch sử xếp hạng tạp chí theo năm dạng key-value, ví dụ: {'2021': 'Q2', '2024': 'Q1'}."
                                },
                                "author_aliases": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "description": "Danh sách các tên viết tắt hoặc biến thể tên của ứng viên (VD: ['Nguyen Van An', 'V. A. Nguyen'])."
                                },
                                "authors_list": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "description": "Danh sách toàn bộ tác giả trong bài báo theo đúng thứ tự (VD: ['Nguyen Van An', 'Tran Thi B', 'Le Van C'])."
                                },
                                "candidate_id": {
                                    "type": "string",
                                    "description": "ID hoặc tên của ứng viên đang xét."
                                },
                                "max_score": {
                                    "type": "number",
                                    "description": "Điểm tối đa của bài báo/tạp chí do hội đồng định mức (ví dụ: 1.0, 1.5, 2.0). Truyền vào đây nếu người dùng cho biết mức điểm tối đa."
                                }
                            },
                            "required": ["name", "role"]
                        }
                    },
                    "academic_field": {
                        "type": "string",
                        "description": "Ngành xét duyệt (ví dụ: 'Công nghệ thông tin'). Tùy chọn."
                    },
                    "eval_year": {
                        "type": "integer",
                        "description": "Năm xét duyệt (mặc định: 2024)."
                    }
                },
                "required": ["items"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "validate_eligibility",
            "description": "Dùng khi người dùng yêu cầu THẨM ĐỊNH hồ sơ GS/PGS. Trả về báo cáo 4 phần: (1) Bảng tóm tắt, (2) Scorecard điều kiện tối thiểu, (3) Phân tích sâu, (4) Khuyến nghị. Áp dụng quy tắc cứng: 3-Year Window, Hard Requirements.",
            "parameters": {
                "type": "object",
                "properties": {
                    "items": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string", "description": "Tên tạp chí"},
                                "issn": {"type": "string", "description": "Mã ISSN (tùy chọn)"},
                                "pub_year": {"type": "integer", "description": "Năm xuất bản bài báo"},
                                "role": {
                                    "type": "string", 
                                    "enum": ["first_author", "corresponding_author", "first_and_corresponding", "co_author"],
                                    "description": "Vai trò: 'first_author' = tác giả đứng tên đầu tiên, 'corresponding_author' = tác giả liên hệ, 'first_and_corresponding' = VỪA là tác giả đầu VỪA là tác giả liên hệ, 'co_author' = thành viên/đồng tác giả bình thường."
                                },
                                "num_authors": {
                                    "type": "integer",
                                    "description": "Tổng số tác giả của bài báo (mặc định: 1)"
                                },
                                "has_distinct_corresponding_author": {
                                    "type": "boolean",
                                    "description": "Bằng true nếu bài báo có người liên hệ ĐỘC LẬP (người khác) so với người đứng tên đầu tiên. Bằng false nếu người đứng tên đầu cũng chính là người liên hệ (hoặc bài chỉ có 1 tác giả)."
                                },
                                "co_first_authors": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "description": "Danh sách tên hoặc ID của các đồng tác giả thứ nhất (Co-first authors) nếu có."
                                },
                                "corresponding_authors": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "description": "Danh sách tên hoặc ID của các tác giả liên hệ (Corresponding authors) nếu có."
                                },
                                "ranking_history": {
                                    "type": "object",
                                    "description": "Bản đồ lịch sử xếp hạng tạp chí theo năm dạng key-value, ví dụ: {'2021': 'Q2', '2024': 'Q1'}."
                                },
                                "author_aliases": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "description": "Danh sách các tên viết tắt hoặc biến thể tên của ứng viên (VD: ['Nguyen Van An', 'V. A. Nguyen'])."
                                },
                                "authors_list": {
                                    "type": "array",
                                    "items": {"type": "string"},
                                    "description": "Danh sách toàn bộ tác giả trong bài báo theo đúng thứ tự (VD: ['Nguyen Van An', 'Tran Thi B', 'Le Van C'])."
                                },
                                "candidate_id": {
                                    "type": "string",
                                    "description": "ID hoặc tên của ứng viên đang xét."
                                }
                            },
                            "required": ["name", "role", "pub_year"]
                        }
                    },
                    "academic_field": {
                        "type": "string",
                        "description": "Ngành/Liên ngành xét duyệt (ví dụ: 'Công nghệ thông tin'). Bắt buộc."
                    },
                    "eval_year": {
                        "type": "integer",
                        "description": "Năm xét duyệt hồ sơ (mặc định: 2024)."
                    },
                    "target_title": {
                        "type": "string",
                        "enum": ["GS", "PGS"],
                        "description": "Chức danh xét duyệt: 'GS' hoặc 'PGS'. Bắt buộc."
                    },
                    "guided_masters": {
                        "type": "integer",
                        "description": "Số học viên thạc sĩ đã bảo vệ thành công luận văn dưới sự hướng dẫn CHÍNH của ứng viên. Dùng cho tiêu chí PGS (cần ≥2 ThS hoặc ≥1 TS)."
                    },
                    "guided_phds": {
                        "type": "integer",
                        "description": "Số nghiên cứu sinh tiến sĩ đã bảo vệ thành công luận án dưới sự hướng dẫn CHÍNH của ứng viên. 1 TS = 2 ThS với tiêu chí PGS; ≥2 TS bắt buộc với tiêu chí GS."
                    }
                },
                "required": ["items", "target_title"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_journals",
            "description": "Liệt kê danh sách các tạp chí theo từ khóa hoặc theo danh mục (Q1, Q2, Scopus, ISI, Tạp chí trong nước, v.v.).",
            "parameters": {
                "type": "object",
                "properties": {
                    "keyword": {
                        "type": "string",
                        "description": "Từ khóa tìm kiếm (ví dụ: 'Computer Science', 'Viện Hàn lâm')"
                    },
                    "category": {
                        "type": "string",
                        "description": "Phân hạng hoặc danh mục (ví dụ: 'Q1', 'Q2', 'ISI', 'Scopus')"
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_journal_online",
            "description": "Dùng khi KHÔNG tìm thấy tạp chí trong cơ sở dữ liệu nội bộ HĐGSNN, hoặc khi người dùng yêu cầu tra cứu từ Internet. Tra cứu thông tin tạp chí từ OpenAlex + ScimagoJR: Tên, ISSN, Nhà xuất bản, H-index, Impact Factor, Phân hạng Q. Kết quả được gắn nhãn rõ là 'Nguồn: Internet'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "journal_name": {
                        "type": "string",
                        "description": "Tên đầy đủ của tạp chí cần tra cứu"
                    },
                    "issn": {
                        "type": "string",
                        "description": "Mã ISSN của tạp chí (tùy chọn, nhưng giúp chính xác hơn)"
                    }
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "fetch_paper_by_doi",
            "description": "BẮT BUỘC DÙNG khi người dùng hỏi thông tin bài báo khoa học dựa trên mã DOI (Digital Object Identifier, dạng '10.xxxx/...'). Tra cứu siêu dữ liệu chuẩn xác 100% (Tên bài báo, Danh sách & Số lượng tác giả, Địa điểm xuất bản/Tạp chí/Hội nghị, Năm xuất bản, Mã ISSN, Nhà xuất bản) từ API trực tuyến (OpenAlex Works / Crossref) và tự động đối soát với danh mục HĐGSNN.",
            "parameters": {
                "type": "object",
                "properties": {
                    "doi": {
                        "type": "string",
                        "description": "Mã DOI của bài báo (ví dụ: '10.1145/3586183.3606763')"
                    }
                },
                "required": ["doi"]
            }
        }
    }
]


# ─────────────────────────────────────────────
# RAG Chatbot Class
# ─────────────────────────────────────────────

def run_compliance_rule_engine(candidate_profile: dict) -> dict:
    # 1. Parse Nam_xet (N)
    N = candidate_profile.get('Nam_xet') or candidate_profile.get('eval_year')
    try:
        N = int(N)
    except (TypeError, ValueError):
        N = 2026 # Default fallback
        
    target_title = candidate_profile.get('target_title') or candidate_profile.get('role') or "PGS"
    target_title = target_title.upper().strip()
    if target_title not in ("GS", "PGS"):
        target_title = "PGS"

    # 2. Extract publications
    publications = candidate_profile.get('papers') or candidate_profile.get('articles') or []
    
    # Target minimum conditions
    if target_title == "GS":
        req_total = 20.0
        req_three_year = 5.0
        req_core = 12.0
        req_students = 2
    else: # PGS
        req_total = 10.0
        req_three_year = 2.5
        req_core = 6.0
        req_students = 2
        
    # Read student counts
    inputs = candidate_profile.get('inputs') or candidate_profile
    guided_masters = inputs.get('guided_masters') or inputs.get('guided_ths') or 0
    try:
        guided_masters = int(guided_masters)
    except (TypeError, ValueError):
        guided_masters = 0
        
    guided_phds = inputs.get('guided_phds') or inputs.get('guided_ncs') or 0
    try:
        guided_phds = int(guided_phds)
    except (TypeError, ValueError):
        guided_phds = 0
        
    students_guided = guided_phds if target_title == "GS" else guided_masters
    
    # Fallback credit calculation
    if target_title == "PGS":
        ok_students = (guided_masters >= 2) or (guided_phds >= 1)
        students_shortfall = 0 if ok_students else max(0, 2 - guided_masters)
        fallback_credit_needed = students_shortfall * 1.0
    else: # GS
        ok_students = (guided_phds >= 2)
        students_shortfall = 0 if ok_students else max(0, 2 - guided_phds)
        fallback_credit_needed = students_shortfall * 3.0
        
    adjusted_req_total = req_total + fallback_credit_needed

    processed_pubs = []
    total_score = 0.0
    three_year_score = 0.0
    core_score = 0.0 # specialized score
    main_author_count = 0
    
    # Get candidate author_id (usually 1)
    author_id = candidate_profile.get('user', {}).get('author_id') or candidate_profile.get('author_id') or 1
    
    for pub in publications:
        pub_copy = dict(pub)
        pub_year = pub_copy.get('year') or pub_copy.get('pub_year') or N
        
        # Parse year
        try:
            pub_year = int(pub_year)
        except (TypeError, ValueError):
            pub_year = N

        # Role checks
        role_val = pub_copy.get('role')
        is_main_role = False
        
        # Check explicit co-first or corresponding lists (Method 1)
        co_firsts = pub_copy.get('co_first_authors') or []
        corrs = pub_copy.get('corresponding_authors') or []
        if author_id in co_firsts or str(author_id) in co_firsts:
            is_main_role = True
        elif author_id in corrs or str(author_id) in corrs:
            is_main_role = True
            
        # Check author aliases matched in authors_list (Method 1)
        aliases = candidate_profile.get('author_aliases') or []
        authors_list = pub_copy.get('authors_list') or []
        if aliases and authors_list:
            matched_index = -1
            for alias in aliases:
                normalized_alias = alias.lower().replace(" ", "").replace(".", "")
                for idx, author_name in enumerate(authors_list):
                    normalized_author = author_name.lower().replace(" ", "").replace(".", "")
                    if normalized_alias == normalized_author or normalized_alias in normalized_author or normalized_author in normalized_alias:
                        matched_index = idx
                        break
                if matched_index != -1:
                    break
            if matched_index == 0:
                is_main_role = True

        if not is_main_role:
            if not role_val:
                is_main = (pub_copy.get('main_author_id') == author_id or pub_copy.get('main_author') == True)
                role_val = "Tác giả chính" if is_main else "co_author"
            is_main_role = role_val in ("Tác giả chính", "first_author", "corresponding_author", "first_and_corresponding", "main")
        
        # Quartile & Ranking History (Method 1)
        ranking_hist = pub_copy.get('ranking_history') or {}
        if str(pub_year) in ranking_hist:
            quartile = ranking_hist[str(pub_year)]
        else:
            quartile = pub_copy.get('quartile') or pub_copy.get('ranking')
        if quartile:
            quartile = str(quartile).upper().strip()
            
        hdgs_point_year = pub_copy.get('hdgs_point_year') or pub_copy.get('max_score') or pub_copy.get('calculated_score')
        
        status_nganh = ""
        points = 0.0
        
        try:
            # 1. Temporal Anomaly Filter
            if pub_year > N:
                status_nganh = "❌ Bị loại - Vượt quá năm xét duyệt"
                points = 0.0
            else:
                # 3. Deterministic Scoring Logic
                if quartile == 'Q1' and is_main_role:
                    points = 2.0
                    status_nganh = "✅ Khớp ngành (Scopus Q1)"
                elif quartile == 'Q2' and is_main_role:
                    points = 1.5
                    status_nganh = "✅ Khớp ngành (Scopus Q2)"
                elif hdgs_point_year is not None:
                    try:
                        points = float(hdgs_point_year)
                        status_nganh = "✅ Khớp ngành (Trong nước)"
                    except (TypeError, ValueError):
                        points = 0.0
                        status_nganh = "⏳ Chờ thẩm định phân hạng"
                else:
                    points = 0.0
                    status_nganh = "⏳ Chờ thẩm định phân hạng"
        except Exception as e:
            logger.error(f"Error parsing publication metadata: {e}")
            points = 0.0
            status_nganh = "⚠️ Thiếu thông tin phân hạng"

        # Accumulate
        pub_copy['calculated_score'] = points
        pub_copy['status_nganh'] = status_nganh
        pub_copy['year'] = pub_year
        pub_copy['role'] = "Tác giả chính" if is_main_role else "Thành viên"
        pub_copy['ranking'] = quartile or "N/A"
        
        processed_pubs.append(pub_copy)
        
        if "❌ Bị loại" not in status_nganh:
            total_score += points
            # 2. 3-Year Window
            if pub_year in (N-2, N-1, N):
                three_year_score += points
            # Core score (specialized score)
            if "✅" in status_nganh:
                core_score += points
            # Main author count
            if is_main_role and pub_year >= 2020:
                main_author_count += 1
                
    # Calculate shortfall precisely
    total_shortfall = max(0.0, adjusted_req_total - total_score)
    three_year_shortfall = max(0.0, req_three_year - three_year_score)
    core_shortfall = max(0.0, req_core - core_score)
    
    # Check eligibility
    ok_total = total_score >= adjusted_req_total
    ok_three_year = three_year_score >= req_three_year
    ok_core = core_score >= req_core
    
    req_main = 3 if target_title == "PGS" else 5
    ok_main = main_author_count >= req_main
    
    eligible = ok_total and ok_three_year and ok_core and ok_main and ok_students
    
    return {
        "Nam_xet": N,
        "target_title": target_title,
        "publications": processed_pubs,
        "total_score": round(total_score, 2),
        "three_year_score": round(three_year_score, 2),
        "core_score": round(core_score, 2),
        "main_author_count": main_author_count,
        "students_guided": students_guided,
        "students_shortfall": students_shortfall,
        "fallback_credit_needed": fallback_credit_needed,
        "adjusted_req_total": adjusted_req_total,
        "total_shortfall": round(total_shortfall, 2),
        "three_year_shortfall": round(three_year_shortfall, 2),
        "core_shortfall": round(core_shortfall, 2),
        "ok_total": ok_total,
        "ok_three_year": ok_three_year,
        "ok_core": ok_core,
        "ok_main": ok_main,
        "ok_students": ok_students,
        "eligible": eligible,
        "requirements": {
            "total": adjusted_req_total,
            "three_year": req_three_year,
            "core": req_core,
            "students": req_students,
            "main": req_main
        }
    }

class RAGChatbot:
    def __init__(self, config: RAGConfig = None, retriever_config: RetrieverConfig = None):
        self.config = config or RAGConfig()
        self.retriever_config = retriever_config or RetrieverConfig()
        
        # Support configuration flag for backend model switch
        import os
        self.generator_backend = os.getenv("GENERATOR_BACKEND") or getattr(self.config, "GENERATOR_BACKEND", "openai")
        self.generator_backend = self.generator_backend.lower().strip()
        
        # Fallback handling
        if self.generator_backend == "openai" and not self.config.OPENAI_API_KEY:
            logger.warning("OpenAI API key missing. Fallback to Gemini if possible.")
            self.generator_backend = "gemini"
            
        gemini_key = os.getenv("GOOGLE_API_KEY") or getattr(self.config, "GEMINI_API_KEY", "")
        if self.generator_backend == "gemini" and not gemini_key:
            logger.warning("Gemini API key missing. Fallback to OpenAI.")
            self.generator_backend = "openai"
            
        if OpenAI is not None and getattr(self.config, "OPENAI_API_KEY", ""):
            try:
                self.openai_client = OpenAI(api_key=self.config.OPENAI_API_KEY, timeout=8.0)
            except Exception as e:
                logger.warning(f"Không thể khởi tạo OpenAI client: {e}")
                self.openai_client = None
        else:
            self.openai_client = None
            
        self.gemini_client = None
        if self.generator_backend == "gemini":
            try:
                import google.generativeai as genai
                if gemini_key:
                    genai.configure(api_key=gemini_key)
                    self.gemini_client = genai
                else:
                    logger.warning("Gemini API key (GOOGLE_API_KEY) not found. Bypassing Gemini initialization.")
            except ImportError:
                logger.warning("google-generativeai package not found. Bypassing Gemini initialization.")

    def _build_context_text(self, chunks: List[RetrievedChunk]) -> str:
        if not chunks:
            return "Không tìm thấy văn bản pháp lý nào liên quan."
        context_parts = []
        hidden_keys = {"source_file", "sheet_source", "source_sheet", "file_source", "embedding"}
        for i, c in enumerate(chunks, 1):
            clean_meta = {k: v for k, v in c.metadata.items() if k not in hidden_keys}
            meta_str = " | ".join([f"{k}: {v}" for k, v in clean_meta.items()])
            part = f"--- Tài liệu {i} ---\nThông tin: {meta_str}\nNội dung:\n{c.content}\n"
            context_parts.append(part)
        return "\n".join(context_parts)

    def _extract_citations(self, chunks: List[RetrievedChunk]) -> List[Dict[str, Any]]:
        hidden_keys = {"source_file", "sheet_source", "source_sheet", "file_source", "embedding"}
        citations = []
        for c in chunks:
            clean_meta = {k: v for k, v in c.metadata.items() if k not in hidden_keys}
            citations.append({
                "rank": c.rank,
                "metadata": clean_meta,
                "rerank_score": c.rerank_score
            })
        return citations

    def _execute_tool(self, function_name: str, function_args: dict) -> str:
        """Thực thi một tool và trả về kết quả."""
        logger.info(f"Executing tool: {function_name} with args: {function_args}")
        
        if function_name == "get_journal_info":
            return scoring_engine.get_journal_info(
                journal_name=function_args.get("journal_name", ""),
                issn=function_args.get("issn", ""),
            )
        elif function_name == "calculate_score":
            return scoring_engine.calculate_score(
                items=function_args.get("items", []),
                academic_field=function_args.get("academic_field"),
                eval_year=function_args.get("eval_year", 2024),
                target_title=function_args.get("target_title", "PGS")
            )
        elif function_name == "validate_eligibility":
            return scoring_engine.validate_eligibility(
                items=function_args.get("items", []),
                academic_field=function_args.get("academic_field"),
                eval_year=function_args.get("eval_year", 2024),
                target_title=function_args.get("target_title", "PGS"),
                guided_masters=function_args.get("guided_masters", 0),
                guided_phds=function_args.get("guided_phds", 0),
            )
        elif function_name == "list_journals":
            return scoring_engine.list_journals(
                keyword=function_args.get("keyword", ""),
                category=function_args.get("category", ""),
            )
        elif function_name == "search_journal_online":
            return search_journal_online(
                journal_name=function_args.get("journal_name", ""),
                issn=function_args.get("issn", ""),
            )
        elif function_name == "fetch_paper_by_doi":
            return fetch_paper_by_doi_markdown(
                doi=function_args.get("doi", "")
            )
        else:
            return f"Lỗi: Công cụ '{function_name}' không tồn tại."

    def get_answer(
        self,
        query: str,
        history: Optional[List[Dict[str, str]]] = None,
        candidate_profile: Optional[Dict[str, Any]] = None,
        user_profile: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Trả lời câu hỏi, kèm lịch sử hội thoại trong phiên để làm giàu context."""
        profile = candidate_profile or user_profile
        logger.info(f"RAGChatbot received query: {query} | history_turns={len(history or [])} | has_profile={profile is not None} | backend={self.generator_backend}")

        # Step 1: Safe Retrieval
        sorted_chunks = []
        try:
            if search_and_rerank:
                sorted_chunks = search_and_rerank(query, config=self.retriever_config)
        except Exception as e:
            logger.warning(f"Lỗi khi search_and_rerank: {e}")
            sorted_chunks = []

        context_text = self._build_context_text(sorted_chunks)
        citations = self._extract_citations(sorted_chunks)

        # Stage 2.1: Run Deterministic Compliance Rule Engine
        compliance_state = None
        if profile:
            try:
                compliance_state = run_compliance_rule_engine(profile)
            except Exception as e:
                logger.error(f"Error running compliance rule engine: {e}")

        # Stage 2.2: Check if query contains DOI format (e.g. 10.xxxx/yyyy)
        import re
        doi_match = re.search(r'10\.\d{4,9}/[-._;()/:A-Za-z0-9]+', query)
        doi_report_str = None
        if doi_match:
            clean_doi_str = doi_match.group(0).rstrip('.,;)')
            logger.info(f"Detected DOI in query: {clean_doi_str}. Pre-fetching DOI metadata...")
            try:
                if fetch_paper_by_doi_markdown:
                    doi_report_str = fetch_paper_by_doi_markdown(clean_doi_str)
            except Exception as e:
                logger.warning(f"Lỗi pre-fetching DOI: {e}")

        # Enrich context with compliance JSON dump & DOI metadata
        context_parts = []
        if compliance_state:
            context_parts.append(
                f"--- DỮ LIỆU ĐÃ TÍNH TOÁN BỞI RULE ENGINE (BẮT BUỘC SỬ DỤNG) ---\n"
                f"{json.dumps(compliance_state, ensure_ascii=False, indent=2)}\n"
            )
        if doi_report_str:
            context_parts.append(
                f"--- DỮ LIỆU SIÊU DỮ LIỆU BÀI BÁO TỪ DOI (BẮT BUỘC SỬ DỤNG) ---\n"
                f"{doi_report_str}\n"
            )
        context_parts.append(context_text)
        enriched_context = "\n".join(context_parts)

        # Determine if query is asking for full profile evaluation report
        q_lower = query.lower()
        is_profile_audit_query = bool(profile and compliance_state and any(k in q_lower for k in [
            "thẩm định hồ sơ của tôi", "xem hồ sơ của tôi", "đánh giá hồ sơ của tôi", "đối soát hồ sơ"
        ]))

        # Build Messages
        if is_profile_audit_query and SYSTEM_PROMPT_SYNTHESIZER:
            system_content = SYSTEM_PROMPT_SYNTHESIZER.format(
                target_title=compliance_state["target_title"],
                academic_field=profile.get("user", {}).get("author", {}).get("academic_field") or profile.get("academic_field") or "Công nghệ thông tin",
                eval_year=compliance_state["Nam_xet"]
            )
            system_content += f"\n\n### NGỮ CẢNH HỖ TRỢ:\n{enriched_context}"
        elif SYSTEM_PROMPT:
            system_content = SYSTEM_PROMPT.format(context=context_text)
            if profile:
                system_content += f"\n\n### THÔNG TIN HỒ SƠ ỨNG VIÊN ĐANG HỎI:\n{json.dumps(profile, ensure_ascii=False, indent=2)}"
        else:
            system_content = "Bạn là trợ lý AI thẩm định hồ sơ khoa học và tra cứu tạp chí theo chuẩn HĐGSNN."

        messages: List[Dict[str, Any]] = [
            {"role": "system", "content": system_content},
        ]

        # Inject conversation history
        MAX_HISTORY_TURNS = 10
        if history:
            for turn in history[-MAX_HISTORY_TURNS:]:
                role = turn.get("role", "user")
                content = turn.get("content", "")
                if role in ("user", "assistant") and content:
                    messages.append({"role": role, "content": content})

        # Current user query
        user_prompt_str = USER_PROMPT.format(query=query) if USER_PROMPT else query
        messages.append({"role": "user", "content": user_prompt_str})

        # Stage 2.3: LLM Text Synthesis with Fallback
        final_answer = ""
        try:
            if self.generator_backend == "gemini" and self.gemini_client:
                logger.info("Calling Gemini LLM for synthesis...")
                model_name = os.getenv("GEMINI_MODEL") or self.retriever_config.gemini_model or "gemini-2.0-flash"
                model = self.gemini_client.GenerativeModel(
                    model_name=model_name,
                    system_instruction=system_content
                )
                contents = []
                for msg in messages:
                    if msg["role"] == "system":
                        continue
                    contents.append({
                        "role": "user" if msg["role"] == "user" else "model",
                        "parts": [msg["content"]]
                    })
                response = model.generate_content(contents)
                final_answer = response.text
            elif self.openai_client:
                # OpenAI generation
                if is_profile_audit_query:
                    logger.info("Calling OpenAI LLM for direct profile report synthesis (no tools)...")
                    response = self.openai_client.chat.completions.create(
                        model=self.config.OPENAI_MODEL,
                        messages=messages,
                        temperature=0.1,
                    )
                    final_answer = response.choices[0].message.content
                else:
                    logger.info("Calling OpenAI LLM with Tools...")
                    tool_choice_param = "auto"
                    if doi_match:
                        tool_choice_param = {"type": "function", "function": {"name": "fetch_paper_by_doi"}}
                    elif any(k in q_lower for k in ["tính số điểm", "tính điểm", "bao nhiêu điểm", "điểm tôi nhận được", "điểm quy đổi"]):
                        tool_choice_param = {"type": "function", "function": {"name": "calculate_score"}}

                    response = self.openai_client.chat.completions.create(
                        model=self.config.OPENAI_MODEL,
                        messages=messages,
                        tools=TOOLS,
                        tool_choice=tool_choice_param,
                        temperature=0.1,
                    )
                    response_message = response.choices[0].message
                    tool_calls = response_message.tool_calls

                    if tool_calls:
                        logger.info(f"LLM requested {len(tool_calls)} tool calls.")
                        messages.append(response_message)
                        journal_info_result = None

                        for tool_call in tool_calls:
                            function_name = tool_call.function.name
                            function_args = json.loads(tool_call.function.arguments)
                            function_response = self._execute_tool(function_name, function_args)

                            if function_name == "get_journal_info":
                                try:
                                    journal_info_result = json.loads(function_response)
                                except Exception:
                                    journal_info_result = None

                            messages.append({
                                "tool_call_id": tool_call.id,
                                "role": "tool",
                                "name": function_name,
                                "content": function_response,
                            })

                        if (
                            len(tool_calls) == 1
                            and tool_calls[0].function.name == "get_journal_info"
                            and journal_info_result
                        ):
                            d = journal_info_result
                            if not d.get("found"):
                                final_answer = (
                                    f"⚠️ Không tìm thấy tạp chí **{d.get('journal_name', 'N/A')}** "
                                    f"(ISSN: {d.get('issn', 'N/A')}) trong cơ sở dữ liệu.\n"
                                    f"Vui lòng kiểm tra lại tên tạp chí hoặc mã ISSN."
                                )
                            else:
                                journal_url = d.get("journal_url") or ""
                                link_line = f"[Xem Trang Chủ Tạp Chí 🔗]({journal_url})" if journal_url else "Chưa cập nhật link."
                                max_score_info = f"\n📊 **Điểm tối đa (S_max):** {d['max_score']} điểm (Căn cứ: Bảng HĐGSNN)" if d.get("max_score") is not None else (f"\n📊 **Khung điểm:** {d['score_range']}" if d.get("score_range") else "")
                                jcr_info = f"\n   JCR IF: {d['jcr_if']}" if d.get("jcr_if") else ""

                                final_answer = (
                                    f"📖 **{d.get('journal_name', 'N/A')}**\n\n"
                                    f"| Thông tin | Chi tiết |\n"
                                    f"|---|---|\n"
                                    f"| **ISSN** | {d.get('issn', 'N/A')} |\n"
                                    f"| **e-ISSN** | {d.get('e_issn', 'N/A')} |\n"
                                    f"| **Phân hạng** | {d.get('rank', 'Chưa rõ')} |\n"
                                    f"| **Ngành/Liên ngành** | {d.get('field', 'N/A')} |\n"
                                    f"| **H-index** | {d.get('h_index') or 'N/A'} |\n"
                                    f"| **Nguồn** | {d.get('source', 'N/A')} |"
                                    f"{max_score_info}{jcr_info}\n\n"
                                    f"🌐 **Website:** {link_line}"
                                )
                        else:
                            second_response = self.openai_client.chat.completions.create(
                                model=self.config.OPENAI_MODEL,
                                messages=messages,
                                temperature=0.1,
                            )
                            final_answer = second_response.choices[0].message.content
                    else:
                        final_answer = response_message.content
            else:
                final_answer = self._generate_local_fallback(query, profile, compliance_state, doi_report_str)

        except Exception as e:
            logger.warning(f"Lỗi khi gọi LLM synthesis: {e}. Fallback về engine nội bộ.")
            final_answer = self._generate_local_fallback(query, profile, compliance_state, doi_report_str)

        logger.info("Generation complete.")
        return {"answer": final_answer, "citations": citations}

    def _generate_local_fallback(
        self,
        query: str,
        profile: Optional[Dict[str, Any]],
        compliance_state: Optional[Dict[str, Any]],
        doi_report_str: Optional[str] = None
    ) -> str:
        """Sinh câu trả lời nội bộ deterministically khi LLM API bên ngoài không khả dụng."""
        import re
        q_lower = query.lower().strip()

        # 1. Greetings
        if any(k in q_lower for k in ["xin chào", "chào", "hello", "hi", "bạn là ai"]):
            name = profile.get("user", {}).get("author", {}).get("name") if profile else None
            greeting = f"Chào {name}! " if name else "Xin chào Quý Thầy/Cô! "
            return (
                f"{greeting}Tôi là **Trợ lý AI Quản lý Khoa học**.\n\n"
                f"Tôi có thể hỗ trợ:\n"
                f"1. 🔍 **Tra cứu tạp chí & hội nghị**: Xếp hạng Q1-Q4, Scimago, chỉ số IF, H-index, điểm HĐGSNN.\n"
                f"2. 🧮 **Tính điểm công trình**: Điểm quy đổi tác giả chính, tác giả liên hệ, đồng tác giả.\n"
                f"3. 📋 **Thẩm định hồ sơ GS/PGS**: Kiểm tra các tiêu chuẩn bắt buộc (tổng điểm, 3 năm cuối, bài tác giả chính).\n"
                f"4. 📑 **Kiểm tra DOI bài báo**: Trích xuất siêu dữ liệu và kiểm tra liêm chính học thuật.\n\n"
                f"*Quý Thầy/Cô có thể đặt câu hỏi hoặc gửi mã DOI/tên tạp chí để bắt đầu!*"
            )

        # 2. DOI Query
        if doi_report_str:
            return f"### 📑 Kết Quả Đối Soát Mã DOI:\n\n{doi_report_str}"

        # 3. Profile / Eligibility Inquiry
        if profile and any(k in q_lower for k in ["hồ sơ", "đạt không", "xét pgs", "xét gs", "điểm của tôi", "tổng điểm", "tiêu chuẩn"]):
            pgs = profile.get("pgs", {})
            gs = profile.get("gs", {})
            totals = profile.get("totals", {})
            author = profile.get("user", {}).get("author", {}) or {}
            author_name = author.get("name", "Ứng viên")
            field = author.get("academic_field", "Công nghệ thông tin")

            status_pgs = "✅ **ĐỦ ĐIỀU KIỆN**" if pgs.get("eligible") else "⚠️ **CHƯA ĐỦ ĐIỀU KIỆN**"
            status_gs = "✅ **ĐỦ ĐIỀU KIỆN**" if gs.get("eligible") else "⚠️ **CHƯA ĐỦ ĐIỀU KIỆN**"

            return (
                f"### 📋 Kết Quả Thẩm Định Hồ Sơ Khoa Học: **{author_name}**\n"
                f"- **Chuyên ngành:** {field}\n"
                f"- **Tổng số bài báo:** {totals.get('total_papers_count', 0)} bài (Đã tính điểm: {totals.get('scored_papers_count', 0)})\n\n"
                f"#### 1. Đánh giá chức danh Phó Giáo Sư (PGS): {status_pgs}\n"
                f"| Tiêu chí | Hiện có | Yêu cầu tối thiểu | Đạt/Chưa đạt |\n"
                f"|---|---|---|---|\n"
                f"| **Tổng điểm công trình** | **{pgs.get('total_score_current', 0)}** | {pgs.get('total_score_required', 10.0)} | {'✅ Đạt' if pgs.get('total_score_pass') else '❌ Chưa đạt'} |\n"
                f"| **Điểm 3 năm liền kề** | **{pgs.get('last3_score_current', 0)}** | {pgs.get('last3_score_required', 2.5)} | {'✅ Đạt' if pgs.get('last3_score_pass') else '❌ Chưa đạt'} |\n"
                f"| **Điểm tạp chí chuyên ngành** | **{pgs.get('journal_score_current', 0)}** | {pgs.get('journal_score_required', 6.0)} | {'✅ Đạt' if pgs.get('journal_score_pass') else '❌ Chưa đạt'} |\n"
                f"| **Số bài là tác giả chính** | **{pgs.get('main_author_current', 0)}** | {pgs.get('main_author_required', 3)} bài | {'✅ Đạt' if pgs.get('main_author_pass') else '❌ Chưa đạt'} |\n\n"
                f"#### 2. Đánh giá chức danh Giáo Sư (GS): {status_gs}\n"
                f"| Tiêu chí | Hiện có | Yêu cầu tối thiểu | Đạt/Chưa đạt |\n"
                f"|---|---|---|---|\n"
                f"| **Tổng điểm công trình** | **{gs.get('total_score_current', 0)}** | {gs.get('total_score_required', 20.0)} | {'✅ Đạt' if gs.get('total_score_pass') else '❌ Chưa đạt'} |\n"
                f"| **Điểm 3 năm liền kề** | **{gs.get('last3_score_current', 0)}** | {gs.get('last3_score_required', 5.0)} | {'✅ Đạt' if gs.get('last3_score_pass') else '❌ Chưa đạt'} |\n"
                f"| **Điểm tạp chí chuyên ngành** | **{gs.get('journal_score_current', 0)}** | {gs.get('journal_score_required', 12.0)} | {'✅ Đạt' if gs.get('journal_score_pass') else '❌ Chưa đạt'} |\n"
                f"| **Số bài là tác giả chính** | **{gs.get('main_author_current', 0)}** | {gs.get('main_author_required', 5)} bài | {'✅ Đạt' if gs.get('main_author_pass') else '❌ Chưa đạt'} |"
            )

        # 4. Journal / Conference Lookup
        if scoring_engine:
            try:
                clean_q = re.sub(r'^(tra cứu|cho tôi biết|thông tin về|tạp chí|hội nghị|điểm của)\s*', '', q_lower).strip()
                info_str = scoring_engine.get_journal_info(clean_q)
                info = json.loads(info_str)
                if info.get("found"):
                    d = info
                    journal_url = d.get("journal_url") or ""
                    link_line = f"[Xem Trang Chủ Tạp Chí 🔗]({journal_url})" if journal_url else "Chưa cập nhật link."
                    max_score_info = f"\n📊 **Điểm tối đa (S_max):** {d['max_score']} điểm (Căn cứ: Bảng HĐGSNN)" if d.get('max_score') is not None else ""
                    jcr_info = f"\n   JCR IF: {d['jcr_if']}" if d.get("jcr_if") else ""

                    return (
                        f"📖 **{d.get('journal_name', 'N/A')}**\n\n"
                        f"| Thông tin | Chi tiết |\n"
                        f"|---|---|\n"
                        f"| **ISSN** | {d.get('issn', 'N/A')} |\n"
                        f"| **e-ISSN** | {d.get('e_issn', 'N/A')} |\n"
                        f"| **Phân hạng** | {d.get('rank', 'Chưa rõ')} |\n"
                        f"| **Ngành/Liên ngành** | {d.get('field', 'N/A')} |\n"
                        f"| **H-index** | {d.get('h_index') or 'N/A'} |\n"
                        f"| **Nguồn** | {d.get('source', 'N/A')} |"
                        f"{max_score_info}{jcr_info}\n\n"
                        f"🌐 **Website:** {link_line}"
                    )
            except Exception as e:
                logger.warning("Local journal search failed: %s", e)

        # 5. Default General Response
        return (
            f"Tôi đã tiếp nhận câu hỏi của Quý Thầy/Cô: *\"{query}\"*.\n\n"
            f"Để được giải đáp chi tiết nhất, Quý Thầy/Cô có thể:\n"
            f"- Nhập tên tạp chí hoặc mã ISSN (Ví dụ: `IEEE Access`, `1530-437X`).\n"
            f"- Hỏi về điều kiện xét duyệt (Ví dụ: `Hồ sơ của tôi đủ điều kiện PGS không?`).\n"
            f"- Nhập mã DOI bài báo để kiểm tra liêm chính học thuật (Ví dụ: `10.1109/ACCESS.2023.1234567`)."
        )
