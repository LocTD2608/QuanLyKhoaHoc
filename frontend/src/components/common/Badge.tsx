import * as React from 'react';
import { AuthorRoleType } from '../../types';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    published: { label: 'Đã xuất bản', bg: '#d1fae5', color: '#065f46' },
    in_review: { label: 'Đang review', bg: '#fef3c7', color: '#92400e' },
    rejected: { label: 'Bị từ chối', bg: '#fee2e2', color: '#991b1b' },
    draft: { label: 'Bản nháp', bg: '#f1f5f9', color: '#475569' },
  };
  const v = map[status] ?? { label: status, bg: '#f1f5f9', color: '#475569' };
  return (
    <span
      style={{
        padding: '2px 10px',
        borderRadius: '99px',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: v.bg,
        color: v.color,
        whiteSpace: 'nowrap',
      }}
    >
      {v.label}
    </span>
  );
};

interface RankBadgeProps {
  ranking?: string;
}

export const RankBadge: React.FC<RankBadgeProps> = ({ ranking }) => {
  if (!ranking) return null;
  const map: Record<string, string> = {
    Q1: '#6366f1',
    Q2: '#10b981',
    Q3: '#f59e0b',
    Q4: '#ef4444',
    'A*': '#8b5cf6',
    A: '#3b82f6',
    B: '#64748b',
  };
  const color = map[ranking] ?? '#94a3b8';
  return (
    <span
      style={{
        padding: '2px 8px',
        borderRadius: '6px',
        fontSize: '0.72rem',
        fontWeight: 700,
        background: `${color}20`,
        color: color,
        whiteSpace: 'nowrap',
      }}
    >
      {ranking}
    </span>
  );
};

interface RoleBadgeProps {
  role: AuthorRoleType;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role }) => {
  const map: Record<AuthorRoleType, { label: string; bg: string; color: string; border: string }> = {
    main: { label: 'Tác giả chính', bg: '#d1fae5', color: '#065f46', border: '#a7f3d0' },
    member: { label: 'Tác giả phụ', bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
    corresponding: { label: 'Tác giả liên hệ', bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
  };
  const v = map[role] || map.member;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '6px',
        fontSize: '0.72rem',
        fontWeight: 600,
        background: v.bg,
        color: v.color,
        border: `1px solid ${v.border}`,
      }}
    >
      {v.label}
    </span>
  );
};
