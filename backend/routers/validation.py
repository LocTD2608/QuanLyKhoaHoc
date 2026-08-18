import json
import traceback
from fastapi import APIRouter, HTTPException

from core.dependencies import integrity_checker, scoring_engine, validation_flow
from core.schemas import (
    JournalCheckRequest, TitleSimilarityRequest, FieldClassificationRequest,
    AffiliationMatchRequest, ArticleValidationRequest, SimulatorRequest,
    SimulatorResponse, CVExtractionRequest, AIConsultRequest,
    SummaryScorecard, ScorecardItem, ArticleTableItem,
    WeightedScoringRequest, WeightedScoringResponse
)
from services.scoring.lookup import lookup_journal
from services.scoring.models import ArticleInput, AuthorRole, ScoringStatus
from services.scoring.engine import calculate_weighted_author_score

router = APIRouter()

def get_openai_client():
    try:
        from services.rag_chatbot.config import RAGConfig
        from openai import OpenAI
        conf = RAGConfig()
        return OpenAI(api_key=conf.OPENAI_API_KEY)
    except Exception as e:
        print(f"Error initializing OpenAI: {e}")
        return None

@router.post("/v1/check/journal")
async def check_journal(req: JournalCheckRequest):
    try:
        # Get baseline results from integrity_checker
        res = integrity_checker.check_journal_integrity(req.journal_name, req.issn_list, req.publisher, req.year)
        
        # Look up in scoring_engine's Master DB
        issn_val = req.issn_list[0] if req.issn_list else None
        record = lookup_journal(scoring_engine.db, req.journal_name, issn_val)
        
        # Populate new clean fields
        journal_name = record.name if record else req.journal_name
        issn = record.issn if (record and record.issn) else (req.issn_list[0] if req.issn_list else None)
        e_issn = record.e_issn if record else None
        
        # Rank can come from Master DB or from the baseline ranking
        rank = None
        if record:
            rank = record.sjr_quartile or record.domestic_rank
        if not rank and res.get("ranking"):
            rank = res["ranking"].get("quartile")
        if not rank:
            rank = "N/A"
            
        field = record.field if record else None
        
        # H-index can come from Master DB or baseline ranking
        h_index = None
        if record and record.h_index is not None:
            h_index = record.h_index
        elif res.get("ranking") and res["ranking"].get("h_index") is not None:
            try:
                h_index = float(res["ranking"]["h_index"])
            except:
                pass
                
        # URL normalization
        journal_url = record.url if record else None
        if not journal_url and res.get("api_metadata"):
            journal_url = res["api_metadata"].get("homepage_url")
            
        from services.scoring.data_processor import normalize_url
        journal_url = normalize_url(journal_url)
        
        # Merge new fields to root of response
        res["journal_name"] = journal_name
        res["issn"] = issn
        res["e_issn"] = e_issn
        res["rank"] = rank
        res["field"] = field
        res["h_index"] = h_index
        res["journal_url"] = journal_url
        
        return res
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, str(e))

