import * as React from 'react';
import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { statsApi } from '../utils/api';

interface OverviewData {
  total_papers: number; published: number; in_review: number;
  q1_papers: number; authors: number; teams: number;
  papers_by_year: Array<{ year: string; count: number }>;
  papers_by_ranking: Array<{ ranking: string; count: number }>;
}

const COLORS: Record<string, string> = {
  Q1: '#6366f1', Q2: '#10b981', Q3: '#f59e0b', Q4: '#ef4444', Other: '#94a3b8'
};

const StatCard = ({ icon, label, value, color }: { icon: string; label: string; value: number | string; color: string }) => (
  <div style={{
    background: 'white', borderRadius: '12px', padding: '1.25rem',
    border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '1rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  }}>
    <div style={{
      width: '48px', height: '48px', borderRadius: '12px', background: color + '15',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
    }}>
      <i className={icon} style={{ color, fontSize: '1.25rem' }} />
    </div>
    <div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>{label}</div>
    </div>
  </div>
);

const Dashboard: React.FC = () => {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    setError(null);
    statsApi
      .overview()
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        console.error(err);
        setError(err.message || 'Không thể kết nối đến máy chủ API');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '4rem' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  if (error) return (
    <div style={{ padding: '2rem', textAlign: 'center', background: 'white', borderRadius: '16px', border: '1px solid #fee2e2' }}>
      <i className="fa-solid fa-triangle-exclamation" style={{ color: '#ef4444', fontSize: '2rem', marginBottom: '0.75rem' }} />
      <div style={{ fontWeight: 700, color: '#991b1b', marginBottom: '0.5rem' }}>Lỗi tải dữ liệu tổng quan</div>
      <div style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '1rem' }}>{error}</div>
      <button
        onClick={loadData}
        style={{
          padding: '0.5rem 1rem',
          borderRadius: '8px',
          border: 'none',
          background: '#4f46e5',
          color: 'white',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        <i className="fa-solid fa-arrows-rotate" style={{ marginRight: '6px' }} /> Thử lại
      </button>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a78bfa 100%)',
        borderRadius: '16px', padding: '1.75rem 2rem', color: 'white',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: '0 8px 24px rgba(99,102,241,0.3)'
      }}>
        <div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 0.5rem', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Kiểm định Liêm chính &amp; Đánh giá Khoa học
          </h2>
          <p style={{ margin: 0, opacity: 0.9, fontSize: '0.875rem', maxWidth: '500px' }}>
            Hệ thống tự động thẩm định chất lượng công trình, xác thực vai trò tác giả, và phát hiện tạp chí giả mạo dựa trên AI.
          </p>
        </div>
        <i className="fa-solid fa-shield-halved" style={{ fontSize: '3.5rem', opacity: 0.3 }} />
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        <StatCard icon="fa-solid fa-newspaper" label="Tổng bài báo" value={data?.total_papers ?? 0} color="#6366f1" />
        <StatCard icon="fa-solid fa-circle-check" label="Đã xuất bản" value={data?.published ?? 0} color="#10b981" />
        <StatCard icon="fa-solid fa-hourglass-half" label="Đang review" value={data?.in_review ?? 0} color="#f59e0b" />
        <StatCard icon="fa-solid fa-trophy" label="Bài báo Q1" value={data?.q1_papers ?? 0} color="#6366f1" />
        <StatCard icon="fa-solid fa-users" label="Thành viên" value={data?.authors ?? 0} color="#3b82f6" />
        <StatCard icon="fa-solid fa-layer-group" label="Nhóm nghiên cứu" value={data?.teams ?? 0} color="#8b5cf6" />
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
        <div style={{ background: 'white', borderRadius: '12px', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 1.25rem', fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>
            Xu hướng xuất bản theo năm
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.papers_by_year ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="year" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }} />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Số bài" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: '0 0 1.25rem', fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>
            Phân bổ theo Quartile
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={data?.papers_by_ranking ?? []} dataKey="count" nameKey="ranking"
                cx="50%" cy="50%" outerRadius={80} label={(props: any) => {
                  const { ranking, percent } = props;
                  return percent > 0.05 ? `${ranking} ${((percent ?? 0) * 100).toFixed(0)}%` : '';
                }}>
                {(data?.papers_by_ranking ?? []).map((entry) => (
                  <Cell key={entry.ranking} fill={COLORS[entry.ranking] ?? '#94a3b8'} />
                ))}
              </Pie>
              <Legend formatter={(value) => <span style={{ fontSize: '12px', color: '#475569' }}>{value}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent Activity Feed */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '1.25rem', border: '1px solid #e2e8f0' }}>
        <h3 style={{ margin: '0 0 1rem', fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>
          Nhật ký hoạt động gần đây
        </h3>
        {[
          { dot: '#6366f1', text: 'Hệ thống sẵn sàng. Chào mừng đến với Research Manager!', time: 'Vừa xong' },
          { dot: '#10b981', text: 'Dữ liệu tạp chí HĐGSNN đã được đồng bộ thành công.', time: '1 phút trước' },
          { dot: '#f59e0b', text: 'Module AI tính điểm PGS/GS đang chờ bài báo mới.', time: '5 phút trước' },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.625rem 0', borderBottom: i < 2 ? '1px solid #f8fafc' : 'none' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.dot, marginTop: '5px', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '0.875rem', color: '#374151' }}>{item.text}</span>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '0.5rem' }}>{item.time}</span>
            </div>
          </div>
        ))}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Dashboard;
