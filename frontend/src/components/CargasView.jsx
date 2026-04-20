import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

export default function CargasView() {
  const { token, user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [activeUploads, setActiveUploads] = useState({});
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const terminalDocRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const eventSource = new EventSource(`${import.meta.env.VITE_API_URL}/api/upload/status`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.log) {
        setLogs(prev => [...prev.slice(-100), {
          id: Date.now() + Math.random(),
          text: data.log,
          type: data.status || 'info'
        }]);
      }

      if (data.filename) {
        setActiveUploads(prev => ({
          ...prev,
          [data.filename]: {
            status: data.status,
            message: data.message,
            progress: data.status === 'success' ? 100 : (prev[data.filename]?.progress || 0) + 2
          }
        }));
      }
    };

    return () => eventSource.close();
  }, []);

  useEffect(() => {
    if (terminalDocRef.current) {
      terminalDocRef.current.scrollTop = terminalDocRef.current.scrollHeight;
    }
  }, [logs]);


  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files)]);
    }
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;
    setUploading(true);
    
    const formData = new FormData();
    files.forEach((file) => formData.append('data', file));

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Error en el servidor de carga');
      setFiles([]);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="cargas-container">
      <header className="cargas-header">
        <div className="title-group">
          <h1>Módulo de <span>Carga e Indexación</span></h1>
          <p>Subida de expedientes con auditoría técnica en tiempo real</p>
        </div>
      </header>

      <div className="cargas-grid-unified">
        <aside className="upload-section glass-panel">
          <div className="section-title">
            <span className="icon">📂</span>
            <h3>Selector de Expedientes</h3>
          </div>
          
          <div className="file-drop-area-large" onClick={() => fileInputRef.current?.click()}>
            <input 
              type="file" 
              multiple 
              onChange={handleFileChange} 
              ref={fileInputRef}
              style={{ display: 'none' }}
            />
            <div className="upload-visual">
                <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                <p>{files.length > 0 ? `${files.length} archivos para subir` : 'Haga clic para seleccionar archivos PDF'}</p>
            </div>
          </div>

          {files.length > 0 && (
            <button className="btn-upload-run" onClick={uploadFiles} disabled={uploading}>
              {uploading ? 'PROCESANDO...' : 'INICIAR EXTRACCIÓN SOBERANA'}
            </button>
          )}

          <div className="mini-status-panel">
             <h4>Estado de Archivos</h4>
             {Object.keys(activeUploads).length === 0 ? (
               <p className="empty-msg">Sin actividad reciente.</p>
             ) : (
               Object.entries(activeUploads).map(([name, data]) => (
                <div key={name} className="mini-upload-row">
                  <div className="row-info">
                    <span className="name">{name}</span>
                    <span className={`status ${data.status}`}>{data.status}</span>
                  </div>
                  <div className="mini-bar-bg">
                    <div className={`mini-bar-fill ${data.status}`} style={{ width: `${data.progress}%` }}></div>
                  </div>
                </div>
               ))
             )}
          </div>
        </aside>

        <section className="terminal-window glass-panel">
          <div className="terminal-header">
            <div className="dots">
              <span className="dot red"></span>
              <span className="dot yellow"></span>
              <span className="dot green"></span>
            </div>
            <span className="terminal-title">system.log - auditoria_soberana</span>
          </div>
          <div className="terminal-body" ref={terminalDocRef}>
            {logs.length === 0 && <div className="line muted">Consola de depuración lista para auditoría...</div>}
            {logs.map(log => (
              <div key={log.id} className={`line ${log.type}`}>
                {log.text}
              </div>
            ))}
          </div>
        </section>
      </div>
      <style>{`
        .cargas-container { 
          padding: 2rem; 
          min-height: 100vh;
          display: flex; 
          flex-direction: column; 
          gap: 2rem; 
          overflow-y: auto;
          background: var(--sys-color-surface);
          animation: fadeIn 0.8s ease-out;
        }
        .cargas-header .title-group h1 { font-family: var(--font-serif); font-size: 2.2rem; margin: 0; letter-spacing: -1px; }
        .cargas-header .title-group h1 span { color: var(--sys-color-primary); font-weight: 400; font-style: italic; }
        .cargas-header .title-group p { color: var(--sys-color-on-surface-variant); font-size: 0.95rem; margin-top: 0.5rem; }
        
        .cargas-grid-unified {
          display: grid;
          grid-template-columns: 400px 1fr;
          gap: 2.5rem;
          flex-grow: 1;
          min-height: 0;
          margin-bottom: 2rem;
        }

        .upload-section { 
          background: var(--sys-color-surface-container); 
          display: flex; 
          flex-direction: column; 
          gap: 1.5rem; 
          padding: 2rem;
          border-radius: 24px;
          border: 1px solid var(--sys-color-outline-variant);
          backdrop-filter: var(--glass-blur);
        }
        .section-title { display: flex; align-items: center; gap: 1rem; color: var(--sys-color-primary); }
        .section-title h3 { margin: 0; font-size: 1rem; text-transform: uppercase; letter-spacing: 2px; font-family: var(--font-sans); }

        .file-drop-area-large {
          border: 2px dashed var(--sys-color-outline-variant);
          border-radius: 20px;
          padding: 2.5rem 1.5rem;
          text-align: center;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
          background: rgba(0, 0, 0, 0.2);
        }
        .file-drop-area-large:hover { 
          border-color: var(--sys-color-primary); 
          background: rgba(242, 202, 80, 0.05);
          transform: translateY(-5px);
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        .upload-visual { display: flex; flex-direction: column; align-items: center; gap: 1.2rem; color: var(--sys-color-on-surface-variant); }
        .upload-visual p { font-size: 0.9rem; font-weight: 500; }

        .btn-upload-run {
          background: linear-gradient(135deg, var(--sys-color-primary), var(--sys-color-primary-container));
          color: var(--sys-color-on-primary);
          border: none;
          padding: 1.2rem;
          border-radius: 16px;
          font-weight: 800;
          cursor: pointer;
          font-size: 0.95rem;
          letter-spacing: 1px;
          box-shadow: 0 10px 25px rgba(242, 202, 80, 0.2);
          transition: all 0.3s;
        }
        .btn-upload-run:hover { 
          transform: translateY(-2px); 
          box-shadow: 0 15px 35px rgba(242, 202, 80, 0.3); 
          filter: brightness(1.1);
        }
        .btn-upload-run:disabled { opacity: 0.3; transform: none; }

        .mini-status-panel { 
          flex-grow: 1; 
          overflow-y: auto; 
          display: flex; 
          flex-direction: column; 
          gap: 1.2rem; 
          padding: 1.5rem;
          background: var(--sys-color-surface-container-low);
          border-radius: 16px;
          border: 1px solid var(--sys-color-outline-variant);
        }
        .mini-status-panel h4 { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1.5px; color: var(--sys-color-on-surface-variant); margin: 0; opacity: 0.7; }
        .mini-upload-row { display: flex; flex-direction: column; gap: 0.6rem; padding: 0.8rem; background: rgba(255,255,255,0.02); border-radius: 10px; }
        .row-info { display: flex; justify-content: space-between; font-size: 0.8rem; }
        .row-info .name { color: var(--sys-color-on-surface); font-weight: 600; width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .row-info .status { font-weight: 800; text-transform: uppercase; font-size: 0.6rem; padding: 2px 8px; border-radius: 4px; }
        .status.success { background: rgba(16, 185, 129, 0.2); color: var(--status-success); }
        .status.error { background: rgba(255, 180, 171, 0.2); color: var(--status-error); }
        
        .mini-bar-bg { height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden; }
        .mini-bar-fill { height: 100%; background: var(--sys-color-primary); transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1); }
        .mini-bar-fill.success { background: var(--status-success); }

        .terminal-window { 
          background: var(--sys-color-surface-container-lowest) !important; 
          padding: 0 !important; 
          border: 1px solid var(--sys-color-outline-variant); 
          border-radius: 20px; 
          overflow: hidden; 
          height: 100%; 
          display: flex; 
          flex-direction: column;
          box-shadow: 0 30px 70px rgba(0,0,0,0.5);
        }
        .terminal-header { 
          background: var(--sys-color-surface-container-high); 
          padding: 0.8rem 1.5rem; 
          display: flex; 
          align-items: center; 
          gap: 2rem;
          border-bottom: 1px solid var(--sys-color-outline-variant);
        }
        .dots { display: flex; gap: 0.6rem; }
        .dot { width: 12px; height: 12px; border-radius: 50%; }
        .dot.red { background: #ff5f56; }
        .dot.yellow { background: #ffbd2e; }
        .dot.green { background: #27c93f; }
        .terminal-title { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: var(--sys-color-on-surface-variant); opacity: 0.7; }
        
        .terminal-body {
          flex-grow: 1;
          padding: 1.5rem;
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          line-height: 1.6;
          overflow-y: auto;
          color: var(--sys-color-on-surface);
          background: var(--sys-color-surface-container-lowest);
        }
        .line { border-left: 2px solid transparent; padding-left: 1rem; margin-bottom: 0.4rem; }
        .line.info { border-color: #38bdf8; }
        .line.success { border-color: var(--status-success); color: #4ade80; }
        .line.warn { border-color: #fbbf24; }
        .line.error { border-color: var(--status-error); color: #ffb4ab; font-weight: 700; }
        .line.muted { color: var(--sys-color-on-surface-variant); font-style: italic; opacity: 0.6; }
        
        @media (max-width: 1024px) {
          .cargas-container { padding: 1.5rem; overflow-y: auto; height: auto; }
          .cargas-grid-unified { grid-template-columns: 1fr; gap: 1.5rem; }
          .cargas-header .title-group h1 { font-size: 1.8rem; }
          .upload-section { padding: 1.5rem; order: 1; }
          .terminal-window { order: 2; height: 400px; min-height: 400px; }
          .file-drop-area-large { padding: 2rem 1rem; }
          .row-info .name { width: 120px; }
        }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
