import * as React from 'react';
import { Totals } from '../../../types';
import { StatCard } from '../../common/StatCard';

interface ScoreSummaryCardsProps {
  totals: Totals;
}

export const ScoreSummaryCards: React.FC<ScoreSummaryCardsProps> = ({ totals }) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
      <StatCard
        title="Tổng điểm quy đổi"
        value={typeof totals?.total_score === 'number' ? totals.total_score.toFixed(2) : '0.00'}
        icon="fa-solid fa-trophy"
        iconBg="#eef2ff"
        iconColor="#4f46e5"
        subtitle={`Trên ${totals?.scored_papers_count ?? 0} công trình đã tính điểm`}
      />
      <StatCard
        title="Điểm 3 năm gần nhất"
        value={typeof totals?.last3_score === 'number' ? totals.last3_score.toFixed(2) : '0.00'}
        icon="fa-solid fa-clock-rotate-left"
        iconBg="#ecfdf5"
        iconColor="#059669"
        subtitle="Tiêu chí trọng yếu HĐGSNN"
      />
      <StatCard
        title="Điểm từ bài báo / Tạp chí"
        value={typeof totals?.journal_score === 'number' ? totals.journal_score.toFixed(2) : '0.00'}
        icon="fa-solid fa-newspaper"
        iconBg="#fef3c7"
        iconColor="#d97706"
        subtitle="WoS/Scopus & Tạp chí ngành"
      />
      <StatCard
        title="Bài báo là tác giả chính"
        value={totals?.main_author_papers_count ?? 0}
        icon="fa-solid fa-star"
        iconBg="#fdf2f8"
        iconColor="#db2777"
        subtitle={`Trên tổng số ${totals?.total_papers_count ?? 0} bài báo`}
      />
    </div>
  );
};
