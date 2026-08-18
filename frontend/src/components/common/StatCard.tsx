import * as React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: string;
  iconBg?: string;
  iconColor?: string;
  subtitle?: string;
  badge?: { label: string; bg: string; color: string };
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  iconBg = '#eef2ff',
  iconColor = '#4f46e5',
  subtitle,
  badge,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'white',
        borderRadius: '12px',
        padding: '1.25rem',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
      }}
    >
      <div>
        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 500, marginBottom: '0.25rem' }}>
          {title}
        </div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
          {value}
        </div>
        {subtitle && (
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>{subtitle}</div>
        )}
      </div>
      {icon && (
        <div
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '10px',
            background: iconBg,
            color: iconColor,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.25rem',
            flexShrink: 0,
          }}
        >
          <i className={icon} />
        </div>
      )}
      {badge && (
        <span
          style={{
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: badge.bg,
            color: badge.color,
          }}
        >
          {badge.label}
        </span>
      )}
    </div>
  );
};
