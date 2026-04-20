import { useState, useRef } from 'react';

export default function FileUpload({ onUploadComplete, onUploadStart }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files)]);
    }
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;
    setUploading(true);
    setMessage('');
    onUploadStart?.();

    const formData = new FormData();
    files.forEach((file) => formData.append('data', file));

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Server error');
      
      setMessage('✅ Documentación encolada.');
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onUploadComplete?.(data);
    } catch (err) {
      console.error(err);
      setMessage('❌ Error: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <section className="glass-panel upload-section bento-item">
      <div className="section-header">
        <span className="icon">📂</span>
        <h2>Custodia Digital</h2>
      </div>
      <p className="description">Protocolo de ingesta segura de expedientes.</p>
      
      <div className="file-drop-area" onClick={() => fileInputRef.current?.click()}>
        <input 
          type="file" 
          multiple 
          onChange={handleFileChange} 
          id="file-upload" 
          ref={fileInputRef}
          style={{ display: 'none' }}
        />
        <div className="upload-icon">
             <svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
        </div>
        <span>{files.length > 0 ? `${files.length} archivos seleccionados` : 'Arrastra o selecciona PDFs'}</span>
      </div>

      <div className="file-preview-list">
        {files.slice(0, 3).map(f => (<span key={f.name} className="mini-pill">{f.name}</span>))}
        {files.length > 3 && <span className="more">+{files.length - 3} más</span>}
      </div>
      
      <button 
        className="btn-primary" 
        disabled={files.length === 0 || uploading} 
        onClick={uploadFiles}
      >
        {uploading ? 'Cifrando Transferencia...' : 'Iniciar Protocolo de Carga'}
      </button>
      
      {message && <div className="status-badge-inline">{message}</div>}
    </section>
  );
}
