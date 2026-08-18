import { Paper, Author } from './paper.types';

export interface Totals {
  total_score: number;
  last3_score: number;
  journal_score: number;
  conference_score: number;
  main_author_papers_count: number;
  total_papers_count: number;
  scored_papers_count: number;
}

export interface ChecklistData {
  eligible: boolean;
  total_score_current: number;
  total_score_required: number;
  total_score_pass: boolean;
  last3_score_current: number;
  last3_score_required: number;
  last3_score_pass: boolean;
  journal_score_current: number;
  journal_score_required: number;
  journal_score_pass: boolean;
  main_author_current: number;
  main_author_required: number;
  main_author_pass: boolean;
}

export interface UserProfile {
  username: string;
  role: string;
  author_id?: number;
  author?: Author;
}

export interface ProfileData {
  user: UserProfile;
  papers: Paper[];
  totals: Totals;
  pgs: ChecklistData;
  gs: ChecklistData;
}
