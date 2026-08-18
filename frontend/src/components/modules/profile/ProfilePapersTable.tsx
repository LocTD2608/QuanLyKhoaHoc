import * as React from 'react';
import { useState, useMemo } from 'react';
import { Paper } from '../../../types';
import { StatusBadge, RankBadge } from '../../common/Badge';
import { Pagination } from '../../common/Pagination';

interface ProfilePapersTableProps {
  papers: Paper[];
}

export const ProfilePapersTable: React.FC<ProfilePapersTableProps> = ({ papers }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'last3' | 'published' | 'main'>('all');

  // Filter papers based on search and selected filter type
  const filteredPapers = useMemo(() => {
    if (!papers) return [];
    return papers.filter((p) => {
      // Search matching
      const matchesSearch =
        !searchTerm.trim() ||
        p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.journal_name && p.journal_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.doi && p.doi.toLowerCase().includes(searchTerm.toLowerCase()));

      if (!matchesSearch) return false;

      // Filter matching
      if (filterType === 'last3') return !!p.is_within_3_years;
      if (filterType === 'published') return p.status === 'published';
      if (filterType === 'main') {
        const isMain = p.main_author_id && p.authors?.some((a) => a.id === p.main_author_id);
        return isMain || (p.author_roles && Object.values(p.author_roles).includes('main'));
      }
      return true;
    });
  }, [papers, searchTerm, filterType]);

  // Reset to first page when search or filter changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, pageSize]);

  const totalItems = filteredPapers.length;
  const totalPages = Math.ceil(totalItems / pageSize) || 1;
  const paginatedPapers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPapers.slice(start, start + pageSize);
  }, [filteredPapers, currentPage, pageSize]);

  if (!papers || papers.length === 0) {
    return (
      <div style={{ padding: '2.5rem', textAlign: 'center', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', color: '#64748b' }}>
        <i className="fa-solid fa-folder-open" style={{ fontSize: '1.75rem', color: '#cbd5e1', marginBottom: '0.5rem' }} />
        <div>Chưa có bài báo khoa học nào trong hồ sơ của bạn.</div>
      </div>
    );
  }

  return (
    <div style={{ background: 'white', borderRadius: '20px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
      {/* Header with Title and Search/Filters */}
      <div
        style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
            Danh sách công trình khoa học ({papers.length} bài)
          </h3>
          <p style={{ margin: 0, fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
            Toàn bộ các bài báo đã được đối chiếu quy chuẩn tính điểm HĐGSNN
          </p>
        </div>

        {/* Filter controls */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Search box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '0.35rem 0.75rem',
              gap: '6px',
            }}
          >
            <i className="fa-solid fa-magnifying-glass" style={{ color: '#94a3b8', fontSize: '0.8rem' }} />
            <input
              type="text"
              placeholder="Tìm theo tiêu đề, tạp chí..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                fontSize: '0.825rem',
                width: '180px',
              }}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
              >
                <i className="fa-solid fa-xmark" style={{ fontSize: '0.75rem' }} />
              </button>
            )}
          </div>

          {/* Quick filter tabs */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            style={{
              padding: '0.4rem 0.75rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              fontSize: '0.825rem',
              fontWeight: 500,
              color: '#334155',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">Tất cả ({papers.length})</option>
            <option value="last3">⏱️ 3 năm gần nhất ({papers.filter((p) => p.is_within_3_years).length})</option>
            <option value="published">🟢 Đã xuất bản ({papers.filter((p) => p.status === 'published').length})</option>
          </select>

          {/* Page size dropdown */}
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            style={{
              padding: '0.4rem 0.5rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              fontSize: '0.825rem',
              fontWeight: 500,
              color: '#334155',
              outline: 'none',
              cursor: 'pointer',
            }}
            title="Số bài trên mỗi trang"
          >
            <option value={5}>5 bài / trang</option>
            <option value={10}>10 bài / trang</option>
            <option value={20}>20 bài / trang</option>
          </select>
        </div>
      </div>

      {/* Table Section */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }}>
              <th style={{ padding: '0.75rem 1.25rem', textAlign: 'left' }}>Tên bài báo & Tạp chí</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Năm</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>3 Năm Gần Nhất</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Trạng thái</th>
              <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Điểm quy đổi</th>
            </tr>
          </thead>
          <tbody>
            {paginatedPapers.length > 0 ? (
              paginatedPapers.map((p) => (
                <tr
                  key={p.id}
                  style={{
                    borderBottom: '1px solid #f1f5f9',
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#fcfdfe')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
                >
                  <td style={{ padding: '0.875rem 1.25rem' }}>
                    <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '3px', lineHeight: 1.35 }}>
                      {p.title}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.78rem', color: '#64748b', flexWrap: 'wrap' }}>
                      <span>{p.journal_name}</span>
                      <RankBadge ranking={p.ranking} />
                      {p.doi && (
                        <a
                          href={`https://doi.org/${p.doi}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#6366f1', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                        >
                          DOI <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.65rem' }} />
                        </a>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: 'center', fontWeight: 500, color: '#475569' }}>
                    {p.year}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                    {p.is_within_3_years ? (
                      <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#ecfdf5', color: '#059669', fontSize: '0.72rem', fontWeight: 700 }}>
                        ✓ 3 năm
                      </span>
                    ) : (
                      <span style={{ color: '#cbd5e1', fontSize: '0.75rem' }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: 'center' }}>
                    <StatusBadge status={p.status} />
                  </td>
                  <td style={{ padding: '0.875rem 1rem', textAlign: 'center', fontWeight: 700, color: '#4f46e5' }}>
                    {typeof p.calculated_score === 'number' ? p.calculated_score.toFixed(2) : (p.calculated_score || '—')}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}>
                  Không tìm thấy bài báo nào khớp với bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
};
