import * as React from 'react';
import { Paper } from '../../../types';
import { StatusBadge, RankBadge } from '../../common/Badge';

interface PaperTableProps {
  papers: Paper[];
  loading: boolean;
  onEdit: (paper: Paper) => void;
  onDelete: (id: number) => void;
  onShowDiscrepancy: (paper: Paper) => void;
}

export const PaperTable: React.FC<PaperTableProps> = ({
  papers,
  loading,
  onEdit,
  onDelete,
  onShowDiscrepancy,
}) => {
  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem', color: '#4f46e5', marginBottom: '0.75rem' }} />
        <div>Đang tải danh sách bài báo...</div>
      </div>
    );
  }

  if (papers.length === 0) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
        <i className="fa-solid fa-file-circle-question" style={{ fontSize: '2rem', color: '#94a3b8', marginBottom: '0.75rem' }} />
        <div style={{ fontWeight: 600, color: '#334155', marginBottom: '0.25rem' }}>Không tìm thấy bài báo nào</div>
        <div style={{ fontSize: '0.85rem' }}>Thử tìm kiếm với từ khóa khác hoặc bấm nút thêm bài báo mới.</div>
      </div>
    );
  }

  return (
    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ padding: '0.875rem 1rem', width: '35%' }}>Bài báo / DOI</th>
              <th style={{ padding: '0.875rem 1rem' }}>Tạp chí / Xếp hạng</th>
              <th style={{ padding: '0.875rem 1rem' }}>Tác giả</th>
              <th style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>Năm</th>
              <th style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>Trạng thái</th>
              <th style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>Điểm quy đổi</th>
              <th style={{ padding: '0.875rem 1rem', textAlign: 'right' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {papers.map((p) => {
              const hasMismatches = p.ai_mismatches && p.ai_mismatches.length > 0;
              return (
                <tr
                  key={p.id}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    transition: 'background-color 0.15s',
                  }}
                  className="table-row-hover"
                >
                  {/* Title / DOI */}
                  <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '0.25rem', lineHeight: 1.35 }}>
                      {p.title}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem', color: '#64748b' }}>
                      {p.doi && (
                        <a
                          href={`https://doi.org/${p.doi}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#4f46e5', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          <i className="fa-solid fa-link" style={{ fontSize: '0.7rem' }} /> DOI: {p.doi}
                        </a>
                      )}
                      {p.issn && <span>ISSN: {p.issn}</span>}
                      {hasMismatches && (
                        <button
                          onClick={() => onShowDiscrepancy(p)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: '#fee2e2',
                            color: '#dc2626',
                            border: '1px solid #fca5a5',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <i className="fa-solid fa-triangle-exclamation" /> {p.ai_mismatches?.length} trường sai lệch AI
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Journal / Ranking */}
                  <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                    <div style={{ fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>
                      {p.journal_name || '—'}
                    </div>
                    <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                      <RankBadge ranking={p.ranking} />
                      {p.sjr_score && (
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>SJR: {p.sjr_score}</span>
                      )}
                    </div>
                  </td>

                  {/* Authors */}
                  <td style={{ padding: '1rem', verticalAlign: 'top' }}>
                    {p.main_author && (
                      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#065f46', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <i className="fa-solid fa-star" style={{ fontSize: '0.7rem', color: '#10b981' }} />
                        {p.main_author.name} (Tác giả chính)
                      </div>
                    )}
                    {p.authors && p.authors.length > 0 && (
                      <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                        {p.authors.map((a) => a.name).join(', ')}
                      </div>
                    )}
                  </td>

                  {/* Year */}
                  <td style={{ padding: '1rem', textAlign: 'center', verticalAlign: 'top', fontWeight: 500, color: '#475569' }}>
                    {p.year}
                  </td>

                  {/* Status */}
                  <td style={{ padding: '1rem', textAlign: 'center', verticalAlign: 'top' }}>
                    <StatusBadge status={p.status} />
                  </td>

                  {/* Score */}
                  <td style={{ padding: '1rem', textAlign: 'center', verticalAlign: 'top' }}>
                    {p.calculated_score !== undefined ? (
                      <div style={{ fontWeight: 700, color: '#4f46e5' }}>
                        {p.calculated_score.toFixed(2)}
                        {p.max_score ? <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}> / {p.max_score}</span> : ''}
                      </div>
                    ) : (
                      <span style={{ color: '#cbd5e1' }}>—</span>
                    )}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '1rem', textAlign: 'right', verticalAlign: 'top' }}>
                    <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                      <button
                        onClick={() => onEdit(p)}
                        title="Chỉnh sửa bài báo"
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          border: '1px solid #e2e8f0',
                          background: 'white',
                          color: '#475569',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <i className="fa-solid fa-pen-to-square" style={{ fontSize: '0.8rem' }} />
                      </button>
                      <button
                        onClick={() => onDelete(p.id)}
                        title="Xóa bài báo"
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '6px',
                          border: '1px solid #fee2e2',
                          background: '#fff5f5',
                          color: '#ef4444',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <i className="fa-solid fa-trash" style={{ fontSize: '0.8rem' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
