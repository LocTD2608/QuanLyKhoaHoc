import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePapers } from '../../../hooks/usePapers';
import { useAuth } from '../../../utils/AuthContext';
import { Paper } from '../../../types';
import { PaperFilterBar } from './PaperFilterBar';
import { PaperTable } from './PaperTable';
import { PaperFormModal } from './modals/PaperFormModal';
import { ScholarImportModal } from './modals/ScholarImportModal';
import { DiscrepancyModal } from './modals/DiscrepancyModal';
import { AiDeclarationConfirmModal } from './modals/AiDeclarationConfirmModal';
import { Pagination } from '../../common/Pagination';

export default function PapersPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const {
    authors,
    loading,
    search,
    setSearch,
    filterStatus,
    setFilterStatus,
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems,
    pageSize,
    paginatedPapers,
    refresh,
    deletePaper,
  } = usePapers();

  // Modals state
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingPaper, setEditingPaper] = useState<Paper | null>(null);
  const [showScholarModal, setShowScholarModal] = useState(false);
  const [discrepancyPaper, setDiscrepancyPaper] = useState<Paper | null>(null);

  // Declaration from AI / OCR
  const [declarationData, setDeclarationData] = useState<any>(null);
  const [showDeclarationModal, setShowDeclarationModal] = useState(false);

  useEffect(() => {
    if (location.state?.pendingDeclaration) {
      setDeclarationData(location.state.pendingDeclaration);
      setShowDeclarationModal(true);
    } else if (location.state?.openAiDeclaration) {
      setDeclarationData(null);
      setShowDeclarationModal(true);
      navigate('/papers', { replace: true, state: {} });
    }
  }, [location.state]);

  const handleDeclarationSuccess = () => {
    refresh();
    setShowDeclarationModal(false);
    setDeclarationData(null);
    navigate('/papers', { replace: true, state: {} });
  };

  const handleEdit = (paper: Paper) => {
    setEditingPaper(paper);
    setShowFormModal(true);
  };

  const handleAdd = () => {
    setEditingPaper(null);
    setShowFormModal(true);
  };

  const candidateName = user?.author?.name || user?.username || 'Tác giả';

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      {/* Pending Declaration Banner if dismissed but still pending */}
      {declarationData && !showDeclarationModal && (
        <div style={{
          background: 'linear-gradient(135deg, #eef2ff, #f0fdf4)',
          border: '1px solid #c7d2fe',
          borderRadius: '12px',
          padding: '0.875rem 1.25rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#4f46e5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className="fa-solid fa-wand-magic-sparkles" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1e293b' }}>
                Hồ sơ bài báo vừa thẩm định từ AI Vision sẵn sàng đối soát & khai báo
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Tiêu đề: {declarationData.paper?.title || declarationData.candidateTitleVn || 'Bài báo khoa học'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowDeclarationModal(true)}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: '#4f46e5',
              color: 'white',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(79, 70, 229, 0.25)',
            }}
          >
            <i className="fa-solid fa-clipboard-check" /> Mở đối soát & xác nhận
          </button>
        </div>
      )}

      {/* Filter and Action Bar */}
      <PaperFilterBar
        search={search}
        onSearchChange={setSearch}
        filterStatus={filterStatus}
        onStatusChange={setFilterStatus}
        totalCount={totalItems}
        onOpenAddModal={handleAdd}
        onOpenScholarModal={() => setShowScholarModal(true)}
        onOpenAiDeclaration={() => {
          setDeclarationData(null);
          setShowDeclarationModal(true);
        }}
      />

      {/* Main Papers Table */}
      <PaperTable
        papers={paginatedPapers}
        loading={loading}
        onEdit={handleEdit}
        onDelete={deletePaper}
        onShowDiscrepancy={(paper) => setDiscrepancyPaper(paper)}
      />

      {/* Pagination */}
      {!loading && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Add / Edit Modal */}
      <PaperFormModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        editingPaper={editingPaper}
        allAuthors={authors}
        currentUserName={candidateName}
        onSuccess={refresh}
        onSwitchToAi={() => {
          setDeclarationData(null);
          setShowDeclarationModal(true);
        }}
      />

      {/* Scholar Import Modal */}
      <ScholarImportModal
        isOpen={showScholarModal}
        onClose={() => setShowScholarModal(false)}
        onSuccess={refresh}
      />

      {/* Discrepancy Inspection Modal */}
      <DiscrepancyModal
        isOpen={!!discrepancyPaper}
        onClose={() => setDiscrepancyPaper(null)}
        paper={discrepancyPaper}
        onSuccess={refresh}
      />

      {/* AI Declaration Confirm Modal from OCR / AI Validation */}
      <AiDeclarationConfirmModal
        isOpen={showDeclarationModal}
        onClose={() => {
          setShowDeclarationModal(false);
        }}
        declarationData={declarationData}
        allAuthors={authors}
        currentUserName={candidateName}
        onSuccess={handleDeclarationSuccess}
      />
    </div>
  );
}
