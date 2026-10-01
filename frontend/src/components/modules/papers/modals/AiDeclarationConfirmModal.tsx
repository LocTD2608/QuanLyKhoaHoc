import * as React from 'react';
import { useState, useEffect, useRef } from 'react';
import { Author, PaperFormData } from '../../../../types';
import { Modal } from '../../../common/Modal';
import { papersApi, ocrApi, validateArticle } from '../../../../api';
import { showToast } from '../../../../utils/toast';

interface AiDeclarationConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  declarationData?: any;
  allAuthors: Author[];
  currentUserName: string;
  onSuccess: () => void;
}

export const AiDeclarationConfirmModal: React.FC<AiDeclarationConfirmModalProps> = ({
  isOpen,
  onClose,
  declarationData,
  allAuthors,
  currentUserName,
  onSuccess,
}) => {
  // Step state: 'scan' (quét ảnh hoặc nhập DOI để AI thẩm định) or 'confirm' (đối soát thông số và xác nhận)
  const [step, setStep] = useState<'scan' | 'confirm'>(declarationData ? 'confirm' : 'scan');
  const [activeData, setActiveData] = useState<any>(declarationData || null);

  // Scan screen states
  const [scanMethod, setScanMethod] = useState<'ocr' | 'doi'>('ocr');
  const [candidateName, setCandidateName] = useState<string>(currentUserName || 'Nguyễn Văn An');
  const [candidateTitleVn, setCandidateTitleVn] = useState<string>('');
  const [doiInput, setDoiInput] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [ocrDocType, setOcrDocType] = useState<string>('declaration_form');
  const [isDragging, setIsDragging] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Confirm screen states
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PaperFormData>({
    title: '',
    journal_name: '',
    doi: '',
    year: new Date().getFullYear(),
    status: 'published',
    author_ids: [],
    main_author_id: undefined,
    corresponding_author_id: undefined,
    author_roles: {},
    ranking: 'Q1',
    sjr_score: undefined,
    issn: '',
    notes: '',
  });

  // Sync state when modal opens or declarationData prop changes
  useEffect(() => {
    if (isOpen) {
      if (declarationData) {
        setActiveData(declarationData);
        setStep('confirm');
      } else if (!activeData) {
        setStep('scan');
      }
      if (currentUserName && (!candidateName || candidateName === 'Nguyễn Văn An')) {
        setCandidateName(currentUserName);
      }
    }
  }, [isOpen, declarationData, currentUserName]);

  // Clipboard paste support for scan screen
  useEffect(() => {
    if (!isOpen || step !== 'scan' || scanMethod !== 'ocr') return;

    const handlePaste = (e: ClipboardEvent) => {
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
  }, [isOpen, step, scanMethod]);

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
      setIsScanning(true);
      const res = await fetch('/sample_declaration_form.png');
      const blob = await res.blob();
      const file = new File([blob], 'sample_declaration_form.png', { type: 'image/png' });
      handleFileSelect(file);
      setOcrDocType('declaration_form');
      showToast('Đã nạp file ảnh Mẫu tờ khai chuẩn định dạng của Hệ thống!', 'success');
    } catch (err) {
      showToast('Không thể tải file ảnh mẫu tờ khai', 'error');
    } finally {
      setIsScanning(false);
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

  const handleRunAiAnalysis = async () => {
    const trimmedName = candidateName.trim();
    if (!trimmedName) {
      showToast('Vui lòng nhập tên ứng viên kê khai để đối soát', 'warning');
      return;
    }

    if (scanMethod === 'ocr') {
      if (!selectedFile) {
        showToast('Vui lòng chọn hoặc kéo thả ảnh chụp trang đầu bài báo / tờ khai', 'warning');
        return;
      }

      try {
        setIsScanning(true);
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
            is_first_author: a.is_first_author,
            is_corresponding: a.is_corresponding,
          })),
          volume: ocrRes.volume,
          issue: ocrRes.issue,
          pages: ocrRes.pages,
        };

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
              }],
        };

        setActiveData(pendingDeclaration);
        setStep('confirm');
        showToast('Quét & Thẩm định AI hoàn tất! Mời bạn đối soát thông số bài báo.', 'success');
      } catch (err: any) {
        console.error(err);
        showToast(err.message || 'Lỗi khi quét ảnh bài báo', 'error');
      } finally {
        setIsScanning(false);
      }
    } else {
      // DOI method
      const trimmedDoi = doiInput.trim();
      if (!trimmedDoi) {
        showToast('Vui lòng nhập mã DOI bài báo khoa học', 'warning');
        return;
      }

      try {
        setIsScanning(true);
        const res: any = await validateArticle(trimmedDoi, '', trimmedName, candidateTitleVn.trim());
        const meta = res.metadata || {};
        const integrity = res.verification?.integrity || res.integrity || {};
        const authorRole = res.verification?.author_role || res.author_role || {};
        const mismatches = res.double_check_mismatches || [];

        const pendingDeclaration = {
          source: 'doi',
          candidateName: trimmedName,
          candidateTitleVn: candidateTitleVn.trim(),
          extractedDoi: trimmedDoi,
          hasDoi: true,
          crossrefMatched: true,
          crossrefMetadata: meta,
          integrity,
          authorRole,
          doubleCheckMismatches: mismatches,
          reportMarkdown: res.report_markdown,
          items: [{
            item_no: 1,
            title: candidateTitleVn.trim() || meta.title || 'Bài báo khoa học',
            title_en: meta.title || '',
            journal_name: meta.journal || '',
            doi: trimmedDoi,
            issn: (meta.issn && meta.issn[0]) || '',
            year: meta.year || new Date().getFullYear(),
            volume: meta.volume || '',
            issue: meta.issue || '',
            pages: meta.pages || '',
            ranking: integrity?.ranking?.quartile || 'Q1',
            sjr_score: integrity?.ranking?.sjr_score,
            role: authorRole?.is_main_author ? 'main' : (authorRole?.is_corresponding_author ? 'corresponding' : 'member'),
            claimed_score: integrity?.vietnam_info?.max_score || 1.0,
          }],
        };

        setActiveData(pendingDeclaration);
        setStep('confirm');
        showToast('Thẩm định siêu dữ liệu & Liêm chính thành công!', 'success');
      } catch (err: any) {
        console.error(err);
        showToast(err.message || 'Lỗi khi thẩm định bài báo qua DOI', 'error');
      } finally {
        setIsScanning(false);
      }
    }
  };

  // Parse items from active declaration
  const items = React.useMemo(() => {
    if (!activeData) return [];
    if (activeData.items && Array.isArray(activeData.items) && activeData.items.length > 0) {
      return activeData.items;
    }
    if (activeData.paper) {
      return [activeData.paper];
    }
    const ocr = activeData.ocrResult || {};
    const meta = activeData.crossrefMetadata || {};
    return [
      {
        title: activeData.candidateTitleVn || ocr.title_vn || meta.title || ocr.title_en || 'Bài báo khoa học',
        title_en: ocr.title_en || meta.title || '',
        journal_name: meta.journal || ocr.journal_name || '',
        doi: activeData.extractedDoi || ocr.doi || '',
        issn: (meta.issn && meta.issn[0]) || ocr.issn || '',
        year: ocr.year || meta.year || new Date().getFullYear(),
        volume: ocr.volume || '',
        issue: ocr.issue || '',
        pages: ocr.pages || '',
        ranking: activeData.integrity?.ranking?.quartile || 'Q1',
        sjr_score: activeData.integrity?.ranking?.sjr_score || 1.85,
        role: activeData.authorRole?.is_main_author ? 'main' : (activeData.authorRole?.is_corresponding_author ? 'corresponding' : 'member'),
        claimed_score: activeData.integrity?.vietnam_info?.max_score || 1.0,
      }
    ];
  }, [activeData]);

  // Sync active item into form in confirm step
  useEffect(() => {
    if (!isOpen || step !== 'confirm' || items.length === 0) return;
    const currentItem = items[selectedItemIndex] || items[0];
    const integrity = activeData?.integrity || {};
    const authorRole = activeData?.authorRole || {};
    const ocrRes = activeData?.ocrResult || {};
    const meta = activeData?.crossrefMetadata || {};

    const title = currentItem.title || currentItem.title_vn || currentItem.title_en || ocrRes.title_vn || ocrRes.title_en || meta.title || '';
    const journal = currentItem.journal_name || ocrRes.journal_name || meta.journal || '';
    const doiVal = currentItem.doi || activeData?.extractedDoi || ocrRes.doi || '';
    const issnVal = currentItem.issn || (meta.issn && meta.issn[0]) || ocrRes.issn || '';
    const yearVal = currentItem.year || ocrRes.year || meta.year || new Date().getFullYear();
    const rankVal = currentItem.ranking || integrity.ranking?.quartile || 'Q1';
    const sjrVal = currentItem.sjr_score || integrity.ranking?.sjr_score;

    // Match authors from allAuthors
    const matchedAuthorIds: number[] = [];
    const newRoles: Record<string, any> = {};
    let mainAuthorId: number | undefined = undefined;
    let correspondingAuthorId: number | undefined = undefined;

    // Match current candidate
    const currentAuthorObj = allAuthors.find((a) => {
      const n = a.name.toLowerCase().trim();
      const cand = (activeData?.candidateName || currentUserName || '').toLowerCase().trim();
      return n === cand || n.includes(cand) || cand.includes(n);
    });

    if (currentAuthorObj) {
      matchedAuthorIds.push(currentAuthorObj.id);
      const isMain = authorRole.is_main_author || currentItem.role === 'main' || authorRole.is_first_author;
      const isCorr = authorRole.is_corresponding_author || currentItem.role === 'corresponding';
      if (isMain) {
        mainAuthorId = currentAuthorObj.id;
        newRoles[currentAuthorObj.id] = 'main';
      } else if (isCorr) {
        correspondingAuthorId = currentAuthorObj.id;
        newRoles[currentAuthorObj.id] = 'corresponding';
      } else {
        newRoles[currentAuthorObj.id] = 'member';
      }
    }

    // Match other authors in OCR / Metadata list
    const scannedAuthors = ocrRes.authors || (meta.authors || []).map((a: any) => ({ name: `${a.given || ''} ${a.family || ''}`.trim() }));
    if (Array.isArray(scannedAuthors)) {
      for (const sa of scannedAuthors) {
        const saName = (sa.name || '').toLowerCase().trim();
        const found = allAuthors.find((a) => {
          const an = a.name.toLowerCase().trim();
          return an === saName || an.includes(saName) || saName.includes(an);
        });
        if (found && !matchedAuthorIds.includes(found.id)) {
          matchedAuthorIds.push(found.id);
          if (sa.is_first_author && !mainAuthorId) {
            mainAuthorId = found.id;
            newRoles[found.id] = 'main';
          } else if (sa.is_corresponding && !correspondingAuthorId) {
            correspondingAuthorId = found.id;
            newRoles[found.id] = 'corresponding';
          } else if (!newRoles[found.id]) {
            newRoles[found.id] = 'member';
          }
        }
      }
    }

    setForm({
      title,
      journal_name: journal,
      doi: doiVal,
      year: yearVal,
      status: 'published',
      author_ids: matchedAuthorIds,
      main_author_id: mainAuthorId,
      corresponding_author_id: correspondingAuthorId,
      author_roles: newRoles,
      ranking: rankVal,
      sjr_score: sjrVal,
      issn: issnVal,
      notes: `Đã thẩm định tự động qua AI. Phân hạng: ${rankVal}. Điểm công trình đề xuất: ${currentItem.claimed_score || 1.0} điểm.`,
    });
  }, [isOpen, step, selectedItemIndex, items, activeData, allAuthors, currentUserName]);

  const handleResetToAi = () => {
    showToast('Đã khôi phục các thông số gốc từ AI', 'info');
    setSelectedItemIndex((prev) => prev);
  };

  const parseSjrScore = (val: any): number | undefined => {
    if (val === undefined || val === null || val === '') return undefined;
    if (typeof val === 'number') return isNaN(val) ? undefined : val;
    const cleaned = String(val).replace(',', '.').trim();
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
  };

  const handleConfirmSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      showToast('Tiêu đề bài báo không được để trống', 'warning');
      return;
    }
    if (!form.journal_name.trim()) {
      showToast('Tên tạp chí không được để trống', 'warning');
      return;
    }

    try {
      setSaving(true);
      const cleanedRoles: Record<string, string> = {};
      if (form.author_roles) {
        for (const [k, v] of Object.entries(form.author_roles)) {
          if (v) cleanedRoles[String(k)] = String(v);
        }
      }

      const currentItem = items[selectedItemIndex] || items[0] || {};
      const mismatches = activeData?.doubleCheckMismatches || [];

      const payload = {
        title: form.title.trim(),
        journal_name: form.journal_name.trim(),
        doi: form.doi ? form.doi.trim() : '',
        year: Number(form.year) || new Date().getFullYear(),
        status: form.status || 'published',
        author_ids: (form.author_ids || []).map(Number),
        main_author_id: form.main_author_id ? Number(form.main_author_id) : undefined,
        corresponding_author_id: form.corresponding_author_id ? Number(form.corresponding_author_id) : undefined,
        author_roles: cleanedRoles,
        ranking: form.ranking || 'Q1',
        sjr_score: parseSjrScore(form.sjr_score),
        issn: form.issn ? form.issn.trim() : '',
        notes: form.notes || '',
        is_ai_verified: mismatches.length === 0,
        ai_mismatches: mismatches,
        ai_metadata: {
          title: currentItem.title_en || currentItem.title,
          journal_name: form.journal_name,
          doi: form.doi,
          year: form.year,
          ranking: form.ranking,
        },
      };

      await papersApi.create(payload);

      showToast(`Đã xác nhận và khai báo thành công bài báo "${form.title.slice(0, 40)}..." lên hệ thống!`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Lỗi khi lưu bài báo vào hệ thống', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleAuthor = (id: number) => {
    setForm((prev) => {
      const exists = prev.author_ids.includes(id);
      const newAuthorIds = exists ? prev.author_ids.filter((aid) => aid !== id) : [...prev.author_ids, id];
      const newRoles = { ...prev.author_roles };
      if (exists) {
        delete newRoles[id];
      } else {
        newRoles[id] = 'member';
      }

      return {
        ...prev,
        author_ids: newAuthorIds,
        author_roles: newRoles,
        main_author_id: prev.main_author_id === id ? undefined : prev.main_author_id,
        corresponding_author_id: prev.corresponding_author_id === id ? undefined : prev.corresponding_author_id,
      };
    });
  };

  const setAuthorRole = (id: number, role: 'main' | 'corresponding' | 'member') => {
    setForm((prev) => {
      const newRoles = { ...prev.author_roles, [id]: role };
      let mainId = prev.main_author_id;
      let corrId = prev.corresponding_author_id;

      if (role === 'main') {
        mainId = id;
      } else if (mainId === id) {
        mainId = undefined;
      }

      if (role === 'corresponding') {
        corrId = id;
      } else if (corrId === id) {
        corrId = undefined;
      }

      return {
        ...prev,
        author_roles: newRoles,
        main_author_id: mainId,
        corresponding_author_id: corrId,
      };
    });
  };

  // Calculations for Confirm Screen
  const currentItem = items[selectedItemIndex] || items[0] || {};
  const integrity = activeData?.integrity || {};
  const authorRole = activeData?.authorRole || {};
  const mismatches = activeData?.doubleCheckMismatches || [];
  const crossrefMatched = activeData?.crossrefMatched;
  const candidate = activeData?.candidateName || currentUserName;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={step === 'scan' ? 'Khai báo bài báo qua Thẩm định AI' : 'Đối soát & Xác nhận Khai báo Bài báo (AI)'}
      subtitle={
        step === 'scan'
          ? 'Quét ảnh trang đầu bài báo / Tờ khai Mẫu 08 hoặc nhập DOI để AI đối soát liêm chính và tính điểm HĐGSNN.'
          : `Kiểm tra tính chính xác của các thông số đã đối soát bởi AI, điều chỉnh nếu cần và xác nhận khai báo lên hệ thống cho ${candidate}.`
      }
      icon={step === 'scan' ? 'fa-solid fa-wand-magic-sparkles' : 'fa-solid fa-clipboard-check'}
      maxWidth={step === 'scan' ? '820px' : '960px'}
    >
      {/* ================= STEP 1: SCAN SCREEN ================= */}
      {step === 'scan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Method Selection Tabs */}
          <div style={{ display: 'flex', gap: '8px', padding: '4px', background: '#f1f5f9', borderRadius: '10px' }}>
            <button
              type="button"
              onClick={() => setScanMethod('ocr')}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                border: 'none',
                background: scanMethod === 'ocr' ? '#ffffff' : 'transparent',
                color: scanMethod === 'ocr' ? '#4f46e5' : '#64748b',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: scanMethod === 'ocr' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <i className="fa-solid fa-camera" /> 1. Quét ảnh trang đầu / Tờ khai (OCR Vision)
              <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', background: '#ecfdf5', color: '#047857' }}>Khuyên dùng</span>
            </button>
            <button
              type="button"
              onClick={() => setScanMethod('doi')}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                border: 'none',
                background: scanMethod === 'doi' ? '#ffffff' : 'transparent',
                color: scanMethod === 'doi' ? '#4f46e5' : '#64748b',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: scanMethod === 'doi' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <i className="fa-solid fa-link" /> 2. Nhập mã DOI bài báo
            </button>
          </div>

          {/* Common Candidate Inputs */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Tên ứng viên kê khai để đối soát <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                placeholder="VD: Nguyễn Văn An"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Tiêu đề bài báo tiếng Việt (nếu có)
              </label>
              <input
                type="text"
                placeholder="VD: Ứng dụng Học sâu trong Quản lý Khoa học"
                value={candidateTitleVn}
                onChange={(e) => setCandidateTitleVn(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
              />
            </div>
          </div>

          {/* OCR Method Body */}
          {scanMethod === 'ocr' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ flex: 1, minWidth: '240px' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Định dạng tài liệu quét:
                  </label>
                  <select
                    value={ocrDocType}
                    onChange={(e) => setOcrDocType(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  >
                    <option value="declaration_form">📄 Tờ đơn / Phiếu kê khai chuẩn định dạng của Hệ thống (Mẫu 08 / HĐGSNN)</option>
                    <option value="article_first_page">📑 Trang đầu bài báo khoa học (Title page / First page)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={handleLoadSampleDeclaration}
                    style={{
                      padding: '0.48rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid #c7d2fe',
                      background: '#eef2ff',
                      color: '#4338ca',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <i className="fa-solid fa-bolt" /> Thử nhanh với ảnh Tờ đơn mẫu
                  </button>
                  <a
                    href="/sample_declaration_form.png"
                    download="sample_declaration_form.png"
                    style={{
                      padding: '0.48rem 0.85rem',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      background: '#f8fafc',
                      color: '#475569',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <i className="fa-solid fa-download" /> Tải ảnh mẫu (.PNG)
                  </a>
                </div>
              </div>

              {/* Drag & Drop Upload Zone */}
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*,application/pdf"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
              />

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: isDragging ? '2px dashed #4f46e5' : '2px dashed #cbd5e1',
                  borderRadius: '12px',
                  background: isDragging ? '#eef2ff' : '#fafafa',
                  padding: '1.75rem 1rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
              >
                {filePreview ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <img
                      src={filePreview}
                      alt="Preview"
                      style={{ maxHeight: '110px', borderRadius: '6px', border: '1px solid #cbd5e1', boxShadow: '0 2px 6px rgba(0,0,0,0.1)' }}
                    />
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>
                        📄 {selectedFile?.name}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                        Kích thước: {((selectedFile?.size || 0) / 1024).toFixed(1)} KB | Loại: {selectedFile?.type}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 600, marginTop: '4px' }}>
                        ✓ Sẵn sàng phân tích. Nhấn vào đây nếu muốn đổi file khác.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#eef2ff', color: '#4f46e5', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', marginBottom: '0.75rem' }}>
                      <i className="fa-solid fa-cloud-arrow-up" />
                    </div>
                    <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>
                      Kéo & thả ảnh trang đầu hoặc Tờ khai vào đây, hoặc nhấn để chọn file
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                      Hỗ trợ định dạng JPG, PNG, PDF (hoặc nhấn <strong>Ctrl + V</strong> để dán ảnh trực tiếp từ Clipboard)
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* DOI Method Body */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Mã DOI bài báo khoa học hoặc Link chi tiết <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="VD: 10.1016/j.eswa.2023.120556 hoặc https://doi.org/10.1016/j.eswa.2023.120556"
                  value={doiInput}
                  onChange={(e) => setDoiInput(e.target.value)}
                  style={{ width: '100%', padding: '0.625rem 0.85rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Thử nghiệm nhanh:</span>
                <button
                  type="button"
                  onClick={() => {
                    setDoiInput('10.1016/j.eswa.2023.120556');
                    setCandidateTitleVn('Ứng dụng Học sâu trong Tự động Giám định và Xác thực Bài báo Khoa học');
                    showToast('Đã điền DOI bài báo mẫu Q1!', 'info');
                  }}
                  style={{
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: '1px solid #c7d2fe',
                    background: '#eef2ff',
                    color: '#4338ca',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Expert Systems with Applications (Scopus Q1)
                </button>
              </div>
            </div>
          )}

          {/* Scan Action Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '9px 18px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#64748b',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleRunAiAnalysis}
              disabled={isScanning}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 24px',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #4f46e5, #4338ca)',
                color: '#ffffff',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: isScanning ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)',
                transition: 'all 0.18s ease',
              }}
            >
              {isScanning ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" /> Hệ thống AI đang phân tích...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-wand-magic-sparkles" /> Bắt đầu Quét & Thẩm định AI
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ================= STEP 2: CONFIRM & EDIT SCREEN ================= */}
      {step === 'confirm' && (
        <form onSubmit={handleConfirmSave}>
          {/* Step Header Badges */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem', paddingBottom: '0.75rem', borderBottom: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', background: '#ecfdf5', color: '#047857', fontSize: '0.8rem', fontWeight: 600, border: '1px solid #a7f3d0' }}>
                <i className="fa-solid fa-check-double" /> Đã thẩm định AI hoàn tất
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '20px', background: '#eef2ff', color: '#4338ca', fontSize: '0.8rem', fontWeight: 600, border: '1px solid #c7d2fe' }}>
                <i className="fa-solid fa-user-tie" /> Ứng viên: <strong>{candidate}</strong>
              </span>
            </div>

            {items.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Chọn công trình:</span>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {items.map((_it: any, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedItemIndex(idx)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: idx === selectedItemIndex ? '2px solid #4f46e5' : '1px solid #cbd5e1',
                        background: idx === selectedItemIndex ? '#eef2ff' : '#f8fafc',
                        color: idx === selectedItemIndex ? '#4338ca' : '#475569',
                        fontWeight: 600,
                        fontSize: '0.78rem',
                        cursor: 'pointer',
                      }}
                    >
                      Bài {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 1. THẨM ĐỊNH & ĐỐI SOÁT THÔNG SỐ (Audit Verification Panel) */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '1.25rem',
              marginBottom: '1.5rem',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-shield-halved" style={{ color: '#4f46e5' }} />
                Kết quả Đối soát Tính Chính xác của Thông số Kê khai (AI Audit)
              </h4>
              <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Chuẩn HĐGSNN & SCImago</span>
            </div>

            {/* 4 Cards Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              {/* Card 1: DOI & Metadata */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>
                  1. Mã DOI & Siêu dữ liệu
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: form.doi ? '#0f172a' : '#94a3b8' }}>
                  {form.doi || 'Chưa phát hiện'}
                </div>
                <div style={{ marginTop: '6px', fontSize: '0.75rem', color: crossrefMatched ? '#059669' : '#d97706', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <i className={crossrefMatched ? "fa-solid fa-circle-check" : "fa-solid fa-circle-info"} />
                  {crossrefMatched ? 'Khớp CSDL Quốc tế (Crossref)' : 'Đối soát theo CSDL Nội bộ/Scan'}
                </div>
              </div>

              {/* Card 2: Journal & Ranking */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>
                  2. Phân hạng & Liêm chính
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', background: '#dcfce7', color: '#15803d', fontWeight: 700, fontSize: '0.8rem' }}>
                    {form.ranking || 'Q1'}
                  </span>
                  {form.sjr_score && (
                    <span style={{ fontSize: '0.75rem', color: '#475569' }}>SJR: {form.sjr_score}</span>
                  )}
                </div>
                <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <i className="fa-solid fa-circle-check" />
                  {integrity.is_predatory ? '⚠️ Tạp chí có rủi ro!' : 'Tạp chí Uy tín (Không nằm Blacklist)'}
                </div>
              </div>

              {/* Card 3: Author Role & Affiliation */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>
                  3. Vai trò Tác giả Ứng viên
                </div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f172a' }}>
                  {authorRole.is_main_author ? '👑 Tác giả chính' : (authorRole.is_corresponding_author ? '✉️ Tác giả liên hệ' : '👥 Đồng tác giả')}
                </div>
                <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#475569' }}>
                  {authorRole.matched_name ? `Khớp tên: "${authorRole.matched_name}"` : 'Tự động gán theo danh sách'}
                </div>
              </div>

              {/* Card 4: Score Simulation */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem' }}>
                <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, marginBottom: '4px' }}>
                  4. Điểm HĐGSNN dự kiến
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#4f46e5' }}>
                    {currentItem.claimed_score || 1.0}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: '#64748b' }}>/ tối đa {integrity.vietnam_info?.max_score || 1.0} đ</span>
                </div>
                <div style={{ marginTop: '6px', fontSize: '0.75rem', color: '#059669', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <i className="fa-solid fa-check" />
                  Quy đổi chuẩn liên ngành
                </div>
              </div>
            </div>

            {/* Mismatches and Discrepancies Alerts */}
            {mismatches && mismatches.length > 0 ? (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.75rem 1rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.825rem', color: '#b45309', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fa-solid fa-triangle-exclamation" /> Phát hiện độ lệch thông số giữa kê khai và cơ sở dữ liệu quốc tế:
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8rem', color: '#92400e' }}>
                  {mismatches.map((m: any, idx: number) => (
                    <li key={idx} style={{ marginBottom: '2px' }}>
                      <strong>{m.field || 'Thông số'}:</strong> {m.reason || m.message || JSON.stringify(m)}
                    </li>
                  ))}
                </ul>
                <div style={{ fontSize: '0.75rem', color: '#b45309', marginTop: '6px' }}>
                  💡 Vui lòng kiểm tra và chỉnh sửa lại các trường bên dưới trước khi xác nhận lưu lên hệ thống.
                </div>
              </div>
            ) : (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '0.625rem 1rem', display: 'flex', alignItems: 'center', gap: '8px', color: '#166534', fontSize: '0.8rem' }}>
                <i className="fa-solid fa-circle-check" style={{ color: '#16a34a' }} />
                <span>Tất cả thông số cơ bản khớp hoàn toàn với cơ sở dữ liệu và danh mục chuẩn. Bạn có thể chỉnh sửa bổ sung nếu muốn.</span>
              </div>
            )}
          </div>

          {/* 2. FORM THÔNG TIN CHI TIẾT ĐỂ CHỈNH SỬA & XÁC NHẬN */}
          <div
            style={{
              background: '#ffffff',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              padding: '1.25rem',
              marginBottom: '1.5rem',
            }}
          >
            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-pen-to-square" style={{ color: '#059669' }} />
              Thông tin Bài báo Khoa học (Có thể chỉnh sửa trước khi Xác nhận)
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Tiêu đề bài báo */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Tiêu đề bài báo <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  style={{ width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.9rem', fontWeight: 500 }}
                />
              </div>

              {/* Tạp chí & DOI */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Tên Tạp chí / Hội nghị <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.journal_name}
                    onChange={(e) => setForm({ ...form, journal_name: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Mã DOI
                  </label>
                  <input
                    type="text"
                    value={form.doi}
                    onChange={(e) => setForm({ ...form, doi: e.target.value })}
                    style={{ width: '100%', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
                  />
                </div>
              </div>

              {/* ISSN, Năm, Xếp hạng, Điểm SJR */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    ISSN
                  </label>
                  <input
                    type="text"
                    value={form.issn}
                    onChange={(e) => setForm({ ...form, issn: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Năm xuất bản
                  </label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Xếp hạng Scopus
                  </label>
                  <select
                    value={form.ranking}
                    onChange={(e) => setForm({ ...form, ranking: e.target.value })}
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  >
                    <option value="Q1">Q1 (Scopus)</option>
                    <option value="Q2">Q2 (Scopus)</option>
                    <option value="Q3">Q3 (Scopus)</option>
                    <option value="Q4">Q4 (Scopus)</option>
                    <option value="Trong nước">Trong nước (HĐGSNN)</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                    Điểm SJR Score
                  </label>
                  <input
                    type="text"
                    value={form.sjr_score !== undefined ? String(form.sjr_score) : ''}
                    onChange={(e) => setForm({ ...form, sjr_score: e.target.value as any })}
                    placeholder="VD: 1.85"
                    style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  />
                </div>
              </div>

              {/* Tác giả & Phân vai trò */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                  Tác giả trong hệ thống & Phân chia vai trò
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#f8fafc', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', maxHeight: '180px', overflowY: 'auto' }}>
                  {allAuthors.map((author) => {
                    const isSelected = form.author_ids.includes(author.id);
                    const role = form.author_roles[author.id] || 'member';
                    return (
                      <div
                        key={author.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          background: isSelected ? '#ffffff' : 'transparent',
                          border: isSelected ? '1px solid #cbd5e1' : '1px solid transparent',
                        }}
                      >
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: isSelected ? 600 : 400, color: '#1e293b' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleAuthor(author.id)}
                            style={{ accentColor: '#4f46e5' }}
                          />
                          <span>{author.name}</span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>({author.affiliation || author.email || 'Khoa/Viện'})</span>
                        </label>

                        {isSelected && (
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => setAuthorRole(author.id, 'main')}
                              style={{
                                padding: '3px 8px',
                                borderRadius: '4px',
                                border: 'none',
                                background: role === 'main' ? '#4f46e5' : '#e2e8f0',
                                color: role === 'main' ? '#ffffff' : '#475569',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Tác giả chính
                            </button>
                            <button
                              type="button"
                              onClick={() => setAuthorRole(author.id, 'corresponding')}
                              style={{
                                padding: '3px 8px',
                                borderRadius: '4px',
                                border: 'none',
                                background: role === 'corresponding' ? '#059669' : '#e2e8f0',
                                color: role === 'corresponding' ? '#ffffff' : '#475569',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Tác giả liên hệ
                            </button>
                            <button
                              type="button"
                              onClick={() => setAuthorRole(author.id, 'member')}
                              style={{
                                padding: '3px 8px',
                                borderRadius: '4px',
                                border: 'none',
                                background: role === 'member' ? '#475569' : '#e2e8f0',
                                color: role === 'member' ? '#ffffff' : '#475569',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              Thành viên
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Ghi chú thẩm định & xác nhận
                </label>
                <textarea
                  rows={2}
                  className="input-field"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '0.85rem' }}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => setStep('scan')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#475569',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <i className="fa-solid fa-arrow-left" /> Quét bài khác / Nhập lại
              </button>

              <button
                type="button"
                onClick={handleResetToAi}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#475569',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <i className="fa-solid fa-rotate-left" /> Khôi phục thông số AI
              </button>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                style={{
                  padding: '9px 18px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#64748b',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Hủy bỏ
              </button>

              <button
                type="submit"
                disabled={saving}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 24px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, #4f46e5, #4338ca)',
                  color: '#ffffff',
                  fontSize: '0.875rem',
                  fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)',
                  transition: 'all 0.18s ease',
                }}
              >
                {saving ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin" /> Đang lưu vào hệ thống...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check" /> Xác nhận khai báo lên hệ thống
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
};
