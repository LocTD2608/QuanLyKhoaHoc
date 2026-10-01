export interface OCRExtractedAuthor {
  name: string;
  order: number;
  email?: string | null;
  affiliation?: string | null;
  is_first_author: boolean;
  is_corresponding: boolean;
  is_co_first: boolean;
  marker?: string | null;
}

export interface OCRArticleExtractResult {
  document_type: 'article_first_page' | 'declaration_form' | 'other';
  title_en?: string | null;
  title_vn?: string | null;
  doi?: string | null;
  journal_name?: string | null;
  issn?: string | null;
  year?: number | null;
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  publisher?: string | null;
  authors: OCRExtractedAuthor[];
  abstract_snippet?: string | null;
  confidence_score: number;
  notes?: string | null;
}

export interface OCRDeclarationItem {
  item_no?: number | null;
  title: string;
  journal_name?: string;
  year?: number | null;
  doi?: string | null;
  role?: string;
  num_authors?: number;
  claimed_score?: number | null;
}

export interface OCRDeclarationResult {
  document_type: 'declaration_form';
  candidate_name?: string | null;
  academic_field?: string | null;
  target_title?: string | null;
  items: OCRDeclarationItem[];
  confidence_score: number;
}

export interface OCRValidationResult {
  ocr_result: OCRArticleExtractResult | OCRDeclarationResult | any;
  has_doi: boolean;
  extracted_doi?: string | null;
  crossref_matched: boolean;
  crossref_metadata?: any;
  double_check_mismatches: string[];
  integrity?: any;
  author_role?: any;
  report_markdown?: string | null;
}
