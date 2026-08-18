import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { authorsApi } from '../utils/api';
import { showToast } from '../utils/toast';

interface AuthorTeamInfo {
  id: number;
  name: string;
  team_role: string;
  kpi_papers: number;
  is_leader: boolean;
}

interface CoAuthorInfo {
  id: number;
  name: string;
  count: number;
}

interface Author {
  id: number;
  name: string;
  email?: string;
  affiliation?: string;
  is_member: boolean;
  group_type?: string;
  member_role?: string;
  academic_field?: string;
  scholar_id?: string;
  scholar_citations?: number;
  scholar_h_index?: number;
  scholar_i10_index?: number;
  teams?: AuthorTeamInfo[];
  papers_count?: number;
  achieved_this_year?: number;
  in_progress_count?: number;
  top_coauthors?: CoAuthorInfo[];
  papers?: any[];
}

const ROLES: Record<string, { bg: string; color: string }> = {
  GS: { bg: '#ede9fe', color: '#5b21b6' },
  PGS: { bg: '#dbeafe', color: '#1d4ed8' },
  TS: { bg: '#d1fae5', color: '#065f46' },
  GV: { bg: '#fef3c7', color: '#92400e' },
  SV: { bg: '#f1f5f9', color: '#475569' },
};

function Avatar({ name, size = 38 }: { name: string; size?: number }) {
  const initials = name.split(' ').pop()?.charAt(0).toUpperCase() ?? '?';
  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: '#e0e7ff',
        color: '#4338ca',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: `${size * 0.4}px`,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

const emptyForm = {
  name: '',
  email: '',
  affiliation: '',
  academic_field: '',
  is_member: true,
  group_type: '',
  member_role: '',
};

export default function Authors() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Author | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  // Detail Profile Modal
  const [selectedAuthor, setSelectedAuthor] = useState<Author | null>(null);

  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterTab, setFilterTab] = useState<'all' | 'members' | 'collabs'>('all');

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    authorsApi
      .list()
      .then(setAuthors)
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  };

  const openEdit = (a: Author, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditing(a);
    setForm({
      name: a.name,
      email: a.email ?? '',
      affiliation: a.affiliation ?? '',
      academic_field: a.academic_field ?? '',
      is_member: a.is_member,
      group_type: a.group_type ?? '',
      member_role: a.member_role ?? '',
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await authorsApi.update(editing.id, form);
        showToast('Cập nhật thành viên thành công!', 'success');
      } else {
        await authorsApi.create(form);
        showToast('Thêm thành viên mới thành công!', 'success');
      }
      setShowForm(false);
      load(true);
    } catch (err: any) {
      showToast(`Lỗi khi lưu: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (a: Author, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!confirm(`Bạn có chắc muốn xóa nhân sự "${a.name}"?`)) return;
    try {
      await authorsApi.delete(a.id);
      showToast('Đã xóa thành viên thành công!', 'success');
      if (selectedAuthor?.id === a.id) setSelectedAuthor(null);
      load(true);
    } catch (err: any) {
      showToast(`Lỗi khi xóa: ${err.message}`, 'error');
    }
  };

  const filteredAuthors = authors.filter((a) => {
    const matchSearch =
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.email && a.email.toLowerCase().includes(search.toLowerCase())) ||
      (a.affiliation && a.affiliation.toLowerCase().includes(search.toLowerCase())) ||
      (a.teams && a.teams.some((t) => t.name.toLowerCase().includes(search.toLowerCase())));
    const matchRole = !filterRole || a.member_role === filterRole;
    const matchTab = filterTab === 'all' || (filterTab === 'members' ? a.is_member : !a.is_member);
    return matchSearch && matchRole && matchTab;
  });

  const members = filteredAuthors.filter((a) => a.is_member);
  const collabs = filteredAuthors.filter((a) => !a.is_member);

  const year = new Date().getFullYear();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Search & Filter Toolbar */}
      <div className="search-filter-card">
        <div className="search-filter-row">
          <div className="search-filter-left">
            <div className="unified-search-box" style={{ maxWidth: '380px' }}>
              <i className="fa-solid fa-magnifying-glass search-icon" />
              <input
                type="text"
                className="unified-search-input"
                placeholder="Tìm tên, email, đơn vị, nhóm nghiên cứu..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button type="button" className="unified-search-clear" onClick={() => setSearch('')}>
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
            </div>

            <select
              className="unified-select"
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              style={{ minWidth: '150px' }}
            >
              <option value="">Tất cả học hàm/vị trí</option>
              {['GS', 'PGS', 'TS', 'GV', 'SV'].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>

            <div className="filter-count-badge">
              <i className="fa-solid fa-users" style={{ marginRight: '5px', color: '#6366f1' }} />
              {filteredAuthors.length} người
            </div>

            {(search || filterRole || filterTab !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setFilterRole('');
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
                }}
              >
                <i className="fa-solid fa-rotate-left" style={{ fontSize: '0.75rem' }} /> Xóa lọc
              </button>
            )}
          </div>

          <div className="search-filter-right">
            <button
              type="button"
              onClick={openCreate}
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
              }}
            >
              <i className="fa-solid fa-user-plus" /> Thêm thành viên
            </button>
          </div>
        </div>

        {/* Tab Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', paddingTop: '0.35rem', borderTop: '1px solid #f1f5f9' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', marginRight: '0.25rem' }}>Phân loại:</span>
          <div className="filter-pill-group">
            <button type="button" className={`filter-pill-btn ${filterTab === 'all' ? 'active' : ''}`} onClick={() => setFilterTab('all')}>
              Tất cả ({authors.length})
            </button>
            <button type="button" className={`filter-pill-btn ${filterTab === 'members' ? 'active' : ''}`} onClick={() => setFilterTab('members')}>
              ⭐ Thành viên chính thức ({authors.filter((a) => a.is_member).length})
            </button>
            <button type="button" className={`filter-pill-btn ${filterTab === 'collabs' ? 'active' : ''}`} onClick={() => setFilterTab('collabs')}>
              🤝 Cộng tác viên ({authors.filter((a) => !a.is_member).length})
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3.5rem', color: '#94a3b8' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px', color: '#6366f1' }} />
          Đang tải danh sách thành viên & hồ sơ...
        </div>
      ) : filteredAuthors.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3.5rem 1rem', background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', color: '#64748b' }}>
          <i className="fa-solid fa-user-slash" style={{ fontSize: '2.5rem', color: '#cbd5e1', marginBottom: '0.75rem', display: 'block' }} />
          <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: '0.25rem' }}>Không tìm thấy nhân sự phù hợp</div>
          <div style={{ fontSize: '0.85rem' }}>Thử thay đổi từ khóa tìm kiếm hoặc bỏ các bộ lọc đang chọn.</div>
        </div>
      ) : (
        <>
          {/* Members Grid */}
          {members.length > 0 && (
            <div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#334155', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                ⭐ Thành viên nhóm nghiên cứu ({members.length})
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '0.875rem' }}>
                {members.map((a) => {
                  const roleStyle = a.member_role ? ROLES[a.member_role] || ROLES.SV : ROLES.SV;
                  const teamsList = a.teams || [];

                  return (
                    <div
                      key={a.id}
                      onClick={() => setSelectedAuthor(a)}
                      style={{
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '1.125rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.75rem',
                        transition: 'all 0.18s ease',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#c7d2fe')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#e2e8f0')}
                    >
                      <div style={{ display: 'flex', gap: '0.875rem', alignItems: 'flex-start' }}>
                        <Avatar name={a.name} size={42} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {a.name}
                            </div>
                            <div style={{ display: 'flex', gap: '0.25rem' }}>
                              <button type="button" onClick={(e) => openEdit(a, e)} title="Chỉnh sửa" style={{ padding: '4px 6px', border: 'none', borderRadius: '5px', background: '#f1f5f9', color: '#475569', cursor: 'pointer', fontSize: '0.75rem' }}>
                                <i className="fa-solid fa-pen" />
                              </button>
                              <button type="button" onClick={(e) => handleDelete(a, e)} title="Xóa" style={{ padding: '4px 6px', border: 'none', borderRadius: '5px', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem' }}>
                                <i className="fa-solid fa-trash" />
                              </button>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '0.25rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                            {a.member_role && (
                              <span style={{ fontSize: '0.72rem', padding: '1px 7px', borderRadius: '4px', background: roleStyle.bg, color: roleStyle.color, fontWeight: 700 }}>
                                {a.member_role}
                              </span>
                            )}
                            {a.academic_field && (
                              <span style={{ fontSize: '0.72rem', padding: '1px 7px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                                {a.academic_field}
                              </span>
                            )}
                          </div>

                          {a.affiliation && (
                            <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.affiliation}>
                              <i className="fa-solid fa-building-columns" style={{ fontSize: '0.7rem', marginRight: '4px', color: '#94a3b8' }} />
                              {a.affiliation}
                            </div>
                          )}

                          {a.email && (
                            <div style={{ fontSize: '0.78rem', color: '#6366f1', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <i className="fa-solid fa-envelope" style={{ fontSize: '0.7rem', marginRight: '4px', color: '#94a3b8' }} />
                              {a.email}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Belonging Teams Badges */}
                      {teamsList.length > 0 && (
                        <div style={{ background: '#f8fafc', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginBottom: '4px' }}>
                            <i className="fa-solid fa-users-gear" style={{ marginRight: '4px', color: '#6366f1' }} />
                            Nhóm tham gia ({teamsList.length}):
                          </div>
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            {teamsList.map((t) => (
                              <span key={t.id} style={{ fontSize: '0.72rem', padding: '2px 7px', borderRadius: '4px', background: '#e0e7ff', color: '#4338ca', fontWeight: 600 }}>
                                {t.is_leader ? '👑 ' : ''}{t.name} ({t.team_role})
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Papers & Yearly Performance Footer */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.4rem', borderTop: '1px solid #f8fafc', fontSize: '0.78rem', color: '#64748b' }}>
                        <div>
                          Công bố {year}: <strong style={{ color: '#16a34a' }}>{a.achieved_this_year || 0} bài</strong>
                        </div>
                        <div>
                          Tổng tích lũy: <strong style={{ color: '#1e293b' }}>{a.papers_count || 0} bài</strong>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Collaborators Table */}
          {collabs.length > 0 && (
            <div style={{ marginTop: members.length > 0 ? '0.5rem' : '0' }}>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 700, color: '#334155', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                🤝 Cộng tác viên ({collabs.length})
              </h3>
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      {['Tên cộng tác viên', 'Email', 'Đơn vị công tác', 'Học hàm/vị trí', 'Bài báo hợp tác', 'Thao tác'].map((h) => (
                        <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 600, color: '#475569', fontSize: '0.78rem' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {collabs.map((a) => (
                      <tr
                        key={a.id}
                        onClick={() => setSelectedAuthor(a)}
                        style={{ borderBottom: '1px solid #f8fafc', cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                      >
                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#1e293b' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Avatar name={a.name} size={28} />
                            {a.name}
                          </div>
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{a.email ?? '—'}</td>
                        <td style={{ padding: '0.75rem 1rem', color: '#64748b', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.affiliation ?? '—'}
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          {a.member_role ? (
                            <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: ROLES[a.member_role]?.bg || '#f1f5f9', color: ROLES[a.member_role]?.color || '#475569', fontWeight: 600 }}>
                              {a.member_role}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td style={{ padding: '0.75rem 1rem', color: '#4338ca', fontWeight: 600 }}>
                          {a.papers_count || 0} bài
                        </td>
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ display: 'flex', gap: '0.375rem' }}>
                            <button type="button" onClick={(e) => openEdit(a, e)} title="Chỉnh sửa" style={{ padding: '4px 8px', border: 'none', borderRadius: '6px', background: '#f1f5f9', color: '#475569', cursor: 'pointer' }}>
                              <i className="fa-solid fa-pen" style={{ fontSize: '0.8rem' }} />
                            </button>
                            <button type="button" onClick={(e) => handleDelete(a, e)} title="Xóa" style={{ padding: '4px 8px', border: 'none', borderRadius: '6px', background: '#fef2f2', color: '#ef4444', cursor: 'pointer' }}>
                              <i className="fa-solid fa-trash" style={{ fontSize: '0.8rem' }} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* MODAL: Member Research Profile Drawer/Modal */}
      {selectedAuthor && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', background: '#fafcff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                <Avatar name={selectedAuthor.name} size={48} />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>{selectedAuthor.name}</h2>
                    {selectedAuthor.member_role && (
                      <span style={{ fontSize: '0.72rem', padding: '2px 8px', borderRadius: '4px', background: ROLES[selectedAuthor.member_role]?.bg || '#f1f5f9', color: ROLES[selectedAuthor.member_role]?.color || '#475569', fontWeight: 700 }}>
                        {selectedAuthor.member_role}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>
                    {selectedAuthor.affiliation || 'Chưa cập nhật đơn vị'} · {selectedAuthor.email || 'Chưa có email'}
                  </div>
                </div>
              </div>
              <button type="button" onClick={() => setSelectedAuthor(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }}>✕</button>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Scholar Stats if any */}
              {selectedAuthor.scholar_id && (
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '0.875rem 1rem', display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Trích dẫn</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b' }}>{selectedAuthor.scholar_citations || 0}</div>
                  </div>
                  <div style={{ borderLeft: '1px solid #e2e8f0' }} />
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>H-index</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#6366f1' }}>{selectedAuthor.scholar_h_index || 0}</div>
                  </div>
                  <div style={{ borderLeft: '1px solid #e2e8f0' }} />
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>i10-index</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>{selectedAuthor.scholar_i10_index || 0}</div>
                  </div>
                </div>
              )}

              {/* Nhóm nghiên cứu tham gia */}
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.88rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <i className="fa-solid fa-users-gear" style={{ color: '#6366f1' }} /> Nhóm nghiên cứu tham gia ({selectedAuthor.teams?.length || 0})
                </h4>
                {selectedAuthor.teams && selectedAuthor.teams.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {selectedAuthor.teams.map((t) => (
                      <div key={t.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.625rem 0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>{t.name}</strong>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Vai trò: <span style={{ color: '#4338ca', fontWeight: 600 }}>{t.team_role}</span></div>
                        </div>
                        <span style={{ fontSize: '0.75rem', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          Chỉ tiêu: {t.kpi_papers} bài
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic' }}>Chưa tham gia nhóm nghiên cứu nào.</div>
                )}
              </div>

              {/* Danh sách bài báo */}
              <div>
                <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.88rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <i className="fa-solid fa-file-lines" style={{ color: '#10b981' }} /> Danh sách bài báo đã công bố ({selectedAuthor.papers?.length || 0})
                </h4>
                {selectedAuthor.papers && selectedAuthor.papers.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '240px', overflowY: 'auto' }}>
                    {selectedAuthor.papers.map((p) => (
                      <div key={p.id} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.625rem 0.875rem', background: '#ffffff' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b' }}>{p.title}</div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                          <span>{p.journal_name} ({p.year})</span>
                          {p.ranking && <span style={{ background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>{p.ranking}</span>}
                          {p.doi && (
                            <a href={p.doi.startsWith('http') ? p.doi : `https://doi.org/${p.doi}`} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', textDecoration: 'none' }}>
                              DOI ↗
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic' }}>Chưa có dữ liệu bài báo.</div>
                )}
              </div>

              {/* Cộng tác viên thường xuyên */}
              {selectedAuthor.top_coauthors && selectedAuthor.top_coauthors.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '0.88rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <i className="fa-solid fa-handshake" style={{ color: '#f59e0b' }} /> Đồng tác giả thường xuyên ({selectedAuthor.top_coauthors.length})
                  </h4>
                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                    {selectedAuthor.top_coauthors.map((ca) => (
                      <span key={ca.id} style={{ fontSize: '0.78rem', background: '#f1f5f9', color: '#334155', padding: '3px 8px', borderRadius: '6px', fontWeight: 500 }}>
                        {ca.name} <strong style={{ color: '#4338ca' }}>({ca.count} bài)</strong>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => setSelectedAuthor(null)} style={{ padding: '0.5rem 1.25rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Create / Edit Author */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '480px', boxShadow: '0 25px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>{editing ? 'Chỉnh sửa thông tin thành viên' : 'Thêm thành viên mới'}</h2>
              <button type="button" onClick={() => setShowForm(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }}>✕</button>
            </div>
            <form onSubmit={handleSave} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>Họ và tên *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="VD: TS. Trần Thị Bình"
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="name@ptit.edu.vn"
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>Đơn vị công tác (Affiliation)</label>
                <input
                  type="text"
                  value={form.affiliation}
                  onChange={(e) => setForm((f) => ({ ...f, affiliation: e.target.value }))}
                  placeholder="Học viện Công nghệ Bưu chính Viễn thông"
                  style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>Chuyên ngành</label>
                  <input
                    value={form.academic_field}
                    onChange={(e) => setForm((f) => ({ ...f, academic_field: e.target.value }))}
                    placeholder="CNTT, ATTT, AI..."
                    style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '0.25rem' }}>Học hàm / Vị trí</label>
                  <select
                    value={form.member_role}
                    onChange={(e) => setForm((f) => ({ ...f, member_role: e.target.value }))}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.875rem', outline: 'none' }}
                  >
                    <option value="">—</option>
                    {['GS', 'PGS', 'TS', 'GV', 'SV'].map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer', paddingTop: '0.25rem' }}>
                <input type="checkbox" checked={form.is_member} onChange={(e) => setForm((f) => ({ ...f, is_member: e.target.checked }))} />
                Là thành viên chính thức của viện / trường
              </label>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '0.5rem 1rem', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}>
                  Hủy
                </button>
                <button type="submit" disabled={saving} style={{ padding: '0.5rem 1.25rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Đang lưu...' : 'Lưu thành viên'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
