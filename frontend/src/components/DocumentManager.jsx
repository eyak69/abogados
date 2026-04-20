import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { API_URL } from '../config.js';

export default function DocumentManager() {
  const { token, user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  const fetchDocuments = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/documents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(response.data);
    } catch (error) {
      console.error('Error al cargar documentos:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchDocuments();
  }, [token]);

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este expediente? Se borrarán también los vectores de IA.')) return;
    
    setDeletingId(id);
    try {
      await axios.delete(`${API_URL}/api/documents/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDocuments(prev => prev.filter(doc => doc.id !== id));
    } catch (error) {
      alert('Error al eliminar el documento.');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="loading-dots">Cargando repositorio...</div>;

  return (
    <section className="glass-panel document-manager-sidebar">
      <div className="section-header">
        <span className="icon">📚</span>
        <h2>REPOSITORIO</h2>
      </div>

      <div className="doc-list">
        {documents.length === 0 ? (
          <p className="empty-msg">No hay documentos indexados.</p>
        ) : (
          documents.map((doc) => (
            <div key={doc.id} className="doc-item">
              <div className="doc-info">
                <span className="doc-name" title={doc.originalName}>{doc.originalName}</span>
                <span className="doc-meta">
                  {new Date(doc.uploadedAt).toLocaleDateString()} • {doc.status}
                </span>
              </div>
              
              {user?.role === 'EDITOR' && (
                <button 
                  className="btn-icon-delete" 
                  onClick={() => handleDelete(doc.id)}
                  disabled={deletingId === doc.id}
                  title="Eliminar de todos lados"
                >
                  {deletingId === doc.id ? '...' : '✕'}
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <style>{`
        .document-manager-sidebar {
          margin-top: 1rem;
          max-height: 400px;
          display: flex;
          flex-direction: column;
        }
        .doc-list {
          overflow-y: auto;
          margin-top: 1rem;
          padding-right: 5px;
        }
        .doc-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem;
          background: rgba(255,255,255,0.03);
          border-radius: 8px;
          margin-bottom: 0.5rem;
          border: 1px solid rgba(255,255,255,0.05);
          transition: all 0.2s;
        }
        .doc-item:hover {
          background: rgba(255,255,255,0.07);
        }
        .doc-info {
          display: flex;
          flex-direction: column;
          max-width: 80%;
        }
        .doc-name {
          font-size: 0.85rem;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: var(--text-primary);
        }
        .doc-meta {
          font-size: 0.7rem;
          color: var(--text-secondary);
          opacity: 0.7;
        }
        .btn-icon-delete {
          background: none;
          border: none;
          color: #ff4d4d;
          cursor: pointer;
          font-size: 1rem;
          padding: 5px;
          opacity: 0.5;
          transition: opacity 0.2s;
        }
        .btn-icon-delete:hover {
          opacity: 1;
        }
        .empty-msg {
          text-align: center;
          font-size: 0.8rem;
          color: var(--text-secondary);
          padding: 1rem;
        }
      `}</style>
    </section>
  );
}
