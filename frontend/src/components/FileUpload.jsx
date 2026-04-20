import { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config.js';

export default function FileUpload({ onUploadComplete, onUploadStart }) {
  const { token, user } = useAuth();

  // Si el usuario no tiene permisos de EDITOR, ocultamos el panel.
  // Fallback: Si el email es el del ADMIN oficial, permitimos acceso incluso si la sesión es vieja (JWT sin role).
  const isAdminEmail = user?.email === 'cfanton@gmail.com';
  const hasEditorRole = user?.role === 'EDITOR';

  if (!isAdminEmail && !hasEditorRole) return null;



  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files)]);
    }
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setStatus('Transfiriendo...');
    onUploadStart?.();

    const formData = new FormData();
    files.forEach((file) => formData.append('data', file));

    try {
      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Server error');
      
      setStatus('Completado');
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onUploadComplete?.(data);
    } catch (err) {
      console.error(err);
      setStatus('Error');
    } finally {
      setUploading(false);
      setTimeout(() => setStatus(''), 3000);
    }
  };

  return (
    <section className="glass-panel upload-sidebar-item">
      <div className="section-header">
        <span className="icon">📂</span>
        <h2>EXPEDIENTES</h2>
      </div>
      
      <div className="file-drop-area" onClick={() => fileInputRef.current?.click()}>
        <input 
          type="file" 
          multiple 
          onChange={handleFileChange} 
          ref={fileInputRef}
          style={{ display: 'none' }}
        />
        <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
        <p>{files.length > 0 ? `${files.length} seleccionados` : 'Cargar PDF'}</p>
      </div>

      {files.length > 0 && (
        <button 
          className="btn-primary" 
          disabled={uploading} 
          onClick={(e) => { e.stopPropagation(); uploadFiles(); }}
          style={{ marginTop: '1rem' }}
        >
          {uploading ? 'ENVIANDO...' : 'SUBIR AHORA'}
        </button>
      )}
      
      {status && <div className="status-mini-msg">{status}</div>}
    </section>
  );
}
