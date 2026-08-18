from pydantic import BaseModel, Field
from typing import List, Optional, Dict

class Author(BaseModel):
    given: Optional[str] = None
    family: Optional[str] = None
    sequence: Optional[str] = None
    affiliation: List[str] = []
    is_corresponding: Optional[bool] = False

class JournalMetadata(BaseModel):
    id: Optional[str] = None
    display_name: str
    issn: List[str] = []
    issn_l: Optional[str] = None
    is_oa: bool = False
    is_in_doaj: bool = False
    publisher: Optional[str] = None
    homepage_url: Optional[str] = None
    cited_by_count: int = 0
    works_count: int = 0
    h_index: Optional[int] = None
    country_code: Optional[str] = None
    type: Optional[str] = None

class ArticleMetadata(BaseModel):
    title: str
    journal: str
    authors: List[Author]
    year: Optional[int] = None
    doi: str
    volume: Optional[str] = None
    issue: Optional[str] = None
    pages: Optional[str] = None
    issn: List[str] = []
    journal_metadata: Optional[JournalMetadata] = None
