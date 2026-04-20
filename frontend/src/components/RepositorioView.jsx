import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config.js';

export default function RepositorioView({ onRefresh }) {
  const { token, user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [selectedDoc, setSelectedDoc] = useState(null);
  const [showMetadata, setShowMetadata] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [historicalLogs, setHistoricalLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const [confirmDeleteDoc, setConfirmDeleteDoc] = useState(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth <= 1024 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchDocuments = async (page = currentPage) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/api/documents?page=${page}&limit=${itemsPerPage}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(response.data.docs);
    } catch (error) {
      console.error('Error al cargar repositorio:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments(currentPage);
  }, [token]);

  const handleShowLogs = async (doc) => {
    setSelectedDoc(doc);
    setShowLogs(true);
    setLoadingLogs(true);
    try {
      const response = await axios.get(`${API_URL}/api/documents/${doc.id}/logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistoricalLogs(response.data);
    } catch (error) {
      console.error('Error al cargar logs:', error);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleShowMetadata = (doc) => {
    setSelectedDoc(doc);
    setShowMetadata(true);
  };

  const executeDelete = async () => {
    if (!confirmDeleteDoc) return;
    const { id } = confirmDeleteDoc;
    
    setDeletingId(id);
    setConfirmDeleteDoc(null);
    try {
      await axios.delete(`${API_URL}/api/documents/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(prev => prev.filter(doc => doc.id !== id));
      if (onRefresh) onRefresh();
    } catch (error) {
      alert('Fallo al eliminar documento.');
    } finally {
      setDeletingId(null);
    }
  };

  const sortedDocs = [...documents].sort((a, b) => 
    new Date(b.uploadedAt) - new Date(a.uploadedAt)
  );

  const filteredDocs = sortedDocs.filter(doc => 
    doc.originalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (doc.metadata?.cuij && String(doc.metadata.cuij).toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Lógica de Paginación
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredDocs.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredDocs.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Resetear paginación al buscar
  useEffect(() => {
    setCurrentPage(1);
    fetchDocuments(1);
  }, [searchTerm]);

  useEffect(() => {
    fetchDocuments(currentPage);
  }, [currentPage]);

  return (
    <div className="repositorio-container">
      <header className="repo-header">
        <div className="title-group">
          <h1>Gestión de <span>Expedientes</span></h1>
          <p>Auditoría y mantenimiento del repositorio soberano</p>
        </div>
        
        <div className="repo-actions">
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input 
              type="text" 
              placeholder="Buscar por nombre o CUIJ..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn-refresh" onClick={fetchDocuments} title="Actualizar">
            🔄
          </button>
        </div>
      </header>

      <div className="table-wrapper glass-panel">
        {loading ? (
          <div className="repo-loading">
            <div className="spinner"></div>
            <span>Sincronizando con el cerebro legal...</span>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="repo-empty">
            <span className="empty-icon">📂</span>
            <h3>No se hallaron expedientes</h3>
            <p>Sube archivos desde el menú lateral para comenzar.</p>
          </div>
        ) : isMobile ? (
          /* VISTA MÓVIL (Regla 9) */
          <div className="docs-mobile-list">
            {filteredDocs.map(doc => (
              <div key={doc.id} className="doc-card-mobile gold-glow">
                <div className="doc-card-header">
                  <div className="doc-card-title">{doc.originalName}</div>
                  <span className={`status-pill ${doc.status.toLowerCase()}`}>
                    {doc.status}
                  </span>
                </div>
                
                <div className="doc-card-body">
                  <div className="doc-card-row">
                    <label>CUIJ</label>
                    <code className="cuij-badge">{doc.metadata?.cuij || 'N/A'}</code>
                  </div>
                  <div className="doc-card-row">
                    <label>Carga</label>
                    <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="doc-card-row" style={{flexDirection: 'column', alignItems: 'flex-start', gap: '0.3rem'}}>
                    <label>Carátula</label>
                    <span style={{fontSize: '0.8rem', opacity: 0.9}}>{doc.metadata?.caratula || 'Sin datos extraídos'}</span>
                  </div>
                </div>

                <div className="doc-card-actions">
                  <button className="btn-mobile-action" onClick={() => handleShowMetadata(doc)}>
                    🔍 Metadatos
                  </button>
                  {user?.role === 'EDITOR' && (
                    <button className="btn-mobile-action" onClick={() => handleShowLogs(doc)}>
                      📋 Auditoría
                    </button>
                  )}
                  {user?.role === 'EDITOR' && (
                    <button className="btn-mobile-action" style={{borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444'}} onClick={() => setConfirmDeleteDoc(doc)}>
                      🗑️ Borrar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <table className="repo-table">
            <thead>
              <tr>
                <th>Expediente / Nombre</th>
                <th>CUIJ</th>
                <th>Carátula</th>
                <th>Carga</th>
                <th>Estado</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.map((doc) => {
                const canManage = user?.role === 'EDITOR';

                return (
                  <tr key={doc.id} className="repo-row">
                    <td className="col-name">
                      <div className="file-info">
                        <span className="file-icon">📄</span>
                        <span className="file-label" title={doc.originalName}>{doc.originalName}</span>
                      </div>
                    </td>
                    <td className="col-cuij">
                      <code className="cuij-badge">{doc.metadata?.cuij || 'N/A'}</code>
                    </td>
                    <td className="col-caratula">
                       <span className="caratula-text">{doc.metadata?.caratula || 'Sin datos extraídos'}</span>
                    </td>
                    <td className="col-date">
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </td>
                    <td className="col-status">
                      <span className={`status-pill ${doc.status.toLowerCase()}`}>
                        {doc.status}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="action-buttons-row">
                        <button className="btn-icon-action meta" onClick={() => handleShowMetadata(doc)} title="Metadatos IA">
                          🔍
                        </button>
                        {canManage && (
                          <button className="btn-icon-action audit" onClick={() => handleShowLogs(doc)} title="Auditoría">
                            📋
                          </button>
                        )}
                        {canManage && (
                          <button className="btn-icon-action danger" onClick={() => setConfirmDeleteDoc(doc)} disabled={deletingId === doc.id} title="Eliminar">
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL DE CONFIRMACIÓN DE BORRADO */}
      {confirmDeleteDoc && (
        <div className="modal-overlay danger" onClick={() => setConfirmDeleteDoc(null)}>
          <div className="modal-content glass-panel confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon">⚠️</div>
            <h3>Eliminar Expediente</h3>
            <p>
              ¿Seguro que desea eliminar <strong>"{confirmDeleteDoc.originalName}"</strong>?
              <br />
              <span className="warning-text">Esta acción borrará permanentemente los vectores de la IA y los logs de auditoría.</span>
            </p>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setConfirmDeleteDoc(null)}>Cancelar</button>
              <button className="btn-confirm-delete" onClick={executeDelete}>Confirmar Eliminación</button>
            </div>
          </div>
        </div>
      )}

      {showMetadata && selectedDoc && (
        <div className="modal-overlay" onClick={() => setShowMetadata(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <div className="header-icon-group">
                <span className="header-icon">🔎</span>
                <h3>Metadatos: <span className="doc-name-accent">{selectedDoc.originalName}</span></h3>
              </div>
              <button 
                className="close-btn-premium" 
                onClick={() => setShowMetadata(false)}
                title="Cerrar"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </header>
            <div className="modal-body">
              <pre className="json-viewer">
                {JSON.stringify(selectedDoc.metadata, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}

      {showLogs && selectedDoc && (
        <div className="modal-overlay" onClick={() => setShowLogs(false)}>
          <div className="modal-content glass-panel terminal-modal" onClick={e => e.stopPropagation()}>
            <header className="modal-header">
              <div className="header-icon-group">
                <span className="header-icon">📋</span>
                <h3>Auditoría: <span className="doc-name-accent">{selectedDoc.originalName}</span></h3>
              </div>
              <button className="close-btn-premium" onClick={() => setShowLogs(false)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </header>
            <div className="modal-body terminal-body">
              {loadingLogs ? (
                <div className="spinner-small"></div>
              ) : historicalLogs.length === 0 ? (
                <p>No hay registros de auditoría para este archivo.</p>
              ) : (
                historicalLogs.map((log, i) => (
                  <div key={i} className={`log-line ${log.level.toLowerCase()}`}>
                    <span className="log-time">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                    <span className="log-msg">{log.message}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* PAGINACIÓN */}
      {totalPages > 1 && (
        <div className="pagination-container">
          <button 
            className="btn-pagination" 
            onClick={() => paginate(currentPage - 1)}
            disabled={currentPage === 1}
          >
            ← Anterior
          </button>
          
          <div className="page-indicator">
            Página <span>{currentPage}</span> de {totalPages}
          </div>

          <button 
            className="btn-pagination" 
            onClick={() => paginate(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Siguiente →
          </button>
        </div>
      )}

      <style>{`
        .repositorio-container {
          padding: 2rem 3rem;
          height: 100%;
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          overflow: hidden;
          animation: fadeIn 0.8s ease-out;
        }
        .repo-header {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 1rem;
          margin-bottom: 0.5rem;
        }
        .title-group h1 {
          font-family: var(--font-serif);
          font-size: 2.2rem;
          line-height: 1.1;
          margin: 0;
          letter-spacing: -1px;
        }
        .title-group h1 span {
          color: var(--sys-color-primary);
          font-weight: 400;
          font-style: italic;
        }
        .title-group p {
          color: var(--sys-color-on-surface-variant);
          margin: 0.4rem 0 0 0;
          font-size: 1rem;
          letter-spacing: 0.5px;
          opacity: 0.8;
        }
        
        .repo-actions {
          display: flex;
          gap: 1rem;
          align-items: center;
          width: 100%;
        }
        .search-bar {
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--sys-color-outline-variant);
          border-radius: 100px;
          display: flex;
          align-items: center;
          padding: 0 1.5rem;
          width: 350px;
          transition: all 0.3s;
          backdrop-filter: blur(5px);
        }
        .search-bar:focus-within {
          border-color: var(--sys-color-primary);
          background: rgba(255,255,255,0.05);
          box-shadow: 0 0 20px rgba(242, 202, 80, 0.1);
        }
        .search-bar input {
          background: transparent;
          border: none;
          color: var(--sys-color-on-surface);
          padding: 0.9rem;
          outline: none;
          width: 100%;
          font-size: 0.95rem;
        }
        .btn-refresh {
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--sys-color-outline-variant);
          color: var(--sys-color-on-surface);
          width: 48px;
          height: 48px;
          border-radius: 50%;
          cursor: pointer;
          transition: all 0.4s;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
        }
        .btn-refresh:hover {
          background: rgba(242, 202, 80, 0.1);
          border-color: var(--sys-color-primary);
          transform: rotate(180deg);
        }

        .table-wrapper {
          flex-grow: 1;
          overflow-y: auto;
          border-radius: 24px;
          background: rgba(15, 23, 42, 0.3);
          backdrop-filter: blur(10px);
          border: 1px solid var(--glass-border);
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
        .repo-table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          text-align: left;
        }
        .repo-table th {
          padding: 1.5rem;
          background: var(--sys-color-surface-container-high);
          backdrop-filter: blur(10px);
          color: var(--sys-color-primary);
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 2px;
          font-weight: 700;
          position: sticky;
          top: 0;
          z-index: 10;
          border-bottom: 1px solid var(--sys-color-outline-variant);
        }
        .repo-row {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .repo-row:hover {
          background: rgba(212, 175, 55, 0.04);
          transform: scale(1.002);
        }
        .repo-row td {
          padding: 1.5rem;
          font-size: 0.95rem;
          border-bottom: 1px solid rgba(255,255,255,0.02);
        }
        
        .file-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .file-icon { font-size: 1.4rem; }
        .file-label {
          max-width: 250px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          font-weight: 500;
        }
        
        .cuij-badge {
          background: rgba(0, 0, 0, 0.45);
          padding: 0.4rem 0.8rem;
          border-radius: 8px;
          font-family: 'JetBrains Mono', monospace;
          color: var(--sys-color-primary);
          border: 1px solid var(--sys-color-outline-variant);
          font-size: 0.8rem;
          display: inline-block;
          max-width: 180px;
          word-break: break-all;
          line-height: 1.4;
          vertical-align: middle;
        }
        
        .caratula-text {
          font-size: 0.85rem;
          opacity: 0.7;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          line-height: 1.4;
        }

        .status-pill {
          padding: 0.4rem 1rem;
          border-radius: 100px;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.5px;
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          border: 1px solid transparent;
        }
        .status-pill.vectorized {
          background: rgba(16, 185, 129, 0.1);
          color: var(--status-success);
          border-color: rgba(16, 185, 129, 0.2);
        }
        .status-pill.processing {
          background: rgba(245, 158, 11, 0.1);
          color: var(--status-warning);
          border-color: rgba(245, 158, 11, 0.2);
        }
        .status-pill.failed {
          background: rgba(239, 68, 68, 0.1);
          color: var(--status-error);
          border-color: rgba(239, 68, 68, 0.2);
        }

        /* ACTION BUTTONS ROW */
        .action-buttons-row {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 0.5rem;
        }
        .btn-icon-action {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.04);
          cursor: pointer;
          font-size: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        .btn-icon-action:hover { transform: translateY(-2px); }
        .btn-icon-action.meta:hover { background: rgba(212,175,55,0.15); border-color: rgba(212,175,55,0.4); }
        .btn-icon-action.audit:hover { background: rgba(56,189,248,0.15); border-color: rgba(56,189,248,0.4); }
        .btn-icon-action.danger:hover { background: rgba(239,68,68,0.15); border-color: rgba(239,68,68,0.4); }
        .btn-icon-action:disabled { opacity: 0.3; cursor: not-allowed; transform: none; }

        /* MODALES LEX CRYSTAL */
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(4, 19, 41, 0.85);
          backdrop-filter: blur(15px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          animation: fadeIn 0.4s ease;
        }
        .modal-content {
          width: 95%;
          max-width: 750px;
          border-radius: 32px;
          border: 1px solid rgba(212, 175, 55, 0.2);
          background: #0d1a2e !important;
          box-shadow: 0 50px 120px rgba(0,0,0,0.9);
          overflow: hidden;
          position: relative;
        }

        /* PAGINACIÓN PREMIUM */
        .pagination-container {
          margin-top: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 2rem;
          padding: 1.5rem 0;
          border-top: 1px solid var(--sys-color-outline-variant);
        }
        .page-indicator {
          font-size: 0.9rem;
          color: var(--sys-color-on-surface-variant);
          letter-spacing: 1px;
        }
        .page-indicator span {
          color: var(--sys-color-primary);
          font-weight: 700;
        }
        .btn-pagination {
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--sys-color-outline-variant);
          color: var(--sys-color-on-surface);
          padding: 0.7rem 1.5rem;
          border-radius: 100px;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.3s;
          min-width: 120px;
        }
        .btn-pagination:hover:not(:disabled) {
          background: rgba(242, 202, 80, 0.1);
          border-color: var(--sys-color-primary);
          transform: translateY(-2px);
        }
        .btn-pagination:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .modal-header {
          padding: 1.5rem 2rem;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(255,255,255,0.02);
        }
        .header-icon-group { display: flex; align-items: center; gap: 1rem; }
        .header-icon { font-size: 1.4rem; }
        .modal-header h3 { margin: 0; font-size: 1.1rem; font-family: var(--font-serif); }
        .doc-name-accent { color: var(--accent-gold); font-style: italic; font-weight: 400; }
        
        .close-btn-premium {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--sys-color-outline-variant);
          color: var(--sys-color-on-surface);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .close-btn-premium:hover {
          background: var(--status-error);
          border-color: var(--status-error);
          color: white;
          transform: rotate(90deg) scale(1.1);
        }

        .modal-body { padding: 2rem; }
        .modal-content.confirm-modal { max-width: 450px; padding: 2.5rem; text-align: center; }
        
        .confirm-icon { font-size: 3rem; margin-bottom: 1.5rem; }
        .warning-text { color: #f87171; font-size: 0.85rem; display: block; margin-top: 1rem; }

        .confirm-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-top: 2rem;
        }

        .btn-cancel {
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--sys-color-outline-variant);
          color: var(--sys-color-on-surface);
          padding: 1rem;
          border-radius: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
        }
        .btn-cancel:hover { background: rgba(255,255,255,0.1); }
        
        .btn-confirm-delete {
          background: linear-gradient(135deg, #ffb4ab, #93000a);
          border: none;
          padding: 1rem;
          border-radius: 14px;
          color: white;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 1px;
          cursor: pointer;
          box-shadow: 0 10px 20px rgba(147, 0, 10, 0.3);
        }
        .btn-confirm-delete:hover { transform: translateY(-2px); box-shadow: 0 15px 30px rgba(147, 0, 10, 0.5); }
        
        .json-viewer {
          background: #020617;
          padding: 2rem;
          border-radius: 16px;
          border: 1px solid rgba(212, 175, 55, 0.15);
          font-family: 'JetBrains Mono', monospace;
          color: var(--accent-gold);
          max-height: 450px;
          overflow-y: auto;
        }
        
        .terminal-body {
          background: #020617;
          border-radius: 16px;
          padding: 2rem;
          border: 1px solid #1e293b;
          max-height: 400px;
          overflow-y: auto;
        }
        .log-line {
          padding: 0.5rem 1rem;
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.9rem;
          border-radius: 6px;
        }
        .log-line:hover { background: rgba(255,255,255,0.02); }
        
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .text-right { text-align: right; }
      `}</style>
    </div>
  );
}
