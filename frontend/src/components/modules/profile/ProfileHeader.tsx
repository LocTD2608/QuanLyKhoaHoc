import * as React from 'react';
import { UserProfile } from '../../../types';

interface ProfileHeaderProps {
  user: UserProfile;
}

export const ProfileHeader: React.FC<ProfileHeaderProps> = ({ user }) => {
  const author = user?.author;
  const initials = (author?.name ?? user?.username ?? '?').split(' ').pop()?.charAt(0).toUpperCase() ?? '?';

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid #e2e8f0',
        borderRadius: '20px',
        padding: '1.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1.5rem',
        boxShadow: '0 4px 20px -2px rgba(50, 50, 93, 0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '2rem',
            fontWeight: 800,
            boxShadow: '0 8px 16px -4px rgba(79, 70, 229, 0.4)',
          }}
        >
          {initials}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.025em' }}>
              {author?.name ?? user?.username ?? 'Thành viên'}
            </h1>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '3px 12px',
                borderRadius: '99px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                background: user.role === 'admin' ? '#fee2e2' : '#dcfce7',
                color: user.role === 'admin' ? '#991b1b' : '#166534',
              }}
            >
              {user.role === 'admin' ? 'Quản trị viên' : author?.group_type || 'Giảng viên'}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#475569' }}>
              <i className="fa-solid fa-graduation-cap" style={{ color: '#6366f1', width: '16px' }} />
              <span>Ngành: <strong>{author?.academic_field || 'Công nghệ thông tin'}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.825rem', color: '#64748b' }}>
              <i className="fa-solid fa-building" style={{ color: '#94a3b8', width: '16px' }} />
              <span>{author?.affiliation || 'Học viện Công nghệ Bưu chính Viễn thông'}</span>
            </div>
            {author?.email && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.825rem', color: '#64748b' }}>
                <i className="fa-solid fa-envelope" style={{ color: '#94a3b8', width: '16px' }} />
                <span>{author.email}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
