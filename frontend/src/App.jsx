import { useState } from 'react';
import './index.css';
import DashboardLayout from './components/DashboardLayout';
import FileUpload from './components/FileUpload';
import StatusTracker from './components/StatusTracker';
import ChatPanel from './components/ChatPanel';

function App() {
  const [sessionId] = useState(() => 'sess_' + Math.random().toString(36).substring(2, 10));

  return (
    <DashboardLayout>
      {/* Columna Izquierda: Gestión de Archivos y Tracking */}
      <div className="bento-column">
        <FileUpload />
        <StatusTracker />
      </div>

      {/* Columna Derecha: IA Conversacional */}
      <div className="bento-column main-tool">
        <ChatPanel sessionId={sessionId} />
      </div>
    </DashboardLayout>
  );
}

export default App;
