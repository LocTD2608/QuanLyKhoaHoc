import { request, json } from './client';
import { Paper } from '../types/paper.types';

export const papersApi = {
  list: () => request<Paper[]>('/papers'),
  get: (id: number) => request<Paper>(`/papers/${id}`),
  create: (data: unknown) => request<Paper>('/papers', { method: 'POST', body: json(data) }),
  submitAI: (doi: string, url: string, candidateTitleVn: string) =>
    request('/papers/submit-ai', { method: 'POST', body: json({ doi, url, candidate_title_vn: candidateTitleVn }) }),
  update: (id: number, data: unknown) => request<Paper>(`/papers/${id}`, { method: 'PUT', body: json(data) }),
  delete: (id: number) => request(`/papers/${id}`, { method: 'DELETE' }),
  addActivity: (id: number, details: string) =>
    request(`/papers/${id}/activity`, { method: 'POST', body: json({ details }) }),
  importBulk: (papers: any[]) => request('/papers/import-bulk', { method: 'POST', body: json({ papers }) }),
};

export async function validateArticle(doi: string, url: string, candidateName: string, candidateTitleVn: string) {
  return request('/v1/validate/article', {
    method: 'POST',
    body: json({ doi, url: url || '', candidate_name: candidateName, candidate_title_vn: candidateTitleVn }),
  });
}
