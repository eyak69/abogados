import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import './index.css';

import DashboardLayout from './components/DashboardLayout';
import SidebarNav from './components/SidebarNav';
import ChatPanel from './components/ChatPanel';
import RepositorioView from './components/RepositorioView';
import CargasView from './components/CargasView';
import Login from './components/Login';


function App() {
  const { user, token, loading } = useAuth();
  const [activeView, setActiveView] = useState('chat'); // 'chat' | 'repositorio'
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [sessionId] = useState(() => 'sess_' + Math.random().toString(36).substring(2, 10));

  if (loading) return null;

  return (
    <Routes>
      <Route 
        path="/" 
        element={
          token ? (
            <DashboardLayout 
              sidebar={<SidebarNav activeView={activeView} onViewChange={setActiveView} />}
            >
              {activeView === 'chat' ? (
                <ChatPanel sessionId={sessionId} />
              ) : activeView === 'repositorio' ? (
                <RepositorioView key={refreshTrigger} onRefresh={() => setRefreshTrigger(t => t + 1)} />
              ) : (
                <CargasView />
              )}

            </DashboardLayout>
          ) : (
            <Navigate to="/login" />
          )
        } 
      />

      <Route 
        path="/login" 
        element={!token ? <Login /> : <Navigate to="/" />} 
      />
    </Routes>
  );
}

export default App;

