import { request, json } from './client';
import { ProfileData } from '../types/profile.types';

export * from './papers.api';

export const profileApi = {
  get: () => request<ProfileData>('/profile'),
  syncScholar: (scholarId: string, source: string) =>
    request('/profile/sync-scholar', { method: 'POST', body: json({ scholar_id: scholarId, source }) }),
  getScholarPapers: (scholarId: string, source: string) =>
    request(`/profile/scholar-papers?scholar_id=${encodeURIComponent(scholarId)}&source=${encodeURIComponent(source)}`),
  searchScholar: (query: string) =>
    request<any[]>(`/profile/scholar-search?query=${encodeURIComponent(query)}`),
  previewScholar: (scholarId: string, source: string = 'auto') =>
    request<any>('/profile/scholar-preview', { method: 'POST', body: json({ scholar_id: scholarId, source }) }),
};

export const authApi = {
  login: (username: string, password: string) =>
    request('/auth/login', { method: 'POST', body: json({ username, password }) }),
};

export const statsApi = {
  overview: () => request('/stats/overview'),
};

export const authorsApi = {
  list: () => request('/authors'),
  get: (id: number) => request(`/authors/${id}`),
  create: (data: unknown) => request('/authors', { method: 'POST', body: json(data) }),
  update: (id: number, data: unknown) => request(`/authors/${id}`, { method: 'PUT', body: json(data) }),
  delete: (id: number) => request(`/authors/${id}`, { method: 'DELETE' }),
};

export const venuesApi = {
  list: () => request('/venues'),
  create: (data: unknown) => request('/venues', { method: 'POST', body: json(data) }),
  update: (id: number, data: unknown) => request(`/venues/${id}`, { method: 'PUT', body: json(data) }),
  delete: (id: number) => request(`/venues/${id}`, { method: 'DELETE' }),
};

export const teamsApi = {
  list: () => request('/teams'),
  get: (id: number) => request(`/teams/${id}`),
  create: (data: unknown) => request('/teams', { method: 'POST', body: json(data) }),
  update: (id: number, data: unknown) => request(`/teams/${id}`, { method: 'PUT', body: json(data) }),
  delete: (id: number) => request(`/teams/${id}`, { method: 'DELETE' }),
  addMember: (teamId: number, authorId: number, kpi: number, teamRole: string = 'Thành viên') =>
    request(`/teams/${teamId}/members`, { method: 'POST', body: json({ author_id: authorId, kpi_papers: kpi, team_role: teamRole }) }),
  updateMember: (teamId: number, authorId: number, kpi?: number, teamRole?: string) =>
    request(`/teams/${teamId}/members/${authorId}`, { method: 'PUT', body: json({ kpi_papers: kpi, team_role: teamRole }) }),
  removeMember: (teamId: number, authorId: number) =>
    request(`/teams/${teamId}/members/${authorId}`, { method: 'DELETE' }),
};

export const journalsApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/journals${qs}`);
  },
  fields: (listType?: string) => {
    const qs = listType ? `?list_type=${listType}` : '';
    return request(`/journals/fields${qs}`);
  },
};

export async function checkJournal(journalName: string, issnList: string[]) {
  return request('/v1/check/journal', {
    method: 'POST',
    body: json({ journal_name: journalName, issn_list: issnList }),
  });
}

export type ChatHistoryItem = { role: 'user' | 'assistant'; content: string };

export const chatApi = {
  send: (message: string, history: ChatHistoryItem[] = []) =>
    request('/chat', { method: 'POST', body: json({ message, history }) }),
};

export async function evaluateProfile(payload: unknown) {
  return request('/v1/simulator/evaluate', { method: 'POST', body: json(payload) });
}

export async function extractCV(text: string) {
  return request('/v1/simulator/extract-cv', { method: 'POST', body: json({ text }) });
}

export async function aiConsult(targetTitle: string, academicField: string, evalYear: number, inputs: any) {
  return request('/v1/simulator/ai-consult', {
    method: 'POST',
    body: json({ target_title: targetTitle, academic_field: academicField, eval_year: evalYear, inputs }),
  });
}
