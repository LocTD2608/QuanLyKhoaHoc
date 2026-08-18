import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { teamsApi, authorsApi } from '../utils/api';
import { Team, TeamMember } from '../types/team.types';
import { showToast } from '../utils/toast';

const ROLE_BADGES: Record<string, { bg: string; color: string }> = {
  GS: { bg: '#ede9fe', color: '#5b21b6' },
  PGS: { bg: '#dbeafe', color: '#1d4ed8' },
  TS: { bg: '#d1fae5', color: '#065f46' },
  GV: { bg: '#fef3c7', color: '#92400e' },
  SV: { bg: '#f1f5f9', color: '#475569' },
};

const TEAM_ROLE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  'Trưởng nhóm (Leader)': { bg: '#fef3c7', color: '#b45309', border: '#fde68a' },
  'Trưởng nhóm': { bg: '#fef3c7', color: '#b45309', border: '#fde68a' },
  'Nghiên cứu viên chính': { bg: '#e0e7ff', color: '#4338ca', border: '#c7d2fe' },
  'Thành viên chủ chốt': { bg: '#e0e7ff', color: '#4338ca', border: '#c7d2fe' },
  'Nghiên cứu sinh': { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
  'NCS': { bg: '#ecfdf5', color: '#047857', border: '#a7f3d0' },
  'Sinh viên NCKH': { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' },
  'Thành viên': { bg: '#f8fafc', color: '#334155', border: '#e2e8f0' },
};

function getTeamRoleStyle(role?: string) {
  if (!role) return { bg: '#f8fafc', color: '#475569', border: '#e2e8f0' };
  return TEAM_ROLE_COLORS[role] || { bg: '#f1f5f9', color: '#475569', border: '#e2e8f0' };
}

function KpiProgressBar({ achieved, target, label }: { achieved: number; target: number; label?: string }) {
  const pct = target > 0 ? Math.min(Math.round((achieved / target) * 100), 100) : 0;
  const isOver = target > 0 && achieved >= target;
  const color = isOver ? '#10b981' : pct >= 60 ? '#6366f1' : pct >= 30 ? '#f59e0b' : '#94a3b8';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', marginBottom: '4px' }}>
        <span style={{ color: '#64748b', fontWeight: 500 }}>{label || 'Tiến độ KPI'}</span>
        <span style={{ fontWeight: 700, color: isOver ? '#10b981' : '#1e293b' }}>
          {achieved} / {target} bài {target > 0 ? `(${pct}%)` : ''} {isOver && <span style={{ color: '#10b981', marginLeft: '2px' }}>✓</span>}
        </span>
      </div>
      <div style={{ height: '7px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '99px', transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

const emptyTeamForm = { name: '', description: '', leader_id: 0, kpi_papers_per_year: 4 };

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [allAuthors, setAllAuthors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modal states
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [teamForm, setTeamForm] = useState({ ...emptyTeamForm });
  const [savingTeam, setSavingTeam] = useState(false);

  const [addMemberModal, setAddMemberModal] = useState<{ isOpen: boolean; teamId: number; teamName: string }>({
    isOpen: false,
    teamId: 0,
    teamName: '',
  });
  const [memberForm, setMemberForm] = useState({ author_id: 0, kpi_papers: 2, team_role: 'Thành viên' });
  const [savingMember, setSavingMember] = useState(false);

  const [editMemberModal, setEditMemberModal] = useState<{
    isOpen: boolean;
    teamId: number;
    authorId: number;
    authorName: string;
    kpi: number;
    role: string;
  }>({
    isOpen: false,
    teamId: 0,
    authorId: 0,
    authorName: '',
    kpi: 0,
    role: 'Thành viên',
  });

  const year = new Date().getFullYear();

  const loadData = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    Promise.all([teamsApi.list(), authorsApi.list()])
      .then(([t, a]) => {
        setTeams(t);
        setAllAuthors(a);
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Overall Stats
  const totalTeams = teams.length;
  const totalPublishedPapers = teams.reduce((sum, t) => sum + (t.achieved || 0), 0);
  const totalCollaborative = teams.reduce((sum, t) => sum + (t.collaborative_count || 0), 0);
  const totalTargetKpi = teams.reduce((sum, t) => sum + (t.kpi_papers_per_year || 0), 0);
  const overallKpiPct = totalTargetKpi > 0 ? Math.min(Math.round((totalPublishedPapers / totalTargetKpi) * 100), 100) : 0;

  // Filtered teams
  const filteredTeams = teams.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.name.toLowerCase().includes(q) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.leader && t.leader.name.toLowerCase().includes(q)) ||
      t.members.some((m) => m.name.toLowerCase().includes(q))
    );
  });

  // Team Form Handlers
  const handleOpenCreateTeam = () => {
    setEditingTeam(null);
    setTeamForm({
      name: '',
      description: '',
      leader_id: allAuthors[0]?.id || 0,
      kpi_papers_per_year: 4,
    });
    setShowTeamModal(true);
  };

  const handleOpenEditTeam = (team: Team) => {
    setEditingTeam(team);
    setTeamForm({
      name: team.name,
      description: team.description || '',
      leader_id: team.leader_id || (team.leader?.id || 0),
      kpi_papers_per_year: team.kpi_papers_per_year || 0,
    });
    setShowTeamModal(true);
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTeam(true);
    try {
      const payload = {
        name: teamForm.name,
        description: teamForm.description,
        leader_id: teamForm.leader_id ? Number(teamForm.leader_id) : null,
        kpi_papers_per_year: Number(teamForm.kpi_papers_per_year),
      };
      if (editingTeam) {
        await teamsApi.update(editingTeam.id, payload);
        showToast('Cập nhật nhóm nghiên cứu thành công!', 'success');
      } else {
        await teamsApi.create(payload);
        showToast('Tạo nhóm nghiên cứu mới thành công!', 'success');
      }
      setShowTeamModal(false);
      loadData(true);
    } catch (err: any) {
      showToast(`Lỗi: ${err.message}`, 'error');
    } finally {
      setSavingTeam(false);
    }
  };

  const handleDeleteTeam = async (team: Team) => {
    if (!confirm(`Bạn có chắc muốn xóa nhóm "${team.name}"?`)) return;
    try {
      await teamsApi.delete(team.id);
      showToast('Xóa nhóm thành công!', 'success');
      loadData(true);
    } catch (err: any) {
      showToast(`Lỗi khi xóa nhóm: ${err.message}`, 'error');
    }
  };

  // Member Handlers
  const handleOpenAddMember = (team: Team) => {
    const existingIds = team.members.map((m) => m.id);
    const available = allAuthors.filter((a) => !existingIds.includes(a.id));
    setMemberForm({
      author_id: available[0]?.id || 0,
      kpi_papers: 2,
      team_role: 'Thành viên',
    });
    setAddMemberModal({
      isOpen: true,
      teamId: team.id,
      teamName: team.name,
    });
  };

  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberForm.author_id) {
      showToast('Vui lòng chọn thành viên', 'warning');
      return;
    }
    setSavingMember(true);
    try {
      await teamsApi.addMember(addMemberModal.teamId, Number(memberForm.author_id), Number(memberForm.kpi_papers), memberForm.team_role);
      showToast('Đã thêm thành viên vào nhóm!', 'success');
      setAddMemberModal({ isOpen: false, teamId: 0, teamName: '' });
      loadData(true);
    } catch (err: any) {
      showToast(`Lỗi: ${err.message}`, 'error');
    } finally {
      setSavingMember(false);
    }
  };

  const handleOpenEditMember = (teamId: number, member: TeamMember) => {
    setEditMemberModal({
      isOpen: true,
      teamId,
      authorId: member.id,
      authorName: member.name,
      kpi: member.kpi_papers || 0,
      role: member.team_role || 'Thành viên',
    });
  };

  const handleUpdateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await teamsApi.updateMember(editMemberModal.teamId, editMemberModal.authorId, Number(editMemberModal.kpi), editMemberModal.role);
      showToast('Cập nhật vai trò & KPI thành công!', 'success');
      setEditMemberModal((prev) => ({ ...prev, isOpen: false }));
      loadData(true);
    } catch (err: any) {
      showToast(`Lỗi: ${err.message}`, 'error');
    }
  };

  const handleRemoveMember = async (teamId: number, member: TeamMember) => {
    if (!confirm(`Xác nhận xóa thành viên "${member.name}" khỏi nhóm?`)) return;
    try {
      await teamsApi.removeMember(teamId, member.id);
      showToast('Đã xóa thành viên khỏi nhóm', 'success');
      loadData(true);
    } catch (err: any) {
      showToast(`Lỗi: ${err.message}`, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 4 Stat Overview Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.125rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '10px', background: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>
            <i className="fa-solid fa-users-gear" />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>Nhóm nghiên cứu</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1e293b' }}>{totalTeams}</div>
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.125rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '10px', background: '#dcfce7', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>
            <i className="fa-solid fa-file-circle-check" />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>Bài báo năm {year}</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1e293b' }}>
              {totalPublishedPapers} <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 400 }}>/ {totalTargetKpi} chỉ tiêu</span>
            </div>
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.125rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '10px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>
            <i className="fa-solid fa-handshake" />
          </div>
          <div>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>Bài làm chung nội bộ</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1e293b' }}>
              {totalCollaborative} <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>đồng tác giả</span>
            </div>
          </div>
        </div>

        <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '1.125rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '10px', background: '#ede9fe', color: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0 }}>
            <i className="fa-solid fa-chart-line" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 500 }}>Hoàn thành KPI</div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#1e293b' }}>{overallKpiPct}%</div>
          </div>
        </div>
      </div>

      {/* Search & Action Bar */}
      <div className="search-filter-card">
        <div className="search-filter-row">
          <div className="search-filter-left">
            <div className="unified-search-box" style={{ maxWidth: '420px' }}>
              <i className="fa-solid fa-magnifying-glass search-icon" />
              <input
                type="text"
                className="unified-search-input"
                placeholder="Tìm nhóm nghiên cứu, trưởng nhóm, thành viên..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button type="button" className="unified-search-clear" onClick={() => setSearch('')}>
                  <i className="fa-solid fa-xmark" />
                </button>
              )}
            </div>

            <div className="filter-count-badge">
              <i className="fa-solid fa-layer-group" style={{ marginRight: '5px', color: '#6366f1' }} />
              {filteredTeams.length} nhóm nghiên cứu
            </div>
          </div>

          <div className="search-filter-right">
            <button
              type="button"
              onClick={handleOpenCreateTeam}
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
              <i className="fa-solid fa-plus" /> Thêm nhóm nghiên cứu
            </button>
          </div>
        </div>
      </div>

      {/* Team Cards List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3.5rem', color: '#94a3b8' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px', color: '#6366f1', fontSize: '1.2rem' }} />
          Đang tải danh sách nhóm & bài báo...
        </div>
      ) : filteredTeams.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3.5rem 1rem', background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', color: '#64748b' }}>
          <i className="fa-solid fa-people-roof" style={{ fontSize: '2.5rem', color: '#cbd5e1', marginBottom: '0.75rem', display: 'block' }} />
          <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '1rem', marginBottom: '0.25rem' }}>Không tìm thấy nhóm nghiên cứu</div>
          <div style={{ fontSize: '0.85rem' }}>Hãy tạo nhóm nghiên cứu mới để bắt đầu quản lý bài báo và hợp tác.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {filteredTeams.map((team) => (
            <TeamDetailCard
              key={team.id}
              team={team}
              year={year}
              onEditTeam={() => handleOpenEditTeam(team)}
              onDeleteTeam={() => handleDeleteTeam(team)}
              onAddMember={() => handleOpenAddMember(team)}
              onEditMember={(member) => handleOpenEditMember(team.id, member)}
              onRemoveMember={(member) => handleRemoveMember(team.id, member)}
            />
          ))}
        </div>
      )}

      {/* Modal: Create/Edit Team */}
      {showTeamModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '480px', boxShadow: '0 25px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.125rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="fa-solid fa-users-gear" style={{ color: '#6366f1' }} />
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>{editingTeam ? 'Chỉnh sửa nhóm nghiên cứu' : 'Thêm nhóm nghiên cứu mới'}</h2>
              </div>
              <button type="button" onClick={() => setShowTeamModal(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }}>✕</button>
            </div>
            <form onSubmit={handleSaveTeam} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>Tên nhóm nghiên cứu (Lab / Group) *</label>
                <input
                  required
                  value={teamForm.name}
                  onChange={(e) => setTeamForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="VD: Nhóm Trí Tuệ Nhân Tạo & Xử Lý Ngôn Ngữ Tự Nhiên (AI & NLP Lab)"
                  style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>Trưởng nhóm (Leader / PI)</label>
                <select
                  value={teamForm.leader_id}
                  onChange={(e) => setTeamForm((f) => ({ ...f, leader_id: +e.target.value }))}
                  style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.875rem', outline: 'none' }}
                >
                  <option value={0}>— Chọn trưởng nhóm nghiên cứu —</option>
                  {allAuthors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.member_role ? `[${a.member_role}] ` : ''}{a.name} ({a.affiliation || 'Chưa rõ'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>Mục tiêu KPI bài báo cả nhóm / năm</label>
                <input
                  type="number"
                  min={0}
                  value={teamForm.kpi_papers_per_year}
                  onChange={(e) => setTeamForm((f) => ({ ...f, kpi_papers_per_year: +e.target.value }))}
                  style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>Mô tả hướng nghiên cứu & mục tiêu</label>
                <textarea
                  value={teamForm.description}
                  onChange={(e) => setTeamForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3}
                  placeholder="Mô tả các hướng nghiên cứu trọng tâm, đề tài cấp bộ/nhà nước đang triển khai..."
                  style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                <button type="button" onClick={() => setShowTeamModal(false)} style={{ padding: '0.5rem 1rem', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500 }}>
                  Hủy
                </button>
                <button type="submit" disabled={savingTeam} style={{ padding: '0.5rem 1.35rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', opacity: savingTeam ? 0.7 : 1 }}>
                  {savingTeam ? 'Đang lưu...' : 'Lưu nhóm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Member */}
      {addMemberModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '440px', boxShadow: '0 25px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.125rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>Thêm thành viên vào nhóm</h3>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{addMemberModal.teamName}</div>
              </div>
              <button type="button" onClick={() => setAddMemberModal({ isOpen: false, teamId: 0, teamName: '' })} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }}>✕</button>
            </div>
            <form onSubmit={handleSaveMember} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>Chọn thành viên *</label>
                <select
                  required
                  value={memberForm.author_id}
                  onChange={(e) => setMemberForm((f) => ({ ...f, author_id: +e.target.value }))}
                  style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.875rem', outline: 'none' }}
                >
                  <option value={0}>— Chọn tác giả / thành viên —</option>
                  {allAuthors.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.member_role || 'Thành viên'} - {a.affiliation || 'Chưa rõ đơn vị'})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>Vai trò trong nhóm</label>
                  <select
                    value={memberForm.team_role}
                    onChange={(e) => setMemberForm((f) => ({ ...f, team_role: e.target.value }))}
                    style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.875rem', outline: 'none' }}
                  >
                    <option value="Trưởng nhóm (Leader)">Trưởng nhóm (Leader)</option>
                    <option value="Nghiên cứu viên chính">Nghiên cứu viên chính</option>
                    <option value="Thành viên chủ chốt">Thành viên chủ chốt</option>
                    <option value="Thành viên">Thành viên</option>
                    <option value="Nghiên cứu sinh">Nghiên cứu sinh (NCS)</option>
                    <option value="Sinh viên NCKH">Sinh viên NCKH</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>Chỉ tiêu KPI (bài/năm)</label>
                  <input
                    type="number"
                    min={0}
                    value={memberForm.kpi_papers}
                    onChange={(e) => setMemberForm((f) => ({ ...f, kpi_papers: +e.target.value }))}
                    style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                <button type="button" onClick={() => setAddMemberModal({ isOpen: false, teamId: 0, teamName: '' })} style={{ padding: '0.5rem 1rem', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}>
                  Hủy
                </button>
                <button type="submit" disabled={savingMember} style={{ padding: '0.5rem 1.35rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', opacity: savingMember ? 0.7 : 1 }}>
                  {savingMember ? 'Đang thêm...' : 'Thêm vào nhóm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Member */}
      {editMemberModal.isOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '16px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.125rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>Cập nhật thành viên nhóm</h3>
                <div style={{ fontSize: '0.8rem', color: '#4f46e5', fontWeight: 600 }}>{editMemberModal.authorName}</div>
              </div>
              <button type="button" onClick={() => setEditMemberModal((prev) => ({ ...prev, isOpen: false }))} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#94a3b8' }}>✕</button>
            </div>
            <form onSubmit={handleUpdateMember} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>Vai trò trong nhóm</label>
                <select
                  value={editMemberModal.role}
                  onChange={(e) => setEditMemberModal((prev) => ({ ...prev, role: e.target.value }))}
                  style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.875rem', outline: 'none' }}
                >
                  <option value="Trưởng nhóm (Leader)">Trưởng nhóm (Leader)</option>
                  <option value="Nghiên cứu viên chính">Nghiên cứu viên chính</option>
                  <option value="Thành viên chủ chốt">Thành viên chủ chốt</option>
                  <option value="Thành viên">Thành viên</option>
                  <option value="Nghiên cứu sinh">Nghiên cứu sinh (NCS)</option>
                  <option value="Sinh viên NCKH">Sinh viên NCKH</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155', display: 'block', marginBottom: '0.35rem' }}>Chỉ tiêu KPI bài báo (bài/năm)</label>
                <input
                  type="number"
                  min={0}
                  value={editMemberModal.kpi}
                  onChange={(e) => setEditMemberModal((prev) => ({ ...prev, kpi: +e.target.value }))}
                  style={{ width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '0.875rem', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                <button type="button" onClick={() => setEditMemberModal((prev) => ({ ...prev, isOpen: false }))} style={{ padding: '0.5rem 1rem', border: '1px solid #cbd5e1', borderRadius: '8px', background: 'white', cursor: 'pointer', fontSize: '0.875rem' }}>
                  Hủy
                </button>
                <button type="submit" style={{ padding: '0.5rem 1.35rem', background: '#6366f1', color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Component: TeamDetailCard with Multi-Tabs
// -------------------------------------------------------------
function TeamDetailCard({
  team,
  year,
  onEditTeam,
  onDeleteTeam,
  onAddMember,
  onEditMember,
  onRemoveMember,
}: {
  team: Team;
  year: number;
  onEditTeam: () => void;
  onDeleteTeam: () => void;
  onAddMember: () => void;
  onEditMember: (m: TeamMember) => void;
  onRemoveMember: (m: TeamMember) => void;
}) {
  const [activeTab, setActiveTab] = useState<'members' | 'papers' | 'collabs'>('members');
  const [paperFilter, setPaperFilter] = useState<'all' | 'collab' | 'published' | 'review'>('all');

  const papers = team.papers || [];
  const collaborativePapers = papers.filter((p) => p.is_collaborative);

  const filteredPapers = papers.filter((p) => {
    if (paperFilter === 'collab') return p.is_collaborative;
    if (paperFilter === 'published') return p.status === 'published';
    if (paperFilter === 'review') return p.status === 'in_review' || p.status === 'accepted';
    return true;
  });

  return (
    <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.02)', overflow: 'hidden' }}>
      {/* Header of Team */}
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', background: '#fafcff' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>{team.name}</h3>
              <span style={{ fontSize: '0.72rem', background: '#e0e7ff', color: '#4338ca', padding: '2px 8px', borderRadius: '6px', fontWeight: 600 }}>
                {team.members.length} thành viên
              </span>
              {team.leader && (
                <span style={{ fontSize: '0.72rem', background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '6px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  👑 Trưởng nhóm: {team.leader.name}
                </span>
              )}
            </div>
            {team.description && (
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.4 }}>
                {team.description}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={onEditTeam}
              title="Chỉnh sửa thông tin nhóm"
              style={{ padding: '6px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', background: 'white', color: '#475569', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <i className="fa-solid fa-pen" style={{ fontSize: '0.75rem' }} /> Sửa nhóm
            </button>
            <button
              type="button"
              onClick={onDeleteTeam}
              title="Xóa nhóm"
              style={{ padding: '6px 10px', border: '1px solid #fee2e2', borderRadius: '8px', background: '#fef2f2', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem' }}
            >
              <i className="fa-solid fa-trash" />
            </button>
          </div>
        </div>

        {/* Team KPI Bar & Quick Stats */}
        <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.25rem', alignItems: 'center' }}>
          <div>
            <KpiProgressBar achieved={team.achieved || 0} target={team.kpi_papers_per_year} label={`KPI bài báo năm ${year}`} />
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}>
              <span style={{ color: '#64748b' }}>Đã xuất bản: </span>
              <strong style={{ color: '#16a34a' }}>{team.achieved || 0} bài</strong>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}>
              <span style={{ color: '#64748b' }}>Đang duyệt / Chấp nhận: </span>
              <strong style={{ color: '#f59e0b' }}>{team.in_progress_count || 0} bài</strong>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}>
              <span style={{ color: '#64748b' }}>Làm chung (Co-author): </span>
              <strong style={{ color: '#6366f1' }}>{collaborativePapers.length} bài</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', background: '#ffffff', padding: '0 1.5rem', gap: '1.5rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('members')}
          style={{
            padding: '0.75rem 0',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'members' ? '2px solid #6366f1' : '2px solid transparent',
            color: activeTab === 'members' ? '#4338ca' : '#64748b',
            fontWeight: activeTab === 'members' ? 700 : 500,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}
        >
          <i className="fa-solid fa-user-group" style={{ fontSize: '0.8rem' }} /> Thành viên & KPI cá nhân ({team.members.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('papers')}
          style={{
            padding: '0.75rem 0',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'papers' ? '2px solid #6366f1' : '2px solid transparent',
            color: activeTab === 'papers' ? '#4338ca' : '#64748b',
            fontWeight: activeTab === 'papers' ? 700 : 500,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}
        >
          <i className="fa-solid fa-book-open" style={{ fontSize: '0.8rem' }} /> Bài báo & Công trình của nhóm ({papers.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('collabs')}
          style={{
            padding: '0.75rem 0',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'collabs' ? '2px solid #6366f1' : '2px solid transparent',
            color: activeTab === 'collabs' ? '#4338ca' : '#64748b',
            fontWeight: activeTab === 'collabs' ? 700 : 500,
            fontSize: '0.85rem',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
          }}
        >
          <i className="fa-solid fa-diagram-project" style={{ fontSize: '0.8rem' }} /> Hợp tác nghiên cứu ({collaborativePapers.length})
        </button>
      </div>

      {/* Tab Content */}
      <div style={{ padding: '1.25rem 1.5rem' }}>
        {/* TAB 1: MEMBERS */}
        {activeTab === 'members' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
                Danh sách nhân sự thuộc nhóm và mục tiêu chỉ tiêu bài báo khoa học cá nhân.
              </div>
              <button
                type="button"
                onClick={onAddMember}
                style={{
                  padding: '6px 12px',
                  borderRadius: '7px',
                  border: '1px dashed #6366f1',
                  background: '#eef2ff',
                  color: '#4f46e5',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <i className="fa-solid fa-user-plus" /> Thêm thành viên vào nhóm
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.875rem' }}>
              {team.members.map((m) => {
                const roleBadge = m.member_role ? ROLE_BADGES[m.member_role] || ROLE_BADGES.SV : null;
                const teamRoleStyle = getTeamRoleStyle(m.team_role);
                const initials = m.name.split(' ').pop()?.charAt(0).toUpperCase() || '?';

                return (
                  <div
                    key={m.id}
                    style={{
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '0.875rem 1rem',
                      background: '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.625rem',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: '#e0e7ff',
                          color: '#4338ca',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.name}
                        </div>
                        <div style={{ display: 'flex', gap: '0.25rem', marginTop: '2px', flexWrap: 'wrap' }}>
                          {roleBadge && (
                            <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: roleBadge.bg, color: roleBadge.color, fontWeight: 600 }}>
                              {m.member_role}
                            </span>
                          )}
                          <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: '4px', background: teamRoleStyle.bg, color: teamRoleStyle.color, border: `1px solid ${teamRoleStyle.border}`, fontWeight: 600 }}>
                            {m.team_role || 'Thành viên'}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button type="button" onClick={() => onEditMember(m)} title="Sửa vai trò & KPI" style={{ padding: '4px 6px', border: 'none', borderRadius: '5px', background: '#f1f5f9', color: '#475569', cursor: 'pointer', fontSize: '0.75rem' }}>
                          <i className="fa-solid fa-pen" />
                        </button>
                        <button type="button" onClick={() => onRemoveMember(m)} title="Xóa khỏi nhóm" style={{ padding: '4px 6px', border: 'none', borderRadius: '5px', background: '#fef2f2', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem' }}>
                          <i className="fa-solid fa-xmark" />
                        </button>
                      </div>
                    </div>

                    {/* Member KPI mini bar */}
                    <div style={{ background: '#f8fafc', padding: '0.5rem', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                      <KpiProgressBar achieved={m.achieved || 0} target={m.kpi_papers || 0} label="Chỉ tiêu cá nhân" />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                        <span>Đang xử lý: {m.in_progress || 0} bài</span>
                        <span>Tổng tích lũy: {m.total_papers || 0} bài</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: RESEARCH PAPERS & COLLABORATIONS */}
        {activeTab === 'papers' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div className="filter-pill-group">
                <button type="button" className={`filter-pill-btn ${paperFilter === 'all' ? 'active' : ''}`} onClick={() => setPaperFilter('all')}>
                  Tất cả ({papers.length})
                </button>
                <button type="button" className={`filter-pill-btn ${paperFilter === 'collab' ? 'active' : ''}`} onClick={() => setPaperFilter('collab')}>
                  🤝 Làm chung trong nhóm ({collaborativePapers.length})
                </button>
                <button type="button" className={`filter-pill-btn ${paperFilter === 'published' ? 'active' : ''}`} onClick={() => setPaperFilter('published')}>
                  ✓ Đã công bố ({papers.filter((p) => p.status === 'published').length})
                </button>
                <button type="button" className={`filter-pill-btn ${paperFilter === 'review' ? 'active' : ''}`} onClick={() => setPaperFilter('review')}>
                  ⏳ Đang thẩm định ({papers.filter((p) => p.status === 'in_review' || p.status === 'accepted').length})
                </button>
              </div>

              <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Hiển thị <strong>{filteredPapers.length}</strong> bài báo
              </span>
            </div>

            {filteredPapers.length === 0 ? (
              <div style={{ padding: '2.5rem', textAlign: 'center', color: '#94a3b8', background: '#f8fafc', borderRadius: '10px', border: '1px dashed #e2e8f0' }}>
                <i className="fa-solid fa-file-circle-question" style={{ fontSize: '1.8rem', marginBottom: '0.5rem', display: 'block', color: '#cbd5e1' }} />
                Chưa có bài báo nào phù hợp với bộ lọc đã chọn.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {filteredPapers.map((paper) => {
                  const isCollab = paper.is_collaborative;
                  const authorsCount = paper.team_author_names?.length || 0;

                  return (
                    <div
                      key={paper.id}
                      style={{
                        padding: '1rem',
                        borderRadius: '10px',
                        border: isCollab ? '1px solid #c7d2fe' : '1px solid #e2e8f0',
                        background: isCollab ? '#fafafe' : '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                            {isCollab && (
                              <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: '4px', background: '#e0e7ff', color: '#4338ca', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                👥 Làm chung ({authorsCount} TV nhóm)
                              </span>
                            )}
                            {paper.ranking && (
                              <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontWeight: 700 }}>
                                {paper.ranking}
                              </span>
                            )}
                            <span style={{ fontSize: '0.7rem', padding: '2px 7px', borderRadius: '4px', background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                              Năm {paper.year}
                            </span>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                padding: '2px 7px',
                                borderRadius: '4px',
                                fontWeight: 600,
                                background: paper.status === 'published' ? '#dcfce7' : paper.status === 'in_review' ? '#fef3c7' : '#e0e7ff',
                                color: paper.status === 'published' ? '#15803d' : paper.status === 'in_review' ? '#b45309' : '#4338ca',
                              }}
                            >
                              {paper.status === 'published' ? 'Đã xuất bản' : paper.status === 'in_review' ? 'Đang thẩm định' : 'Chấp nhận'}
                            </span>
                          </div>

                          <div style={{ fontWeight: 600, fontSize: '0.92rem', color: '#1e293b', lineHeight: 1.35 }}>
                            {paper.title}
                          </div>

                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '3px' }}>
                            <i className="fa-solid fa-book-journal-whills" style={{ marginRight: '4px', color: '#94a3b8' }} />
                            {paper.journal_name} {paper.issn ? `(ISSN: ${paper.issn})` : ''}
                          </div>
                        </div>

                        {paper.doi && (
                          <a
                            href={paper.doi.startsWith('http') ? paper.doi : `https://doi.org/${paper.doi}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid #e2e8f0',
                              background: '#ffffff',
                              color: '#6366f1',
                              fontSize: '0.75rem',
                              textDecoration: 'none',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              flexShrink: 0,
                            }}
                          >
                            DOI <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: '0.65rem' }} />
                          </a>
                        )}
                      </div>

                      {/* Co-authors from Team */}
                      {paper.team_author_names && paper.team_author_names.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', paddingTop: '0.35rem', borderTop: '1px solid #f1f5f9', fontSize: '0.78rem' }}>
                          <span style={{ color: '#64748b', fontWeight: 500 }}>Tác giả thuộc nhóm:</span>
                          {paper.team_author_names.map((name, idx) => (
                            <span key={idx} style={{ background: '#eef2ff', color: '#4338ca', padding: '1px 7px', borderRadius: '4px', fontWeight: 600 }}>
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: COLLABORATION NETWORK */}
        {activeTab === 'collabs' && (
          <div>
            <div style={{ marginBottom: '1rem', fontSize: '0.82rem', color: '#64748b' }}>
              Mạng lưới các bài báo nghiên cứu được thực hiện với sự phối hợp của 2 hoặc nhiều thành viên trong nhóm.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.88rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <i className="fa-solid fa-chart-pie" style={{ color: '#6366f1' }} /> Thống kê hợp tác nội bộ
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.8rem', color: '#475569' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Tổng số bài báo của nhóm:</span>
                    <strong>{papers.length} bài</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Số bài đồng tác giả nội bộ:</span>
                    <strong style={{ color: '#4338ca' }}>{collaborativePapers.length} bài</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Tỷ lệ hợp tác nhóm:</span>
                    <strong style={{ color: '#10b981' }}>
                      {papers.length > 0 ? Math.round((collaborativePapers.length / papers.length) * 100) : 0}%
                    </strong>
                  </div>
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1rem' }}>
                <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.88rem', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <i className="fa-solid fa-users" style={{ color: '#10b981' }} /> Thành viên tích cực phối hợp
                </div>
                <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                  {team.members.map((m) => {
                    const collabCount = collaborativePapers.filter((p) => p.team_author_ids?.includes(m.id)).length;
                    return (
                      <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                        <span>{m.name}:</span>
                        <strong>{collabCount} bài làm chung</strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
