import { useState } from 'react';
import './index.css';
import DashboardLayout from './components/DashboardLayout';
import Header from './components/Header';
import FileUpload from './components/FileUpload';
import StatusTracker from './components/StatusTracker';
import ChatPanel from './components/ChatPanel';

function App() {
  const [sessionId] = useState(() => 'sess_' + Math.random().toString(36).substring(2, 10));

  const SidebarContent = (
    <>
      <Header />
      <FileUpload />
      <StatusTracker />
    </>
  );

  return (
    <DashboardLayout sidebar={SidebarContent}>
      <ChatPanel sessionId={sessionId} />
    </DashboardLayout>
  );
}

export default App;
