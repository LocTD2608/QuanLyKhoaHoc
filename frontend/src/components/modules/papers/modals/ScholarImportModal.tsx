import * as React from 'react';
import { useState } from 'react';
import { Modal } from '../../../common/Modal';
import { profileApi, papersApi } from '../../../../api';
import { showToast } from '../../../../utils/toast';

interface ScholarImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ScholarImportModal: React.FC<ScholarImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [scholarId, setScholarId] = useState('');
  const [source, setSource] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [searchingAuthors, setSearchingAuthors] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showAuthorPicker, setShowAuthorPicker] = useState(false);

  const [profileSummary, setProfileSummary] = useState<any>(null);
  const [papers, setPapers] = useState<any[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Record<number, boolean>>({});
  const [importing, setImporting] = useState(false);

  // Search authors by name or query
  const handleSearchAuthors = async () => {
    if (!scholarId.trim()) {
      showToast('Vui lòng nhập Tên tác giả hoặc Liên kết hồ sơ', 'warning');
      return;
    }

    try {
      setSearchingAuthors(true);
      const results = await profileApi.searchScholar(scholarId.trim());
      if (results && results.length > 0) {
        setSearchResults(results);
        setShowAuthorPicker(true);
      } else {
        // If not found as name search, try direct fetch
        handleFetchScholar();
      }
    } catch {
      handleFetchScholar();
    } finally {
      setSearchingAuthors(false);
    }
  };

  const handleSelectAuthor = (authorItem: any) => {
    setScholarId(authorItem.scholar_id);
    setSource(authorItem.source || 'auto');
    setShowAuthorPicker(false);
    // Automatically fetch profile for selected author
    fetchProfileForId(authorItem.scholar_id, authorItem.source || 'auto');
  };

  const fetchProfileForId = async (id: string, src: string) => {
    try {
      setLoading(true);
      const res: any = await profileApi.previewScholar(id, src);
      if (res && Array.isArray(res.papers)) {
        setProfileSummary(res);
        setPapers(res.papers);

        // Default select papers that are not duplicates
        const initialSelected: Record<number, boolean> = {};
        res.papers.forEach((p: any, idx: number) => {
          initialSelected[idx] = !p.is_duplicate;
        });
        setSelectedIndices(initialSelected);
        showToast(`Đã tìm thấy ${res.papers.length} bài báo từ hồ sơ ${res.name}!`, 'success');
      } else {
        setPapers([]);
        setProfileSummary(null);
        showToast('Không tìm thấy bài báo nào từ nguồn này', 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi tải dữ liệu bài báo', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchScholar = async () => {
    if (!scholarId.trim()) {
      showToast('Vui lòng nhập Scholar ID, Tên tác giả hoặc URL', 'warning');
      return;
    }
    fetchProfileForId(scholarId.trim(), source);
  };

  const toggleSelect = (idx: number) => {
    setSelectedIndices((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Filter actions
  const selectAll = () => {
    const next: Record<number, boolean> = {};
    papers.forEach((_, idx) => (next[idx] = true));
    setSelectedIndices(next);
  };

  const deselectAll = () => {
    setSelectedIndices({});
  };

  const selectOnlyNew = () => {
    const next: Record<number, boolean> = {};
    papers.forEach((p, idx) => {
      next[idx] = !p.is_duplicate;
    });
    setSelectedIndices(next);
  };

  const selectLast3Years = () => {
    const next: Record<number, boolean> = {};
    papers.forEach((p, idx) => {
      next[idx] = !p.is_duplicate && (p.is_within_3_years || (p.year >= 2023 && p.year <= 2026));
    });
    setSelectedIndices(next);
  };

  const selectHighImpact = () => {
    const next: Record<number, boolean> = {};
    papers.forEach((p, idx) => {
      next[idx] = !p.is_duplicate && (p.ranking === 'Q1' || p.ranking === 'Q2');
    });
    setSelectedIndices(next);
  };

  const handleImport = async () => {
    const toImport = papers
      .filter((_, idx) => selectedIndices[idx])
      .map((p) => ({
        title: p.title,
        journal_name: p.journal_name || p.journal || '',
        issn: p.issn || '',
        doi: p.doi || '',
        year: p.year || 2026,
        citations: p.citations || p.citation_count || 0,
        authors: p.authors || [],
      }));

    if (toImport.length === 0) {
      showToast('Vui lòng chọn ít nhất một bài báo để nhập', 'warning');
      return;
    }

    try {
      setImporting(true);
      await papersApi.importBulk(toImport);
      showToast(`Đã nhập thành công ${toImport.length} bài báo vào hệ thống!`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi nhập danh sách bài báo', 'error');
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = Object.values(selectedIndices).filter(Boolean).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Đồng bộ & Nhập bài báo từ Google Scholar / OpenAlex"
      subtitle="Tìm kiếm thông minh, tự động xếp hạng Scimago Q1-Q4 và tính điểm HĐGSNN"
      icon="fa-brands fa-google-scholar"
      maxWidth="900px"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Search controls */}
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', position: 'relative' }}>
          <div className="unified-search-box" style={{ flex: '1 1 320px', maxWidth: 'none' }}>
            <i className="fa-solid fa-magnifying-glass search-icon" />
            <input
              type="text"
              className="unified-search-input"
              placeholder="Dán link Scholar, OpenAlex ID hoặc nhập Tên tác giả..."
              value={scholarId}
              onChange={(e) => {
                setScholarId(e.target.value);
                setShowAuthorPicker(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearchAuthors();
              }}
            />
            {scholarId && (
              <button
                type="button"
                className="unified-search-clear"
                onClick={() => {
                  setScholarId('');
                  setPapers([]);
                  setProfileSummary(null);
                }}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>
          <select
            className="unified-select"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            style={{ minWidth: '160px' }}
          >
            <option value="auto">⚡ Tự động chọn nguồn</option>
            <option value="openalex">🌐 OpenAlex</option>
            <option value="google_scholar">🎓 Google Scholar</option>
            <option value="semantic_scholar">📚 Semantic Scholar</option>
          </select>

          <button
            type="button"
            onClick={handleSearchAuthors}
            disabled={searchingAuthors || loading}
            style={{
              height: '40px',
              padding: '0 1.25rem',
              borderRadius: '9px',
              border: 'none',
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: 'white',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: (searchingAuthors || loading) ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
            }}
          >
            {(searchingAuthors || loading) ? (
              <i className="fa-solid fa-spinner fa-spin" />
            ) : (
              <i className="fa-solid fa-cloud-arrow-down" />
            )}
            {loading ? 'Đang phân tích...' : searchingAuthors ? 'Đang tìm kiếm...' : 'Truy vấn dữ liệu'}
          </button>
        </div>

        {/* Author picker modal/dropdown */}
        {showAuthorPicker && searchResults.length > 0 && (
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '12px',
              padding: '0.75rem',
              maxHeight: '220px',
              overflowY: 'auto',
            }}
          >
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', marginBottom: '0.5rem' }}>
              CHỌN TÁC GIẢ PHÙ HỢP ĐỂ TẢI BÀI BÁO:
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.5rem' }}>
              {searchResults.map((auth, idx) => (
                <div
                  key={idx}
                  onClick={() => handleSelectAuthor(auth)}
                  style={{
                    padding: '0.6rem 0.75rem',
                    background: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>{auth.name}</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{auth.affiliation}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4f46e5' }}>{auth.citations} trích dẫn</div>
                    <div style={{ fontSize: '0.7rem', color: '#059669' }}>H-Index: {auth.h_index}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Profile Summary Card (if profile loaded) */}
        {profileSummary && (
          <div
            style={{
              padding: '0.85rem 1.15rem',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
              border: '1px solid #a7f3d0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.75rem',
            }}
          >
            <div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#065f46' }}>
                <i className="fa-solid fa-user-graduate" style={{ marginRight: '6px' }} />
                {profileSummary.name}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#047857' }}>
                {profileSummary.affiliation || 'Hồ sơ học thuật trực tuyến'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: '#047857' }}>Trích dẫn</div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#065f46' }}>
                  {profileSummary.citations}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: '#047857' }}>H-Index</div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#4f46e5' }}>
                  {profileSummary.h_index}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', color: '#047857' }}>i10-Index</div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#059669' }}>
                  {profileSummary.i10_index}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Filter Buttons Toolbar */}
        {papers.length > 0 && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '0.5rem',
            }}
          >
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={selectAll}
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: '#334155',
                }}
              >
                Tất cả ({papers.length})
              </button>
              <button
                type="button"
                onClick={selectOnlyNew}
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #a7f3d0',
                  background: '#f0fdf4',
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: '#065f46',
                }}
              >
                ✨ Chỉ bài mới ({papers.filter((p) => !p.is_duplicate).length})
              </button>
              <button
                type="button"
                onClick={selectLast3Years}
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #c7d2fe',
                  background: '#eef2ff',
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: '#4338ca',
                }}
              >
                ⏱️ 3 năm gần nhất (2023-2026)
              </button>
              <button
                type="button"
                onClick={selectHighImpact}
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #fed7aa',
                  background: '#fff7ed',
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: '#c2410c',
                }}
              >
                🔥 Tạp chí Q1 / Q2
              </button>
              <button
                type="button"
                onClick={deselectAll}
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #e2e8f0',
                  background: 'white',
                  cursor: 'pointer',
                  color: '#64748b',
                }}
              >
                Bỏ chọn
              </button>
            </div>

            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
              Đã chọn: <strong style={{ color: '#4f46e5' }}>{selectedCount}</strong> / {papers.length} bài
            </div>
          </div>
        )}

        {/* Papers list */}
        {papers.length > 0 && (
          <div
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              maxHeight: '380px',
              overflowY: 'auto',
              background: '#f8fafc',
            }}
          >
            {papers.map((p, idx) => {
              const isSelected = !!selectedIndices[idx];
              return (
                <div
                  key={idx}
                  onClick={() => toggleSelect(idx)}
                  style={{
                    padding: '0.85rem 1rem',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    cursor: 'pointer',
                    background: isSelected ? '#ffffff' : '#f8fafc',
                    opacity: p.is_duplicate ? 0.75 : 1,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    style={{ marginTop: '4px', cursor: 'pointer' }}
                  />

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      {/* Duplicate badge */}
                      {p.is_duplicate ? (
                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: '#e2e8f0', color: '#475569', fontWeight: 600 }}>
                          <i className="fa-solid fa-check-double" /> Đã có trong DB
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontWeight: 600 }}>
                          ✨ Bài mới
                        </span>
                      )}

                      {/* Ranking badge */}
                      {p.ranking && (
                        <span
                          style={{
                            fontSize: '0.68rem',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: p.ranking.startsWith('Q1')
                              ? '#dbeafe'
                              : p.ranking.startsWith('Q2')
                              ? '#e0e7ff'
                              : p.ranking.startsWith('conf')
                              ? '#fef3c7'
                              : '#f1f5f9',
                            color: p.ranking.startsWith('Q1')
                              ? '#1d4ed8'
                              : p.ranking.startsWith('Q2')
                              ? '#4338ca'
                              : p.ranking.startsWith('conf')
                              ? '#b45309'
                              : '#475569',
                            fontWeight: 700,
                          }}
                        >
                          {p.ranking}
                        </span>
                      )}

                      {/* Estimated PGS points badge */}
                      {p.estimated_score > 0 && (
                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: '#ecfdf5', color: '#047857', fontWeight: 700 }}>
                          +{p.estimated_score} đ (PGS)
                        </span>
                      )}

                      {/* 3-year window badge */}
                      {(p.is_within_3_years || (p.year >= 2023 && p.year <= 2026)) && (
                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: '#fae8ff', color: '#86198f', fontWeight: 600 }}>
                          3 năm gần nhất
                        </span>
                      )}
                    </div>

                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1e293b', lineHeight: 1.35 }}>
                      {p.title}
                    </div>

                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px', display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
                      {p.journal_name && <span>Tạp chí: <strong>{p.journal_name}</strong></span>}
                      {p.year ? <span>Năm: <strong>{p.year}</strong></span> : null}
                      {p.citations !== undefined && <span>Trích dẫn: <strong style={{ color: '#4f46e5' }}>{p.citations}</strong></span>}
                      {p.doi && (
                        <span>
                          DOI:{' '}
                          <a
                            href={`https://doi.org/${p.doi}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{ color: '#6366f1', textDecoration: 'none' }}
                          >
                            {p.doi} <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.65rem' }} />
                          </a>
                        </span>
                      )}
                    </div>

                    {p.authors && p.authors.length > 0 && (
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                        Tác giả: {p.authors.slice(0, 4).join(', ')}{p.authors.length > 4 ? ` (+${p.authors.length - 4})` : ''}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
            {papers.length > 0 ? `Đang hiển thị ${papers.length} bài báo tìm thấy.` : 'Chưa có dữ liệu bài báo.'}
          </div>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button
              onClick={onClose}
              style={{
                padding: '0.55rem 1.15rem',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: 'white',
                color: '#475569',
                fontSize: '0.85rem',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Đóng
            </button>
            {papers.length > 0 && (
              <button
                onClick={handleImport}
                disabled={importing || selectedCount === 0}
                style={{
                  padding: '0.55rem 1.35rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: selectedCount > 0 ? 'linear-gradient(135deg, #10b981, #059669)' : '#cbd5e1',
                  color: 'white',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  cursor: (importing || selectedCount === 0) ? 'not-allowed' : 'pointer',
                  boxShadow: selectedCount > 0 ? '0 2px 8px rgba(16, 185, 129, 0.3)' : 'none',
                }}
              >
                {importing ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }} /> Đang nhập...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-cloud-arrow-down" style={{ marginRight: '6px' }} /> Nhập {selectedCount} bài đã chọn
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
