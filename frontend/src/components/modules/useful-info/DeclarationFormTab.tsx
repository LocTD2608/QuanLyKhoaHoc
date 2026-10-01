import * as React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../../../utils/toast';

interface PaperDeclarationItem {
  stt: number;
  titleVn: string;
  titleEn: string;
  role: 'Tác giả chính (First)' | 'Tác giả liên hệ (Corr.)' | 'Đồng tác giả (Member)';
  coAuthors: string;
  journal: string;
  volIssuePages: string;
  year: number;
  indexType: 'WoS (Q1)' | 'WoS (Q2)' | 'Scopus (Q3)' | 'HĐGSNN (1.0đ)' | 'HĐGSNN (0.75đ)';
  doi: string;
  maxScore: number;
  claimedScore: number;
}

const SAMPLE_PAPERS: PaperDeclarationItem[] = [
  {
    stt: 1,
    titleVn: 'Ứng dụng Học sâu trong Tự động Giám định & Xác thực Bài báo Khoa học',
    titleEn: 'Deep Learning for Automated Scientific Article Disambiguation and Verification',
    role: 'Tác giả chính (First)',
    coAuthors: 'Nguyễn Văn An, Trần Thị Bình, Lê Văn Cường',
    journal: 'Expert Systems with Applications (Elsevier)',
    volIssuePages: 'Vol. 238, Art. 120556, pp. 1-14',
    year: 2024,
    indexType: 'WoS (Q1)',
    doi: '10.1016/j.eswa.2023.120556',
    maxScore: 2.0,
    claimedScore: 1.0,
  },
  {
    stt: 2,
    titleVn: 'Khung kiến trúc Phân tích Dữ liệu chuỗi thời gian phân tán cho Mạng lưới Cảm biến IoT',
    titleEn: 'A Distributed Time-Series Analytic Framework for Dense Sensor Networks',
    role: 'Tác giả liên hệ (Corr.)',
    coAuthors: 'Phạm Minh Đức, Nguyễn Văn An*',
    journal: 'IEEE Internet of Things Journal',
    volIssuePages: 'Vol. 11, No. 4, pp. 6120-6133',
    year: 2023,
    indexType: 'WoS (Q1)',
    doi: '10.1109/JIOT.2023.3289110',
    maxScore: 2.0,
    claimedScore: 1.0,
  },
  {
    stt: 3,
    titleVn: 'Đánh giá Hiệu năng Cơ chế Đồng thuận BFT trong Hệ thống Hồ sơ Y tế Điện tử',
    titleEn: 'Performance Evaluation of BFT Consensus in Decentralized Electronic Health Records',
    role: 'Tác giả chính (First)',
    coAuthors: 'Nguyễn Văn An, Hoàng Thị Mai',
    journal: 'Tạp chí Tin học và Điều khiển học (VAST)',
    volIssuePages: 'Tập 39, Số 2, tr. 145-156',
    year: 2023,
    indexType: 'HĐGSNN (1.0đ)',
    doi: '10.15625/1813-9663/39/2/18021',
    maxScore: 1.0,
    claimedScore: 0.67,
  },
  {
    stt: 4,
    titleVn: 'Mô hình Ngôn ngữ Lớn cho Hệ thống Trả lời Câu hỏi Y khoa Đa ngữ',
    titleEn: 'Cross-Lingual Clinical Question Answering using Fine-Tuned Transformer Models',
    role: 'Đồng tác giả (Member)',
    coAuthors: 'Trần Thị Bình, Nguyễn Văn An, Đỗ Hoàng Long',
    journal: 'Journal of Biomedical Informatics',
    volIssuePages: 'Vol. 142, pp. 104389',
    year: 2022,
    indexType: 'WoS (Q2)',
    doi: '10.1016/j.jbi.2023.104389',
    maxScore: 1.5,
    claimedScore: 0.5,
  },
  {
    stt: 5,
    titleVn: 'Phương pháp Cân bằng tải Động trong Điện toán Đám mây Biên',
    titleEn: 'Dynamic Load Balancing Heuristics for Heterogeneous Edge-Cloud Clusters',
    role: 'Tác giả chính (First)',
    coAuthors: 'Nguyễn Văn An, Lê Văn Cường',
    journal: 'Chuyên san Các công trình Nghiên cứu, Phát triển và Ứng dụng CNTT-TT',
    volIssuePages: 'Số V-1, Tập 2022, tr. 45-53',
    year: 2022,
    indexType: 'HĐGSNN (0.75đ)',
    doi: '10.32913/mic-ict-research.v2022.n1.102',
    maxScore: 0.75,
    claimedScore: 0.5,
  }
];

