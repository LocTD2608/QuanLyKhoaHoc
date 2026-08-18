import * as React from 'react';
import { Paper } from '../../../../types';
import { Modal } from '../../../common/Modal';
import { papersApi } from '../../../../api';
import { showToast } from '../../../../utils/toast';

interface DiscrepancyModalProps {
  isOpen: boolean;
  onClose: () => void;
  paper: Paper | null;
  onSuccess: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Tiêu đề',
  journal_name: 'Tạp chí / Hội nghị',
  issn: 'ISSN',
  year: 'Năm',
  ranking: 'Xếp hạng',
};

export const DiscrepancyModal: React.FC<DiscrepancyModalProps> = ({
  isOpen,
  onClose,
  paper,
  onSuccess,
}) => {
  if (!paper) return null;

  const mismatches = paper.ai_mismatches || [];
  const aiMeta = paper.ai_metadata || {};

  const handleApplyAiValue = async (field: string) => {
    try {
      const updateData: any = {};
      if (field === 'title') updateData.title = aiMeta.title;
      if (field === 'journal_name') updateData.journal_name = aiMeta.journal;
      if (field === 'issn') updateData.issn = aiMeta.issn?.[0] || '';
      if (field === 'year') updateData.year = aiMeta.year;
      if (field === 'ranking') updateData.ranking = aiMeta.ranking;

      await papersApi.update(paper.id, updateData);
      showToast(`Đã cập nhật trường "${FIELD_LABELS[field] || field}" theo dữ liệu AI`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi cập nhật dữ liệu', 'error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Đối soát sai lệch dữ liệu AI"
      subtitle={`Bài báo: ${paper.title}`}
      icon="fa-solid fa-triangle-exclamation"
      maxWidth="700px"
    >
      <div>
        <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
          Hệ thống AI phát hiện các trường thông tin do người dùng nhập có sự khác biệt so với kết quả trích xuất tự động từ siêu dữ liệu xuất bản chính thức.
        </p>

        <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Trường dữ liệu</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Dữ liệu hiện tại</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left' }}>Dữ liệu AI trích xuất</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {mismatches.map((field) => {
                const userVal = (paper as any)[field] || '—';
                const aiVal =
                  field === 'journal_name'
                    ? aiMeta.journal
                    : field === 'issn'
                    ? aiMeta.issn?.[0]
                    : aiMeta[field] || '—';

                return (
                  <tr key={field} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#334155' }}>
                      {FIELD_LABELS[field] || field}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#ef4444', background: '#fff5f5' }}>
                      {String(userVal)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', color: '#059669', background: '#f0fdf4', fontWeight: 500 }}>
                      {String(aiVal)}
                    </td>
                    <td style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>
                      <button
                        onClick={() => handleApplyAiValue(field)}
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
                        Áp dụng AI
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
          <button
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
            Đóng
          </button>
        </div>
      </div>
    </Modal>
  );
};
