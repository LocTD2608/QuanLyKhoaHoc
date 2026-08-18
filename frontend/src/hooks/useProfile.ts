import { useState, useEffect, useCallback } from 'react';
import { profileApi } from '../api';
import { ProfileData } from '../types';
import { showToast } from '../utils/toast';

export function useProfile() {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scholarId, setScholarId] = useState('');
  const [scholarSource, setScholarSource] = useState('auto');
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<null | { imported: number; skipped: number; imported_titles: string[] }>(null);

  const loadProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await profileApi.get();
      setData(res);
      if (res?.user?.author?.scholar_id) {
        setScholarId(res.user.author.scholar_id);
      }
    } catch (err: any) {
      showToast(err.message || 'Lỗi khi tải dữ liệu hồ sơ cá nhân', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSyncScholar = async () => {
    if (!scholarId.trim()) {
      showToast('Vui lòng nhập Google Scholar ID hoặc Tên tác giả', 'warning');
      return;
    }
    try {
      setSyncing(true);
      setSyncResult(null);
      const response: any = await profileApi.syncScholar(scholarId.trim(), scholarSource);
      if (response && response.import_summary) {
        setSyncResult(response.import_summary);
      }
      showToast('Đồng bộ dữ liệu Scholar thành công!', 'success');
      const updated = await profileApi.get();
      setData(updated);
    } catch (err: any) {
      showToast(err.message || 'Lỗi đồng bộ Scholar', 'error');
    } finally {
      setSyncing(false);
    }
  };

  return {
    data,
    loading,
    scholarId,
    setScholarId,
    scholarSource,
    setScholarSource,
    syncing,
    syncResult,
    handleSyncScholar,
    refresh: loadProfile,
  };
}
