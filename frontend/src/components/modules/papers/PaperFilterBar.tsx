import * as React from 'react';

interface PaperFilterBarProps {
  search: string;
  onSearchChange: (val: string) => void;
  filterStatus: string;
  onStatusChange: (val: string) => void;
  totalCount: number;
  onOpenAddModal: () => void;
  onOpenScholarModal: () => void;
}

export const PaperFilterBar: React.FC<PaperFilterBarProps> = ({
  search,
  onSearchChange,
  filterStatus,
  onStatusChange,
  totalCount,
  onOpenAddModal,
  onOpenScholarModal,
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
        <div className="search-filter-right">
          <button
            type="button"
            onClick={onOpenScholarModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              height: '40px',
              padding: '0 1rem',
              borderRadius: '9px',
              border: '1px solid #c7d2fe',
              background: '#eef2ff',
              color: '#4338ca',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.18s ease',
            }}
          >
            <i className="fa-brands fa-google" style={{ color: '#4f46e5' }} /> Đồng bộ Scholar
          </button>

          <button
            type="button"
            onClick={onOpenAddModal}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              height: '40px',
              padding: '0 1.125rem',
              borderRadius: '9px',
              border: 'none',
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              color: 'white',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
              transition: 'all 0.18s ease',
            }}
          >
            <i className="fa-solid fa-plus" /> Thêm bài báo
          </button>
        </div>
      </div>
    </div>
  );
};
