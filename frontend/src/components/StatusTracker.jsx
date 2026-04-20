import { useState, useEffect } from 'react';
import { API_URL } from '../config.js';

export default function StatusTracker({ initialStatuses = {} }) {
  const [statuses, setStatuses] = useState(initialStatuses);

  useEffect(() => {
    const sse = new EventSource(`${API_URL}/api/upload/status`);

    sse.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        setStatuses(prev => ({
          ...prev,
          [data.filename]: { 
             status: data.status, 
             error: data.error || '',
             metadata: data.metadata || null 
          }
        }));
      } catch (err) {
        console.error("SSE Parse Error", err);
      }
    };

    return () => sse.close();
  }, []);

  const hasData = Object.keys(statuses).length > 0;

  return (
    <section className="glass-panel status-section bento-item">
      <div className="section-header">
        <span className="icon">📈</span>
        <h2>Estado de Procesamiento</h2>
      </div>
      
      {!hasData ? (
        <div className="empty-state">
          <p>No hay documentos en transito.</p>
        </div>
      ) : (
        <div className="status-grid-container">
          {Object.entries(statuses).map(([filename, info]) => (
            <div key={filename} className={`status-card ${info.status}`}>
              <div className="status-main">
                <span className="filename">📄 {filename}</span>
                <span className="status-label">
                  {info.status === 'processing' ? '⏳' : info.status === 'success' ? '✅' : '❌'}
                </span>
              </div>
              
              {info.metadata && (
                <div className="metadata-tag">
                  <strong>CUIJ:</strong> {info.metadata.cuij || 'N/A'}
                </div>
              )}
              
              {info.error && <div className="error-text">{info.error}</div>}
              
              <div className="progress-bar-mini">
                <div className={`fill ${info.status}`}></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
