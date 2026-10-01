import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as apiClient from '../utils/api';
import { ocrApi } from '../api';
import { showToast } from '../utils/toast';

interface ValidationProps {
  setLoading: (loading: boolean) => void;
}

const Validation = ({ setLoading }: ValidationProps) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'doi' | 'ocr'>('doi');
  const [candidateName, setCandidateName] = useState('Nguyễn Văn An');
  const [candidateTitleVn, setCandidateTitleVn] = useState('');
  
  // DOI mode states
  const [doi, setDoi] = useState('');
  
  // OCR mode states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [ocrDocType, setOcrDocType] = useState<string>('declaration_form');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Result states
  const [resultData, setResultData] = useState<any>(null);

  // Paste image from clipboard support
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (activeTab !== 'ocr') return;
      if (e.clipboardData && e.clipboardData.files.length > 0) {
        const file = e.clipboardData.files[0];
        if (file.type.startsWith('image/') || file.type === 'application/pdf') {
          handleFileSelect(file);
          showToast('Đã nhận diện ảnh từ bộ nhớ tạm (Clipboard)!', 'info');
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [activeTab]);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setFilePreview(url);
    } else {
      setFilePreview(null);
    }
  };

  const handleLoadSampleDeclaration = async () => {
    try {
      setLoading(true);
      const res = await fetch('/sample_declaration_form.png');
      const blob = await res.blob();
      const file = new File([blob], 'sample_declaration_form.png', { type: 'image/png' });
      handleFileSelect(file);
      setOcrDocType('declaration_form');
      showToast('Đã nạp file ảnh Mẫu tờ khai chuẩn định dạng của Hệ thống!', 'success');
    } catch (err) {
      showToast('Không thể tải file ảnh mẫu tờ khai', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleValidateDoi = async () => {
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
      showToast('Lỗi hệ thống khi kiểm định bài báo khoa học.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleValidateOcr = async () => {
    if (!selectedFile) {
      showToast('Vui lòng chọn hoặc kéo thả ảnh chụp trang đầu bài báo / tờ khai', 'warning');
      return;
    }
    const trimmedName = candidateName.trim();
    if (!trimmedName) {
      showToast('Vui lòng nhập tên ứng viên kê khai để đối soát', 'warning');
      return;
    }

    setLoading(true);
    setResultData(null);
    try {
      const res = await ocrApi.validateFromImage(selectedFile, trimmedName, candidateTitleVn.trim(), ocrDocType);
      
      const ocrRes = res.ocr_result || {};
      const meta = res.crossref_metadata || {
        title: ocrRes.title_en || ocrRes.title_vn || 'Chưa rõ tiêu đề',
        journal: ocrRes.journal_name || 'N/A',
        doi: res.extracted_doi || '',
        year: ocrRes.year || new Date().getFullYear(),
        issn: ocrRes.issn ? [ocrRes.issn] : [],
        authors: (ocrRes.authors || []).map((a: any) => ({
          given: a.name,
          family: '',
          affiliation: a.affiliation ? [a.affiliation] : [],
          is_first_author: a.is_first_author,
          is_corresponding: a.is_corresponding
        })),
        volume: ocrRes.volume,
        issue: ocrRes.issue,
        pages: ocrRes.pages
      };

      const resultObj = {
        input: {
          doi: res.extracted_doi || '',
          url: '',
          candidate_name: trimmedName,
          title_vn: candidateTitleVn || ocrRes.title_vn,
        },
        metadata: meta,
        verification: {
          integrity: res.integrity || {},
          author_role: res.author_role || {},
        },
        double_check_mismatches: res.double_check_mismatches || [],
        ocr_result: ocrRes,
        has_doi: res.has_doi,
        extracted_doi: res.extracted_doi,
        report_markdown: res.report_markdown,
      };

      setResultData(resultObj);

      if (res.extracted_doi) {
        setDoi(res.extracted_doi);
      }
      if (ocrRes.title_vn && !candidateTitleVn) {
        setCandidateTitleVn(ocrRes.title_vn);
      }

      // Prepare comprehensive pending declaration for /papers
      const pendingDeclaration = {
        source: 'ocr',
        docType: ocrDocType,
        candidateName: trimmedName,
        candidateTitleVn: candidateTitleVn.trim() || ocrRes.title_vn || '',
        ocrResult: ocrRes,
        extractedDoi: res.extracted_doi,
        hasDoi: res.has_doi,
        crossrefMatched: res.crossref_matched,
        crossrefMetadata: meta,
        integrity: res.integrity || {},
        authorRole: res.author_role || {},
        doubleCheckMismatches: res.double_check_mismatches || [],
        reportMarkdown: res.report_markdown,
        items: (ocrRes.items && ocrRes.items.length > 0)
          ? ocrRes.items
          : [{
              item_no: 1,
              title: candidateTitleVn.trim() || ocrRes.title_vn || meta.title || ocrRes.title_en || 'Bài báo khoa học',
              title_en: ocrRes.title_en || meta.title || '',
              journal_name: meta.journal || ocrRes.journal_name || '',
              doi: res.extracted_doi || '',
              issn: (meta.issn && meta.issn[0]) || ocrRes.issn || '',
              year: ocrRes.year || meta.year || new Date().getFullYear(),
              volume: ocrRes.volume,
              issue: ocrRes.issue,
              pages: ocrRes.pages,
              ranking: res.integrity?.ranking?.quartile || 'Q1',
              sjr_score: res.integrity?.ranking?.sjr_score,
              role: res.author_role?.is_main_author ? 'main' : (res.author_role?.is_corresponding_author ? 'corresponding' : 'member'),
              claimed_score: res.integrity?.vietnam_info?.max_score || 1.0,
            }]
      };

      showToast('Quét & Thẩm định AI thành công! Đang chuyển sang trang Bài báo để đối soát và xác nhận khai báo...', 'success');
      
      // Auto navigate to /papers with pendingDeclaration
      setTimeout(() => {
        navigate('/papers', { state: { pendingDeclaration } });
      }, 700);

    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Lỗi khi xử lý hình ảnh', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoToPapersDeclaration = () => {
    if (!resultData) return;
    const meta = resultData.metadata || {};
    const ocrRes = resultData.ocr_result || {};
    const pendingDeclaration = {
      source: activeTab,
      candidateName: candidateName.trim(),
      candidateTitleVn: candidateTitleVn.trim() || ocrRes.title_vn || '',
      ocrResult: ocrRes,
      extractedDoi: resultData.extracted_doi || meta.doi || doi.trim(),
      hasDoi: resultData.has_doi || !!(resultData.extracted_doi || meta.doi || doi.trim()),
      crossrefMatched: !!resultData.metadata,
      crossrefMetadata: meta,
      integrity: resultData.verification?.integrity || {},
      authorRole: resultData.verification?.author_role || {},
      doubleCheckMismatches: resultData.double_check_mismatches || [],
      reportMarkdown: resultData.report_markdown,
      items: (ocrRes.items && ocrRes.items.length > 0)
        ? ocrRes.items
        : [{
            item_no: 1,
            title: candidateTitleVn.trim() || ocrRes.title_vn || meta.title || 'Bài báo khoa học',
            title_en: meta.title || ocrRes.title_en || '',
            journal_name: meta.journal || ocrRes.journal_name || '',
            doi: resultData.extracted_doi || meta.doi || doi.trim(),
            issn: (meta.issn && meta.issn[0]) || ocrRes.issn || '',
            year: meta.year || ocrRes.year || new Date().getFullYear(),
            ranking: resultData.verification?.integrity?.ranking?.quartile || 'Q1',
            sjr_score: resultData.verification?.integrity?.ranking?.sjr_score,
            role: resultData.verification?.author_role?.is_main_author ? 'main' : 'member',
            claimed_score: resultData.verification?.integrity?.vietnam_info?.max_score || 1.0,
          }]
    };
    showToast('Đang chuyển sang trang Bài báo để đối soát thông số...', 'info');
    navigate('/papers', { state: { pendingDeclaration } });
  };

  const handleRegisterPaper = handleGoToPapersDeclaration;

  const metadata = resultData?.metadata;
  const verification = resultData?.verification || {};
  const integrity = verification.integrity || {};
  const authorRole = verification.author_role || {};
  const ocrResult = resultData?.ocr_result;
  const doubleCheckMismatches = resultData?.double_check_mismatches || [];

  return (
    <div className="card">
      <div className="card-header">
        <h2>Xác thực bài báo khoa học & Giám định Liêm chính</h2>
        <p>Hỗ trợ song song qua mã DOI chuẩn quốc tế hoặc Quét thông minh (OCR Vision) từ ảnh chụp trang đầu bài báo / Tờ khai HĐGSNN.</p>
      </div>

      {/* Mode Tabs */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem' }}>
        <button
          type="button"
          onClick={() => setActiveTab('doi')}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: activeTab === 'doi' ? '2px solid #4f46e5' : '1px solid #cbd5e1',
            background: activeTab === 'doi' ? '#eef2ff' : '#ffffff',
            color: activeTab === 'doi' ? '#4338ca' : '#64748b',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s ease',
          }}
        >
          <i className="fas fa-link"></i> 1. Nhập mã DOI / URL bài báo
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ocr')}
          style={{
            padding: '10px 20px',
            borderRadius: '10px',
            border: activeTab === 'ocr' ? '2px solid #059669' : '1px solid #cbd5e1',
            background: activeTab === 'ocr' ? '#ecfdf5' : '#ffffff',
            color: activeTab === 'ocr' ? '#047857' : '#64748b',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'all 0.2s ease',
          }}
        >
          <i className="fas fa-camera"></i> 2. Quét ảnh trang đầu / Tờ khai (OCR Vision)
          <span style={{ fontSize: '0.75rem', background: '#10b981', color: 'white', padding: '2px 8px', borderRadius: '12px' }}>Mới</span>
        </button>
      </div>

      {/* Candidate Profile Details */}
      <div className="form-grid">
        <div className="form-group">
          <label htmlFor="candidate-name">Tên ứng viên kê khai để đối soát *</label>
          <input
            type="text"
            id="candidate-name"
            value={candidateName}
            onChange={(e) => setCandidateName(e.target.value)}
            placeholder="e.g. Nguyễn Văn An"
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

        {/* Tab 1: DOI Input */}
        {activeTab === 'doi' && (
          <div className="form-group full-width">
            <label htmlFor="doi-input">Mã DOI bài báo khoa học hoặc Link chi tiết</label>
            <div className="input-with-button">
              <input
                type="text"
                id="doi-input"
                value={doi}
                onChange={(e) => setDoi(e.target.value)}
                placeholder="e.g. 10.1016/j.eswa.2023.120556"
              />
              <button id="btn-validate" className="btn-primary" onClick={handleValidateDoi}>
                <i className="fas fa-robot"></i> Kiểm định AI
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: OCR Image Upload */}
        {activeTab === 'ocr' && (
          <div className="form-group full-width">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <label style={{ fontWeight: 700, color: '#1e293b' }}>Định dạng tài liệu quét OCR:</label>
              <select
                value={ocrDocType}
                onChange={(e) => setOcrDocType(e.target.value)}
                style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid #059669', fontSize: '0.875rem', fontWeight: 600, color: '#047857', background: '#ecfdf5' }}
              >
                <option value="declaration_form">📄 Tờ đơn / Phiếu kê khai chuẩn định dạng của Hệ thống (Khuyên dùng)</option>
                <option value="article_first_page">📑 Trang đầu bài báo gốc (Title / Cover Page - Tự do)</option>
              </select>
            </div>

            {/* Standard Template Guidance Card */}
            {ocrDocType === 'declaration_form' && (
              <div
                style={{
                  background: 'linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)',
                  border: '1px solid #a7f3d0',
                  borderRadius: '12px',
                  padding: '1rem 1.25rem',
                  marginBottom: '1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '10px',
                      background: '#059669',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.25rem',
                      flexShrink: 0,
                    }}
                  >
                    <i className="fa-solid fa-file-contract" />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, color: '#065f46', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      Mẫu Tờ Đơn Kê Khai Chuẩn Định Dạng của Hệ Thống
                      <span style={{ fontSize: '0.7rem', background: '#059669', color: 'white', padding: '2px 8px', borderRadius: '12px' }}>
                        Mẫu 08 / HĐGSNN
                      </span>
                    </div>
                    <p style={{ margin: '3px 0 0 0', fontSize: '0.825rem', color: '#047857', maxWidth: '650px' }}>
                      Hệ thống tự động đọc và đối soát chính xác theo các ô trường đã định dạng: Tiêu đề, DOI, Tạp chí, Vai trò tác giả chính/liên hệ, ISSN và điểm công trình.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={handleLoadSampleDeclaration}
                    style={{
                      padding: '7px 14px',
                      borderRadius: '8px',
                      border: '1px solid #059669',
                      background: '#ffffff',
                      color: '#047857',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                    title="Nạp ngay ảnh mẫu tờ khai chuẩn đã điền sẵn để kiểm tra OCR ngay lập tức"
                  >
                    <i className="fa-solid fa-bolt" style={{ color: '#eab308' }} />
                    Thử nhanh với ảnh Tờ đơn mẫu
                  </button>

                  <a
                    href="/sample_declaration_form.png"
                    download="Mau_To_Khai_Dang_Ky_Bai_Bao.png"
                    style={{
                      padding: '7px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#334155',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                    title="Tải ảnh mẫu tờ khai chuẩn về máy"
                  >
                    <i className="fa-solid fa-download" />
                    Tải file ảnh mẫu (.PNG)
                  </a>
                </div>
              </div>
            )}

            {/* Drag & Drop Area */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: isDragging ? '2px dashed #059669' : '2px dashed #94a3b8',
                borderRadius: '12px',
                padding: '2rem 1.5rem',
                textAlign: 'center',
                background: isDragging ? '#f0fdf4' : '#f8fafc',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
              
              {selectedFile ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                  {filePreview && (
                    <img
                      src={filePreview}
                      alt="Xem trước tài liệu"
                      style={{ maxHeight: '150px', maxWidth: '220px', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)' }}
                    />
                  )}
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontWeight: 700, color: '#1e293b' }}>
                      <i className="fas fa-file-image" style={{ color: '#059669', marginRight: '6px' }}></i>
                      {selectedFile.name}
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '4px' }}>
                      Kích thước: {(selectedFile.size / 1024).toFixed(1)} KB | Loại: {selectedFile.type || 'Tài liệu'}
                    </div>
                    <div style={{ marginTop: '8px', fontSize: '0.85rem', color: '#059669', fontWeight: 600 }}>
                      <i className="fas fa-check-circle"></i> Sẵn sàng phân tích theo định dạng {ocrDocType === 'declaration_form' ? 'Tờ đơn chuẩn' : 'Trang đầu bài báo'}. Nhấn vào đây để đổi ảnh khác.
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '2.5rem', color: '#059669', marginBottom: '0.75rem' }}>
                    <i className={ocrDocType === 'declaration_form' ? "fa-solid fa-file-invoice" : "fas fa-cloud-arrow-up"}></i>
                  </div>
                  <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e293b' }}>
                    {ocrDocType === 'declaration_form'
                      ? 'Kéo & thả ảnh chụp Tờ đơn / Phiếu kê khai định dạng chuẩn vào đây, hoặc nhấn để chọn file'
                      : 'Kéo & thả ảnh trang đầu bài báo gốc vào đây, hoặc nhấn để chọn file'}
                  </h4>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: '#64748b' }}>
                    {ocrDocType === 'declaration_form'
                      ? 'Hệ thống tối ưu nhận diện ảnh chụp điện thoại hoặc scan theo cấu trúc ô biểu mẫu chuẩn. Mẹo: Dán trực tiếp bằng Ctrl + V!'
                      : 'Hỗ trợ file PNG, JPG, JPEG, WEBP hoặc PDF trang 1. Mẹo: Dán trực tiếp bằng Ctrl + V!'}
                  </p>
                </div>
              )}
            </div>

            <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={handleValidateOcr}
                disabled={!selectedFile}
                style={{
                  background: selectedFile ? 'linear-gradient(135deg, #059669 0%, #047857 100%)' : '#94a3b8',
                  padding: '10px 24px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  cursor: selectedFile ? 'pointer' : 'not-allowed',
                  boxShadow: selectedFile ? '0 4px 12px rgba(5, 150, 105, 0.25)' : 'none',
                }}
              >
                <i className="fas fa-wand-magic-sparkles"></i> Quét & Thẩm định AI (Vision)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Validation Outcome Report Output */}
      {resultData && (
        <div id="validation-result" className="result-area" style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h3 className="report-main-title" style={{ margin: 0 }}>
              <i className="fas fa-shield-halved"></i> Báo cáo thẩm định & Kiểm định liêm chính học thuật
            </h3>
            <button 
              className="btn-primary" 
              onClick={handleRegisterPaper}
              style={{
                background: 'linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)',
                color: 'white',
                border: 'none',
                padding: '10px 22px',
                borderRadius: '10px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
              }}
            >
              <i className="fa-solid fa-arrow-right-to-bracket"></i> Qua trang Bài báo để Đối soát & Xác nhận Khai báo
            </button>
          </div>

          {/* Double Check Alert Banner if any mismatches found */}
          {doubleCheckMismatches.length > 0 && (
            <div style={{
              background: '#fffbeb',
              border: '1px solid #fef3c7',
              borderLeft: '5px solid #f59e0b',
              padding: '1rem',
              borderRadius: '8px',
              marginBottom: '1.5rem',
            }}>
              <div style={{ fontWeight: 700, color: '#b45309', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className="fas fa-triangle-exclamation"></i> Cảnh báo đối soát kép (Double Verification Warning):
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#92400e', fontSize: '0.92rem' }}>
                {doubleCheckMismatches.map((m: string, idx: number) => (
                  <li key={idx} style={{ marginBottom: '4px' }}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Section 0: OCR Visual Extraction Insights */}
          {ocrResult && (
            <div className="report-section" style={{ borderLeft: '4px solid #059669', background: '#f8fafc' }}>
              <h4>
                <i className="fas fa-camera"></i> Dữ liệu trích xuất từ Hình ảnh (OCR Vision Insights)
              </h4>
              
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {resultData.has_doi ? (
                  <span className="badge badge-valid" style={{ background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
                    <i className="fas fa-check-double"></i> Đã phát hiện mã DOI trên trang bìa: <strong>{resultData.extracted_doi}</strong>
                  </span>
                ) : (
                  <span className="badge badge-warning" style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                    <i className="fas fa-info-circle"></i> Không phát hiện mã DOI - Thẩm định trực tiếp qua Tên & Danh mục HĐGSNN
                  </span>
                )}
                {ocrResult.publisher && (
                  <span className="badge" style={{ background: '#f1f5f9', color: '#475569' }}>
                    Nhà xuất bản: {ocrResult.publisher}
                  </span>
                )}
              </div>

              {ocrResult.authors && ocrResult.authors.length > 0 && (
                <div className="res-item">
                  <span className="res-label">Tác giả bóc tách từ ảnh & Ký hiệu nhận dạng</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                    {ocrResult.authors.map((a: any, idx: number) => (
                      <div key={idx} style={{ fontSize: '0.9rem', color: '#334155' }}>
                        <strong>{idx + 1}. {a.name}</strong>
                        {a.is_first_author && <span style={{ marginLeft: '6px', color: '#059669', fontWeight: 600 }}>[Tác giả thứ nhất]</span>}
                        {a.is_corresponding && <span style={{ marginLeft: '6px', color: '#d97706', fontWeight: 600 }}>⭐ [Tác giả liên hệ]</span>}
                        {a.is_co_first && <span style={{ marginLeft: '6px', color: '#6366f1', fontWeight: 600 }}>🤝 [Đồng tác giả]</span>}
                        {a.affiliation && <div style={{ fontSize: '0.82rem', color: '#64748b', marginLeft: '1rem' }}>{a.affiliation}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 1: Overview */}
          {metadata && (
            <div className="report-section">
              <h4>
                <i className="fas fa-file-invoice"></i> 1. Thông tin tổng quan công trình
              </h4>
              <div className="res-item">
                <span className="res-label">Tiêu đề bài báo (Title)</span>
                <span className="res-value" style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                  {metadata.title || 'N/A'}
                </span>
              </div>
              <div className="res-item">
                <span className="res-label">Danh sách nhóm tác giả</span>
                <span className="res-value">
                  {metadata.authors ? metadata.authors.map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()).filter(Boolean).join(', ') : 'N/A'}
                </span>
              </div>
              <div className="res-item">
                <span className="res-label">Tạp chí đăng tải & Chỉ số định danh</span>
                <span className="res-value" style={{ color: 'var(--accent-blue)' }}>
                  {metadata.journal || 'N/A'} ({metadata.year || 'N/A'})
                </span>
                <span className="res-subtext" style={{ marginTop: '0.25rem' }}>
                  <strong>Mã định danh Quốc tế (ISSN):</strong> {metadata.issn ? (Array.isArray(metadata.issn) ? metadata.issn.join(', ') : metadata.issn) : 'N/A'}
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
                    <strong className={`q-${(integrity.ranking.quartile || '').toLowerCase()}`}>
                      {integrity.ranking.quartile}
                    </strong>{' '}
                    | Chỉ số ảnh hưởng SJR:{' '}
                    <strong style={{ color: 'var(--accent-blue)' }}>{integrity.ranking.sjr_score}</strong>
                  </span>
                </div>
              )}
              {integrity.title_similarity_pct !== undefined && (
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
              )}
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
                <span className="res-label">Đơn vị công tác trích xuất</span>
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
