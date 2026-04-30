import { Routes, Route, Link, useLocation } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import SetupPage from './pages/SetupPage';
import HistoryPage from './pages/HistoryPage';
import GuidePanel from './components/GuidePanel';
import ConnectionStatus from './components/ConnectionStatus';

export default function App() {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  return (
    <div style={{ minHeight: '100vh', background: '#141414' }}>
      <nav style={{
        padding: '16px 40px',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.7) 100%)',
        borderBottom: '1px solid #2a2a2a',
        display: 'flex',
        gap: '32px',
        alignItems: 'center',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(10px)',
      }}>
        <strong style={{
          marginRight: 'auto',
          fontSize: '24px',
          fontWeight: 700,
          color: '#ffffff',
          letterSpacing: '-0.5px',
        }}>
          CARDNEWS
        </strong>
        <Link
          to="/"
          style={{
            color: isActive('/') ? '#ffffff' : '#b3b3b3',
            fontSize: '14px',
            fontWeight: isActive('/') ? 600 : 400,
            transition: 'color 0.2s',
            textDecoration: 'none',
          }}
        >
          대시보드
        </Link>
        <Link
          to="/setup"
          style={{
            color: isActive('/setup') ? '#ffffff' : '#b3b3b3',
            fontSize: '14px',
            fontWeight: isActive('/setup') ? 600 : 400,
            transition: 'color 0.2s',
            textDecoration: 'none',
          }}
        >
          설정
        </Link>
        <Link
          to="/history"
          style={{
            color: isActive('/history') ? '#ffffff' : '#b3b3b3',
            fontSize: '14px',
            fontWeight: isActive('/history') ? 600 : 400,
            transition: 'color 0.2s',
            textDecoration: 'none',
          }}
        >
          히스토리
        </Link>
        <ConnectionStatus />
      </nav>
      <main style={{
        padding: '40px',
        maxWidth: '1400px',
        margin: '0 auto',
      }}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </main>
      <GuidePanel />
    </div>
  );
}
