// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useState, useEffect, useCallback } from 'react';
import { journalsApi } from '../utils/api';

interface Journal {
  id?: number; name: string; issn?: string; eissn?: string;
  list_type?: string; sources?: string; quartile?: string;
  jcr_score?: string; sjr_score?: string; h_index?: number;
  field?: string; organization?: string; type?: string;
  points?: string; url?: string; notes?: string;
}

const LIST_TYPES = [
  { value: '', label: 'Tất cả' }, { value: 'quoc_gia', label: 'Quốc gia' },
  { value: 'isi', label: 'ISI' }, { value: 'quoc_te', label: 'Quốc tế' },
  { value: 'draft_quoc_te', label: 'Quốc tế (Draft)' },
];
const QUARTILES = ['', 'Q1', 'Q2', 'Q3', 'Q4'];
const LIST_LABELS: Record<string, string> = { quoc_gia: 'Quốc gia', isi: 'ISI', quoc_te: 'Quốc tế', draft_quoc_te: 'QT Draft' };
const LIST_COLORS: Record<string, string> = { quoc_gia: '#059669', isi: '#1d4ed8', quoc_te: '#7c3aed', draft_quoc_te: '#b45309' };
const Q_COLORS: Record<string, string> = { Q1: '#6366f1', Q2: '#10b981', Q3: '#f59e0b', Q4: '#ef4444' };

const LIMIT = 50;

