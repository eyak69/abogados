import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function ChatPanel({ sessionId }) {
  const { token } = useAuth();

  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'AI', text: `Bienvenido al Centro de Comando Legal. Soy tu perito senior. (ID de Sesión: ${sessionId})` }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, loading]);

  const sendChatMessage = async () => {
    if (!chatInput.trim() || loading) return;
    
    const newHistory = [...chatHistory, { role: 'USER', text: chatInput }];
    setChatHistory(newHistory);
    setChatInput('');
    setLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: chatInput, sessionId })
      });

      const data = await response.json();
      
      let aiText = 'Protocolo completado sin datos de respuesta.';
      if (typeof data === 'string') aiText = data;
      else if (data && data.response) aiText = data.response;
      else if (data && data.output) aiText = data.output;
      else if (data) aiText = JSON.stringify(data);

      setChatHistory([...newHistory, { role: 'AI', text: aiText }]);
    } catch (err) {
      setChatHistory([...newHistory, { role: 'AI', text: '⚠️ [Fallo de Conexión] No se pudo alcanzar el nodo de IA soberano.' }]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format, content, title = "Informe Legal") => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/chat/export/${format}`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content, title })
      });


      if (!response.ok) throw new Error('Fallo en la generación del documento');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.${format === 'word' ? 'docx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export Error:', err);
      alert('No se pudo exportar el documento.');
    }
  };

  const exportFullChat = () => {
    const fullContent = chatHistory
      .map(msg => `**${msg.role === 'AI' ? 'ASISTENTE' : 'USUARIO'}**\n${msg.text}`)
      .join('\n\n---\n\n');
    handleExport('pdf', fullContent, 'Historial_Completo_Abogados');
  };

  return (
    <div className="chat-panel-container">
      <div className="messages-container">
        {chatHistory.map((msg, idx) => (
          <div key={idx} className={`chat-bubble ${msg.role === 'AI' ? 'ai' : 'user'}`}>
            <div className="bubble-content">
              <div className="bubble-header">
                <strong>{msg.role === 'AI' ? 'Veritas AI' : 'Tú'}</strong>
                {msg.role === 'AI' && idx > 0 && (
                  <div className="export-actions">
                    <button title="Bajar PDF" onClick={() => handleExport('pdf', msg.text, `Analisis_Legal_${idx}`)}>
                      <span className="btn-icon">📄</span> PDF
                    </button>
                    <button title="Bajar Word" onClick={() => handleExport('word', msg.text, `Analisis_Legal_${idx}`)}>
                      <span className="btn-icon">📝</span> DOC
                    </button>
                  </div>
                )}
              </div>
              <div className={`text-content ${msg.role === 'AI' ? 'serif-font' : ''}`}>
                {msg.text}
              </div>
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="chat-bubble ai processing">
            <div className="bubble-content">
              <div className="bubble-header">
                <strong>Veritas AI</strong>
              </div>
              <div className="thinking-indicator">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="thinking-text">Analizando expediente...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-wrapper">
        <div className="chat-controls gold-glow">
          <input 
            type="text" 
            placeholder={loading ? 'Procesando consulta jurídica...' : 'Analizar expediente o consultar ley...'}
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
            disabled={loading}
          />
          <button onClick={sendChatMessage} className="btn-chat" disabled={loading}>
            {loading ? (
              <div className="btn-spinner"></div>
            ) : (
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"></line>
                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
              </svg>
            )}
          </button>
        </div>
        
        {chatHistory.length > 2 && (
          <div className="chat-global-actions" style={{marginTop: '1.5rem', display: 'flex', justifyContent: 'center'}}>
            <button onClick={exportFullChat} className="btn-premium-action gold-glow" disabled={loading}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              Exportar Dictamen (PDF)
            </button>
          </div>
        )}
      </div>

      <style>{`
        .serif-font {
          font-family: var(--font-serif);
          font-size: 1.05rem;
          color: var(--text-primary);
        }
        .text-content {
          white-space: pre-wrap;
        }
        .export-actions {
          display: flex;
          gap: 0.5rem;
        }
        .export-actions button {
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--glass-border);
          color: var(--accent-gold);
          font-size: 0.7rem;
          padding: 4px 8px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          gap: 4px;
          font-weight: 600;
        }
        .export-actions button:hover {
          background: var(--accent-gold);
          color: #000;
          border-color: #fff;
        }
        .thinking-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0;
        }
        .dot {
          width: 8px;
          height: 8px;
          background: var(--sys-color-primary);
          border-radius: 50%;
          animation: dotPulse 1.5s infinite ease-in-out;
        }
        .dot:nth-child(2) { animation-delay: 0.2s; }
        .dot:nth-child(3) { animation-delay: 0.4s; }
        
        .thinking-text {
          font-size: 0.85rem;
          color: var(--sys-color-on-surface-variant);
          margin-left: 0.5rem;
          font-style: italic;
        }
        
        @keyframes dotPulse {
          0%, 100% { transform: scale(0.8); opacity: 0.4; }
          50% { transform: scale(1.2); opacity: 1; }
        }

        .btn-spinner {
          width: 20px;
          height: 20px;
          border: 3px solid rgba(255,255,255,0.2);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .chat-bubble.processing {
          border-left: 3px solid var(--sys-color-primary);
          background: rgba(242, 202, 80, 0.05);
        }
      `}</style>
    </div>
  );
}

