import * as React from 'react';
import { useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './utils/AuthContext';
import { showToast } from './utils/toast';

import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import ChatWidget from './components/ChatWidget';

// Code-splitting via React.lazy for optimized bundle delivery
const Login = lazy(() => import('./components/Login'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const Papers = lazy(() => import('./components/modules/papers/PapersPage'));
const Authors = lazy(() => import('./components/Authors'));
const Venues = lazy(() => import('./components/Venues'));
const Teams = lazy(() => import('./components/Teams'));
const JournalCatalog = lazy(() => import('./components/JournalCatalog'));
const Profile = lazy(() => import('./components/modules/profile/ProfilePage'));
const Simulator = lazy(() => import('./components/Simulator'));
const UsefulInfo = lazy(() => import('./components/modules/useful-info/UsefulInfoPage'));

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Tổng quan',
  '/papers': 'Bài báo',
  '/teams': 'Nhóm & KPI',
  '/authors': 'Thành viên',
  '/venues': 'Tạp chí / Hội nghị',
  '/journal-catalog': 'Danh mục HĐGSNN',
  '/profile': 'Hồ sơ của tôi',
  '/simulator': 'Mô phỏng PGS/GS',
  '/info': 'Thông tin hữu ích',
};

const LoadingFallback = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px', color: '#6366f1' }}>
    <div style={{ width: '32px', height: '32px', border: '3px solid #e0e7ff', borderTopColor: '#4f46e5', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
  </div>
);

function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const path = location.pathname;
  const title = Object.entries(PAGE_TITLES).find(([k]) => path.startsWith(k))?.[1] ?? '';

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
    showToast('Đã đăng xuất', 'info');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f8fafc' }}>
      {/* Sidebar */}
      <Sidebar user={user} onLogout={handleLogout} />

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <Header title={title} user={user} />

        {/* Page Content with Lazy Loading Suspense */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/papers" element={<Papers />} />
              <Route path="/teams" element={<Teams />} />
              <Route path="/authors" element={<Authors />} />
              <Route path="/venues" element={<Venues />} />
              <Route path="/journal-catalog" element={<JournalCatalog />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/simulator" element={<Simulator setLoading={setLoading} />} />
              <Route path="/validation" element={<Navigate to="/papers" replace state={{ openAiDeclaration: true }} />} />
              <Route path="/info" element={<UsefulInfo />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </main>
      </div>

      {/* Global Processing Overlay */}
      {loading && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9998, gap: '1rem' }}>
          <div style={{ width: '48px', height: '48px', border: '4px solid rgba(255,255,255,0.2)', borderTopColor: '#a5b4fc', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p style={{ color: 'white', fontSize: '0.9rem' }}>Hệ thống AI đang phân tích...</p>
        </div>
      )}

      {/* AI Chat Widget */}
      <div style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999 }}>
        <button
          onClick={() => setIsChatOpen((o) => !o)}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: isChatOpen ? '#ef4444' : '#6366f1',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
            transition: 'all 0.3s',
          }}
        >
          <i className={`fas ${isChatOpen ? 'fa-times' : 'fa-robot'}`} style={{ fontSize: '1.375rem' }} />
        </button>
        <ChatWidget isOpen={isChatOpen} />
      </div>

      {/* Toast Container */}
      <div id="toast-container" className="toast-container" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ProtectedApp() {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
        <div style={{ width: '32px', height: '32px', border: '3px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/*" element={user ? <AppLayout /> : <Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}

const App: React.FC = () => (
  <BrowserRouter>
    <AuthProvider>
      <ProtectedApp />
    </AuthProvider>
  </BrowserRouter>
);

export default App;
