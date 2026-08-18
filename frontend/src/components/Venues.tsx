import * as React from 'react';
import { useState, useEffect } from 'react';
import { venuesApi } from '../utils/api';
import { showToast } from '../utils/toast';

interface Venue {
  id: number; name: string; abbreviation?: string; type: string;
  ranking?: string; impact_factor?: number; sjr_score?: number;
  url?: string; deadline?: string; location?: string;
}

const rankColors: Record<string, string> = {
  'A*': '#8b5cf6', A: '#6366f1', B: '#3b82f6', C: '#64748b',
  Q1: '#10b981', Q2: '#84cc16', Q3: '#f59e0b', Q4: '#ef4444'
};

function RankBadge({ ranking }: { ranking?: string }) {
  if (!ranking) return null;
  const c = rankColors[ranking] ?? '#94a3b8';
  return <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, background: c + '20', color: c }}>{ranking}</span>;
}

function daysUntil(dateStr?: string) {
  if (!dateStr) return null;
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  return diff;
}

const emptyForm = { name: '', abbreviation: '', type: 'journal', ranking: '', impact_factor: '' as any, sjr_score: '' as any, url: '', deadline: '', location: '' };

export default function Venues() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Venue | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const load = (silent = false) => {
    if (!silent) setLoading(true);
    venuesApi.list().then(setVenues).finally(() => { if (!silent) setLoading(false); });
  };
  useEffect(() => { load(); }, []);

  const openCreate = (type: string) => { setEditing(null); setForm({ ...emptyForm, type }); setShowForm(true); };
  const openEdit = (v: Venue) => {
    setEditing(v);
    setForm({ name: v.name, abbreviation: v.abbreviation ?? '', type: v.type, ranking: v.ranking ?? '', impact_factor: v.impact_factor ?? '', sjr_score: v.sjr_score ?? '', url: v.url ?? '', deadline: v.deadline ?? '', location: v.location ?? '' });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const data = { ...form, impact_factor: form.impact_factor ? +form.impact_factor : undefined, sjr_score: form.sjr_score ? +form.sjr_score : undefined, ranking: form.ranking || undefined };
      editing ? await venuesApi.update(editing.id, data) : await venuesApi.create(data);
      setShowForm(false);
      showToast(editing ? 'Cập nhật nơi xuất bản thành công!' : 'Thêm nơi xuất bản thành công!', 'success');
      load(true);
    } catch (err: any) {
      showToast(`Lỗi khi lưu: ${err.message}`, 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async (v: Venue) => {
    if (!confirm(`Xóa "${v.name}"?`)) return;
    try {
      await venuesApi.delete(v.id);
      showToast('Xóa nơi xuất bản thành công!', 'success');
      load(true);
    } catch (err: any) {
      showToast(`Lỗi khi xóa: ${err.message}`, 'error');
    }
  };

  const [search, setSearch] = useState('');
  const [filterRank, setFilterRank] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'journal' | 'conference'>('all');

  const filteredVenues = venues.filter(v => {
    const matchSearch = !search ||
      v.name.toLowerCase().includes(search.toLowerCase()) ||
      (v.abbreviation && v.abbreviation.toLowerCase().includes(search.toLowerCase())) ||
      (v.location && v.location.toLowerCase().includes(search.toLowerCase()));
    const matchRank = !filterRank || v.ranking === filterRank;
    const matchTab = filterTab === 'all' || v.type === filterTab;
    return matchSearch && matchRank && matchTab;
  });

  const conferences = filteredVenues.filter(v => v.type === 'conference');
  const journals = filteredVenues.filter(v => v.type === 'journal');

  const VenueTable = ({ list, isConf }: { list: Venue[]; isConf: boolean }) => (
    list.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '0.875rem', textAlign: 'center', padding: '2rem' }}>Không có dữ liệu phù hợp</p> : (
      <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead><tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            {['Tên đầy đủ', 'Viết tắt', 'Xếp hạng', isConf ? 'Deadline' : 'IF (JCR)', isConf ? 'Địa điểm' : 'SJR', 'URL', 'Thao tác'].map(h => (
              <th key={h} style={{ padding: '0.625rem 0.875rem', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: '0.78rem' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {list.map(v => {
              const days = daysUntil(v.deadline);
              return (
                <tr key={v.id} style={{ borderBottom: '1px solid #f8fafc' }} onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')} onMouseLeave={e => (e.currentTarget.style.background = '')}>
                  <td style={{ padding: '0.75rem 0.875rem', fontWeight: 600, color: '#1e293b', maxWidth: '240px' }}>{v.name}</td>
                  <td style={{ padding: '0.75rem 0.875rem' }}><span style={{ fontFamily: 'monospace', fontSize: '0.78rem', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px' }}>{v.abbreviation || '—'}</span></td>
                  <td style={{ padding: '0.75rem 0.875rem' }}><RankBadge ranking={v.ranking} /></td>
                  <td style={{ padding: '0.75rem 0.875rem', fontSize: '0.8rem', color: '#475569' }}>
                    {isConf ? (v.deadline ? (
                      <span style={{ color: days !== null && days < 14 ? '#ef4444' : '#475569' }}>
                        {new Date(v.deadline).toLocaleDateString('vi-VN')}{days !== null && <span style={{ color: '#94a3b8', marginLeft: '4px' }}>({days}d)</span>}
                      </span>
                    ) : '—') : (v.impact_factor ? <span style={{ color: '#10b981', fontWeight: 600 }}>{Number(v.impact_factor).toFixed(3)}</span> : '—')}
                  </td>
                  <td style={{ padding: '0.75rem 0.875rem', color: '#64748b', fontSize: '0.8rem' }}>
                    {isConf ? (v.location || '—') : (v.sjr_score ? <span style={{ color: '#3b82f6', fontWeight: 600 }}>{Number(v.sjr_score).toFixed(3)}</span> : '—')}
                  </td>
                  <td style={{ padding: '0.75rem 0.875rem' }}>
                    {v.url ? <a href={v.url} target="_blank" rel="noreferrer" style={{ color: '#6366f1', fontSize: '0.8rem', textDecoration: 'none', fontWeight: 500 }}>Link ↗</a> : <span style={{ color: '#94a3b8' }}>—</span>}
                  </td>
                  <td style={{ padding: '0.75rem 0.875rem' }}>
                    <div style={{ display: 'flex', gap: '0.375rem' }}>
                      <button type="button" onClick={() => openEdit(v)} title="Chỉnh sửa" style={{ padding: '4px 8px', border: 'none', borderRadius: '6px', background: '#f1f5f9', color: '#475569', cursor: 'pointer' }}><i className="fa-solid fa-pen" style={{ fontSize: '0.8rem' }} /></button>
                      <button type="button" onClick={() => handleDelete(v)} title="Xóa" style={{ padding: '4px 8px', border: 'none', borderRadius: '6px', background: '#fef2f2', color: '#ef4444', cursor: 'pointer' }}><i className="fa-solid fa-trash" style={{ fontSize: '0.8rem' }} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Search & Filter Toolbar */}
      <div className="search-filter-card">
        <div className="search-filter-row">
          {/* Left: Search + Rank Filter + Count */}
          <div className="search-filter-left">
            <div className="unified-search-box" style={{ maxWidth: '380px' }}>
              <i className="fa-solid fa-magnifying-glass search-icon" />
              <input
                type="text"
                className="unified-search-input"
                placeholder="Tìm theo tên nơi XB, tên viết tắt, địa điểm..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
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

            <select
              className="unified-select"
              value={filterRank}
              onChange={(e) => setFilterRank(e.target.value)}
              style={{ minWidth: '140px' }}
            >
              <option value="">Tất cả xếp hạng</option>
              {['Q1', 'Q2', 'Q3', 'Q4', 'A*', 'A', 'B', 'C'].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <div className="filter-count-badge">
              <i className="fa-solid fa-book-open" style={{ marginRight: '5px', color: '#6366f1' }} />
              {filteredVenues.length} nơi XB
            </div>

            {(search || filterRank || filterTab !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setFilterRank('');
                  setFilterTab('all');
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
                }}
              >
                <i className="fa-solid fa-rotate-left" style={{ fontSize: '0.75rem' }} /> Xóa lọc
              </button>
            )}
          </div>

          {/* Right: Action Buttons */}
          <div className="search-filter-right">
            <button
              type="button"
              onClick={() => openCreate('conference')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                height: '40px',
                padding: '0 0.875rem',
                borderRadius: '9px',
                border: '1px solid #c7d2fe',
                background: '#eef2ff',
                color: '#4338ca',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.18s ease',
              }}
            >
              <i className="fa-solid fa-plus" /> Thêm Hội nghị
            </button>

            <button
              type="button"
              onClick={() => openCreate('journal')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                height: '40px',
                padding: '0 1.125rem',
                borderRadius: '9px',
                border: 'none',
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: 'white',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
                transition: 'all 0.18s ease',
              }}
            >
              <i className="fa-solid fa-plus" /> Thêm Tạp chí
            </button>
          </div>
        </div>

        {/* Tab Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.35rem', borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginRight: '0.25rem' }}>
            Loại ấn phẩm:
          </span>
          <div className="filter-pill-group">
            <button
              type="button"
              className={`filter-pill-btn ${filterTab === 'all' ? 'active' : ''}`}
              onClick={() => setFilterTab('all')}
            >
              Tất cả ({venues.length})
            </button>
            <button
              type="button"
              className={`filter-pill-btn ${filterTab === 'journal' ? 'active' : ''}`}
              onClick={() => setFilterTab('journal')}
            >
              📖 Tạp chí ({venues.filter(v => v.type === 'journal').length})
            </button>
            <button
              type="button"
              className={`filter-pill-btn ${filterTab === 'conference' ? 'active' : ''}`}
              onClick={() => setFilterTab('conference')}
            >
              🏛️ Hội nghị ({venues.filter(v => v.type === 'conference').length})
            </button>
          </div>
        </div>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Đang tải...</div> : (
        <>
          <div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.75rem' }}>Hội nghị ({conferences.length})</h3>
            <VenueTable list={conferences} isConf={true} />
          </div>
          <div>
            <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.75rem' }}>Tạp chí ({journals.length})</h3>
            <VenueTable list={journals} isConf={false} />
          </div>
        </>
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: 0, background: 'white' }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>{editing ? 'Chỉnh sửa' : (form.type === 'journal' ? 'Thêm tạp chí' : 'Thêm hội nghị')}</h2>
              <button onClick={() => setShowForm(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }}>✕</button>
            </div>
            <form onSubmit={handleSave} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>Tên đầy đủ *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>Viết tắt</label>
                  <input value={form.abbreviation} onChange={e => setForm(f => ({ ...f, abbreviation: e.target.value }))} style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>Xếp hạng</label>
                  <select value={form.ranking} onChange={e => setForm(f => ({ ...f, ranking: e.target.value }))} style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', outline: 'none' }}>
                    <option value="">Chưa xếp hạng</option>
                    {form.type === 'journal' ? ['Q1','Q2','Q3','Q4'] : ['A*','A','B','C']}
                    {(form.type === 'journal' ? ['Q1','Q2','Q3','Q4'] : ['A*','A','B','C']).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>URL</label>
                <input type="url" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://..." style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none' }} />
              </div>
              {form.type === 'journal' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>Impact Factor</label>
                    <input type="number" step="0.001" min="0" value={form.impact_factor} onChange={e => setForm(f => ({ ...f, impact_factor: e.target.value }))} placeholder="14.255" style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>SJR Score</label>
                    <input type="number" step="0.001" min="0" value={form.sjr_score} onChange={e => setForm(f => ({ ...f, sjr_score: e.target.value }))} style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none' }} />
                  </div>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>Deadline nộp bài</label>
                    <input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', outline: 'none' }} />
                  </div>
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>Địa điểm</label>
                    <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Vienna, Austria" style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none' }} />
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '0.5rem 1rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}>Hủy</button>
                <button type="submit" disabled={saving} style={{ padding: '0.5rem 1.25rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Lưu...' : 'Lưu'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
