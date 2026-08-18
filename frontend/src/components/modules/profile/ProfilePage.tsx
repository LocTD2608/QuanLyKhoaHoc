import { useProfile } from '../../../hooks/useProfile';
import { ProfileHeader } from './ProfileHeader';
import { ScholarSyncCard } from './ScholarSyncCard';
import { ScoreSummaryCards } from './ScoreSummaryCards';
import { EligibilityChecklist } from './EligibilityChecklist';
import { ProfilePapersTable } from './ProfilePapersTable';

export default function ProfilePage() {
  const {
    data,
    loading,
    scholarId,
    setScholarId,
    scholarSource,
    setScholarSource,
    syncing,
    syncResult,
    handleSyncScholar,
  } = useProfile();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem', color: '#4f46e5', fontSize: '1.1rem', fontWeight: 600 }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '8px' }} />
        Đang tải hồ sơ khoa học...
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%', maxWidth: '1300px', margin: '0 auto' }}>
      {/* 1. Header with Author Info */}
      <ProfileHeader user={data.user} />

      {/* 2. Scholar Integration */}
      <ScholarSyncCard
        author={data.user?.author}
        scholarId={scholarId}
        onScholarIdChange={setScholarId}
        scholarSource={scholarSource}
        onSourceChange={setScholarSource}
        syncing={syncing}
        onSync={handleSyncScholar}
        syncResult={syncResult}
      />

      {/* 3. Points & Metrics Summary */}
      <ScoreSummaryCards totals={data.totals} />

      {/* 4. Eligibility Checklists (PGS / GS) */}
      <EligibilityChecklist pgs={data.pgs} gs={data.gs} />

      {/* 5. Papers Table */}
      <ProfilePapersTable papers={data.papers || []} />
    </div>
  );
}
