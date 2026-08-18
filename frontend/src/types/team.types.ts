export interface TeamMember {
  id: number;
  name: string;
  email?: string;
  affiliation?: string;
  is_member?: boolean;
  group_type?: string;
  member_role?: string; // GS, PGS, TS, GV, SV
  team_role?: string;   // Trưởng nhóm, Nghiên cứu viên chính, Thành viên, NCS, Sinh viên NCKH
  kpi_papers: number;
  achieved?: number;
  in_progress?: number;
  total_papers?: number;
}

export interface TeamPaper {
  id: number;
  title: string;
  journal_name: string;
  doi?: string;
  year: number;
  status: string; // published, in_review, accepted, rejected
  ranking?: string; // Q1, Q2, Q3, Q4, Vietnam...
  sjr_score?: number;
  issn?: string;
  notes?: string;
  author_ids?: number[];
  main_author_id?: number;
  corresponding_author_id?: number;
  team_author_ids?: number[];
  team_author_names?: string[];
  is_collaborative?: boolean;
}

export interface Team {
  id: number;
  name: string;
  description?: string;
  leader_id?: number;
  leader?: {
    id: number;
    name: string;
    email?: string;
    member_role?: string;
  } | null;
  kpi_papers_per_year: number;
  members: TeamMember[];
  papers?: TeamPaper[];
  achieved?: number;
  in_progress_count?: number;
  collaborative_count?: number;
  total_papers_count?: number;
}