export const DeclarationFormTab: React.FC = () => {
  const navigate = useNavigate();
  const [formMode, setFormMode] = useState<'sample' | 'blank'>('sample');
  const [formType, setFormType] = useState<'mau08' | 'mau04' | 'xacnhan'>('mau08');

  const papers = formMode === 'sample' ? SAMPLE_PAPERS : [];
  const totalMaxScore = papers.reduce((sum, p) => sum + p.maxScore, 0);
  const totalClaimedScore = papers.reduce((sum, p) => sum + p.claimedScore, 0);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyTable = () => {
    const header = "STT\tTên bài báo\tVai trò\tTác giả\tTạp chí\tNăm\tPhân loại\tMã DOI\tĐiểm tối đa\tĐiểm kê khai\n";
    const rows = SAMPLE_PAPERS.map(p => 
      `${p.stt}\t${p.titleVn} (${p.titleEn})\t${p.role}\t${p.coAuthors}\t${p.journal} (${p.volIssuePages})\t${p.year}\t${p.indexType}\t${p.doi}\t${p.maxScore}\t${p.claimedScore}`
    ).join("\n");

    navigator.clipboard.writeText(header + rows);
    showToast('Đã sao chép danh mục bài báo vào Clipboard (dễ dàng dán vào Word/Excel)!', 'success');
  };

  const handleGoToOcr = () => {
    navigate('/papers', { state: { openAiDeclaration: true } });
    showToast('Đang chuyển hướng sang mô-đun Khai báo & Thẩm định AI...', 'info');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Action Toolbar */}
      <div
        style={{
          background: 'white',
          borderRadius: '16px',
          border: '1px solid #e2e8f0',
          padding: '1.25rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
            <button
              onClick={() => setFormMode('sample')}
              style={{
                padding: '0.45rem 0.9rem',
                fontSize: '0.825rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: formMode === 'sample' ? '#ffffff' : 'transparent',
                color: formMode === 'sample' ? '#4f46e5' : '#64748b',
                boxShadow: formMode === 'sample' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <i className="fa-solid fa-file-circle-check" style={{ marginRight: '6px' }} />
              Bản khai mẫu (Điền sẵn minh họa)
            </button>
            <button
              onClick={() => setFormMode('blank')}
              style={{
                padding: '0.45rem 0.9rem',
                fontSize: '0.825rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: formMode === 'blank' ? '#ffffff' : 'transparent',
                color: formMode === 'blank' ? '#4f46e5' : '#64748b',
                boxShadow: formMode === 'blank' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <i className="fa-solid fa-file-pen" style={{ marginRight: '6px' }} />
              Khung mẫu trống (In tự điền)
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.825rem', fontWeight: 600, color: '#475569' }}>Loại mẫu:</label>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value as any)}
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '0.825rem',
                color: '#1e293b',
                fontWeight: 500,
              }}
            >
              <option value="mau08">Mẫu 08 - Bản khai Công trình KH tiêu biểu (HĐGSNN)</option>
              <option value="mau04">Mẫu 04 - Báo cáo Tổng quan Toàn bộ công trình</option>
              <option value="xacnhan">Mẫu Giấy xác nhận Phân chia vai trò tác giả</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleCopyTable}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#334155',
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Sao chép bảng dữ liệu để dán vào Microsoft Word hoặc Excel"
          >
            <i className="fa-solid fa-copy" />
            Sao chép bảng
          </button>

          <button
            onClick={handlePrint}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: '1px solid #4f46e5',
              background: '#eef2ff',
              color: '#4f46e5',
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Xem trước bản in hoặc xuất PDF theo quy chuẩn văn bản"
          >
            <i className="fa-solid fa-print" />
            In / Xuất PDF
          </button>

          <button
            onClick={handleGoToOcr}
            style={{
              padding: '0.5rem 1.1rem',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
              color: 'white',
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(5, 150, 105, 0.25)',
            }}
            title="Sử dụng AI OCR Vision để tự động nhận diện trang bài báo hoặc tờ khai"
          >
            <i className="fa-solid fa-camera-retro" />
            Quét OCR Tờ khai này
          </button>
        </div>
      </div>

      {/* Printable Sheet Container */}
      <div
        className="declaration-sheet"
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          border: '1px solid #cbd5e1',
          padding: '3rem 3.5rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.04)',
          position: 'relative',
          fontFamily: "'Times New Roman', Times, serif",
          color: '#111827',
          lineHeight: 1.45,
        }}
      >
        {/* National Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', textAlign: 'center', marginBottom: '2rem' }}>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, textTransform: 'uppercase' }}>
              HỘI ĐỒNG GIÁO SƯ NHÀ NƯỚC
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>
              HỘI ĐỒNG GIÁO SƯ LIÊN NGÀNH
            </div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, textTransform: 'uppercase' }}>
              CÔNG NGHỆ THÔNG TIN
            </div>
            <div style={{ width: '80px', height: '1px', background: '#000', margin: '6px auto 0' }} />
          </div>

          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, textTransform: 'uppercase' }}>
              CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM
            </div>
            <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>
              Độc lập - Tự do - Hạnh phúc
            </div>
            <div style={{ width: '120px', height: '1px', background: '#000', margin: '6px auto 0' }} />
            <div style={{ fontSize: '0.85rem', fontStyle: 'italic', marginTop: '8px' }}>
              Hà Nội, ngày 30 tháng 09 năm 2026
            </div>
          </div>
        </div>

        {/* Document Title */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, float: 'right', border: '1px solid #000', padding: '4px 10px', marginTop: '-1.5rem' }}>
            Mẫu số 08
          </div>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: '0 0 0.5rem 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            BẢN KÊ KHAI CÔNG TRÌNH KHOA HỌC TIÊU BIỂU
          </h2>
          <div style={{ fontSize: '1rem', fontStyle: 'italic', fontWeight: 600 }}>
            (Phục vụ xét đạt tiêu chuẩn chức danh: PHÓ GIÁO SƯ NĂM 2026)
          </div>
        </div>

        {/* Section I: Candidate Information */}
        <div style={{ marginBottom: '1.75rem' }}>
          <h4 style={{ fontSize: '1.05rem', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 0.75rem 0' }}>
            I. THÔNG TIN ỨNG VIÊN
          </h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem 1.5rem', fontSize: '0.95rem' }}>
            <div>
              <strong>1. Họ và tên ứng viên: </strong>
              <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>
                {formMode === 'sample' ? 'NGUYỄN VĂN AN' : '....................................................................'}
              </span>
            </div>
            <div>
              <strong>2. Ngày, tháng, năm sinh: </strong>
              <span>{formMode === 'sample' ? '15/08/1986' : '...................................................'}</span>
            </div>
            <div>
              <strong>3. Học vị cao nhất: </strong>
              <span>{formMode === 'sample' ? 'Tiến sĩ (Năm nhận bằng: 2017)' : '...................................................'}</span>
            </div>
            <div>
              <strong>4. Nơi cấp bằng TS: </strong>
              <span>{formMode === 'sample' ? 'Đại học Bách Khoa Hà Nội' : '...................................................'}</span>
            </div>
            <div>
              <strong>5. Ngành / Chuyên ngành: </strong>
              <span>{formMode === 'sample' ? 'Công nghệ thông tin / Khoa học máy tính' : '...................................................'}</span>
            </div>
            <div>
              <strong>6. Cơ quan công tác hiện nay: </strong>
              <span>{formMode === 'sample' ? 'Khoa Công nghệ thông tin - Trường Đại học Công nghệ' : '...................................................'}</span>
            </div>
            <div>
              <strong>7. Chức vụ hiện tại: </strong>
              <span>{formMode === 'sample' ? 'Giảng viên chính, Trưởng PTN Trí tuệ nhân tạo' : '...................................................'}</span>
            </div>
            <div>
              <strong>8. Thời gian bổ nhiệm GV/GVC: </strong>
              <span>{formMode === 'sample' ? 'Từ năm 2018 (8 năm thâm niên)' : '...................................................'}</span>
            </div>
          </div>
        </div>

        {/* Section II: Papers Table */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.75rem' }}>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 700, textTransform: 'uppercase', margin: 0 }}>
              II. DANH MỤC CÁC BÀI BÁO KHOA HỌC TIÊU BIỂU CÔNG BỐ TRÊN CÁC TẠP CHÍ UY TÍN
            </h4>
            <span style={{ fontSize: '0.85rem', fontStyle: 'italic', color: '#475569' }}>
              (Theo quy định tại Điều 4 & 5 Quyết định 37/2018/QĐ-TTg)
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.85rem',
                border: '1px solid #000',
              }}
            >
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'center' }}>
                  <th style={{ border: '1px solid #000', padding: '6px 4px', width: '35px' }}>TT</th>
                  <th style={{ border: '1px solid #000', padding: '6px 8px', minWidth: '220px' }}>
                    Tên công trình (Tên bài báo)
                  </th>
                  <th style={{ border: '1px solid #000', padding: '6px 6px', minWidth: '130px' }}>
                    Tác giả / Vai trò
                  </th>
                  <th style={{ border: '1px solid #000', padding: '6px 8px', minWidth: '180px' }}>
                    Tạp chí xuất bản, Tập, Số, Trang, Năm
                  </th>
                  <th style={{ border: '1px solid #000', padding: '6px 6px', width: '90px' }}>
                    Phân loại / Chỉ mục
                  </th>
                  <th style={{ border: '1px solid #000', padding: '6px 6px', width: '130px' }}>
                    Mã DOI / Định danh
                  </th>
                  <th style={{ border: '1px solid #000', padding: '6px 4px', width: '50px' }}>
                    Điểm tối đa
                  </th>
                  <th style={{ border: '1px solid #000', padding: '6px 4px', width: '55px' }}>
                    Điểm ứng viên
                  </th>
                </tr>
              </thead>
              <tbody>
                {papers.length > 0 ? (
                  papers.map((p) => (
                    <tr key={p.stt} style={{ verticalAlign: 'top' }}>
                      <td style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'center', fontWeight: 600 }}>
                        {p.stt}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '6px 8px' }}>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>{p.titleVn}</div>
                        <div style={{ fontStyle: 'italic', fontSize: '0.8rem', color: '#475569', marginTop: '3px' }}>
                          "{p.titleEn}"
                        </div>
                      </td>
                      <td style={{ border: '1px solid #000', padding: '6px 6px' }}>
                        <div style={{ fontWeight: 600 }}>{p.coAuthors}</div>
                        <div
                          style={{
                            marginTop: '4px',
                            display: 'inline-block',
                            fontSize: '0.725rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: p.role.includes('First') || p.role.includes('Corr.') ? '#ecfdf5' : '#f1f5f9',
                            color: p.role.includes('First') || p.role.includes('Corr.') ? '#047857' : '#475569',
                            border: `1px solid ${p.role.includes('First') || p.role.includes('Corr.') ? '#a7f3d0' : '#cbd5e1'}`,
                          }}
                        >
                          {p.role}
                        </div>
                      </td>
                      <td style={{ border: '1px solid #000', padding: '6px 8px' }}>
                        <div style={{ fontWeight: 600 }}>{p.journal}</div>
                        <div style={{ fontSize: '0.8rem', color: '#334155', marginTop: '2px' }}>
                          {p.volIssuePages} ({p.year})
                        </div>
                      </td>
                      <td style={{ border: '1px solid #000', padding: '6px 6px', textAlign: 'center' }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: '0.75rem',
                            color: p.indexType.includes('WoS') ? '#4338ca' : p.indexType.includes('Scopus') ? '#0284c7' : '#059669',
                          }}
                        >
                          {p.indexType}
                        </span>
                      </td>
                      <td style={{ border: '1px solid #000', padding: '6px 6px', wordBreak: 'break-all', fontSize: '0.75rem' }}>
                        <a
                          href={`https://doi.org/${p.doi}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: '#2563eb', textDecoration: 'none' }}
                        >
                          {p.doi}
                        </a>
                      </td>
                      <td style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'center', fontWeight: 600 }}>
                        {p.maxScore.toFixed(2)}
                      </td>
                      <td style={{ border: '1px solid #000', padding: '6px 4px', textAlign: 'center', fontWeight: 700, color: '#047857' }}>
                        {p.claimedScore.toFixed(2)}
                      </td>
                    </tr>
                  ))
                ) : (
                  [1, 2, 3, 4, 5].map((idx) => (
                    <tr key={idx} style={{ height: '48px' }}>
                      <td style={{ border: '1px solid #000', textAlign: 'center' }}>{idx}</td>
                      <td style={{ border: '1px solid #000' }}></td>
                      <td style={{ border: '1px solid #000' }}></td>
                      <td style={{ border: '1px solid #000' }}></td>
                      <td style={{ border: '1px solid #000' }}></td>
                      <td style={{ border: '1px solid #000' }}></td>
                      <td style={{ border: '1px solid #000' }}></td>
                      <td style={{ border: '1px solid #000' }}></td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: '#f1f5f9', fontWeight: 700 }}>
                  <td colSpan={6} style={{ border: '1px solid #000', padding: '8px 10px', textAlign: 'right' }}>
                    TỔNG ĐIỂM CÔNG TRÌNH QUY ĐỔI KÊ KHAI:
                  </td>
                  <td style={{ border: '1px solid #000', padding: '8px 4px', textAlign: 'center' }}>
                    {formMode === 'sample' ? totalMaxScore.toFixed(2) : '.........'}
                  </td>
                  <td style={{ border: '1px solid #000', padding: '8px 4px', textAlign: 'center', color: '#047857', fontSize: '0.95rem' }}>
                    {formMode === 'sample' ? totalClaimedScore.toFixed(2) : '.........'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Section III: Summary & Declaration */}
        <div style={{ marginBottom: '2.5rem', fontSize: '0.95rem' }}>
          <h4 style={{ fontSize: '1.05rem', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 0.5rem 0' }}>
            III. ĐỐI CHIẾU ĐIỀU KIỆN TIÊU CHUẨN CỨNG (THEO QĐ 37 & 25)
          </h4>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <li>
              <strong>Tổng điểm công trình quy đổi: </strong>
              <span>{formMode === 'sample' ? `${totalClaimedScore.toFixed(2)} điểm` : '........... điểm'}</span>{' '}
              <em>(Yêu cầu tối thiểu đối với PGS ngành CNTT: ≥ 10.0 điểm).</em>
            </li>
            <li>
              <strong>Số bài báo chủ trì (Tác giả chính / Tác giả liên hệ): </strong>
              <span>{formMode === 'sample' ? '4 bài' : '........... bài'}</span>{' '}
              <em>(Yêu cầu tối thiểu: ≥ 3 bài báo trên tạp chí khoa học quốc tế uy tín).</em>
            </li>
            <li>
              <strong>Điểm công trình trong 3 năm gần nhất: </strong>
              <span>{formMode === 'sample' ? '3.0 điểm' : '........... điểm'}</span>{' '}
              <em>(Yêu cầu tối thiểu: ≥ 25% tổng điểm công trình).</em>
            </li>
            <li>
              <strong>Cam kết liêm chính học thuật: </strong>
              Tôi xin cam đoan toàn bộ thông tin kê khai trên đây, các minh chứng kèm theo là hoàn toàn trung thực, chính xác và không vi phạm đạo đức nghiên cứu khoa học. Nếu sai sót, tôi xin hoàn toàn chịu trách nhiệm trước pháp luật và Hội đồng Giáo sư Nhà nước.
            </li>
          </ul>
        </div>

        {/* Section IV: Signatures */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', textAlign: 'center', marginTop: '2rem' }}>
          <div>
            <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.9rem' }}>
              XÁC NHẬN CỦA ĐƠN VỊ CÔNG TÁC
            </div>
            <div style={{ fontStyle: 'italic', fontSize: '0.8rem', color: '#64748b' }}>
              (Ký tên, đóng dấu)
            </div>
            <div style={{ height: '80px' }} />
            <div style={{ fontWeight: 700 }}>{formMode === 'sample' ? 'Hiệu trưởng / Thủ trưởng' : '................................................'}</div>
          </div>

          <div>
            <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.9rem' }}>
              HỘI ĐỒNG CƠ SỞ THẨM ĐỊNH
            </div>
            <div style={{ fontStyle: 'italic', fontSize: '0.8rem', color: '#64748b' }}>
              (Chủ tịch HĐCS ký tên)
            </div>
            <div style={{ height: '80px' }} />
            <div style={{ fontWeight: 700 }}>{formMode === 'sample' ? 'GS. TSKH. Trần Văn Nam' : '................................................'}</div>
          </div>

          <div>
            <div style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.9rem' }}>
              NGƯỜI KÊ KHAI
            </div>
            <div style={{ fontStyle: 'italic', fontSize: '0.8rem', color: '#64748b' }}>
              (Ký và ghi rõ họ tên)
            </div>
            <div style={{ height: '80px' }} />
            <div style={{ fontWeight: 700 }}>{formMode === 'sample' ? 'TS. Nguyễn Văn An' : '................................................'}</div>
          </div>
        </div>
      </div>

      {/* Golden Guidelines / Cẩm nang kê khai */}
      <div
        style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%)',
          borderRadius: '16px',
          border: '1px solid #bfdbfe',
          padding: '1.5rem 1.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: '#3b82f6',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.1rem',
            }}
          >
            <i className="fa-solid fa-lightbulb" />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1e3a8a' }}>
              Lưu ý Vàng & Quy cách Kê khai Hồ sơ đạt Chuẩn HĐGSNN
            </h4>
            <p style={{ margin: 0, fontSize: '0.825rem', color: '#3b82f6' }}>
              Tổng hợp từ kinh nghiệm thẩm định thực tế của các Hội đồng Giáo sư ngành
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <i className="fa-solid fa-star" style={{ color: '#eab308' }} />
              1. Vai trò Tác giả Chính
            </div>
            <p style={{ fontSize: '0.825rem', color: '#475569', margin: 0, lineHeight: 1.5 }}>
              Tác giả chính bao gồm <strong>Tác giả đứng đầu danh sách (First Author)</strong> hoặc <strong>Tác giả liên hệ (Corresponding Author)</strong>. Nếu bài báo có nhiều tác giả đóng góp bình đẳng (*), phải có văn bản thỏa thuận xác nhận của các đồng tác giả kèm theo hồ sơ.
            </p>
          </div>

          <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <i className="fa-solid fa-building-columns" style={{ color: '#6366f1' }} />
              2. Địa chỉ Cơ quan (Affiliation)
            </div>
            <p style={{ fontSize: '0.825rem', color: '#475569', margin: 0, lineHeight: 1.5 }}>
              Tên cơ sở giáo dục đại học hoặc viện nghiên cứu ghi trên bài báo bắt buộc phải là nơi ứng viên đang làm việc, giảng dạy cơ hữu. Bài báo ghi địa chỉ ở nơi khác sẽ không được tính điểm quy đổi vào đơn vị công tác hiện tại.
            </p>
          </div>

          <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <i className="fa-solid fa-clock-rotate-left" style={{ color: '#059669' }} />
              3. Bài báo 3 năm / 5 năm gần nhất
            </div>
            <p style={{ fontSize: '0.825rem', color: '#475569', margin: 0, lineHeight: 1.5 }}>
              Tối thiểu <strong>25% tổng số điểm công trình</strong> (đối với PGS) hoặc <strong>30%</strong> (đối với GS) phải được tích lũy trong vòng 3 năm gần nhất trước thời điểm hết hạn nộp hồ sơ, nhằm chứng minh hoạt động nghiên cứu liên tục.
            </p>
          </div>

          <div style={{ background: 'white', padding: '1rem', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <i className="fa-solid fa-robot" style={{ color: '#ec4899' }} />
              4. Kết hợp Đối soát AI Vision
            </div>
            <p style={{ fontSize: '0.825rem', color: '#475569', margin: 0, lineHeight: 1.5 }}>
              Hệ thống đã hỗ trợ chức năng <strong>OCR Vision thông minh</strong>. Bạn có thể chụp trang đầu của bài báo hoặc ảnh chụp tờ khai này và tải lên tab <em>Kiểm tra & Thẩm định</em> để hệ thống tự động kiểm tra đối soát chéo và phát hiện tạp chí mạo danh!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
