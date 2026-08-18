import { useState, useEffect } from 'react';
import * as apiClient from '../utils/api';
import { showToast } from '../utils/toast';
import { marked } from 'marked';

// Custom markdown link renderer
marked.use({
  renderer: {
    link(href, title, text) {
      if (typeof href === 'object' && href !== null) {
        const obj = href as any;
        return `<a href="${obj.href || ''}" title="${obj.title || ''}" target="_blank" rel="noopener noreferrer">${obj.text || ''}</a>`;
      }
      return `<a href="${href || ''}" title="${title || ''}" target="_blank" rel="noopener noreferrer">${text || ''}</a>`;
    }
  }
});

interface SimulatorProps {
  setLoading: (loading: boolean) => void;
}

const Simulator = ({ setLoading }: SimulatorProps) => {
  // --- Section State Fields ---
  // Section 1: Điểm công trình
  const [totalScore, setTotalScore] = useState<number>(9.5);
  const [last3YearsScore, setLast3YearsScore] = useState<number>(4.2);
  const [journalScore, setJournalScore] = useState<number>(7.1);
  const [mainAuthorArticles, setMainAuthorArticles] = useState<number>(4);

  // Section 2: Giảng dạy & thâm niên
  const [teachingHours, setTeachingHours] = useState<number>(300);
  const [seniorityYears, setSeniorityYears] = useState<number>(8);

  // Section 3: Trình độ & chức danh
  const [degreeTitle, setDegreeTitle] = useState<'TS' | 'PGS' | 'Khác'>('TS');
  const [degreeYears, setDegreeYears] = useState<number>(5);

  // Section 4: Trình độ ngoại ngữ
  const [foreignLanguage, setForeignLanguage] = useState<string>('B2');

  // Section 5: Hướng dẫn học viên
  const [guidedMasters, setGuidedMasters] = useState<number>(2);
  const [guidedPhds, setGuidedPhds] = useState<number>(0);

  // Section 6: Đề tài chủ trì
  const [projectsDomestic, setProjectsDomestic] = useState<number>(2);
  const [projectsMinistry, setProjectsMinistry] = useState<number>(0);
  const [projectsNational, setProjectsNational] = useState<number>(0);

  // Simulator Context
  const [academicField, setAcademicField] = useState<string>('Công nghệ thông tin');
  const [evalYear, setEvalYear] = useState<number>(2026);

  // AI & Recommendation Results
  const [rawCVText, setRawCVText] = useState<string>('');
  const [isExtractingCV, setIsExtractingCV] = useState<boolean>(false);
  
  const [aiConsultationReport, setAiConsultationReport] = useState<string>('');
  const [isConsulting, setIsConsulting] = useState<boolean>(false);

  // Load from LocalStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('scientific_simulator_state');
      if (saved) {
        const state = JSON.parse(saved);
        if (state.totalScore !== undefined) setTotalScore(state.totalScore);
        if (state.last3YearsScore !== undefined) setLast3YearsScore(state.last3YearsScore);
        if (state.journalScore !== undefined) setJournalScore(state.journalScore);
        if (state.mainAuthorArticles !== undefined) setMainAuthorArticles(state.mainAuthorArticles);
        if (state.teachingHours !== undefined) setTeachingHours(state.teachingHours);
        if (state.seniorityYears !== undefined) setSeniorityYears(state.seniorityYears);
        if (state.degreeTitle !== undefined) setDegreeTitle(state.degreeTitle);
        if (state.degreeYears !== undefined) setDegreeYears(state.degreeYears);
        if (state.foreignLanguage !== undefined) setForeignLanguage(state.foreignLanguage);
        if (state.guidedMasters !== undefined) setGuidedMasters(state.guidedMasters);
        if (state.guidedPhds !== undefined) setGuidedPhds(state.guidedPhds);
        if (state.projectsDomestic !== undefined) setProjectsDomestic(state.projectsDomestic);
        if (state.projectsMinistry !== undefined) setProjectsMinistry(state.projectsMinistry);
        if (state.projectsNational !== undefined) setProjectsNational(state.projectsNational);
        if (state.academicField !== undefined) setAcademicField(state.academicField);
        if (state.evalYear !== undefined) setEvalYear(state.evalYear);
        if (state.aiConsultationReport !== undefined) setAiConsultationReport(state.aiConsultationReport);
      }
    } catch (e) {
      console.error('Lỗi load simulator state từ LocalStorage:', e);
    }
  }, []);

  // Save to LocalStorage when states change
  useEffect(() => {
    const stateToSave = {
      totalScore,
      last3YearsScore,
      journalScore,
      mainAuthorArticles,
      teachingHours,
      seniorityYears,
      degreeTitle,
      degreeYears,
      foreignLanguage,
      guidedMasters,
      guidedPhds,
      projectsDomestic,
      projectsMinistry,
      projectsNational,
      academicField,
      evalYear,
      aiConsultationReport
    };
    localStorage.setItem('scientific_simulator_state', JSON.stringify(stateToSave));
  }, [
    totalScore, last3YearsScore, journalScore, mainAuthorArticles,
    teachingHours, seniorityYears, degreeTitle, degreeYears,
    foreignLanguage, guidedMasters, guidedPhds,
    projectsDomestic, projectsMinistry, projectsNational,
    academicField, evalYear, aiConsultationReport
  ]);

  // Reset all states
  const handleReset = () => {
    setTotalScore(0);
    setLast3YearsScore(0);
    setJournalScore(0);
    setMainAuthorArticles(0);
    setTeachingHours(0);
    setSeniorityYears(0);
    setDegreeTitle('TS');
    setDegreeYears(0);
    setForeignLanguage('A1');
    setGuidedMasters(0);
    setGuidedPhds(0);
    setProjectsDomestic(0);
    setProjectsMinistry(0);
    setProjectsNational(0);
    setAiConsultationReport('');
    showToast('Đã đặt lại toàn bộ thông tin mô phỏng về 0', 'warning');
  };

  // Sync Points from Candidate Profile
  const handleLoadFromProfile = async () => {
    setLoading(true);
    try {
      const data = await apiClient.profileApi.get();
      if (data && data.pgs) {
        setTotalScore(data.pgs.total_score_current || 0);
        setLast3YearsScore(data.pgs.last3_score_current || 0);
        setJournalScore(data.pgs.journal_score_current || 0);
        setMainAuthorArticles(data.pgs.main_author_current || 0);
        showToast('Đã lấy điểm bài báo thành công từ hồ sơ của bạn!', 'success');
      } else {
        showToast('Không tìm thấy thông tin hồ sơ của bạn để lấy điểm.', 'warning');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Lỗi khi đồng bộ điểm từ hồ sơ: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Parse CV using AI
  const handleAIParseCV = async () => {
    if (!rawCVText.trim()) {
      showToast('Vui lòng dán văn bản lý lịch hoặc CV của bạn vào ô phân tích.', 'warning');
      return;
    }
    setIsExtractingCV(true);
    try {
      const data = await apiClient.extractCV(rawCVText);
      const ext = data?.extracted_data;
      if (ext) {
        // Apply extracted fields
        if (ext.scientific_points) {
          if (ext.scientific_points.total_score !== null) setTotalScore(ext.scientific_points.total_score);
          if (ext.scientific_points.last_3_years_score !== null) setLast3YearsScore(ext.scientific_points.last_3_years_score);
          if (ext.scientific_points.journal_score !== null) setJournalScore(ext.scientific_points.journal_score);
          if (ext.scientific_points.main_author_articles !== null) setMainAuthorArticles(ext.scientific_points.main_author_articles);
        }
        if (ext.teaching_hours !== null) setTeachingHours(ext.teaching_hours);
        if (ext.seniority_years !== null) setSeniorityYears(ext.seniority_years);
        if (ext.degree_title !== null) setDegreeTitle(ext.degree_title as any);
        if (ext.degree_years !== null) setDegreeYears(ext.degree_years);
        if (ext.foreign_language !== null) setForeignLanguage(ext.foreign_language);
        if (ext.guided_masters !== null) setGuidedMasters(ext.guided_masters);
        if (ext.guided_phds !== null) setGuidedPhds(ext.guided_phds);
        if (ext.projects_domestic !== null) setProjectsDomestic(ext.projects_domestic);
        if (ext.projects_ministry !== null) setProjectsMinistry(ext.projects_ministry);
        if (ext.projects_national !== null) setProjectsNational(ext.projects_national);
        if (ext.academic_field !== null) setAcademicField(ext.academic_field);
        if (ext.target_title !== null) {
          showToast(`Phân tích AI hoàn tất! Trích xuất hồ sơ ứng tuyển ${ext.target_title}`, 'success');
        } else {
          showToast('Phân tích AI hoàn tất! Đã cập nhật các trường mô phỏng.', 'success');
        }
      } else {
        showToast('AI không tìm thấy thông tin hợp lệ nào trong văn bản đã dán.', 'warning');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Lỗi phân tích AI: ' + err.message, 'error');
    } finally {
      setIsExtractingCV(false);
    }
  };

  // Generate Roadmaps via AI Consultation
  const handleAIConsult = async () => {
    setIsConsulting(true);
    try {
      const inputs = {
        total_score: totalScore,
        last_3_years_score: last3YearsScore,
        journal_score: journalScore,
        main_author_articles: mainAuthorArticles,
        teaching_hours: teachingHours,
        seniority_years: seniorityYears,
        degree_title: degreeTitle,
        degree_years: degreeYears,
        foreign_language: foreignLanguage,
        guided_masters: guidedMasters,
        guided_phds: guidedPhds,
        projects_domestic: projectsDomestic,
        projects_ministry: projectsMinistry,
        projects_national: projectsNational
      };

      const data = await apiClient.aiConsult('PGS', academicField, evalYear, inputs);
      if (data?.consultation_markdown) {
        setAiConsultationReport(data.consultation_markdown);
        showToast('Đã lập lộ trình tư vấn AI thành công!', 'success');
      } else {
        showToast('Máy chủ AI không trả về báo cáo tư vấn.', 'warning');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Lỗi sinh tư vấn AI: ' + err.message, 'error');
    } finally {
      setIsConsulting(false);
    }
  };

  // Helper validation checkers
  const checkLanguage = (level: string) => {
    const order = ["A1", "A2", "B1", "B2", "C1", "C2", "Bản ngữ"];
    return order.indexOf(level) >= order.indexOf("B2");
  };

  const checkGuidedPGS = (masters: number, phds: number) => {
    return masters >= 2 || phds >= 1;
  };

  const checkGuidedGS = (phds: number) => {
    return phds >= 2;
  };

  const checkProjectsPGS = (domestic: number, ministry: number, national: number) => {
    return domestic >= 2 || ministry >= 1 || national >= 1;
  };

  const checkProjectsGS = (ministry: number, national: number) => {
    return ministry >= 2 || national >= 1;
  };

  // Compute criteria checks for PGS
  const checksPGS = [
    { name: 'Tổng điểm', desc: 'Điểm quy đổi ≥ 10.0', pass: totalScore >= 10, current: `${totalScore} / 10` },
    { name: '3 năm cuối', desc: 'Điểm 3 năm cuối ≥ 2.5', pass: last3YearsScore >= 2.5, current: `${last3YearsScore} / 2.5` },
    { name: 'Điểm bài báo', desc: 'Điểm từ bài báo uy tín ≥ 6.0', pass: journalScore >= 6, current: `${journalScore} / 6` },
    { name: 'Tác giả chính', desc: 'Bài báo tác giả chính ≥ 3 bài', pass: mainAuthorArticles >= 3, current: `${mainAuthorArticles} / 3` },
    { name: 'Giờ giảng dạy', desc: 'Giờ chuẩn giảng dạy ≥ 275h/năm', pass: teachingHours >= 275, current: `${teachingHours}h / 275h` },
    { name: 'Thâm niên', desc: 'Số năm công tác ≥ 6 năm', pass: seniorityYears >= 6, current: `${seniorityYears} năm / 6 năm` },
    { name: 'Học vị TS', desc: 'Đã có học vị Tiến sĩ ≥ 3 năm', pass: (degreeTitle === 'TS' && degreeYears >= 3) || degreeTitle === 'PGS', current: degreeTitle === 'PGS' ? 'Đã là PGS' : `${degreeYears} năm / 3 năm` },
    { name: 'Ngoại ngữ', desc: 'Trình độ tối thiểu bậc B2', pass: checkLanguage(foreignLanguage), current: foreignLanguage },
    { name: 'Hướng dẫn', desc: 'Hướng dẫn thành công ≥ 2 ThS hoặc ≥ 1 NCS', pass: checkGuidedPGS(guidedMasters, guidedPhds), current: `${guidedMasters} ThS, ${guidedPhds} NCS` },
    { name: 'Đề tài', desc: 'Chủ trì ≥ 2 đề tài cơ sở hoặc ≥ 1 cấp Bộ', pass: checkProjectsPGS(projectsDomestic, projectsMinistry, projectsNational), current: `${projectsDomestic} CS, ${projectsMinistry} Bộ, ${projectsNational} QG` },
  ];

  // Compute criteria checks for GS
  const checksGS = [
    { name: 'Tổng điểm', desc: 'Điểm quy đổi ≥ 20.0', pass: totalScore >= 20, current: `${totalScore} / 20` },
    { name: '3 năm cuối', desc: 'Điểm 3 năm cuối ≥ 5.0', pass: last3YearsScore >= 5.0, current: `${last3YearsScore} / 5` },
    { name: 'Điểm bài báo', desc: 'Điểm từ bài báo uy tín ≥ 12.0', pass: journalScore >= 12, current: `${journalScore} / 12` },
    { name: 'Tác giả chính', desc: 'Bài báo tác giả chính ≥ 5 bài', pass: mainAuthorArticles >= 5, current: `${mainAuthorArticles} / 5` },
    { name: 'Giờ giảng dạy', desc: 'Giờ chuẩn giảng dạy ≥ 275h/năm', pass: teachingHours >= 275, current: `${teachingHours}h / 275h` },
    { name: 'Thâm niên', desc: 'Số năm công tác ≥ 9 năm', pass: seniorityYears >= 9, current: `${seniorityYears} năm / 9 năm` },
    { name: 'Chức danh PGS', desc: 'Có chức danh PGS ≥ 3 năm', pass: degreeTitle === 'PGS' && degreeYears >= 3, current: degreeTitle === 'PGS' ? `${degreeYears} năm / 3 năm` : 'Chưa có PGS' },
    { name: 'Ngoại ngữ', desc: 'Trình độ tối thiểu bậc B2', pass: checkLanguage(foreignLanguage), current: foreignLanguage },
    { name: 'Hướng dẫn', desc: 'Hướng dẫn thành công ≥ 2 NCS Tiến sĩ', pass: checkGuidedGS(guidedPhds), current: `${guidedPhds} NCS TS / 2` },
    { name: 'Đề tài', desc: 'Chủ trì ≥ 2 đề tài cấp Bộ hoặc ≥ 1 cấp QG', pass: checkProjectsGS(projectsMinistry, projectsNational), current: `${projectsMinistry} Bộ, ${projectsNational} QG` },
  ];

  const pgsPassedCount = checksPGS.filter(c => c.pass).length;
  const pgsPercent = Math.round((pgsPassedCount / checksPGS.length) * 100);

  const gsPassedCount = checksGS.filter(c => c.pass).length;
  const gsPercent = Math.round((gsPassedCount / checksGS.length) * 100);

  const cefrLevels = ["A1", "A2", "B1", "B2", "C1", "C2", "Bản ngữ"];

  return (
    <div className="simulator-container">
      <style>{`
        .simulator-layout {
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 2rem;
          align-items: start;
        }
        @media (max-width: 1024px) {
          .simulator-layout {
            grid-template-columns: 1fr;
          }
        }
        .section-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          transition: all 0.25s ease;
        }
        .section-card:hover {
          box-shadow: 0 4px 12px rgba(99, 102, 241, 0.05);
          border-color: #cbd5e1;
        }
        .section-title {
          font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
          font-size: 1.15rem;
          font-weight: 600;
          color: #1e293b;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 0.75rem;
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .section-title i {
          color: #6366f1;
        }
        .section-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
        }
        @media (max-width: 640px) {
          .section-grid {
            grid-template-columns: 1fr;
          }
        }
        .input-box {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }
        .input-box label {
          font-size: 0.8rem;
          font-weight: 600;
          text-transform: none;
          letter-spacing: normal;
          color: #475569;
        }
        .input-box input, .input-box select {
          padding: 0.65rem 0.85rem;
          font-size: 0.925rem;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
        }
        .input-box .subtext {
          font-size: 0.72rem;
          color: #94a3b8;
        }
        .cefr-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
          margin-top: 0.25rem;
        }
        .cefr-btn {
          padding: 0.4rem 0.8rem;
          font-size: 0.825rem;
          border-radius: 20px;
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          color: #475569;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }
        .cefr-btn:hover {
          background: #f1f5f9;
          border-color: #cbd5e1;
        }
        .cefr-btn.selected {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #ffffff;
          border-color: transparent;
          box-shadow: 0 2px 6px rgba(99, 102, 241, 0.25);
        }
        .compliance-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          padding: 1.75rem;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
          margin-bottom: 1.5rem;
        }
        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }
        .progress-bar-container {
          background: #f1f5f9;
          border-radius: 8px;
          height: 10px;
          width: 100%;
          overflow: hidden;
          margin-bottom: 1.5rem;
        }
        .progress-bar-fill {
          height: 100%;
          border-radius: 8px;
          transition: width 0.4s ease-out;
        }
        .criteria-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.6rem 0.5rem;
          border-bottom: 1px solid #f8fafc;
          font-size: 0.85rem;
        }
        .criteria-row:last-child {
          border-bottom: none;
        }
        .criteria-meta {
          display: flex;
          align-items: center;
          gap: 0.65rem;
          min-width: 0;
        }
        .criteria-meta span.title {
          font-weight: 600;
          color: #1e293b;
        }
        .criteria-meta span.desc {
          color: #64748b;
          font-size: 0.78rem;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .criteria-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-shrink: 0;
        }
        .status-badge {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 0.72rem;
          font-weight: 700;
        }
        .status-badge.pass {
          background: rgba(16, 185, 129, 0.1);
          color: #10b981;
        }
        .status-badge.fail {
          background: rgba(239, 68, 68, 0.08);
          color: #ef4444;
        }
        .icon-pass {
          color: #10b981;
          font-size: 0.95rem;
        }
        .icon-fail {
          color: #ef4444;
          font-size: 0.95rem;
        }
        .ai-card {
          background: linear-gradient(135deg, #f8fafc, #eff6ff);
          border: 1px solid #dbeafe;
          border-radius: 16px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }
        .ai-card h3 {
          font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
          font-size: 1.15rem;
          color: #1e3a8a;
          margin-bottom: 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .ai-card h3 i {
          color: #3b82f6;
        }
        .ai-textarea {
          width: 100%;
          min-height: 100px;
          border-radius: 8px;
          border: 1px solid #bfdbfe;
          padding: 0.75rem;
          font-size: 0.875rem;
          font-family: inherit;
          resize: vertical;
          margin-bottom: 0.75rem;
        }
        .ai-textarea:focus {
          border-color: #3b82f6;
          outline: none;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
        }
        .consult-report-box {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1.5rem;
          max-height: 450px;
          overflow-y: auto;
          font-size: 0.9rem;
          line-height: 1.6;
        }
        .consult-report-box h1, .consult-report-box h2, .consult-report-box h3 {
          color: #1e293b;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          font-weight: 700;
        }
        .consult-report-box h2 {
          font-size: 1.15rem;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 0.4rem;
        }
        .consult-report-box ul, .consult-report-box ol {
          padding-left: 1.25rem;
          margin-bottom: 1rem;
        }
        .consult-report-box li {
          margin-bottom: 0.35rem;
        }
        .consult-report-box p {
          margin-bottom: 0.85rem;
        }
      `}</style>

      {/* Page Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <i className="fa-solid fa-gauge" style={{ color: '#6366f1' }}></i> Mô phỏng đánh giá đạt chuẩn PGS / GS
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.925rem', marginTop: '0.25rem' }}>
            Điền các chỉ số lý lịch của bạn để đối chiếu điều kiện đạt chuẩn tự động. Dữ liệu được lưu trữ trực tiếp trên trình duyệt của bạn.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={handleReset} style={{ background: '#f8fafc', borderColor: '#cbd5e1' }}>
            <i className="fa-solid fa-rotate-left"></i> Đặt lại
          </button>
          <button className="btn-primary" onClick={handleLoadFromProfile}>
            <i className="fa-solid fa-cloud-arrow-down"></i> Lấy điểm từ hồ sơ
          </button>
        </div>
      </div>

      {/* Top Config Fields */}
      <div className="section-card" style={{ background: '#f8fafc', borderColor: '#cbd5e1', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div className="input-box" style={{ flex: 1, minWidth: '240px' }}>
            <label style={{ fontWeight: 700 }}>Hội đồng ngành / liên ngành</label>
            <select value={academicField} onChange={(e) => setAcademicField(e.target.value)}>
              <option value="Công nghệ thông tin">Công nghệ thông tin</option>
              <option value="Kỹ thuật điện">Kỹ thuật điện, Điện tử, Tự động hóa</option>
              <option value="Y học">Y học</option>
              <option value="Dược học">Dược học</option>
              <option value="Toán học">Toán học</option>
              <option value="Vật lý">Vật lý</option>
              <option value="Kinh tế">Kinh tế</option>
              <option value="Giáo dục học">Giáo dục học</option>
              <option value="Hóa học">Hóa học - Công nghệ thực phẩm</option>
              <option value="Cơ khí">Cơ khí - Động lực</option>
            </select>
          </div>
          <div className="input-box" style={{ width: '150px' }}>
            <label style={{ fontWeight: 700 }}>Năm thẩm định</label>
            <input
              type="number"
              value={evalYear}
              onChange={(e) => setEvalYear(parseInt(e.target.value) || 2026)}
            />
          </div>
        </div>
      </div>

      <div className="simulator-layout">
        
        {/* Left Column: Criteria Form Inputs */}
        <div className="form-column">
          
          {/* Card 1: Điểm công trình */}
          <div className="section-card">
            <div className="section-title">
              <i className="fa-solid fa-file-invoice"></i> 1. Điểm công trình khoa học (Quy đổi)
            </div>
            <div className="section-grid">
              <div className="input-box">
                <label>Tổng điểm quy đổi</label>
                <input
                  type="number"
                  step="0.05"
                  value={totalScore || ''}
                  onChange={(e) => setTotalScore(parseFloat(e.target.value) || 0)}
                  placeholder="Ví dụ: 9.5"
                />
                <span className="subtext">PGS ≥ 10 · GS ≥ 20</span>
              </div>
              <div className="input-box">
                <label>Điểm trong 3 năm cuối</label>
                <input
                  type="number"
                  step="0.05"
                  value={last3YearsScore || ''}
                  onChange={(e) => setLast3YearsScore(parseFloat(e.target.value) || 0)}
                  placeholder="Ví dụ: 4.2"
                />
                <span className="subtext">PGS ≥ 2.5 · GS ≥ 5.0</span>
              </div>
              <div className="input-box">
                <label>Điểm bài báo (Tạp chí quốc tế uy tín)</label>
                <input
                  type="number"
                  step="0.05"
                  value={journalScore || ''}
                  onChange={(e) => setJournalScore(parseFloat(e.target.value) || 0)}
                  placeholder="Ví dụ: 7.1"
                />
                <span className="subtext">PGS ≥ 6 · GS ≥ 12</span>
              </div>
              <div className="input-box">
                <label>Số bài báo là tác giả chính (từ 2020)</label>
                <input
                  type="number"
                  value={mainAuthorArticles || ''}
                  onChange={(e) => setMainAuthorArticles(parseInt(e.target.value) || 0)}
                  placeholder="Ví dụ: 4"
                />
                <span className="subtext">Đầu hoặc liên hệ · PGS ≥ 3 · GS ≥ 5</span>
              </div>
            </div>
          </div>

          {/* Card 2: Giảng dạy */}
          <div className="section-card">
            <div className="section-title">
              <i className="fa-solid fa-chalkboard-user"></i> 2. Giảng dạy & thâm niên công tác
            </div>
            <div className="section-grid">
              <div className="input-box">
                <label>Giờ chuẩn giảng dạy trung bình / năm</label>
                <input
                  type="number"
                  value={teachingHours || ''}
                  onChange={(e) => setTeachingHours(parseInt(e.target.value) || 0)}
                  placeholder="Ví dụ: 300"
                />
                <span className="subtext">PGS & GS yêu cầu tối thiểu 275 giờ/năm</span>
              </div>
              <div className="input-box">
                <label>Số năm công tác trong lĩnh vực đào tạo</label>
                <input
                  type="number"
                  value={seniorityYears || ''}
                  onChange={(e) => setSeniorityYears(parseInt(e.target.value) || 0)}
                  placeholder="Ví dụ: 8"
                />
                <span className="subtext">PGS ≥ 6 năm · GS ≥ 9 năm</span>
              </div>
            </div>
          </div>

          {/* Card 3: Học vị */}
          <div className="section-card">
            <div className="section-title">
              <i className="fa-solid fa-graduation-cap"></i> 3. Trình độ & chức danh
            </div>
            <div className="section-grid">
              <div className="input-box">
                <label>Học vị / chức danh hiện tại</label>
                <select value={degreeTitle} onChange={(e) => setDegreeTitle(e.target.value as any)}>
                  <option value="TS">Tiến sĩ (TS)</option>
                  <option value="PGS">Phó Giáo sư (PGS)</option>
                  <option value="Khác">Khác</option>
                </select>
              </div>
              <div className="input-box">
                <label>Số năm giữ học vị TS / chức danh PGS</label>
                <input
                  type="number"
                  value={degreeYears || ''}
                  onChange={(e) => setDegreeYears(parseInt(e.target.value) || 0)}
                  placeholder="Ví dụ: 4"
                />
                <span className="subtext">Yêu cầu tối thiểu 3 năm đối với PGS/GS</span>
              </div>
            </div>
          </div>

          {/* Card 4: Ngoại ngữ */}
          <div className="section-card">
            <div className="section-title">
              <i className="fa-solid fa-language"></i> 4. Trình độ ngoại ngữ
            </div>
            <div className="input-box">
              <label>Bậc năng lực ngoại ngữ (CEFR hoặc tương đương)</label>
              <div className="cefr-grid">
                {cefrLevels.map(lvl => (
                  <button
                    key={lvl}
                    className={`cefr-btn ${foreignLanguage === lvl ? 'selected' : ''}`}
                    onClick={() => setForeignLanguage(lvl)}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
              <span className="subtext" style={{ marginTop: '0.35rem' }}>PGS & GS yêu cầu tối thiểu trình độ ngoại ngữ từ B2 trở lên</span>
            </div>
          </div>

          {/* Card 5: Hướng dẫn học viên */}
          <div className="section-card">
            <div className="section-title">
              <i className="fa-solid fa-people-group"></i> 5. Hướng dẫn học viên bảo vệ thành công
            </div>
            <div className="section-grid">
              <div className="input-box">
                <label>Số học viên Thạc sĩ hướng dẫn</label>
                <input
                  type="number"
                  value={guidedMasters || ''}
                  onChange={(e) => setGuidedMasters(parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
                <span className="subtext">PGS yêu cầu ≥ 2 học viên Thạc sĩ</span>
              </div>
              <div className="input-box">
                <label>Số Nghiên cứu sinh (NCS) Tiến sĩ hướng dẫn</label>
                <input
                  type="number"
                  value={guidedPhds || ''}
                  onChange={(e) => setGuidedPhds(parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
                <span className="subtext">PGS ≥ 1 NCS (thay cho 2 ThS) · GS ≥ 2 NCS TS</span>
              </div>
            </div>
          </div>

          {/* Card 6: Đề tài */}
          <div className="section-card">
            <div className="section-title">
              <i className="fa-solid fa-folder-open"></i> 6. Đề tài nghiên cứu khoa học (chủ trì)
            </div>
            <div className="section-grid">
              <div className="input-box">
                <label>Đề tài cấp Cơ sở / Trường</label>
                <input
                  type="number"
                  value={projectsDomestic || ''}
                  onChange={(e) => setProjectsDomestic(parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
                <span className="subtext">PGS: ≥ 2 cơ sở (hoặc 1 cấp Bộ)</span>
              </div>
              <div className="input-box">
                <label>Đề tài cấp Bộ / Tỉnh</label>
                <input
                  type="number"
                  value={projectsMinistry || ''}
                  onChange={(e) => setProjectsMinistry(parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
                <span className="subtext">GS: ≥ 2 cấp Bộ (hoặc 1 cấp QG)</span>
              </div>
              <div className="input-box" style={{ gridColumn: 'span 2' }}>
                <label>Đề tài cấp Quốc gia (NAFOSTED, trọng điểm QG...)</label>
                <input
                  type="number"
                  value={projectsNational || ''}
                  onChange={(e) => setProjectsNational(parseInt(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Right Column: Scorecards & AI Integration */}
        <div className="scorecard-column">
          
          {/* Dual Scorecards: PGS */}
          <div className="compliance-card" style={{ borderLeft: `5px solid ${pgsPercent === 100 ? '#10b981' : '#f59e0b'}` }}>
            <div className="progress-header">
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>Ứng viên Phó Giáo sư (PGS)</h3>
                <span style={{ fontSize: '0.825rem', color: '#64748b', fontWeight: 500 }}>
                  Đạt {pgsPassedCount} / {checksPGS.length} tiêu chuẩn
                </span>
              </div>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: pgsPercent === 100 ? '#10b981' : '#f59e0b' }}>
                {pgsPercent}%
              </span>
            </div>
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${pgsPercent}%`,
                  background: pgsPercent === 100 ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #6366f1, #8b5cf6)'
                }}
              />
            </div>

            <div className="criteria-list">
              {checksPGS.map((chk, idx) => (
                <div key={idx} className="criteria-row">
                  <div className="criteria-meta">
                    {chk.pass ? (
                      <i className="fa-solid fa-circle-check icon-pass"></i>
                    ) : (
                      <i className="fa-solid fa-circle-xmark icon-fail"></i>
                    )}
                    <span className="title">{chk.name}</span>
                    <span className="desc">({chk.desc})</span>
                  </div>
                  <div className="criteria-status">
                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>{chk.current}</span>
                    <span className={`status-badge ${chk.pass ? 'pass' : 'fail'}`}>
                      {chk.pass ? 'ĐẠT' : 'CHƯA ĐẠT'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Dual Scorecards: GS */}
          <div className="compliance-card" style={{ borderLeft: `5px solid ${gsPercent === 100 ? '#10b981' : '#6366f1'}` }}>
            <div className="progress-header">
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>Ứng viên Giáo sư (GS)</h3>
                <span style={{ fontSize: '0.825rem', color: '#64748b', fontWeight: 500 }}>
                  Đạt {gsPassedCount} / {checksGS.length} tiêu chuẩn
                </span>
              </div>
              <span style={{ fontSize: '1.5rem', fontWeight: 800, color: gsPercent === 100 ? '#10b981' : '#6366f1' }}>
                {gsPercent}%
              </span>
            </div>
            <div className="progress-bar-container">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${gsPercent}%`,
                  background: gsPercent === 100 ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #3b82f6, #6366f1)'
                }}
              />
            </div>

            <div className="criteria-list">
              {checksGS.map((chk, idx) => (
                <div key={idx} className="criteria-row">
                  <div className="criteria-meta">
                    {chk.pass ? (
                      <i className="fa-solid fa-circle-check icon-pass"></i>
                    ) : (
                      <i className="fa-solid fa-circle-xmark icon-fail"></i>
                    )}
                    <span className="title">{chk.name}</span>
                    <span className="desc">({chk.desc})</span>
                  </div>
                  <div className="criteria-status">
                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>{chk.current}</span>
                    <span className={`status-badge ${chk.pass ? 'pass' : 'fail'}`}>
                      {chk.pass ? 'ĐẠT' : 'CHƯA ĐẠT'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* AI Parser Card */}
          <div className="ai-card">
            <h3><i className="fa-solid fa-wand-magic-sparkles"></i> Phân tích lý lịch bằng AI ✨</h3>
            <p style={{ fontSize: '0.825rem', color: '#1e3a8a', marginBottom: '0.75rem', lineHeight: 1.4 }}>
              Dán thông tin lý lịch cá nhân hoặc tóm tắt các hoạt động khoa học của bạn vào đây. AI sẽ tự động phân tích và điền dữ liệu vào các ô mô phỏng ở bên.
            </p>
            <textarea
              className="ai-textarea"
              placeholder="Ví dụ: Tôi tốt nghiệp Tiến sĩ ngành Công nghệ thông tin từ năm 2021. Tôi đã giảng dạy được 5 năm, trung bình 280 giờ mỗi năm. Tôi đã hoàn thành hướng dẫn 3 học viên Cao học bảo vệ thành công Thạc sĩ. Tôi đã làm chủ trì 2 đề tài NCKH cấp cơ sở của học viện và thi đạt chứng chỉ IELTS 6.5 (tương đương B2)..."
              value={rawCVText}
              onChange={(e) => setRawCVText(e.target.value)}
              disabled={isExtractingCV}
            />
            <button
              className="btn-primary"
              onClick={handleAIParseCV}
              disabled={isExtractingCV || !rawCVText.trim()}
              style={{ width: '100%', background: '#2563eb', borderColor: '#2563eb' }}
            >
              {isExtractingCV ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i> Đang trích xuất lý lịch...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-robot"></i> Trích xuất thông tin bằng AI
                </>
              )}
            </button>
          </div>

          {/* AI Consultant Card */}
          <div className="section-card" style={{ background: '#f8fafc', border: '1px solid #cbd5e1' }}>
            <div className="section-title" style={{ borderBottom: 'none', marginBottom: 0, paddingBottom: 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="fa-solid fa-user-doctor" style={{ color: '#059669' }}></i> Tư vấn lộ trình đạt tiêu chuẩn (AI Consultant)
              </span>
            </div>
            <p style={{ fontSize: '0.825rem', color: '#475569', margin: '0.5rem 0 1rem 0', lineHeight: 1.4 }}>
              AI sẽ phân tích hồ sơ hiện tại và đề xuất cho bạn một lộ trình chi tiết để bù đắp các tiêu chí còn thiếu nhằm đủ điều kiện PGS/GS.
            </p>
            <button
              className="btn-primary"
              onClick={handleAIConsult}
              disabled={isConsulting}
              style={{ width: '100%', background: '#059669', borderColor: '#059669', marginBottom: '1rem' }}
            >
              {isConsulting ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin"></i> Đang xây dựng lộ trình...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-lightbulb"></i> Tư vấn lộ trình bằng AI 🤖
                </>
              )}
            </button>

            {aiConsultationReport && (
              <div className="consult-report-box" dangerouslySetInnerHTML={{ __html: marked.parse(aiConsultationReport) as string }} />
            )}
          </div>

        </div>

      </div>
    </div>
  );
};

export default Simulator;
