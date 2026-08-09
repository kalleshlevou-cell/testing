import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { NhostProvider } from '@nhost/react';
import { ApolloProvider } from '@apollo/client';
import { nhost } from './lib/nhost';
import { apolloClient } from './lib/apolloClient';
import { OrgProvider } from './context/OrgContext';
import { AuthGuard } from './components/AuthGuard';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { WorkflowBuilderPage } from './pages/WorkflowBuilderPage';
import { RunViewerPage } from './pages/RunViewerPage';
import { OrgSettingsPage } from './pages/OrgSettingsPage';
import './index.css';

const ProtectedLayout = ({ children }: { children: React.ReactNode }) => (
  <AuthGuard>
    <OrgProvider>
      <div className="app-layout">
        <Navbar />
        <main className="app-main">{children}</main>
      </div>
    </OrgProvider>
  </AuthGuard>
);

function App() {
  return (
    <NhostProvider nhost={nhost}>
      <ApolloProvider client={apolloClient}>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />

            {/* Protected */}
            <Route
              path="/"
              element={
                <ProtectedLayout>
                  <DashboardPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/workflows/:id"
              element={
                <ProtectedLayout>
                  <WorkflowBuilderPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/runs/:runId"
              element={
                <ProtectedLayout>
                  <RunViewerPage />
                </ProtectedLayout>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedLayout>
                  <OrgSettingsPage />
                </ProtectedLayout>
              }
            />

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ApolloProvider>
    </NhostProvider>
  );
}

export default App;
