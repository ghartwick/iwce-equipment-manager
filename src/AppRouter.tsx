import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { LoginPage } from './components/LoginPage';
import Layout from './components/Layout';
import { ThemeProvider } from './context/ThemeContext';

// Lazy-load page components for code splitting
const InventoryPage = React.lazy(() => import('./pages/InventoryPage'));
const TimecardPage = React.lazy(() => import('./pages/TimecardPage'));
const TimecardEditPage = React.lazy(() => import('./pages/TimecardEditPage'));
const GamePage = React.lazy(() => import('./pages/GamePage'));
const EquipmentPage = React.lazy(() => import('./pages/EquipmentPage'));
const Service = React.lazy(() => import('./pages/ShopPage'));
const HeavyEquipmentManagementPage = React.lazy(() => import('./pages/HeavyEquipmentManagementPage'));
const FleetManagementPage = React.lazy(() => import('./pages/FleetManagementPage'));
const FieldToolsManagementPage = React.lazy(() => import('./pages/FieldToolsManagementPage'));
const SmallToolsManagementPage = React.lazy(() => import('./pages/SmallToolsManagementPage'));
const SiteManagementPage = React.lazy(() => import('./pages/SiteManagementPage'));
const EditSitePage = React.lazy(() => import('./pages/EditSitePage').then(m => ({ default: m.EditSitePage })));
const UserManagementPage = React.lazy(() => import('./pages/UserManagementPage'));
const ReportsPage = React.lazy(() => import('./pages/ReportsPage'));

// Loading fallback for lazy-loaded pages
const PageLoader = () => (
  <div className="min-h-screen bg-yellow-100 dark:bg-black flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-600 dark:border-yellow-400 mx-auto mb-4"></div>
      <div className="text-lg text-yellow-600 dark:text-yellow-400">Loading...</div>
    </div>
  </div>
);

function AppRouter() {
  const { isAuthenticated, isLoading, login, error: authError } = useAuth();

  const handleLogin = async (username: string, password: string, rememberMe: boolean) => {
    try {
      await login(username, password, rememberMe);
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
      <Suspense fallback={<PageLoader />}>
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
        <Route path="/game" element={
          isAuthenticated ? (
            <Layout>
              <GamePage />
            </Layout>
          ) : <Navigate to="/login" replace />
        } />
        <Route path="/inventory/equipment/:equipmentId" element={
          isAuthenticated ? (
            <Layout>
              <EquipmentPage />
            </Layout>
          ) : <Navigate to="/login" replace />
        } />
        <Route path="/inventory/equipment/:equipmentId/service" element={
          isAuthenticated ? (
            <Layout>
              <Service />
            </Layout>
          ) : <Navigate to="/login" replace />
        } />
        <Route path="/manage/fleet" element={
          isAuthenticated ? (
            <Layout>
              <FleetManagementPage />
            </Layout>
          ) : <Navigate to="/login" replace />
        } />
        <Route path="/manage/heavy-equipment" element={
          isAuthenticated ? (
            <Layout>
              <HeavyEquipmentManagementPage />
            </Layout>
          ) : <Navigate to="/login" replace />
        } />
        <Route path="/manage/field-tools" element={
          isAuthenticated ? (
            <Layout>
              <FieldToolsManagementPage />
            </Layout>
          ) : <Navigate to="/login" replace />
        } />
        <Route path="/manage/small-tools" element={
          isAuthenticated ? (
            <Layout>
              <SmallToolsManagementPage />
            </Layout>
          ) : <Navigate to="/login" replace />
        } />
        <Route path="/manage/sites" element={
          isAuthenticated ? (
            <Layout>
              <SiteManagementPage />
            </Layout>
          ) : <Navigate to="/login" replace />
        } />
        <Route path="/admin/sites/edit/:siteId" element={
          isAuthenticated ? (
            <Layout>
              <EditSitePage />
            </Layout>
          ) : <Navigate to="/login" replace />
        } />
        <Route path="/manage/users" element={
          isAuthenticated ? (
            <Layout>
              <UserManagementPage />
            </Layout>
          ) : <Navigate to="/login" replace />
        } />
        <Route path="/shop" element={
          isAuthenticated ? (
            <Layout>
              <ReportsPage />
            </Layout>
          ) : <Navigate to="/login" replace />
        } />
      </Routes>
      </Suspense>
    </Router>
    </ThemeProvider>
  );
}

export default AppRouter;
