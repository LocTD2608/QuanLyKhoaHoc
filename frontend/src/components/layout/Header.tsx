import * as React from 'react';
import { UserProfile } from '../../types';

interface HeaderProps {
  title: string;
  user: UserProfile | null;
}

export const Header: React.FC<HeaderProps> = ({ title, user }) => {
  const roleColors: Record<string, string> = {
    admin: '#fef2f2|#dc2626',
    lead: '#fef9c3|#ca8a04',
    member: '#f0fdf4|#16a34a',
  };
  const [roleBg, roleColor] = (roleColors[user?.role ?? 'member'] ?? '#f1f5f9|#475569').split('|');

  return (
    <header
      style={{
        background: 'white',
        borderBottom: '1px solid #e2e8f0',
        padding: '1rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}
    >
      <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {title}
      </h1>
      {user && (
        <span
          style={{
            fontSize: '0.75rem',
            padding: '3px 10px',
            borderRadius: '99px',
            fontWeight: 600,
            background: roleBg,
            color: roleColor,
          }}
        >
          {user.role === 'admin' ? 'Admin' : user.role === 'lead' ? 'Lead' : 'Member'}
          {user.author?.name ? ` · ${user.author.name}` : ''}
        </span>
      )}
    </header>
  );
};