@router.post("/v1/check/title-similarity")
async def check_title_similarity(req: TitleSimilarityRequest):
    try:
        score = await integrity_checker.correlate_titles_with_llm(req.english_title, req.vietnamese_title)
        return {"similarity_score": score}
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/v1/classify/field")
async def classify_field(req: FieldClassificationRequest):
    try:
        return await integrity_checker.classify_scientific_field(req.title, req.abstract)
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/v1/match/affiliation")
async def match_affiliation(req: AffiliationMatchRequest):
    try:
        return await integrity_checker.semantic_affiliation_match(req.extracted_aff, req.historical_affs)
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/v1/validate/article")
async def validate_article(req: ArticleValidationRequest):
    try:
        return await validation_flow.run_validation(req.doi, req.url, req.candidate_name, req.candidate_title_vn)
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/v1/simulator/evaluate", response_model=SimulatorResponse)
async def evaluate_profile(req: SimulatorRequest):
    try:
        inputs = [ArticleInput(
            journal_name=a.journal_name, issn=a.issn,
            author_role=AuthorRole.MAIN if a.role == "main" else AuthorRole.MEMBER,
            num_authors=a.num_authors, academic_field=req.academic_field,
            pub_year=a.year, eval_year=req.eval_year, target_title=req.target_title
        ) for a in req.articles]
        eval_result = scoring_engine.validate_eligibility(inputs)
        report_md = scoring_engine.generate_response(inputs)

        checks = eval_result["checks"]
        std = eval_result["standards"]
        is_tech = eval_result["is_tech"]

        total_score_status = "ĐẠT" if checks["ok_total"][0] else "CHƯA ĐẠT"
        main_author_articles_status = "ĐẠT" if checks["ok_main"][0] else "CHƯA ĐẠT"
        last_3_years_score_status = "ĐẠT" if checks["ok_last3"][0] else "CHƯA ĐẠT"

        summary_scorecard = SummaryScorecard(
            total_score=ScorecardItem(
                current=round(eval_result["total_score"], 2),
                required=std["min_total"],
                status=total_score_status
            ),
            main_author_articles=ScorecardItem(
                current=eval_result["main_count"],
                required=std["min_main"],
                status=main_author_articles_status
            ),
            last_3_years_score=ScorecardItem(
                current=round(eval_result["last3_score"], 2),
                required=std["min_last3"],
                status=last_3_years_score_status
            )
        )

        if is_tech:
            specialized_score_status = "ĐẠT" if checks["ok_spec"][0] else "CHƯA ĐẠT"
            summary_scorecard.specialized_score = ScorecardItem(
                current=round(eval_result["specialized_score"], 2),
                required=std["min_specialized"],
                status=specialized_score_status
            )

        articles_table = []
        for art_in, res in zip(inputs, eval_result["results"]):
            j = res.journal
            rank = (j.sjr_quartile or j.domestic_rank or "?") if j else "?"
            role = "Tác giả chính" if art_in.author_role in (AuthorRole.MAIN, AuthorRole.CORRESPONDING) else f"Thành viên ({art_in.num_authors})"

            articles_table.append(ArticleTableItem(
                journal_name=j.name if j else art_in.journal_name,
                issn=j.issn if j else art_in.issn,
                rank=rank,
                year=art_in.pub_year,
                role=role,
                max_score=res.max_score,
                calculated_score=res.final_score,
                is_within_3_years=res.is_in_last_3_years,
                is_field_match=res.status != ScoringStatus.FIELD_MISMATCH,
                journal_url=j.url if j else None
            ))

        eligibility_status = "ĐẠT" if eval_result["all_pass"] else "CHƯA ĐẠT"

        return SimulatorResponse(
            eligibility_status=eligibility_status,
            summary_scorecard=summary_scorecard,
            articles_table=articles_table,
            detailed_explanation_markdown=report_md
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, str(e))

@router.post("/v1/simulator/extract-cv")
async def extract_cv(req: CVExtractionRequest):
    client = get_openai_client()
    if not client:
        raise HTTPException(500, "Dịch vụ AI chưa được cấu hình hoặc thư viện openai thiếu.")
    
    system_prompt = """Bạn là một trợ lý AI phân tích lý lịch khoa học của giảng viên/nghiên cứu sinh để hỗ trợ mô phỏng hồ sơ xét chức danh Giáo sư (GS) và Phó Giáo sư (PGS) theo tiêu chuẩn Việt Nam.
Nhiệm vụ của bạn là đọc đoạn văn bản tiếng Việt mô tả lý lịch và trích xuất ra các chỉ số tương ứng. Chỉ trả về một đối tượng JSON hợp lệ có định dạng sau (nếu không tìm thấy thông tin cho trường nào thì để null hoặc 0):
{
  "scientific_points": {
    "total_score": float or null,
    "last_3_years_score": float or null,
    "journal_score": float or null,
    "main_author_articles": int or null
  },
  "teaching_hours": int or null,
  "seniority_years": int or null,
  "degree_title": "TS" | "PGS" | "Khác" | null,
  "degree_years": int or null,
  "foreign_language": "A1" | "A2" | "B1" | "B2" | "C1" | "C2" | "Bản ngữ" | null,
  "guided_masters": int or null,
  "guided_phds": int or null,
  "projects_domestic": int or null,
  "projects_ministry": int or null,
  "projects_national": int or null,
  "academic_field": string or null,
  "target_title": "PGS" | "GS" | null
}
Hãy phân tích kỹ văn bản để điền chính xác. Không thêm bất cứ giải thích nào ngoài mã JSON."""

    try:
        from services.rag_chatbot.config import RAGConfig
        conf = RAGConfig()
        response = client.chat.completions.create(
            model=conf.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.text}
            ],
            response_format={"type": "json_object"},
            temperature=0.1
        )
        result_text = response.choices[0].message.content
        extracted_data = json.loads(result_text)
        return {"extracted_data": extracted_data}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"Lỗi xử lý AI: {str(e)}")

