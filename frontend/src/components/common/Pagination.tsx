import * as React from 'react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}) => {
  if (totalPages <= 1) return null;

  const start = (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.875rem 1.25rem',
        background: 'white',
        borderTop: '1px solid #e2e8f0',
        fontSize: '0.85rem',
        color: '#64748b',
      }}
    >
      <div>
        Hiển thị <strong style={{ color: '#1e293b' }}>{start}-{end}</strong> trên tổng số{' '}
        <strong style={{ color: '#1e293b' }}>{totalItems}</strong>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={{
            padding: '0.375rem 0.75rem',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            background: currentPage === 1 ? '#f8fafc' : 'white',
            color: currentPage === 1 ? '#cbd5e1' : '#475569',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            fontSize: '0.8rem',
            fontWeight: 500,
          }}
        >
          <i className="fa-solid fa-chevron-left" style={{ marginRight: '4px' }} /> Trước
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1)
          .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
          .map((page, idx, arr) => {
            const prev = arr[idx - 1];
            return (
              <React.Fragment key={page}>
                {prev && page - prev > 1 && <span style={{ padding: '0 4px', color: '#94a3b8' }}>...</span>}
                <button
                  onClick={() => onPageChange(page)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    border: page === currentPage ? 'none' : '1px solid #e2e8f0',
                    background: page === currentPage ? '#4f46e5' : 'white',
                    color: page === currentPage ? 'white' : '#475569',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: page === currentPage ? 700 : 500,
                  }}
                >
                  {page}
                </button>
              </React.Fragment>
            );
          })}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{
            padding: '0.375rem 0.75rem',
            borderRadius: '6px',
            border: '1px solid #e2e8f0',
            background: currentPage === totalPages ? '#f8fafc' : 'white',
            color: currentPage === totalPages ? '#cbd5e1' : '#475569',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            fontSize: '0.8rem',
            fontWeight: 500,
          }}
        >
          Sau <i className="fa-solid fa-chevron-right" style={{ marginLeft: '4px' }} />
        </button>
      </div>
    </div>
  );
};
