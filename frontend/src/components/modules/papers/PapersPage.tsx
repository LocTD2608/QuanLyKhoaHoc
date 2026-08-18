import { useState } from 'react';
import { usePapers } from '../../../hooks/usePapers';
import { useAuth } from '../../../utils/AuthContext';
import { Paper } from '../../../types';
import { PaperFilterBar } from './PaperFilterBar';
import { PaperTable } from './PaperTable';
import { PaperFormModal } from './modals/PaperFormModal';
import { ScholarImportModal } from './modals/ScholarImportModal';
import { DiscrepancyModal } from './modals/DiscrepancyModal';
import { Pagination } from '../../common/Pagination';

export default function PapersPage() {
  const { user } = useAuth();
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
      {/* Filter and Action Bar */}
      <PaperFilterBar
        search={search}
        onSearchChange={setSearch}
        filterStatus={filterStatus}
        onStatusChange={setFilterStatus}
        totalCount={totalItems}
        onOpenAddModal={handleAdd}
        onOpenScholarModal={() => setShowScholarModal(true)}
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
    </div>
  );
}