@router.post("/v1/simulator/ai-consult")
async def ai_consult(req: AIConsultRequest):
    client = get_openai_client()
    if not client:
        raise HTTPException(500, "Dịch vụ AI chưa được cấu hình hoặc thư viện openai thiếu.")
    
    target_title = req.target_title
    academic_field = req.academic_field
    eval_year = req.eval_year
    inputs = req.inputs
    
    # Extract inputs safely
    total_score = inputs.get("total_score", 0.0)
    last_3_years_score = inputs.get("last_3_years_score", 0.0)
    journal_score = inputs.get("journal_score", 0.0)
    main_author_articles = inputs.get("main_author_articles", 0)
    teaching_hours = inputs.get("teaching_hours", 0)
    seniority_years = inputs.get("seniority_years", 0)
    degree_title = inputs.get("degree_title", "TS")
    degree_years = inputs.get("degree_years", 0)
    foreign_language = inputs.get("foreign_language", "B2")
    guided_masters = inputs.get("guided_masters", 0)
    guided_phds = inputs.get("guided_phds", 0)
    projects_domestic = inputs.get("projects_domestic", 0)
    projects_ministry = inputs.get("projects_ministry", 0)
    projects_national = inputs.get("projects_national", 0)

    # Establish requirement thresholds for prompting
    req_total = 10.0 if target_title == "PGS" else 20.0
    req_last3 = 2.5 if target_title == "PGS" else 5.0
    req_journal = 6.0 if target_title == "PGS" else 12.0
    req_main = 3 if target_title == "PGS" else 5
    req_seniority = 6 if target_title == "PGS" else 9
    req_degree_role = "Tiến sĩ" if target_title == "PGS" else "Phó Giáo sư"
    
    # Guided requirement string
    if target_title == "PGS":
        req_guided = ">= 2 học viên Thạc sĩ (ThS) hoặc >= 1 Nghiên cứu sinh (NCS)"
    else:
        req_guided = ">= 2 Nghiên cứu sinh (NCS) bảo vệ thành công học vị Tiến sĩ"
        
    # Project requirement string
    if target_title == "PGS":
        req_projects = ">= 2 đề tài cấp cơ sở (trường) hoặc >= 1 đề tài cấp Bộ/Tỉnh"
    else:
        req_projects = ">= 2 đề tài cấp Bộ/Tỉnh hoặc >= 1 đề tài cấp Quốc gia"
        
    # Status helper
    def get_status_str(current, required):
        try:
            curr_val = float(current)
            req_val = float(required)
            return "ĐẠT" if curr_val >= req_val else "CHƯA ĐẠT"
        except:
            return "ĐẠT" if current == required else "CHƯA ĐẠT"
            
    status_total = get_status_str(total_score, req_total)
    status_last3 = get_status_str(last_3_years_score, req_last3)
    status_journal = get_status_str(journal_score, req_journal)
    status_main = get_status_str(main_author_articles, req_main)
    status_teaching = get_status_str(teaching_hours, 275)
    status_seniority = get_status_str(seniority_years, req_seniority)
    status_degree = get_status_str(degree_years, 3) if degree_title == ("TS" if target_title == "PGS" else "PGS") else "CHƯA ĐẠT"
    
    # Language check helper
    language_levels = ["A1", "A2", "B1", "B2", "C1", "C2", "Bản ngữ"]
    try:
        lang_idx = language_levels.index(foreign_language)
        req_lang_idx = language_levels.index("B2")
        status_lang = "ĐẠT" if lang_idx >= req_lang_idx else "CHƯA ĐẠT"
    except:
        status_lang = "CHƯA ĐẠT"
        
    # Guided check helper
    if target_title == "PGS":
        status_guided = "ĐẠT" if (guided_masters >= 2 or guided_phds >= 1) else "CHƯA ĐẠT"
    else:
        status_guided = "ĐẠT" if (guided_phds >= 2) else "CHƯA ĐẠT"
        
    # Project check helper
    if target_title == "PGS":
        status_projects = "ĐẠT" if (projects_domestic >= 2 or projects_ministry >= 1 or projects_national >= 1) else "CHƯA ĐẠT"
    else:
        status_projects = "ĐẠT" if (projects_ministry >= 2 or projects_national >= 1) else "CHƯA ĐẠT"

    prompt = f"""Bạn là một chuyên gia tư vấn của Hội đồng Giáo sư Nhà nước.
Dưới đây là thông tin hiện tại của ứng viên đăng ký xét chức danh {target_title} ngành {academic_field} trong năm {eval_year}:

Ứng viên đặt mục tiêu xét duyệt: {target_title}
Các thông số hồ sơ hiện tại:
1. Tổng điểm quy đổi bài báo: {total_score} (Yêu cầu: >= {req_total}) -> {status_total}
2. Điểm trong 3 năm cuối: {last_3_years_score} (Yêu cầu: >= {req_last3}) -> {status_last3}
3. Điểm từ bài báo khoa học (Tạp chí quốc tế uy tín): {journal_score} (Yêu cầu: >= {req_journal}) -> {status_journal}
4. Bài báo tác giả chính (từ 2020): {main_author_articles} (Yêu cầu: >= {req_main}) -> {status_main}
5. Giờ giảng dạy trung bình/năm: {teaching_hours} giờ (Yêu cầu: >= 275) -> {status_teaching}
6. Số năm công tác: {seniority_years} năm (Yêu cầu: >= {req_seniority}) -> {status_seniority}
7. Thời gian giữ chức danh/học vị ({req_degree_role}): {degree_years} năm (Yêu cầu: >= 3 năm giữ {req_degree_role}) -> {status_degree} (Học vị hiện tại khai báo: {degree_title})
8. Trình độ ngoại ngữ: {foreign_language} (Yêu cầu: tối thiểu B2) -> {status_lang}
9. Hướng dẫn học viên: {guided_masters} Thạc sĩ, {guided_phds} Tiến sĩ (Yêu cầu: {req_guided}) -> {status_guided}
10. Đề tài NCKH chủ trì: {projects_domestic} Cơ sở, {projects_ministry} Bộ/Tỉnh, {projects_national} Quốc gia (Yêu cầu: {req_projects}) -> {status_projects}

Nhiệm vụ của bạn:
- Phân tích chi tiết và đánh giá điểm mạnh (các tiêu chuẩn đã ĐẠT), chỉ ra điểm yếu/thiếu sót cốt lõi (các tiêu chuẩn CHƯA ĐẠT).
- Tư vấn một lộ trình hành động cụ thể, khoa học từng bước (Actionable Roadmap) giúp ứng viên khắc phục những thiếu sót của hồ sơ.
- **CÁC RÀNG BUỘC PHÁP QUY & BẪY NGHIỆP VỤ BẮT BUỘC TUÂN THỦ STICTLY:**
  1. **Không bù thâm niên giảng dạy bằng bài báo:** Thâm niên giảng dạy & giờ giảng là tiêu chuẩn tối thiểu bắt buộc. TUYỆT ĐỐI KHÔNG gợi ý viết thêm bài báo để "bù" cho số năm đứng lớp hay thâm niên bị thiếu. Nếu thâm niên chưa đạt, phải tư vấn giảng dạy thêm đủ số năm/giờ quy định.
  2. **Không bù chủ trì đề tài bằng bài báo:** Chủ trì đề tài NCKH là tiêu chuẩn tối thiểu bắt buộc (cơ sở/Bộ/Quốc gia). TUYỆT ĐỐI KHÔNG gợi ý dùng bài báo Q1 hay bài báo uy tín để bù đắp cho việc thiếu đề tài chủ trì.
  3. **Xử lý trùng lặp quá trình công tác (BR2 - Data Engineering):** Nếu có trùng lặp thời gian công tác, khuyên ứng viên giữ lại bản ghi có Quyết định bổ nhiệm cơ hữu (`decision_file_id`) trong `position_history` để tính thâm niên chính, chuyển bản ghi trùng còn lại thành dạng thỉnh giảng (nếu có minh chứng).
  4. **Bài báo chờ xuất bản (Acceptance Letter):** Hướng dẫn đính kèm file minh chứng vào `evidence_file_id` trong `publication`. Nhấn mạnh điểm này là TẠM TÍNH và ở trạng thái `pending` chờ Quản trị viên/Hội đồng duyệt.
- Viết phản hồi bằng tiếng Việt dưới dạng Markdown có cấu trúc rõ ràng, sử dụng các ký hiệu cảnh báo hoặc các định dạng đẹp mắt để làm nổi bật thông tin cốt lõi."""

    try:
        from services.rag_chatbot.config import RAGConfig
        conf = RAGConfig()
        response = client.chat.completions.create(
            model=conf.OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "Bạn là chuyên gia tư vấn điều kiện chức danh Giáo sư và Phó Giáo sư chuẩn mực tại Việt Nam, tuân thủ nghiêm ngặt các quy tắc pháp quy cứng và không đưa ra lời khuyên lách luật."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3
        )
        consultation_markdown = response.choices[0].message.content
        return {"consultation_markdown": consultation_markdown}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"Lỗi sinh tư vấn lộ trình: {str(e)}")

@router.post("/v1/scoring/weighted", response_model=WeightedScoringResponse)
async def get_weighted_score(req: WeightedScoringRequest):
    try:
        result = calculate_weighted_author_score(
            max_score=req.max_score,
            total_authors=req.total_authors,
            is_first_author=req.is_first_author,
            is_corresponding_author=req.is_corresponding_author,
            has_distinct_corresponding_author=req.has_distinct_corresponding_author
        )
        return WeightedScoringResponse(
            status=result["status"],
            data=result["data"]
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, str(e))
