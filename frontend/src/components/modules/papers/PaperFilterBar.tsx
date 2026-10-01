import * as React from 'react';

interface PaperFilterBarProps {
  search: string;
  onSearchChange: (val: string) => void;
  filterStatus: string;
  onStatusChange: (val: string) => void;
  totalCount: number;
  onOpenAddModal: () => void;
  onOpenScholarModal: () => void;
  onOpenAiDeclaration?: () => void;
}

export const PaperFilterBar: React.FC<PaperFilterBarProps> = ({
  search,
  onSearchChange,
  filterStatus,
  onStatusChange,
  totalCount,
  onOpenAddModal,
  onOpenScholarModal,
  onOpenAiDeclaration,
}) => {
  return (
    <div className="search-filter-card" style={{ marginBottom: '1.25rem' }}>
      <div className="search-filter-row">
        {/* Left Side: Search Box + Status Filter + Result Count */}
        <div className="search-filter-left">
          <div className="unified-search-box">
            <i className="fa-solid fa-magnifying-glass search-icon" />
            <input
              type="text"
              className="unified-search-input"
              placeholder="Tìm theo tên bài báo, DOI, tác giả, tạp chí..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
            />
            {search && (
              <button
                type="button"
                className="unified-search-clear"
                onClick={() => onSearchChange('')}
                title="Xóa tìm kiếm"
              >
                <i className="fa-solid fa-xmark" />
              </button>
            )}
          </div>

          <select
            className="unified-select"
            value={filterStatus}
            onChange={(e) => onStatusChange(e.target.value)}
            title="Lọc theo trạng thái xuất bản"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="published">Đã xuất bản</option>
            <option value="in_review">Đang phản biện</option>
            <option value="draft">Bản nháp</option>
            <option value="rejected">Bị từ chối</option>
          </select>

          <div className="filter-count-badge">
            <i className="fa-solid fa-file-lines" style={{ marginRight: '5px', color: '#6366f1' }} />
            {totalCount} bài báo
          </div>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="search-filter-right" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onOpenScholarModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              height: '38px',
              padding: '0 0.875rem',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              color: '#475569',
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.18s ease',
            }}
            title="Đồng bộ danh sách bài báo từ Google Scholar"
          >
            <i className="fa-brands fa-google" style={{ color: '#4f46e5' }} /> Scholar
          </button>

          <button
            type="button"
            onClick={onOpenAddModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              height: '38px',
              padding: '0 0.875rem',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: 'white',
              color: '#334155',
              fontSize: '0.825rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.18s ease',
            }}
            title="Nhập thông tin bài báo thủ công theo mẫu"
          >
            <i className="fa-solid fa-plus" /> Thêm thủ công
          </button>

          {onOpenAiDeclaration && (
            <button
              type="button"
              onClick={onOpenAiDeclaration}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                height: '38px',
                padding: '0 1.125rem',
                borderRadius: '8px',
                border: 'none',
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: 'white',
                fontSize: '0.825rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.3)',
                transition: 'all 0.18s ease',
              }}
              title="Quét ảnh trang đầu / Tờ khai Mẫu 08 hoặc nhập DOI để AI tự động thẩm định và tính điểm HĐGSNN"
            >
              <i className="fa-solid fa-wand-magic-sparkles" /> Khai báo & Thẩm định AI
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
