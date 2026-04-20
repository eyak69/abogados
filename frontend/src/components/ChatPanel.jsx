import { useState, useRef, useEffect } from 'react';

export default function ChatPanel({ sessionId }) {
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'AI', text: `Bienvenido al Centro de Comando Legal. Soy tu perito senior. (ID de Sesión: ${sessionId})` }
  ]);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const sendChatMessage = async () => {
    if (!chatInput.trim()) return;
    
    const newHistory = [...chatHistory, { role: 'USER', text: chatInput }];
    setChatHistory(newHistory);
    setChatInput('');

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    }
  };

  const handleExport = async (format, content, title = "Informe Legal") => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
      const response = await fetch(`${apiUrl}/api/chat/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    <>
      <div className="messages-container">
        {chatHistory.map((msg, idx) => (
          <div key={idx} className={`chat-bubble ${msg.role === 'AI' ? 'ai' : 'user'}`}>
            <div className="bubble-content">
              <div className="bubble-header">
                <strong>{msg.role === 'AI' ? 'Veritas AI' : 'Tú'}</strong>
                {msg.role === 'AI' && idx > 0 && (
                  <div className="export-actions">
                    <button title="Bajar PDF" onClick={() => handleExport('pdf', msg.text, `Analisis_Legal_${idx}`)}>PDF</button>
                    <button title="Bajar Word" onClick={() => handleExport('word', msg.text, `Analisis_Legal_${idx}`)}>DOC</button>
                  </div>
                )}
              </div>
              <p>{msg.text}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-wrapper">
        {chatHistory.length > 2 && (
          <div className="chat-global-actions">
            <button onClick={exportFullChat} className="btn-secondary-legal">
              📥 Exportar Historial Completo (PDF)
            </button>
          </div>
        )}
        <div className="chat-controls">
          <input 
            type="text" 
            placeholder="Analizar expediente o consultar ley..." 
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
          />
          <button onClick={sendChatMessage} className="btn-chat">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
            </svg>
          </button>
        </div>
      </div>
    </>
  );
}
