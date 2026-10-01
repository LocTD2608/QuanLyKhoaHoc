import * as React from 'react';
import { useState, useEffect } from 'react';
import { Paper, Author, PaperFormData } from '../../../../types';
import { Modal } from '../../../common/Modal';
import { papersApi, validateArticle, ocrApi } from '../../../../api';
import { showToast } from '../../../../utils/toast';

interface PaperFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingPaper: Paper | null;
  allAuthors: Author[];
  currentUserName: string;
  onSuccess: () => void;
  onSwitchToAi?: () => void;
}

const emptyForm: PaperFormData = {
  title: '',
  journal_name: '',
  doi: '',
  year: new Date().getFullYear(),
  status: 'published',
  author_ids: [],
  main_author_id: undefined,
  corresponding_author_id: undefined,
  author_roles: {},
  ranking: '',
  sjr_score: undefined,
  issn: '',
  notes: '',
};

export const PaperFormModal: React.FC<PaperFormModalProps> = ({
  isOpen,
  onClose,
  editingPaper,
  allAuthors,
  currentUserName,
  onSuccess,
  onSwitchToAi,
}) => {
  const [form, setForm] = useState<PaperFormData>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [ocrScanning, setOcrScanning] = useState(false);
  const [aiDoi, setAiDoi] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingPaper) {
      setForm({
        title: editingPaper.title || '',
        journal_name: editingPaper.journal_name || '',
        doi: editingPaper.doi || '',
        year: editingPaper.year || new Date().getFullYear(),
        status: editingPaper.status || 'published',
        author_ids: editingPaper.author_ids || [],
        main_author_id: editingPaper.main_author_id,
        corresponding_author_id: editingPaper.corresponding_author_id,
        author_roles: (editingPaper as any).author_roles || {},
        ranking: editingPaper.ranking || '',
        sjr_score: editingPaper.sjr_score,
        issn: editingPaper.issn || '',
        notes: editingPaper.notes || '',
      });
      setAiDoi(editingPaper.doi || '');
    } else {
      setForm({ ...emptyForm });
      setAiDoi('');
    }
  }, [editingPaper, isOpen]);

  const handleOcrFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setOcrScanning(true);
      const res: any = await ocrApi.extractPage(file, 'article_first_page');
      if (!res) throw new Error('Không nhận được phản hồi từ Vision AI');

      setForm((prev) => {
        const updated = { ...prev };
        if (res.title_en || res.title_vn) {
          updated.title = res.title_en || res.title_vn;
        }
        if (res.journal_name) {
          updated.journal_name = res.journal_name;
        }
        if (res.doi) {
          updated.doi = res.doi;
          setAiDoi(res.doi);
        }
        if (res.year) {
          updated.year = res.year;
        }
        if (res.issn) {
          updated.issn = res.issn;
        }

        // Tự động đối soát tác giả nếu có
        if (res.authors && Array.isArray(res.authors) && allAuthors.length > 0) {
          const matchedIds: number[] = [...prev.author_ids];
          const newRoles = { ...prev.author_roles };
          let mainId = prev.main_author_id;
          let corrId = prev.corresponding_author_id;

          for (const ocrAuth of res.authors) {
            const authName = (ocrAuth.name || '').toLowerCase().trim();
            const found = allAuthors.find((a) => {
              const n = a.name.toLowerCase().trim();
              return n === authName || n.includes(authName) || authName.includes(n);
            });
            if (found) {
              if (!matchedIds.includes(found.id)) {
                matchedIds.push(found.id);
              }
              if (ocrAuth.is_first_author) {
                mainId = found.id;
                newRoles[found.id] = 'main';
              } else if (ocrAuth.is_corresponding) {
                corrId = found.id;
                newRoles[found.id] = 'corresponding';
              } else if (!newRoles[found.id]) {
                newRoles[found.id] = 'member';
              }
            }
          }
          updated.author_ids = matchedIds;
          updated.author_roles = newRoles;
          if (mainId) updated.main_author_id = mainId;
          if (corrId) updated.corresponding_author_id = corrId;
        }

        return updated;
      });

      showToast('Đã quét và tự động điền dữ liệu bài báo từ hình ảnh!', 'success');
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Lỗi khi quét ảnh bài báo', 'error');
    } finally {
      setOcrScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAiAutofill = async () => {
    const doiToQuery = aiDoi.trim() || form.doi.trim();
    if (!doiToQuery) {
      showToast('Vui lòng nhập mã DOI hoặc URL bài báo', 'warning');
      return;
    }

    try {
      setAutofilling(true);
      const res: any = await validateArticle(doiToQuery, '', currentUserName, '');
      if (!res) throw new Error('Không nhận được phản hồi từ AI');

      const meta = res.metadata || {};
      setForm((prev) => ({
        ...prev,
        title: meta.title || prev.title,
        journal_name: meta.journal || prev.journal_name,
        doi: meta.doi || doiToQuery,
        year: meta.year || prev.year,
        issn: (meta.issn && meta.issn[0]) || prev.issn,
        ranking: res.journal_evaluation?.ranking?.quartile || prev.ranking,
        sjr_score: res.journal_evaluation?.ranking?.sjr_score || prev.sjr_score,
      }));

      showToast('Đã trích xuất siêu dữ liệu và kiểm định AI thành công!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi trích xuất AI', 'error');
    } finally {
      setAutofilling(false);
    }
  };


  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      showToast('Tiêu đề bài báo không được để trống', 'warning');
      return;
    }

    try {
      setSaving(true);
      if (editingPaper) {
        await papersApi.update(editingPaper.id, form);
        showToast('Cập nhật bài báo thành công', 'success');
      } else {
        await papersApi.create(form);
        showToast('Thêm bài báo mới thành công', 'success');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi lưu bài báo', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleAuthor = (id: number) => {
    setForm((prev) => {
      const exists = prev.author_ids.includes(id);
      const newAuthorIds = exists ? prev.author_ids.filter((aid) => aid !== id) : [...prev.author_ids, id];
      const newRoles = { ...prev.author_roles };
      if (exists) delete newRoles[id];
      else newRoles[id] = 'member';

      return {
        ...prev,
        author_ids: newAuthorIds,
        author_roles: newRoles,
        main_author_id: prev.main_author_id === id ? undefined : prev.main_author_id,
      };
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editingPaper ? 'Chỉnh sửa bài báo' : 'Thêm bài báo khoa học mới'}
      subtitle="Nhập thông tin hoặc trích xuất tự động qua DOI/URL"
      icon={editingPaper ? 'fa-solid fa-pen' : 'fa-solid fa-file-circle-plus'}
      maxWidth="720px"
    >
      <form onSubmit={handleSave}>
        {!editingPaper && onSwitchToAi && (
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '0.625rem 0.875rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ fontSize: '0.825rem', color: '#334155' }}>
              💡 Có ảnh bài báo hoặc mã DOI? Hãy sử dụng <strong>Khai báo & Thẩm định AI</strong> để tự động kiểm tra liêm chính và tính điểm HĐGSNN.
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onSwitchToAi();
              }}
              style={{
                padding: '4px 12px',
                borderRadius: '6px',
                border: 'none',
                background: '#4f46e5',
                color: 'white',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              Chuyển sang Khai báo AI
            </button>
          </div>
        )}

        {/* AI & Vision Autofill Bar */}
        <div
          style={{
            background: 'linear-gradient(135deg, #eef2ff, #f0fdf4)',
            border: '1px solid #c7d2fe',
            borderRadius: '10px',
            padding: '0.875rem 1rem',
            marginBottom: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <i className="fa-solid fa-wand-magic-sparkles" style={{ color: '#6366f1' }} />
              Tự động trích xuất thông tin bài báo
            </span>

            {/* Hidden file input for OCR */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,application/pdf"
              style={{ display: 'none' }}
              onChange={handleOcrFileSelect}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={ocrScanning}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: '6px',
                border: '1px solid #059669',
                background: '#ecfdf5',
                color: '#047857',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: ocrScanning ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {ocrScanning ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-camera" />}
              📸 Quét từ ảnh trang đầu (Vision OCR)
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Hoặc nhập mã DOI (vd: 10.1016/j.neucom.2023.126584)"
              value={aiDoi}
              onChange={(e) => setAiDoi(e.target.value)}
              style={{
                flex: 1,
                padding: '0.45rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid #c7d2fe',
                fontSize: '0.825rem',
                background: 'white',
              }}
            />
            <button
              type="button"
              onClick={handleAiAutofill}
              disabled={autofilling}
              style={{
                padding: '0.45rem 0.875rem',
                borderRadius: '6px',
                border: 'none',
                background: '#4f46e5',
                color: 'white',
                fontSize: '0.825rem',
                fontWeight: 600,
                cursor: autofilling ? 'not-allowed' : 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {autofilling ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-bolt" />}
              Điền từ DOI
            </button>
          </div>
        </div>


        {/* Form Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
              Tiêu đề bài báo <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              id="paper-title-input"
              name="title"
              placeholder="Nhập tiêu đề bài báo..."
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.875rem' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                Tạp chí / Hội nghị
              </label>
              <input
                type="text"
                value={form.journal_name}
                onChange={(e) => setForm({ ...form, journal_name: e.target.value })}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.875rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                DOI
              </label>
              <input
                type="text"
                value={form.doi}
                onChange={(e) => setForm({ ...form, doi: e.target.value })}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.875rem' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Năm</label>
              <input
                type="number"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || new Date().getFullYear() })}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.875rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>ISSN</label>
              <input
                type="text"
                value={form.issn}
                onChange={(e) => setForm({ ...form, issn: e.target.value })}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.875rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Xếp hạng</label>
              <input
                type="text"
                placeholder="Q1, Q2, A*..."
                value={form.ranking}
                onChange={(e) => setForm({ ...form, ranking: e.target.value })}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.875rem' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>Trạng thái</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.875rem', background: 'white' }}
              >
                <option value="published">Đã xuất bản</option>
                <option value="in_review">Đang review</option>
                <option value="draft">Bản nháp</option>
                <option value="rejected">Bị từ chối</option>
              </select>
            </div>
          </div>

          {/* Authors Assignment */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              Thành viên tác giả trong hệ thống
            </label>
            <div style={{ maxHeight: '140px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.5rem' }}>
              {allAuthors.map((a) => {
                const isSelected = form.author_ids.includes(a.id);
                const isMain = form.main_author_id === a.id;
                return (
                  <div
                    key={a.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 8px',
                      borderRadius: '6px',
                      background: isSelected ? '#f8fafc' : 'transparent',
                      marginBottom: '2px',
                    }}
                  >
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleAuthor(a.id)}
                      />
                      {a.name} {a.academic_field ? `(${a.academic_field})` : ''}
                    </label>
                    {isSelected && (
                      <button
                        type="button"
                        onClick={() => setForm({ ...form, main_author_id: isMain ? undefined : a.id })}
                        style={{
                          fontSize: '0.72rem',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          border: isMain ? '1px solid #10b981' : '1px solid #e2e8f0',
                          background: isMain ? '#ecfdf5' : 'white',
                          color: isMain ? '#059669' : '#64748b',
                          cursor: 'pointer',
                          fontWeight: isMain ? 700 : 500,
                        }}
                      >
                        {isMain ? '★ Tác giả chính' : 'Đặt làm tác giả chính'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: 'white',
              color: '#475569',
              fontSize: '0.85rem',
              cursor: 'pointer',
            }}
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '8px',
              border: 'none',
              background: '#4f46e5',
              color: 'white',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Đang lưu...' : editingPaper ? 'Cập nhật' : 'Thêm bài báo'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
