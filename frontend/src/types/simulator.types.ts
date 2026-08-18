export interface Article {
  title: string;
  journal_name: string;
  issn?: string;
  year: number;
  num_authors: number;
  role: 'main' | 'member';
}

export interface ScorecardItem {
  current: number;
  required: number;
  status: string;
}

export interface SummaryScorecard {
  total_score: ScorecardItem;
  main_author_articles: ScorecardItem;
  last_3_years_score: ScorecardItem;
  specialized_score?: ScorecardItem;
}

export interface ArticleTableItem {
  journal_name: string;
  issn?: string;
  rank?: string;
  year: number;
  role: string;
  max_score: number;
  calculated_score: number;
  is_within_3_years: boolean;
  is_field_match: boolean;
  journal_url?: string;
}

export interface EvaluationResponse {
  eligibility_status: string;
  summary_scorecard: SummaryScorecard;
  articles_table: ArticleTableItem[];
  detailed_explanation_markdown: string;
}
