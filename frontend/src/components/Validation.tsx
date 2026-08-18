import { useState } from 'react';
import * as apiClient from '../utils/api';
import { showToast } from '../utils/toast';

interface ValidationProps {
  setLoading: (loading: boolean) => void;
}

const Validation = ({ setLoading }: ValidationProps) => {
  const [candidateName, setCandidateName] = useState('Nguyễn Văn An');
  const [candidateTitleVn, setCandidateTitleVn] = useState('');
  const [doi, setDoi] = useState('');
  const [resultData, setResultData] = useState<any>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  const handleValidate = async () => {
    const trimmedDoi = doi.trim();
    const trimmedName = candidateName.trim();
    const trimmedTitle = candidateTitleVn.trim();

    if (!trimmedDoi) {
      showToast('Vui lòng cung cấp mã DOI bài báo khoa học', 'warning');
      return;
    }
    if (!trimmedName) {
      showToast('Vui lòng nhập tên ứng viên kê khai để đối soát', 'warning');
      return;
    }

    setLoading(true);
    setResultData(null);
    try {
      const data = await apiClient.validateArticle(trimmedDoi, "", trimmedName, trimmedTitle);
      showToast('Xác thực bài báo khoa học hoàn thành!', 'success');
      setResultData(data);
    } catch (error) {
      console.error(error);
      showToast('Lỗi hệ thống khi kiểm định bài báo khoa học. Đảm bảo Ollama và Backend đang chạy.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterPaper = async () => {
    if (!resultData?.metadata?.doi) {
      showToast('Không có thông tin DOI hợp lệ để đăng ký', 'warning');
      return;
    }
    setIsRegistering(true);
    try {
      await apiClient.papersApi.submitAI(
        resultData.metadata.doi,
        doi.trim(),
        candidateTitleVn
      );
      showToast('Đăng ký bài báo khoa học vào hệ thống thành công!', 'success');
    } catch (error: any) {
      console.error(error);
      showToast(error.message || 'Lỗi khi đăng ký bài báo khoa học vào hệ thống', 'error');
    } finally {
      setIsRegistering(false);
    }
  };

  const metadata = resultData?.metadata;
  const verification = resultData?.verification || {};
  const integrity = verification.integrity || {};
  const authorRole = verification.author_role || {};

  return (
    <div className="card">
      <div className="card-header">
        <h2>Xác thực bài báo khoa học toàn diện</h2>
        <p>Tự động trích xuất metadata, phân loại ngành OECD, xếp hạng Scopus và đối soát đơn vị công tác của tác giả.</p>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label htmlFor="candidate-name">Tên ứng viên khai báo</label>
          <input
            type="text"
            id="candidate-name"
            value={candidateName}
            onChange={(e) => setCandidateName(e.target.value)}
            placeholder="e.g. Nguyễn Văn A"
          />
        </div>
        <div className="form-group">
          <label htmlFor="candidate-title-vn">Tiêu đề bài báo tiếng Việt (nếu có)</label>
          <input
            type="text"
            id="candidate-title-vn"
            value={candidateTitleVn}
            onChange={(e) => setCandidateTitleVn(e.target.value)}
            placeholder="e.g. Ứng dụng Học sâu trong quản trị doanh nghiệp"
          />
        </div>
        <div className="form-group full-width">
          <label htmlFor="doi-input">Mã DOI bài báo khoa học hoặc Link chi tiết</label>
          <div className="input-with-button">
            <input
              type="text"
              id="doi-input"
              value={doi}
              onChange={(e) => setDoi(e.target.value)}
              placeholder="e.g. 10.1016/j.jbusres.2023.113781"
            />
            <button id="btn-validate" className="btn-primary" onClick={handleValidate}>
              <i className="fas fa-robot"></i> Kiểm định AI
            </button>
          </div>
        </div>
      </div>

      {/* Validation Outcome Report Output */}
      {resultData && (
        <div id="validation-result" className="result-area">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 className="report-main-title" style={{ margin: 0 }}>
              <i className="fas fa-shield-halved"></i> Báo cáo thẩm định & Kiểm định liêm chính học thuật
            </h3>
            <button 
              className="btn-primary" 
              onClick={handleRegisterPaper}
              disabled={isRegistering}
              style={{
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: 'white',
                border: 'none',
                padding: '8px 18px',
                borderRadius: '10px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
              }}
            >
              <i className="fas fa-plus-circle"></i> {isRegistering ? 'Đang đăng ký...' : 'Đăng ký bài báo lên hệ thống'}
            </button>
          </div>

          {/* Section 1: Overview */}
          {metadata && (
            <div className="report-section">
              <h4>
                <i className="fas fa-file-invoice"></i> 1. Thông tin tổng quan công trình
              </h4>
              <div className="res-item">
                <span className="res-label">Tiêu đề bài báo quốc tế (English)</span>
                <span className="res-value" style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                  {metadata.title || 'N/A'}
                </span>
              </div>
              <div className="res-item">
                <span className="res-label">Danh sách nhóm tác giả</span>
                <span className="res-value">
                  {metadata.authors ? metadata.authors.map((a: any) => `${a.given} ${a.family}`).join(', ') : 'N/A'}
                </span>
              </div>
              <div className="res-item">
                <span className="res-label">Tạp chí đăng tải & Chỉ số định danh</span>
                <span className="res-value" style={{ color: 'var(--accent-blue)' }}>
                  {metadata.journal || 'N/A'} ({metadata.year || 'N/A'})
                </span>
                <span className="res-subtext" style={{ marginTop: '0.25rem' }}>
                  <strong>Mã định danh Quốc tế (ISSN):</strong> {metadata.issn ? metadata.issn.join(', ') : 'N/A'}
                </span>
              </div>
            </div>
          )}

          {/* Section 2: Integrity & Trust */}
          {Object.keys(integrity).length > 0 && (
            <div className="report-section">
              <h4>
                <i className="fas fa-circle-nodes"></i> 2. Đánh giá uy tín & Liêm chính học thuật
              </h4>
              <div className="res-item">
                <span className="res-label">Kết luận uy tín tạp chí</span>
                <span className={`badge ${integrity.is_predatory ? 'badge-danger' : 'badge-valid'}`}>
                  <i className={`fas ${integrity.is_predatory ? 'fa-triangle-exclamation' : 'fa-check'}`}></i>{' '}
                  {integrity.message || 'N/A'}
                </span>
                {!integrity.is_year_match && (
                  <span className="badge badge-warning" style={{ marginLeft: '5px' }}>
                    <i className="fas fa-clock"></i> Khác biệt năm công bố
                  </span>
                )}
              </div>
              {integrity.ranking && (
                <div className="res-item">
                  <span className="res-label">Phân hạng Scopus Quartile</span>
                  <span className="res-value">
                    Tạp chí đạt mức:{' '}
                    <strong className={`q-${integrity.ranking.quartile.toLowerCase()}`}>
                      {integrity.ranking.quartile}
                    </strong>{' '}
                    | Chỉ số ảnh hưởng SJR:{' '}
                    <strong style={{ color: 'var(--accent-blue)' }}>{integrity.ranking.sjr_score}</strong>
                  </span>
                </div>
              )}
              <div className="res-item">
                <span className="res-label">Chỉ số tương đồng tiêu đề bài báo (Anh - Việt)</span>
                <div className="score-container">
                  <div className="score-meta">
                    <span className="score-title">Độ khớp ngữ nghĩa</span>
                    <span className="score-number">{integrity.title_similarity_pct || 0}%</span>
                  </div>
                  <div className="score-track">
                    <div className="score-bar" style={{ width: `${integrity.title_similarity_pct || 0}%` }}></div>
                  </div>
                </div>
              </div>
              {integrity.scientific_field && (
                <div className="res-item">
                  <span className="res-label">Phân loại lĩnh vực học thuật (OECD Standard)</span>
                  <span className="res-value" style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                    {integrity.scientific_field.main_field}
                  </span>
                  <span className="res-subtext">
                    Hệ thống AI phân loại độ tin cậy đạt: <strong>{integrity.scientific_field.confidence}%</strong>.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Section 3: Author Role & Affiliation */}
          {Object.keys(authorRole).length > 0 && (
            <div className="report-section">
              <h4>
                <i className="fas fa-users-gear"></i> 3. Đối soát vai trò ứng viên & Đơn vị công tác
              </h4>
              <div className="res-item">
                <span className="res-label">Ứng viên cần đối soát</span>
                <span className="res-value" style={{ fontWeight: 700 }}>
                  {resultData.input?.candidate_name}
                </span>
              </div>
              <div className="res-item">
                <span className="res-label">Sự hiện diện trong nhóm tác giả</span>
                <span className={`badge ${authorRole.is_present ? 'badge-trusted' : 'badge-warning'}`}>
                  {authorRole.is_present ? (
                    <>
                      <i className="fas fa-user-check"></i> Xác nhận: Có tên trong danh sách tác giả chính thức
                    </>
                  ) : (
                    <>
                      <i className="fas fa-user-xmark"></i> Cảnh báo: Không tìm thấy tên trong nhóm tác giả
                    </>
                  )}
                </span>
              </div>
              <div className="res-item">
                <span className="res-label">Đối soát vai trò tác giả chính (Main Author)</span>
                <span className={`badge ${authorRole.is_main_author ? 'badge-valid' : 'badge-warning'}`}>
                  {authorRole.is_main_author ? (
                    <>
                      <i className="fas fa-crown"></i> Xác nhận: Là tác giả chính (Tác giả đầu / Tác giả liên hệ)
                    </>
                  ) : (
                    <>
                      <i className="fas fa-people-group"></i> Cảnh báo: Không phải tác giả chính của công trình
                    </>
                  )}
                </span>
              </div>

              <div className="stats-row" style={{ marginTop: '1rem', marginBottom: '1.5rem' }}>
                <div className="stat-box-mini">
                  <span className="res-label">Tác giả thứ nhất (First Author)</span>
                  <span
                    className="res-value"
                    style={{
                      fontSize: '1.15rem',
                      color: authorRole.is_first_author ? 'var(--color-success)' : 'var(--text-muted)',
                    }}
                  >
                    {authorRole.is_first_author ? (
                      <>
                        <i className="fas fa-circle-check"></i> Có
                      </>
                    ) : (
                      <>
                        <i className="fas fa-circle-xmark"></i> Không
                      </>
                    )}
                  </span>
                </div>
                <div className="stat-box-mini">
                  <span className="res-label">Tác giả liên hệ (Corresponding)</span>
                  <span
                    className="res-value"
                    style={{
                      fontSize: '1.15rem',
                      color: authorRole.is_corresponding_author ? 'var(--color-success)' : 'var(--text-muted)',
                    }}
                  >
                    {authorRole.is_corresponding_author ? (
                      <>
                        <i className="fas fa-circle-check"></i> Có
                      </>
                    ) : (
                      <>
                        <i className="fas fa-circle-xmark"></i> Không
                      </>
                    )}
                  </span>
                </div>
              </div>

              <div className="res-item">
                <span className="res-label">Đơn vị công tác trích xuất từ bài báo</span>
                <span className="res-value" style={{ fontSize: '0.95rem', fontStyle: 'italic' }}>
                  "{authorRole.affiliation_captured || 'Không tìm thấy thông tin đơn vị trong bài báo'}"
                </span>
              </div>

              {authorRole.affiliation_match && (
                <div className="res-item">
                  <span className={`badge ${authorRole.affiliation_match.is_match ? 'badge-valid' : 'badge-warning'}`}>
                    {authorRole.affiliation_match.is_match ? (
                      <>
                        <i className="fas fa-building-circle-check"></i> Trùng khớp đơn vị công tác
                      </>
                    ) : (
                      <>
                        <i className="fas fa-building-circle-exclamation"></i> Không trùng khớp đơn vị
                      </>
                    )}
                  </span>
                  {authorRole.affiliation_match.is_match && (
                    <p className="res-subtext" style={{ marginTop: '0.5rem' }}>
                      Trùng khớp với đơn vị kê khai lịch sử: <strong>{authorRole.affiliation_match.matched_with}</strong>
                    </p>
                  )}
                  <p className="res-subtext" style={{ marginTop: '0.5rem', fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    <strong>Nhận xét đối soát:</strong> {authorRole.affiliation_match.reason}
                  </p>
                </div>
              )}

              <div className="res-item">
                <span className="res-label">Tóm tắt lý giải đóng góp khoa học (AI generated)</span>
                <p className="res-subtext" style={{ fontSize: '0.95rem', lineHeight: 1.5, color: 'var(--text-main)', marginTop: '0.25rem' }}>
                  {authorRole.reason || 'N/A'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Validation;
