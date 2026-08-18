import * as React from 'react';
import { ChecklistData } from '../../../types';

interface EligibilityChecklistProps {
  pgs: ChecklistData;
  gs: ChecklistData;
}

const getPercent = (curr: number, req: number) => {
  if (!req || req <= 0) return 100;
  return Math.min(Math.round(((curr || 0) / req) * 100), 100);
};

const ChecklistBlock: React.FC<{ title: string; data: ChecklistData; badgeColor: string }> = ({
  title,
  data,
  badgeColor,
}) => {
  const items = [
    { label: 'Tổng điểm công trình KH', current: data?.total_score_current, req: data?.total_score_required, pass: !!data?.total_score_pass, unit: 'điểm' },
    { label: 'Điểm 3 năm gần nhất', current: data?.last3_score_current, req: data?.last3_score_required, pass: !!data?.last3_score_pass, unit: 'điểm' },
    { label: 'Điểm bài báo tạp chí uy tín', current: data?.journal_score_current, req: data?.journal_score_required, pass: !!data?.journal_score_pass, unit: 'điểm' },
    { label: 'Số bài báo là tác giả chính', current: data?.main_author_current, req: data?.main_author_required, pass: !!data?.main_author_pass, unit: 'bài' },
  ];

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '20px',
        border: '1px solid #e2e8f0',
        padding: '1.5rem',
        flex: '1 1 450px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.02)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{title}</h3>
        <span
          style={{
            padding: '4px 12px',
            borderRadius: '99px',
            fontSize: '0.75rem',
            fontWeight: 700,
            background: data?.eligible ? '#dcfce7' : '#fee2e2',
            color: data?.eligible ? '#166534' : '#991b1b',
          }}
        >
          {data?.eligible ? '✓ ĐỦ ĐIỀU KIỆN' : '✗ CHƯA ĐẠT'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {items.map((item, idx) => {
          const pct = getPercent(item.current || 0, item.req || 0);
          const currentVal = typeof item.current === 'number' ? item.current.toFixed(1) : (item.current ?? 0);
          const reqVal = typeof item.req === 'number' ? item.req : (item.req ?? 0);

          return (
            <div key={idx}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.825rem', marginBottom: '4px' }}>
                <span style={{ color: '#334155', fontWeight: 500 }}>{item.label}</span>
                <span style={{ fontWeight: 600, color: item.pass ? '#059669' : '#dc2626' }}>
                  {currentVal} / {reqVal} {item.unit} ({pct}%)
                </span>
              </div>
              <div style={{ height: '6px', width: '100%', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: item.pass ? badgeColor : '#f87171',
                    borderRadius: '99px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const EligibilityChecklist: React.FC<EligibilityChecklistProps> = ({ pgs, gs }) => {
  return (
    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
      <ChecklistBlock title="Tiêu chuẩn Phó Giáo sư (PGS)" data={pgs} badgeColor="#4f46e5" />
      <ChecklistBlock title="Tiêu chuẩn Giáo sư (GS)" data={gs} badgeColor="#7c3aed" />
    </div>
  );
};
