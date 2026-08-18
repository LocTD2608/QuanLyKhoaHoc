import * as React from 'react';
import { useState } from 'react';

const STEPS = [
  {
    step: 1,
    title: 'Giai đoạn 1: Chuẩn bị Thâm niên & Giờ giảng chuẩn',
    items: [
      'Thâm niên: Ứng viên PGS cần ≥ 3 năm sau bằng Tiến sĩ; ứng viên GS cần ≥ 3 năm sau khi bổ nhiệm PGS.',
      'Giảng dạy: Tích lũy số giờ giảng trực tiếp ≥ 137.5 giờ/năm (chiếm 50% của tổng ≥ 275 giờ giảng chuẩn).',
      'Ngoại ngữ: Đạt chứng chỉ ngoại ngữ B2 (IELTS ≥ 5.5, TOEIC ≥ 701, VSTEP B2) nếu chưa đủ điều kiện miễn.',
    ],
  },
  {
    step: 2,
    title: 'Giai đoạn 2: Tập trung Nghiên cứu & Công bố khoa học',
    items: [
      'Kế hoạch công bố: Đăng tối thiểu 3 bài báo quốc tế uy tín ISI/Scopus (PGS) hoặc 5 bài báo (GS) vai trò tác giả chính.',
      'Tích lũy điểm: Viết sách chuyên khảo, giáo trình, đăng ký độc quyền sáng chế để đạt đủ tổng điểm tối thiểu.',
      'Liêm chính học thuật: Kiểm tra kỹ và tránh các tạp chí trong danh sách predatory/giả mạo.',
    ],
  },
  {
    step: 3,
    title: 'Giai đoạn 3: Hoàn thiện Đề tài KH&CN và Đào tạo sau Đại học',
    items: [
      'Nhiệm vụ KH&CN: Chủ trì đề tài cấp Bộ / Quốc gia đúng quy định.',
      'Hướng dẫn đào tạo: Hoàn tất thủ tục công nhận bảo vệ thành công cho học viên ThS / NCS TS.',
    ],
  },
  {
    step: 4,
    title: 'Giai đoạn 4: Thẩm định hồ sơ tại Hội đồng Giáo sư Cơ sở',
    items: [
      'Nộp hồ sơ trực tuyến và bản cứng theo mẫu HĐGSNN.',
      'Trình bày báo cáo tổng quan và kiểm tra hồ sơ thực tế tại cơ sở.',
    ],
  },
  {
    step: 5,
    title: 'Giai đoạn 5: Thẩm định tại Hội đồng Giáo sư Ngành / Liên ngành',
    items: [
      'Hội đồng ngành phân công thẩm định chi tiết từng công trình.',
      'Phỏng vấn ngoại ngữ và đánh giá năng lực học thuật chuyên sâu.',
    ],
  },
  {
    step: 6,
    title: 'Giai đoạn 6: Xét duyệt và Công nhận tại Hội đồng Giáo sư Nhà nước',
    items: [
      'HĐGSNN họp biểu quyết công nhận đạt chuẩn chức danh GS/PGS.',
      'Cơ sở đào tạo thực hiện quy trình bổ nhiệm chính thức.',
    ],
  },
];

export const RoadmapTab: React.FC = () => {
  const [expandedStep, setExpandedStep] = useState<number>(1);

  return (
    <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <i className="fa-solid fa-route" style={{ color: '#4f46e5' }} /> Tiến trình chuẩn bị và xét đạt chuẩn GS / PGS
        </h3>
        <p style={{ fontSize: '0.78rem', color: '#64748b', margin: '4px 0 0 0' }}>
          6 giai đoạn chuẩn từ xây dựng học thuật đến thẩm định Hội đồng Nhà nước. Nhấp vào từng bước để xem chi tiết.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {STEPS.map((s) => {
          const isExpanded = expandedStep === s.step;
          return (
            <div
              key={s.step}
              onClick={() => setExpandedStep(isExpanded ? 0 : s.step)}
              style={{
                border: isExpanded ? '1px solid #c7d2fe' : '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '1rem',
                background: isExpanded ? '#f8fafc' : 'white',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      background: isExpanded ? '#4f46e5' : '#e2e8f0',
                      color: isExpanded ? 'white' : '#64748b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                    }}
                  >
                    {s.step}
                  </div>
                  <h4 style={{ margin: 0, fontSize: '0.925rem', fontWeight: 700, color: isExpanded ? '#4f46e5' : '#1e293b' }}>
                    {s.title}
                  </h4>
                </div>
                <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`} style={{ color: '#94a3b8', fontSize: '0.8rem' }} />
              </div>

              {isExpanded && (
                <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.825rem', color: '#475569' }}>
                  {s.items.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                      <span style={{ color: '#4f46e5' }}>•</span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