export default function JournalCatalog() {
  const [data, setData] = useState<Journal[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [listType, setListType] = useState('');
  const [quartile, setQuartile] = useState('');
  const [field, setField] = useState('');
  const [fields, setFields] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [detail, setDetail] = useState<Journal | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: String(LIMIT), sort_by: sortBy, sort_dir: sortDir };
    if (search) params.search = search;
    if (listType) params.list_type = listType;
    if (quartile) params.quartile = quartile;
    if (field) params.field = field;
    journalsApi.list(params)
      .then(r => { setData(r.data); setTotal(r.total); setPages(r.pages); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, search, listType, quartile, field, sortBy, sortDir]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, listType, quartile, field, sortBy, sortDir]);
  useEffect(() => { journalsApi.fields(listType || undefined).then(setFields).catch(() => {}); }, [listType]);

  const handleSort = (col: string) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  };

  const SortIcon = ({ col }: { col: string }) => (
    <span style={{ marginLeft: '2px', color: sortBy === col ? '#6366f1' : '#cbd5e1', fontSize: '0.7rem' }}>
      {sortBy === col ? (sortDir === 'asc' ? '▲' : '▼') : '⬍'}
    </span>
  );

  const getSource = (j: Journal) => j.sources || j.list_type || '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Header Info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '1.15rem', fontWeight: 700, color: '#1e293b' }}>
            Danh mục Tạp chí & Hội nghị HĐGSNN
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
            Tra cứu cơ sở dữ liệu {total.toLocaleString()} tạp chí & hội nghị được Hội đồng Giáo sư Nhà nước công nhận tính điểm
          </p>
        </div>
      </div>

      {/* Unified Search & Filters Card */}
      <div className="search-filter-card">
        <div className="search-filter-row">
          <div className="search-filter-left">
            {/* Main Search */}
            <div className="unified-search-box" style={{ maxWidth: '380px' }}>
              <i className="fa-solid fa-magnifying-glass search-icon" />
              <input
                type="text"
                className="unified-search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm theo tên tạp chí, hội nghị, mã ISSN..."
              />
              {search && (
                <button
                  type="button"
                  className="unified-search-clear"
                  onClick={() => setSearch('')}
                  title="Xóa tìm kiếm"
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
            </div>

            {/* Quartile Select */}
            <select
              className="unified-select"
              value={quartile}
              onChange={(e) => setQuartile(e.target.value)}
              style={{ minWidth: '145px' }}
            >
              {QUARTILES.map((q) => (
                <option key={q} value={q}>
                  {q ? `Quartile: ${q}` : 'Tất cả Quartile'}
                </option>
              ))}
            </select>

            {/* Scientific Field Select */}
            {fields.length > 0 && (
              <select
                className="unified-select"
                value={field}
                onChange={(e) => setField(e.target.value)}
                style={{ minWidth: '180px', maxWidth: '240px' }}
              >
                <option value="">Tất cả ngành khoa học</option>
                {fields.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            )}

            {/* Reset Filters */}
            {(search || listType || quartile || field) && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setListType('');
                  setQuartile('');
                  setField('');
                }}
                style={{
                  height: '40px',
                  padding: '0 0.875rem',
                  border: '1px solid #fee2e2',
                  background: '#fef2f2',
                  color: '#dc2626',
                  borderRadius: '9px',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.375rem',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              >
                <i className="fa-solid fa-rotate-left" style={{ fontSize: '0.75rem' }} /> Xóa bộ lọc
              </button>
            )}
          </div>

          <div className="search-filter-right">
            <div className="filter-count-badge">
              <i className="fa-solid fa-book-bookmark" style={{ marginRight: '5px', color: '#6366f1' }} />
              {total.toLocaleString()} ấn phẩm
            </div>
          </div>
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.35rem', borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginRight: '0.25rem' }}>
            Nguồn:
          </span>
          <div className="filter-pill-group">
            {LIST_TYPES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`filter-pill-btn ${listType === value ? 'active' : ''}`}
                onClick={() => setListType(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left', color: '#475569', fontWeight: 600, width: '32px' }}>#</th>
                <th onClick={() => handleSort('name')} style={{ padding: '0.625rem 0.875rem', textAlign: 'left', color: '#475569', fontWeight: 600, cursor: 'pointer', minWidth: '240px' }}>
                  Tên tạp chí / hội nghị <SortIcon col="name" />
                </th>
                <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left', color: '#475569', fontWeight: 600 }}>ISSN</th>
                <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left', color: '#475569', fontWeight: 600 }}>Danh mục</th>
                <th onClick={() => handleSort('quartile')} style={{ padding: '0.625rem 0.875rem', textAlign: 'left', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>
                  Quartile <SortIcon col="quartile" />
                </th>
                <th onClick={() => handleSort('jcr_score')} style={{ padding: '0.625rem 0.875rem', textAlign: 'left', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>
                  IF (JCR) <SortIcon col="jcr_score" />
                </th>
                <th onClick={() => handleSort('points')} style={{ padding: '0.625rem 0.875rem', textAlign: 'left', color: '#475569', fontWeight: 600, cursor: 'pointer' }}>
                  Điểm QĐ <SortIcon col="points" />
                </th>
                <th style={{ padding: '0.625rem 0.875rem', textAlign: 'left', color: '#475569', fontWeight: 600, maxWidth: '140px' }}>Ngành</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Đang tải...</td></tr>
              ) : data.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>{total === 0 && !search ? 'Chưa có dữ liệu.' : 'Không tìm thấy kết quả.'}</td></tr>
              ) : data.map((j, i) => {
                const src = getSource(j);
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #f8fafc' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = '')}>
                    <td style={{ padding: '0.625rem 0.875rem', color: '#94a3b8' }}>{(page - 1) * LIMIT + i + 1}</td>
                    <td style={{ padding: '0.625rem 0.875rem', maxWidth: '280px' }}>
                      <button onClick={() => setDetail(j)} style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontWeight: 600, color: '#1e293b', lineHeight: 1.4, padding: 0, fontSize: '0.82rem' }}>
                        {j.name}
                      </button>
                      {j.organization && <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '1px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.organization}</div>}
                    </td>
                    <td style={{ padding: '0.625rem 0.875rem', color: '#64748b', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                      <div>{j.issn || '—'}</div>
                      {j.eissn && <div style={{ color: '#94a3b8', fontSize: '0.7rem' }}>e: {j.eissn}</div>}
                    </td>
                    <td style={{ padding: '0.625rem 0.875rem' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                        {src.split(',').map(s => s.trim()).filter(Boolean).map(s => (
                          <span key={s} style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '99px', fontWeight: 600, background: (LIST_COLORS[s] ?? '#94a3b8') + '20', color: LIST_COLORS[s] ?? '#94a3b8' }}>
                            {LIST_LABELS[s] ?? s}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ padding: '0.625rem 0.875rem' }}>
                      {j.quartile ? <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '99px', fontWeight: 700, background: (Q_COLORS[j.quartile] ?? '#94a3b8') + '20', color: Q_COLORS[j.quartile] ?? '#94a3b8' }}>{j.quartile}</span> : <span style={{ color: '#e2e8f0' }}>—</span>}
                    </td>
                    <td style={{ padding: '0.625rem 0.875rem', fontWeight: 600, color: '#475569' }}>{j.jcr_score || <span style={{ color: '#e2e8f0' }}>—</span>}</td>
                    <td style={{ padding: '0.625rem 0.875rem', color: '#10b981', fontWeight: 600 }}>{j.points || <span style={{ color: '#e2e8f0' }}>—</span>}</td>
                    <td style={{ padding: '0.625rem 0.875rem', color: '#64748b', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={j.field ?? ''}>{j.field || <span style={{ color: '#e2e8f0' }}>—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {pages > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.875rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Trang {page}/{pages} · {total.toLocaleString()} kết quả</span>
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '0.8rem', opacity: page <= 1 ? 0.4 : 1 }}>‹</button>
              {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                const pg = Math.max(1, Math.min(page - 2, pages - 4)) + i;
                return (
                  <button key={pg} onClick={() => setPage(pg)} style={{ padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem', background: pg === page ? '#6366f1' : 'white', color: pg === page ? 'white' : '#475569', border: pg === page ? 'none' : '1px solid #e2e8f0' } as any}>{pg}</button>
                );
              })}
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages} style={{ padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '0.8rem', opacity: page >= pages ? 0.4 : 1 }}>›</button>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }} onClick={() => setDetail(null)}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '520px', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ flex: 1, paddingRight: '1rem' }}>
                <h3 style={{ margin: '0 0 0.375rem', fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.3 }}>{detail.name}</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {(detail.sources || detail.list_type || '').split(',').map(s => s.trim()).filter(Boolean).map(s => (
                    <span key={s} style={{ fontSize: '0.7rem', padding: '1px 6px', borderRadius: '99px', fontWeight: 600, background: (LIST_COLORS[s] ?? '#94a3b8') + '20', color: LIST_COLORS[s] ?? '#94a3b8' }}>{LIST_LABELS[s] ?? s}</span>
                  ))}
                </div>
              </div>
              <button onClick={() => setDetail(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '1.2rem' }}>✕</button>
            </div>
            <div style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {[['Loại', detail.type], ['ISSN', detail.issn], ['eISSN', detail.eissn], ['Cơ quan xuất bản', detail.organization], ['Ngành', detail.field], ['Điểm quy đổi', detail.points], ['Quartile', detail.quartile], ['IF (JCR)', detail.jcr_score], ['SJR', detail.sjr_score], ['H-index', detail.h_index != null ? String(detail.h_index) : null], ['Ghi chú', detail.notes]].filter(([, v]) => v).map(([label, val]) => (
                <div key={label as string} style={{ display: 'flex', gap: '0.75rem' }}>
                  <span style={{ color: '#64748b', minWidth: '160px', fontSize: '0.8rem', flexShrink: 0 }}>{label}</span>
                  <span style={{ color: '#1e293b', fontSize: '0.8rem' }}>{val}</span>
                </div>
              ))}
              {detail.url && (
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <span style={{ color: '#64748b', minWidth: '160px', fontSize: '0.8rem' }}>Link</span>
                  <a href={detail.url} target="_blank" rel="noreferrer" style={{ color: '#6366f1', fontSize: '0.8rem' }}>Mở trang web ↗</a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
