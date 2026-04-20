import { useState, useRef, useEffect } from 'react';

export default function ChatPanel({ sessionId }) {
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState([
    { role: 'AI', text: `Bienvenido. Soy tu asistente legal. (ID de Sesión: ${sessionId})` }
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
      
      let aiText = 'El webhook procesó el mensaje exitosamente pero no devolvió cuerpo de respuesta.';
      if (typeof data === 'string') aiText = data;
      else if (data && data.response) aiText = data.response;
      else if (data && data.output) aiText = data.output;
      else if (data) aiText = JSON.stringify(data);

      setChatHistory([...newHistory, { role: 'AI', text: aiText }]);
    } catch (err) {
      setChatHistory([...newHistory, { role: 'AI', text: '⚠️ [Error de Conexión Segura] No se pudo conectar con el Proxy de IA. Fallback garantizado.' }]);
    }
  };

  return (
    <section className="glass-panel chat-section bento-item">
      <div className="section-header">
        <span className="icon">⚖️</span>
        <h2>Asesor Legal IA</h2>
      </div>
      <div className="chat-window">
        {chatHistory.map((msg, idx) => (
          <div key={idx} className={`chat-bubble ${msg.role === 'AI' ? 'ai' : 'user'}`}>
            <div className="bubble-content">
              <strong>{msg.role === 'AI' ? 'IA' : 'Tú'}</strong>
              <p>{msg.text}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="chat-controls">
        <input 
          type="text" 
          placeholder="Consulta sobre el contrato..." 
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
        />
        <button onClick={sendChatMessage} className="btn-chat">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
        </button>
      </div>
    </section>
  );
}
