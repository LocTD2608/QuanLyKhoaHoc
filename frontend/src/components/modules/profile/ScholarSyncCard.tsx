import * as React from 'react';
import { useState } from 'react';
import { Author } from '../../../types';
import { profileApi } from '../../../api';
import { showToast } from '../../../utils/toast';

interface ScholarSyncCardProps {
  author?: Author;
  scholarId: string;
  onScholarIdChange: (val: string) => void;
  scholarSource: string;
  onSourceChange: (val: string) => void;
  syncing: boolean;
  onSync: () => void;
  syncResult: null | { imported: number; skipped: number; imported_titles: string[] };
}

export const ScholarSyncCard: React.FC<ScholarSyncCardProps> = ({
  author,
  scholarId,
  onScholarIdChange,
  scholarSource,
  onSourceChange,
  syncing,
  onSync,
  syncResult,
}) => {
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);

  const handleSearchAuthors = async () => {
    const query = scholarId.trim() || author?.name || '';
    if (!query) {
      showToast('Vui lòng nhập tên hoặc liên kết hồ sơ để tìm kiếm', 'warning');
      return;
    }
    try {
      setSearching(true);
      const results = await profileApi.searchScholar(query);
      if (results && results.length > 0) {
        setSearchResults(results);
        setShowSearchDropdown(true);
      } else {
        setSearchResults([]);
        showToast('Không tìm thấy hồ sơ tác giả phù hợp', 'info');
      }
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi tìm kiếm tác giả', 'error');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectAuthor = (res: any) => {
    onScholarIdChange(res.scholar_id);
    onSourceChange(res.source || 'auto');
    setShowSearchDropdown(false);
    showToast(`Đã chọn hồ sơ: ${res.name} (${res.affiliation || 'Chưa cập nhật'})`, 'success');
  };

  // Yearly citations data calculation for mini-graph
  const yearlyCitations = Array.isArray(author?.scholar_yearly_citations)
    ? author.scholar_yearly_citations
    : [];
  const maxCitation = yearlyCitations.length > 0
    ? Math.max(...yearlyCitations.map((y) => Number(y?.citations) || 0), 1)
    : 1;

  const topics = Array.isArray(author?.scholar_topics) ? author.scholar_topics : [];

  return (
    <div
      style={{
        background: 'white',
        border: '1px solid #e2e8f0',
        borderRadius: '20px',
        padding: '1.5rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
        boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
        position: 'relative',
      }}
    >
      {/* Header section */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1.25rem',
        }}
      >
        <div style={{ flex: '1 1 300px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '1.1rem',
                boxShadow: '0 3px 8px rgba(79, 70, 229, 0.3)',
              }}
            >
              <i className="fa-brands fa-google-scholar" />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
                Đồng bộ Google Scholar & OpenAlex Thông minh
              </h2>
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                Tự động bóc tách URL, tìm kiếm theo tên, làm giàu Scimago SJR (Q1-Q4) và tính điểm HĐGSNN.
              </p>
            </div>
          </div>
        </div>

        {/* Input & Search controls */}
        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
          <div
            style={{
              display: 'flex',
              border: '1px solid #cbd5e1',
              borderRadius: '10px',
              overflow: 'hidden',
              background: '#f8fafc',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <select
              value={scholarSource}
              onChange={(e) => onSourceChange(e.target.value)}
              style={{
                padding: '0.55rem 0.75rem',
                border: 'none',
                background: '#f1f5f9',
                fontSize: '0.825rem',
                fontWeight: 600,
                color: '#334155',
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="auto">⚡ Tự động</option>
              <option value="openalex">🌐 OpenAlex</option>
              <option value="google_scholar">🎓 Google Scholar</option>
              <option value="semantic_scholar">📚 Semantic Scholar</option>
            </select>
            <input
              type="text"
              placeholder="Dán URL Google Scholar hoặc nhập Tên tác giả..."
              value={scholarId}
              onChange={(e) => {
                onScholarIdChange(e.target.value);
                setShowSearchDropdown(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearchAuthors();
              }}
              style={{
                padding: '0.55rem 0.85rem',
                border: 'none',
                borderLeft: '1px solid #cbd5e1',
                fontSize: '0.85rem',
                outline: 'none',
                minWidth: '280px',
                background: 'white',
              }}
            />
            {scholarId && (
              <button
                type="button"
                onClick={() => onScholarIdChange('')}
                style={{
                  border: 'none',
                  background: 'white',
                  color: '#94a3b8',
                  padding: '0 0.5rem',
                  cursor: 'pointer',
                }}
              >
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleSearchAuthors}
            disabled={searching}
            title="Tìm kiếm tác giả theo tên / viện nghiên cứu"
            style={{
              padding: '0.55rem 0.85rem',
              borderRadius: '9px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#475569',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: searching ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            {searching ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-magnifying-glass" />}
            Tìm hồ sơ
          </button>

          <button
            onClick={onSync}
            disabled={syncing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.55rem 1.15rem',
              borderRadius: '9px',
              border: 'none',
              background: 'linear-gradient(135deg, #4f46e5, #6366f1)',
              color: 'white',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: syncing ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 6px rgba(79, 70, 229, 0.3)',
              transition: 'all 0.18s ease',
            }}
          >
            {syncing ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-arrows-rotate" />}
            {syncing ? 'Đang đồng bộ...' : 'Đồng bộ ngay'}
          </button>
        </div>
      </div>

      {/* Search dropdown results */}
      {showSearchDropdown && searchResults.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '75px',
            right: '1.5rem',
            width: '420px',
            maxHeight: '320px',
            overflowY: 'auto',
            background: 'white',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.12)',
            zIndex: 100,
            padding: '0.5rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0.5rem', fontSize: '0.75rem', fontWeight: 700, color: '#64748b', borderBottom: '1px solid #f1f5f9' }}>
            <span>GỢI Ý HỒ SƠ TÁC GIẢ TÌM THẤY</span>
            <button
              onClick={() => setShowSearchDropdown(false)}
              style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer' }}
            >
              Đóng
            </button>
          </div>
          {searchResults.map((res, idx) => (
            <div
              key={idx}
              onClick={() => handleSelectAuthor(res)}
              style={{
                padding: '0.6rem 0.75rem',
                borderRadius: '8px',
                cursor: 'pointer',
                borderBottom: '1px solid #f8fafc',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#1e293b' }}>{res.name}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{res.affiliation}</div>
                {Array.isArray(res.topics) && res.topics.length > 0 && (
                  <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                    {res.topics.slice(0, 2).map((t: any, ti: number) => {
                      const label = typeof t === 'string' ? t : (t?.name || t?.title || '');
                      if (!label) return null;
                      return (
                        <span key={ti} style={{ fontSize: '0.68rem', padding: '1px 6px', background: '#e0e7ff', color: '#4338ca', borderRadius: '4px' }}>
                          {label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', minWidth: '70px' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4f46e5' }}>{res.citations} trích dẫn</div>
                <div style={{ fontSize: '0.7rem', color: '#64748b' }}>H-Index: {res.h_index}</div>
                <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '3px', background: '#f1f5f9', color: '#475569' }}>
                  {res.source}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
        <div style={{ padding: '0.875rem 1rem', borderRadius: '14px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Tổng số trích dẫn (Citations)</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#1e293b', marginTop: '2px' }}>
            {author?.scholar_citations ?? 0}
          </div>
        </div>
        <div style={{ padding: '0.875rem 1rem', borderRadius: '14px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Chỉ số H-Index</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#4f46e5', marginTop: '2px' }}>
            {author?.scholar_h_index ?? 0}
          </div>
        </div>
        <div style={{ padding: '0.875rem 1rem', borderRadius: '14px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Chỉ số i10-Index</div>
          <div style={{ fontSize: '1.45rem', fontWeight: 800, color: '#059669', marginTop: '2px' }}>
            {author?.scholar_i10_index ?? 0}
          </div>
        </div>
        <div style={{ padding: '0.875rem 1rem', borderRadius: '14px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Lần đồng bộ gần nhất</div>
          <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginTop: '6px' }}>
            {author?.scholar_last_synced ? new Date(author.scholar_last_synced).toLocaleDateString('vi-VN') : 'Chưa đồng bộ'}
          </div>
        </div>
      </div>

      {/* Yearly Citations Visual Chart (if available) */}
      {yearlyCitations.length > 0 && (
        <div
          style={{
            padding: '1rem',
            borderRadius: '14px',
            background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
            border: '1px solid #e2e8f0',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#334155' }}>
              <i className="fa-solid fa-chart-column" style={{ color: '#6366f1', marginRight: '6px' }} />
              Lịch sử Tăng trưởng Trích dẫn theo năm
            </span>
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {yearlyCitations[0]?.year} - {yearlyCitations[yearlyCitations.length - 1]?.year}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '0.6rem',
              height: '80px',
              paddingTop: '10px',
            }}
          >
            {yearlyCitations.map((item, idx) => {
              const heightPercent = Math.max(Math.round((item.citations / maxCitation) * 100), 8);
              return (
                <div
                  key={idx}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px',
                    height: '100%',
                    justifyContent: 'flex-end',
                  }}
                  title={`Năm ${item.year}: ${item.citations} trích dẫn`}
                >
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#4f46e5' }}>
                    {item.citations}
                  </span>
                  <div
                    style={{
                      width: '100%',
                      height: `${heightPercent}%`,
                      background: 'linear-gradient(180deg, #6366f1 0%, #818cf8 100%)',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.3s ease',
                      minHeight: '4px',
                    }}
                  />
                  <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 500 }}>
                    {item.year}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Research Topics Tags */}
      {topics.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>
            <i className="fa-solid fa-tags" style={{ marginRight: '4px' }} /> Chủ đề nghiên cứu:
          </span>
          {topics.map((t: any, idx: number) => {
            const label = typeof t === 'string' ? t : (t?.name || t?.title || '');
            if (!label) return null;
            return (
              <span
                key={idx}
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: '20px',
                  background: '#eef2ff',
                  color: '#4338ca',
                  border: '1px solid #c7d2fe',
                }}
              >
                {label}
              </span>
            );
          })}
        </div>
      )}

      {/* Sync Result Banner */}
      {syncResult && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '10px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            fontSize: '0.825rem',
            color: '#065f46',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <i className="fa-solid fa-circle-check" style={{ fontSize: '1.1rem' }} />
          <div>
            Đã nhập tự động <strong>{syncResult.imported}</strong> bài báo mới (đã tự động xếp hạng Scimago SJR và tính điểm PGS), bỏ qua <strong>{syncResult.skipped}</strong> bài trùng lặp.
          </div>
        </div>
      )}
    </div>
  );
};
