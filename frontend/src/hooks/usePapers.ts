import { useState, useEffect, useCallback, useMemo } from 'react';
import { papersApi, authorsApi } from '../api';
import { Paper, Author } from '../types';
import { showToast } from '../utils/toast';

export function usePapers() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [papersData, authorsData] = await Promise.all([
        papersApi.list(),
        authorsApi.list(),
      ]);
      setPapers(papersData || []);
      setAuthors(authorsData || []);
    } catch (err: any) {
      showToast(err.message || 'Không thể tải dữ liệu bài báo', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredPapers = useMemo(() => {
    return papers.filter((p) => {
      const matchSearch =
        !search ||
        p.title.toLowerCase().includes(search.toLowerCase()) ||
        p.journal_name.toLowerCase().includes(search.toLowerCase()) ||
        (p.doi && p.doi.toLowerCase().includes(search.toLowerCase())) ||
        (p.authors && p.authors.some((a) => a.name.toLowerCase().includes(search.toLowerCase())));
      const matchStatus = !filterStatus || p.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [papers, search, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredPapers.length / PAGE_SIZE));
  const paginatedPapers = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredPapers.slice(start, start + PAGE_SIZE);
  }, [filteredPapers, currentPage, PAGE_SIZE]);

  const deletePaper = async (id: number) => {
    if (!window.confirm('Bạn có chắc muốn xóa bài báo này?')) return;
    try {
      await papersApi.delete(id);
      showToast('Đã xóa bài báo thành công', 'success');
      loadData();
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi xóa bài báo', 'error');
    }
  };

  return {
    papers,
    authors,
    loading,
    search,
    setSearch,
    filterStatus,
    setFilterStatus,
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems: filteredPapers.length,
    pageSize: PAGE_SIZE,
    paginatedPapers,
    refresh: loadData,
    deletePaper,
  };
}
