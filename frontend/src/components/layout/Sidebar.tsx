import * as React from 'react';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { UserProfile } from '../../types';

interface SidebarProps {
  user: UserProfile | null;
  onLogout: () => void;
}

const NAV_ITEMS = [
  { to: '/dashboard', icon: 'fa-solid fa-table-cells-large', label: 'Tổng quan' },
  { to: '/papers', icon: 'fa-solid fa-file-lines', label: 'Bài báo' },
  { to: '/teams', icon: 'fa-solid fa-users', label: 'Nhóm & KPI' },
  { to: '/authors', icon: 'fa-solid fa-user', label: 'Thành viên' },
  { to: '/venues', icon: 'fa-solid fa-book-open', label: 'Tạp chí / HN' },
  { to: '/journal-catalog', icon: 'fa-solid fa-bars-staggered', label: 'Danh mục HĐGSNN' },
  { to: '/profile', icon: 'fa-solid fa-circle-user', label: 'Hồ sơ của tôi' },
  { to: '/simulator', icon: 'fa-solid fa-gauge', label: 'Mô phỏng PGS/GS' },
  { to: '/info', icon: 'fa-solid fa-circle-info', label: 'Thông tin hữu ích' },
];

export const Sidebar: React.FC<SidebarProps> = ({ user, onLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = (user?.username ?? '').slice(0, 2).toUpperCase();
  const roleColors: Record<string, string> = {
    admin: '#fef2f2|#dc2626',
    lead: '#fef9c3|#ca8a04',
    member: '#f0fdf4|#16a34a',
  };
  const [roleBg, roleColor] = (roleColors[user?.role ?? 'member'] ?? '#f1f5f9|#475569').split('|');

  return (
    <aside
      style={{
        width: '240px',
        flexShrink: 0,
        background: 'white',
        borderRight: '1px solid #e2e8f0',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 50,
      }}
    >
      {/* Logo */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          padding: '1.125rem 1.25rem',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <i className="fa-solid fa-book-bookmark" style={{ color: 'white', fontSize: '0.875rem' }} />
        </div>
        <div>
          <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Research
          </div>
          <div style={{ fontSize: '0.72rem', color: '#94a3b8', lineHeight: 1.1 }}>Paper Manager</div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '0.75rem 0.625rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {NAV_ITEMS.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '0.625rem',
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: 500,
              transition: 'all 0.15s',
              background: isActive ? '#eef2ff' : 'transparent',
              color: isActive ? '#4338ca' : '#64748b',
            })}
          >
            <i className={icon} style={{ width: '16px', textAlign: 'center', fontSize: '0.875rem' }} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User menu */}
      <div style={{ padding: '0.625rem', borderTop: '1px solid #e2e8f0', position: 'relative' }}>
        <button
          onClick={() => setMenuOpen((m) => !m)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '0.625rem',
            padding: '0.5rem 0.625rem',
            borderRadius: '8px',
            border: 'none',
            background: 'none',
            cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: '#6366f1',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.75rem',
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.username}
            </div>
            {user?.author?.name && (
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.author.name}
              </div>
            )}
          </div>
          <i className={`fa-solid fa-chevron-${menuOpen ? 'up' : 'down'}`} style={{ fontSize: '0.7rem', color: '#94a3b8', flexShrink: 0 }} />
        </button>

        {menuOpen && (
          <div
            style={{
              position: 'absolute',
              bottom: '100%',
              left: '0.625rem',
              right: '0.625rem',
              background: 'white',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
              overflow: 'hidden',
              zIndex: 100,
            }}
          >
            <div style={{ padding: '0.75rem', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginBottom: '0.25rem' }}>Vai trò</div>
              <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '99px', fontWeight: 600, background: roleBg, color: roleColor }}>
                {user?.role === 'admin' ? 'Admin' : user?.role === 'lead' ? 'Lead' : 'Member'}
              </span>
            </div>
            <button
              onClick={onLogout}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 0.75rem',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: '#ef4444',
                fontSize: '0.85rem',
              }}
            >
              <i className="fa-solid fa-right-from-bracket" /> Đăng xuất
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
