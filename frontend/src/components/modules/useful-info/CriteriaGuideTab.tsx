import * as React from 'react';
import { useState } from 'react';

type Domain = 'khtn' | 'khxh';

export const CriteriaGuideTab: React.FC = () => {
  const [selectedDomain, setSelectedDomain] = useState<Domain>('khtn');

  return (
    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <i className="fa-solid fa-scale-balanced" style={{ color: '#4f46e5' }} /> Bảng đối chiếu tiêu chuẩn chức danh Giáo sư & Phó Giáo sư
        </h3>
        <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
          <button
            onClick={() => setSelectedDomain('khtn')}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: selectedDomain === 'khtn' ? '#ffffff' : 'transparent',
              color: selectedDomain === 'khtn' ? '#4f46e5' : '#64748b',
              boxShadow: selectedDomain === 'khtn' ? '0 1px 3px rgba(0, 0, 0, 0.05)' : 'none',
            }}
          >
            KHTN & Công nghệ
          </button>
          <button
            onClick={() => setSelectedDomain('khxh')}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.75rem',
              fontWeight: 600,
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer',
              background: selectedDomain === 'khxh' ? '#ffffff' : 'transparent',
              color: selectedDomain === 'khxh' ? '#4f46e5' : '#64748b',
              boxShadow: selectedDomain === 'khxh' ? '0 1px 3px rgba(0, 0, 0, 0.05)' : 'none',
            }}
          >
            KHXH & Nhân văn
          </button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
          <thead>
            <tr style={{ background: '#f8fafc', borderBottom: '2px solid #cbd5e1' }}>
              <th style={{ padding: '0.8rem 1rem', color: '#475569', fontWeight: 700, width: '25%' }}>Tiêu chí thẩm định</th>
              <th style={{ padding: '0.8rem 1rem', color: '#475569', fontWeight: 700, width: '37.5%' }}>Phó Giáo Sư (PGS)</th>
              <th style={{ padding: '0.8rem 1rem', color: '#475569', fontWeight: 700, width: '37.5%' }}>Giáo Sư (GS)</th>
            </tr>
          </thead>
          <tbody style={{ color: '#334155' }}>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>Thời gian công tác</td>
              <td style={{ padding: '0.75rem 1rem' }}>≥ 6 năm (Trong đó 3 năm cuối liên tiếp giảng dạy)</td>
              <td style={{ padding: '0.75rem 1rem' }}>≥ 9 năm (Trong đó ≥ 3 năm sau khi bổ nhiệm PGS)</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>Bằng cấp học thuật</td>
              <td style={{ padding: '0.75rem 1rem' }}>≥ 3 năm kể từ ngày được cấp bằng Tiến sĩ</td>
              <td style={{ padding: '0.75rem 1rem' }}>≥ 3 năm kể từ ngày có quyết định bổ nhiệm PGS</td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0', background: '#fdf4ff' }}>
              <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#a21caf' }}>Tổng điểm công trình KH</td>
              <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#a21caf' }}>
                ≥ 10.0 điểm tổng số (Trong đó ≥ 2.5 điểm quy đổi tích lũy trong 3 năm cuối)
              </td>
              <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#a21caf' }}>
                ≥ 20.0 điểm tổng số (Trong đó ≥ 5.0 điểm quy đổi tích lũy trong 3 năm cuối)
              </td>
            </tr>
            <tr
              style={{
                borderBottom: '1px solid #e2e8f0',
                background: selectedDomain === 'khtn' ? '#f0fdf4' : 'transparent',
              }}
            >
              <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: selectedDomain === 'khtn' ? '#15803d' : '#0f172a' }}>
                Điểm bài báo KH (KHTN-KT-CN-Y)
              </td>
              <td style={{ padding: '0.75rem 1rem', fontWeight: selectedDomain === 'khtn' ? 600 : 400 }}>
                ≥ 6.0 điểm từ bài báo khoa học, bằng độc quyền sáng chế, giải pháp hữu ích
              </td>
              <td style={{ padding: '0.75rem 1rem', fontWeight: selectedDomain === 'khtn' ? 600 : 400 }}>
                ≥ 12.0 điểm từ bài báo khoa học, bằng độc quyền sáng chế, giải pháp hữu ích
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>Công trình chủ trì (Tác giả chính)</td>
              <td style={{ padding: '0.75rem 1rem' }}>
                <strong>Từ 2020: ≥ 3 CTKH</strong> công bố trên tạp chí quốc tế ISI/Scopus.
              </td>
              <td style={{ padding: '0.75rem 1rem' }}>
                <strong>Từ 2020: ≥ 5 CTKH</strong> công bố trên tạp chí quốc tế ISI/Scopus.
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#0f172a' }}>Đào tạo học viên & NCS</td>
              <td style={{ padding: '0.75rem 1rem' }}>
                Hướng dẫn thành công <strong>≥ 2 ThS</strong> hoặc <strong>≥ 1 Tiến sĩ</strong> đã bảo vệ.
              </td>
              <td style={{ padding: '0.75rem 1rem' }}>
                Hướng dẫn chính thành công <strong>≥ 2 Tiến sĩ</strong> đã bảo vệ.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
