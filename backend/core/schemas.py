from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class LoginRequest(BaseModel):
    username: str
    password: str

class PaperCreate(BaseModel):
    title: str
    journal_name: str
    doi: Optional[str] = ""
    year: int
    status: str = "in_review"
    author_ids: List[int] = []
    main_author_id: Optional[int] = None
    corresponding_author_id: Optional[int] = None
    # Maps str(author_id) -> role: 'main' | 'member' | 'corresponding'
    author_roles: Optional[Dict[str, str]] = None
    ranking: Optional[str] = None
    sjr_score: Optional[float] = None
    issn: Optional[str] = ""
    notes: Optional[str] = ""
    is_ai_verified: Optional[bool] = True
    ai_mismatches: Optional[List[str]] = []
    ai_metadata: Optional[Dict[str, Any]] = None

class AuthorCreate(BaseModel):
    name: str
    email: Optional[str] = ""
    affiliation: Optional[str] = ""
    is_member: bool = True
    group_type: Optional[str] = ""
    member_role: Optional[str] = ""

class VenueCreate(BaseModel):
    name: str
    abbreviation: Optional[str] = ""
    type: str = "journal"
    ranking: Optional[str] = None
    impact_factor: Optional[float] = None
    sjr_score: Optional[float] = None
    url: Optional[str] = ""
    deadline: Optional[str] = None
    location: Optional[str] = ""

class TeamCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    leader_id: Optional[int] = None
    kpi_papers_per_year: int = 0

class TeamMemberAdd(BaseModel):
    author_id: int
    kpi_papers: Optional[int] = 0
    team_role: Optional[str] = "Thành viên"

class TeamMemberUpdate(BaseModel):
    kpi_papers: Optional[int] = None
    team_role: Optional[str] = None


class PaperSubmitAIRequest(BaseModel):
    doi: str
    url: Optional[str] = ""
    candidate_title_vn: Optional[str] = ""

# Legacy API structures
class JournalCheckRequest(BaseModel):
    journal_name: str
    issn_list: List[str]
    publisher: Optional[str] = None
    year: Optional[int] = None

class TitleSimilarityRequest(BaseModel):
    english_title: str
    vietnamese_title: str

class FieldClassificationRequest(BaseModel):
    title: str
    abstract: Optional[str] = ""

class AffiliationMatchRequest(BaseModel):
    extracted_aff: str
    historical_affs: List[str]

class ArticleValidationRequest(BaseModel):
    doi: str
    url: Optional[str] = ""
    candidate_name: str
    candidate_title_vn: str

class ArticleItem(BaseModel):
    title: str
    journal_name: str
    issn: str = ""
    year: int
    num_authors: int = 1
    role: str = "main"

class SimulatorRequest(BaseModel):
    target_title: str
    academic_field: str = "Công nghệ thông tin"
    eval_year: int = 2024
    articles: List[ArticleItem]

class ScorecardItem(BaseModel):
    current: float
    required: float
    status: str

class SummaryScorecard(BaseModel):
    total_score: ScorecardItem
    main_author_articles: ScorecardItem
    last_3_years_score: ScorecardItem
    specialized_score: Optional[ScorecardItem] = None

class ArticleTableItem(BaseModel):
    journal_name: str
    issn: Optional[str] = None
    rank: Optional[str] = None
    year: int
    role: str
    max_score: float
    calculated_score: float
    is_within_3_years: bool
    is_field_match: bool
    journal_url: Optional[str] = None

class SimulatorResponse(BaseModel):
    eligibility_status: str
    summary_scorecard: SummaryScorecard
    articles_table: List[ArticleTableItem]
    detailed_explanation_markdown: str

class ChatHistoryItem(BaseModel):
    role: str          # "user" | "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatHistoryItem] = []   # conversation history for this session

class ChatResponse(BaseModel):
    answer: str
    citations: List[Dict[str, Any]]

# Models for Simulator AI
class CVExtractionRequest(BaseModel):
    text: str

class ExtractedCVDataScientific(BaseModel):
    total_score: Optional[float] = 0.0
    last_3_years_score: Optional[float] = 0.0
    journal_score: Optional[float] = 0.0
    main_author_articles: Optional[int] = 0

class ExtractedCVData(BaseModel):
    scientific_points: Optional[ExtractedCVDataScientific] = None
    teaching_hours: Optional[int] = 0
    seniority_years: Optional[int] = 0
    degree_title: Optional[str] = "TS"
    degree_years: Optional[int] = 0
    foreign_language: Optional[str] = "B2"
    guided_masters: Optional[int] = 0
    guided_phds: Optional[int] = 0
    projects_domestic: Optional[int] = 0
    projects_ministry: Optional[int] = 0
    projects_national: Optional[int] = 0
    academic_field: Optional[str] = "Công nghệ thông tin"
    target_title: Optional[str] = "PGS"

class AIConsultRequest(BaseModel):
    target_title: str
    academic_field: str
    eval_year: int
    inputs: dict

class WeightedScoringRequest(BaseModel):
    max_score: float
    total_authors: int
    is_first_author: bool
    is_corresponding_author: bool
    has_distinct_corresponding_author: bool

class WeightedScoringResponse(BaseModel):
    status: str
    data: dict

class ScholarSyncRequest(BaseModel):
    scholar_id: str
    source: Optional[str] = "auto"

class ScholarSearchRequest(BaseModel):
    query: str

class ScholarPaperImportItem(BaseModel):
    title: str
    journal_name: Optional[str] = ""
    issn: Optional[str] = ""
    doi: Optional[str] = ""
    year: int
    citations: Optional[int] = 0
    authors: List[str] = []

class BulkPaperImportRequest(BaseModel):
    papers: List[ScholarPaperImportItem]
