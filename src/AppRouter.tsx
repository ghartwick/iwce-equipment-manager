import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './components/LoginPage';
import InventoryPage from './pages/InventoryPage';
import TimecardPage from './pages/TimecardPage';
import TimecardEditPage from './pages/TimecardEditPage';
import Layout from './components/Layout';
import { ThemeProvider } from './context/ThemeContext';

function AppRouter() {
  const { isAuthenticated, isLoading, login, error: authError } = useAuth();

  const handleLogin = async (username: string, password: string) => {
    try {
      await login(username, password);
    } catch (error) {
      // Error is handled in useAuth hook
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 dark:border-yellow-400 mx-auto mb-4"></div>
          <div className="text-lg text-yellow-600 dark:text-yellow-400">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
    <Router>
      <Routes>
        <Route path="/login" element={!isAuthenticated ? <LoginPage onLogin={handleLogin} error={authError || undefined} /> : <Navigate to="/inventory" replace />} />
        <Route path="/" element={<Navigate to="/inventory" replace />} />
        <Route path="/inventory" element={
          isAuthenticated ? (
            <Layout>
              <InventoryPage />
            </Layout>
          ) : <Navigate to="/login" replace />
        } />
        <Route path="/timecard" element={
          isAuthenticated ? (
            <Layout>
              <TimecardPage />
            </Layout>
          ) : <Navigate to="/login" replace />
        } />
        <Route path="/timecard/edit/:entryId" element={
          isAuthenticated ? (
            <Layout>
              <TimecardEditPage />
            </Layout>
          ) : <Navigate to="/login" replace />
        } />
      </Routes>
    </Router>
    </ThemeProvider>
  );
}

export default AppRouter;
