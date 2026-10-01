export type AuthorRoleType = 'main' | 'member' | 'corresponding';

export interface ScholarYearlyCitation {
  year: number;
  citations: number;
  works?: number;
}

export interface ScholarTopic {
  name: string;
  score: number;
}

export interface ScholarCoAuthor {
  name: string;
  shared_papers: number;
}

export interface Author {
  id: number;
  name: string;
  email?: string;
  affiliation?: string;
  member_role?: string;
  group_type?: string;
  academic_field?: string;
  scholar_id?: string;
  scholar_citations?: number;
  scholar_h_index?: number;
  scholar_i10_index?: number;
  scholar_last_synced?: string;
  scholar_yearly_citations?: ScholarYearlyCitation[];
  scholar_topics?: ScholarTopic[];
  scholar_co_authors?: ScholarCoAuthor[];
}

export interface Paper {
  id: number;
  title: string;
  journal_name: string;
  doi?: string;
  year: number;
  status: string;
  ranking?: string;
  sjr_score?: number;
  issn?: string;
  notes?: string;
  author_ids: number[];
  main_author_id?: number;
  corresponding_author_id?: number;
  author_roles?: Record<string, string>;
  authors?: Author[];

  main_author?: Author;
  calculated_score?: number;
  max_score?: number;
  is_within_3_years?: boolean;
  is_ai_verified?: boolean;
  ai_mismatches?: string[];
  ai_metadata?: Record<string, any>;
  url?: string;
  activity_history?: Array<{
    timestamp: string;
    action: string;
    details?: string;
    user?: string;
  }>;
}

export interface DiscrepancyItem {
  aiValue: any;
  userValue: any;
}

export interface PaperFormData {
  title: string;
  journal_name: string;
  doi: string;
  year: number;
  status: string;
  author_ids: number[];
  main_author_id?: number;
  corresponding_author_id?: number;
  author_roles: Record<string, AuthorRoleType>;
  ranking: string;
  sjr_score?: number;
  issn: string;
  notes: string;
}

export interface ScholarPaperItem {
  title: string;
  journal?: string;
  year?: number;
  doi?: string;
  citation_count?: number;
  pub_url?: string;
  source?: string;
  authors?: string[];
  ranking?: string;
  sjr_score?: number;
  issn?: string;
}
