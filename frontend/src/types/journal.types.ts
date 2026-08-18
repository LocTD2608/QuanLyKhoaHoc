export interface JournalResponse {
  status: string;
  message: string;
  is_in_doaj?: boolean;
  ranking?: { quartile: string; sjr_score: number; year: number };
  all_rankings?: Array<{ year: number; quartile: string; sjr_score: number }>;
  vietnam_info?: { council: string; max_score: number };
  api_metadata?: {
    works_count: number;
    cited_by_count: number;
    h_index: number;
    is_oa: boolean;
    type: string;
    publisher: string;
    country_code: string;
    homepage_url: string;
  };
  journal_name?: string;
  issn?: string;
  e_issn?: string | null;
  rank?: string;
  field?: string | null;
  h_index?: number | null;
  journal_url?: string | null;
}

export interface JournalItem {
  id?: number;
  name: string;
  issn: string;
  e_issn?: string;
  rank?: string;
  sjr_score?: number;
  field?: string;
  h_index?: number;
  publisher?: string;
  country?: string;
  is_predatory?: boolean;
  vn_council?: string;
  vn_max_score?: number;
  list_type?: string;
}
