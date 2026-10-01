import { useState } from 'react';
import { PointsCalculatorTab } from './PointsCalculatorTab';
import { CriteriaGuideTab } from './CriteriaGuideTab';
import { RoadmapTab } from './RoadmapTab';
import { DeclarationFormTab } from './DeclarationFormTab';

type Tab = 'declaration' | 'points' | 'criteria' | 'roadmap';

export default function UsefulInfoPage() {
  const [activeTab, setActiveTab] = useState<Tab>('declaration');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1300px', margin: '0 auto' }}>
      {/* Banner */}
      <div
        style={{
          padding: '1.5rem 1.75rem',
          background: 'linear-gradient(135deg, #4f46e5 0%, #312e81 100%)',
          color: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 4px 20px -2px rgba(79, 70, 229, 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 0.5rem 0', color: 'white' }}>
            Cẩm nang & Tra cứu Tiêu chuẩn PGS / GS
          </h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.875rem', margin: 0, maxWidth: '800px', lineHeight: 1.5 }}>
            Hệ thống hóa toàn bộ công thức tính điểm công trình khoa học, phân chia vai trò tác giả, mẫu tờ khai chuẩn Hội đồng Giáo sư Nhà nước và lộ trình thực hiện theo Quyết định 37/2018/QĐ-TTg & 25/2020/QĐ-TTg.
          </p>
        </div>
        <div style={{ fontSize: '2.5rem', opacity: 0.25 }}>
          <i className="fa-solid fa-book-open-reader" />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('declaration')}
          style={{
            padding: '0.6rem 1.2rem',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 700,
            cursor: 'pointer',
            background: activeTab === 'declaration' ? '#eef2ff' : 'transparent',
            color: activeTab === 'declaration' ? '#4f46e5' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s',
          }}
        >
          <i className="fa-solid fa-file-contract" style={{ color: activeTab === 'declaration' ? '#4f46e5' : '#94a3b8' }} />
          Mẫu Tờ khai Công trình KH (HĐGSNN)
          <span style={{ fontSize: '0.7rem', background: '#10b981', color: 'white', padding: '2px 7px', borderRadius: '10px' }}>
            Mẫu 08
          </span>
        </button>
        <button
          onClick={() => setActiveTab('points')}
          style={{
            padding: '0.6rem 1.2rem',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeTab === 'points' ? '#eef2ff' : 'transparent',
            color: activeTab === 'points' ? '#4f46e5' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s',
          }}
        >
          <i className="fa-solid fa-calculator" /> Công thức & Trình tính điểm
        </button>
        <button
          onClick={() => setActiveTab('criteria')}
          style={{
            padding: '0.6rem 1.2rem',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeTab === 'criteria' ? '#eef2ff' : 'transparent',
            color: activeTab === 'criteria' ? '#4f46e5' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s',
          }}
        >
          <i className="fa-solid fa-scale-balanced" /> Tiêu chuẩn xét duyệt GS/PGS
        </button>
        <button
          onClick={() => setActiveTab('roadmap')}
          style={{
            padding: '0.6rem 1.2rem',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 600,
            cursor: 'pointer',
            background: activeTab === 'roadmap' ? '#eef2ff' : 'transparent',
            color: activeTab === 'roadmap' ? '#4f46e5' : '#64748b',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.15s',
          }}
        >
          <i className="fa-solid fa-route" /> Tiến trình xét duyệt chuẩn
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'declaration' && <DeclarationFormTab />}
      {activeTab === 'points' && <PointsCalculatorTab />}
      {activeTab === 'criteria' && <CriteriaGuideTab />}
      {activeTab === 'roadmap' && <RoadmapTab />}
    </div>
  );
}
