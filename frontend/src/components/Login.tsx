import * as React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { setError('Vui lòng điền đầy đủ thông tin'); return; }
    setLoading(true); setError('');
    try {
      await login(username, password);
      navigate('/dashboard', { replace: true });
    } catch {
      setError('Sai tên đăng nhập hoặc mật khẩu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: 'Inter, sans-serif'
    }}>
      <div style={{
        background: 'white', borderRadius: '16px', padding: '2.5rem',
        width: '100%', maxWidth: '400px', boxShadow: '0 25px 50px rgba(0,0,0,0.15)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1rem', boxShadow: '0 8px 20px rgba(99,102,241,0.35)'
          }}>
            <i className="fa-solid fa-book-bookmark" style={{ color: 'white', fontSize: '1.4rem' }} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1e293b', fontFamily: "'Plus Jakarta Sans', sans-serif", margin: 0 }}>
            Research Manager
          </h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            Hệ thống Quản lý Khoa học AI
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>
              Tên đăng nhập
            </label>
            <input
              type="text" value={username} onChange={e => setUsername(e.target.value)}
              placeholder="admin"
              style={{
                width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #d1d5db',
                borderRadius: '8px', fontSize: '0.9rem', outline: 'none',
                boxSizing: 'border-box', transition: 'border-color 0.2s',
              }}
              onFocus={e => (e.target.style.borderColor = '#6366f1')}
              onBlur={e => (e.target.style.borderColor = '#d1d5db')}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.375rem' }}>
              Mật khẩu
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: '100%', padding: '0.625rem 0.875rem', border: '1px solid #d1d5db',
                borderRadius: '8px', fontSize: '0.9rem', outline: 'none',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.target.style.borderColor = '#6366f1')}
              onBlur={e => (e.target.style.borderColor = '#d1d5db')}
            />
          </div>

          {error && (
            <div style={{
              padding: '0.625rem 0.875rem', background: '#fef2f2',
              border: '1px solid #fecaca', borderRadius: '8px',
              color: '#dc2626', fontSize: '0.875rem'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              padding: '0.75rem', background: loading ? '#a5b4fc' : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              color: 'white', border: 'none', borderRadius: '8px', fontSize: '0.9rem',
              fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', marginTop: '0.5rem',
              boxShadow: loading ? 'none' : '0 4px 12px rgba(99,102,241,0.35)'
            }}
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '0.78rem', color: '#9ca3af', marginTop: '1.5rem' }}>
          Demo: <strong>admin</strong> / <strong>admin</strong>
        </p>
      </div>
    </div>
  );
};

export default Login;
