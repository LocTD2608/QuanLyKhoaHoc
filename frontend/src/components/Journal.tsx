import { useState } from 'react';
import * as apiClient from '../utils/api';
import { showToast } from '../utils/toast';

interface JournalProps {
  setLoading: (loading: boolean) => void;
}

const Journal = ({ setLoading }: JournalProps) => {
  const [journalName, setJournalName] = useState('');
  const [issn, setIssn] = useState('');
  const [resultData, setResultData] = useState<apiClient.JournalResponse | null>(null);

  const handleSearch = async (nameToSearch = journalName, issnToSearch = issn) => {
    const trimmedName = nameToSearch.trim();
    const trimmedIssn = issnToSearch.trim();

    if (!trimmedName) {
      showToast('Vui lòng nhập tên tạp chí cần tra cứu', 'warning');
      return;
    }

    setLoading(true);
    setResultData(null);
    try {
      const data = await apiClient.checkJournal(trimmedName, trimmedIssn ? [trimmedIssn] : []);
      showToast('Tra cứu tạp chí thành công!', 'success');
      setResultData(data);
    } catch (error) {
      console.error(error);
      showToast('Lỗi hệ thống khi tra cứu tạp chí khoa học', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (name: string) => {
    setJournalName(name);
    setIssn('');
    showToast(`Đã điền tạp chí: ${name}`, 'success');
    // Call search directly with the new filled values
    handleSearch(name, '');
  };

  // Determine trust status style class
  let statusClass = 'info';
  if (resultData) {
    if (resultData.status === 'trusted' || resultData.status === 'valid') statusClass = 'valid';
    if (resultData.status === 'warning') statusClass = 'warning';
    if (resultData.status === 'predatory') statusClass = 'predatory';
  }

  const apiMeta = resultData?.api_metadata;

  return (
    <div className="card">
      <div className="card-header">
        <h2>Tra cứu uy tín & Lịch sử xếp hạng Tạp chí</h2>
        <p>Kiểm tra cơ sở dữ liệu ScimagoJR, danh mục HĐGSNN Việt Nam, và truy vấn cảnh báo Predatory Publisher.</p>
      </div>

      <div className="form-grid">
        <div className="form-group full-width">
          <label htmlFor="journal-name">Tên tạp chí khoa học</label>
          <input
            type="text"
            id="journal-name"
            value={journalName}
            onChange={(e) => setJournalName(e.target.value)}
            placeholder="e.g. Nature, IEEE Access, Journal of Business Research..."
          />
        </div>
        <div className="form-group full-width">
          <div className="suggested-chips-container">
            <span className="suggested-label">
              <i className="fas fa-tags"></i> Gợi ý tra cứu:
            </span>
            <button className="chip" onClick={() => handleQuickFill('Nature')}>
              Nature
            </button>
            <button className="chip" onClick={() => handleQuickFill('IEEE Access')}>
              IEEE Access
            </button>
            <button className="chip" onClick={() => handleQuickFill('Journal of Business Research')}>
              Journal of Business Research
            </button>
            <button className="chip" onClick={() => handleQuickFill('Academy of Management Review')}>
              Academy of Management Review
            </button>
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="journal-issn">Mã ISSN (Không bắt buộc)</label>
          <input
            type="text"
            id="journal-issn"
            value={issn}
            onChange={(e) => setIssn(e.target.value)}
            placeholder="e.g. 0028-0836"
          />
        </div>
        <div className="form-group" style={{ justifyContent: 'flex-end' }}>
          <button
            id="btn-check-journal"
            className="btn-primary btn-large"
            style={{ width: '100%' }}
            onClick={() => handleSearch()}
          >
            <i className="fas fa-magnifying-glass"></i> Bắt đầu tra cứu
          </button>
        </div>
      </div>

      {/* Journal Lookup Output */}
      {resultData && (
        <div id="journal-result" className="result-area">
          <h3 className="report-main-title">
            <i className="fas fa-book-bookmark"></i> Kết quả tra cứu tạp chí khoa học
          </h3>

          <div className="res-item">
            <span className="res-label">Trạng thái kiểm định</span>
            <span className={`badge badge-${statusClass}`}>{resultData.status.toUpperCase()}</span>
          </div>
          <div className="res-item">
            <span className="res-label">Nhận định chi tiết</span>
            <span className="res-value" style={{ lineHeight: 1.5, fontSize: '1.05rem' }}>
              {resultData.message}
            </span>
          </div>

          {/* OpenAlex API Metadata */}
          {apiMeta && (
            <div className="res-item">
              <span className="res-label">
                <i className="fas fa-globe"></i> Thông tin mở rộng (OpenAlex API)
              </span>
              <div className="stats-row">
                <div className="stat-box-mini">
                  <span className="res-label">Tổng số bài báo</span>
                  <span className="res-value" style={{ color: 'var(--accent-blue)' }}>
                    {apiMeta.works_count?.toLocaleString() || '0'}
                  </span>
                </div>
                <div className="stat-box-mini">
                  <span className="res-label">Tổng lượt trích dẫn</span>
                  <span className="res-value" style={{ color: 'var(--primary)' }}>
                    {apiMeta.cited_by_count?.toLocaleString() || '0'}
                  </span>
                </div>
                <div className="stat-box-mini">
                  <span className="res-label">Chỉ số H-Index</span>
                  <span className="res-value" style={{ color: 'var(--color-success)' }}>
                    {apiMeta.h_index || 'N/A'}
                  </span>
                </div>
              </div>
              <div className="meta-tags" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {apiMeta.is_oa && (
                  <span className="badge badge-trusted">
                    <i className="fas fa-unlock"></i> Open Access
                  </span>
                )}
                {resultData.is_in_doaj && (
                  <span className="badge badge-valid">
                    <i className="fas fa-check-double"></i> Indexed DOAJ
                  </span>
                )}
                <span className="badge badge-info">
                  <i className="fas fa-book-open"></i> Thể loại: {apiMeta.type || 'Journal'}
                </span>
              </div>
              <p className="res-subtext" style={{ marginTop: '0.75rem' }}>
                <strong>Nhà xuất bản chính:</strong> {apiMeta.publisher || 'N/A'}
              </p>
              <p className="res-subtext">
                <strong>Quốc gia đăng ký:</strong> {apiMeta.country_code || 'N/A'}
              </p>
              {apiMeta.homepage_url && (
                <p className="res-subtext">
                  <strong>Trang chủ tạp chí:</strong>{' '}
                  <a href={apiMeta.homepage_url} target="_blank" rel="noreferrer">
                    {apiMeta.homepage_url} <i className="fas fa-external-link-alt" style={{ fontSize: '0.8rem' }}></i>
                  </a>
                </p>
              )}
            </div>
          )}

          {/* Current Ranking Detailed Card */}
          {resultData.ranking && (
            <div className="res-item">
              <span className="res-label">Chi tiết Phân hạng (ScimagoJR {resultData.ranking.year})</span>
              <div className="stats-row">
                <div className="stat-box-mini">
                  <span className="res-label">Phân hạng chính</span>
                  <span className={`res-value q-${resultData.ranking.quartile?.toLowerCase()}`}>
                    {resultData.ranking.quartile || 'N/A'}
                  </span>
                </div>
                <div className="stat-box-mini">
                  <span className="res-label">Điểm số tác động (SJR)</span>
                  <span className="res-value" style={{ color: 'var(--text-main)' }}>
                    {resultData.ranking.sjr_score || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Vietnam Council Max Score Guideline */}
          {resultData.vietnam_info && (
            <div className="res-item">
              <span className="res-label">Quy chuẩn xếp hạng của HĐGSNN Việt Nam</span>
              <div className="stats-row">
                <div className="stat-box-mini" style={{ textAlign: 'left', paddingLeft: '1.25rem' }}>
                  <span className="res-label">Hội đồng Ngành</span>
                  <span className="res-value" style={{ fontSize: '1rem', color: 'var(--accent-blue)' }}>
                    {resultData.vietnam_info.council}
                  </span>
                </div>
                <div className="stat-box-mini">
                  <span className="res-label">Khung điểm quy đổi tối đa</span>
                  <span className="res-value" style={{ color: 'var(--color-success)' }}>
                    {resultData.vietnam_info.max_score} điểm
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Ranking History Table */}
          {resultData.all_rankings && resultData.all_rankings.length > 0 && (
            <div className="ranking-history-container">
              <div className="ranking-history-title">
                <i className="fas fa-history"></i> Lịch sử phân hạng tạp chí quốc tế (SJR)
              </div>
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Năm công bố</th>
                    <th>Xếp hạng Scopus Quartile</th>
                    <th>Chỉ số ảnh hưởng SJR</th>
                  </tr>
                </thead>
                <tbody>
                  {resultData.all_rankings.map((r, i) => (
                    <tr key={i}>
                      <td className="year-cell">{r.year}</td>
                      <td className={`quartile-cell q-${r.quartile ? r.quartile.toLowerCase() : 'na'}`}>
                        {r.quartile || 'N/A'}
                      </td>
                      <td style={{ fontWeight: 600 }}>{r.sjr_score || 'N/A'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Journal;
