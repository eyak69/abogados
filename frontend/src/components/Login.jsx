import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { API_URL } from '../config.js';


const Login = () => {
  const { login } = useAuth();
  const [error, setError] = useState('');

  const handleGoogleSuccess = async (credentialResponse) => {
    setError('');
    try {
      const response = await axios.post(`${API_URL}/api/auth/google`, {
        credential: credentialResponse.credential
      });
      const { token, user } = response.data;
      login(token, user);
    } catch (err) {
      console.error('Error en login:', err);
      setError('Error de autenticación. Verificá que tu cuenta tenga acceso al sistema.');
    }
  };

  return (
    <div className="login-overlay">
      <div className="login-card glass-panel">
        <div className="brand-header">
          <h1>Abogados <span>Premium</span></h1>
          <p>Soberanía Legal Inteligente</p>
        </div>
        
        <div className="login-content">
          <p>Accede con tu cuenta institucional para comenzar el análisis.</p>
          {error && <div className="login-error">{error}</div>}
          <div className="google-btn-wrapper">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Error en la autenticación de Google. Intentá nuevamente.')}
              useOneTap
              theme="filled_blue"
              shape="pill"
            />
          </div>
        </div>


        <div className="login-footer">
          <p>© 2026 Abogados IA - Sistema Veritas</p>
        </div>
      </div>

      <style>{`
        .login-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: #0b0e14;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          background-image: 
            radial-gradient(circle at 20% 20%, rgba(212, 175, 55, 0.05) 0%, transparent 40%),
            radial-gradient(circle at 80% 80%, rgba(212, 175, 55, 0.05) 0%, transparent 40%);
        }
        .login-card {
          width: 400px;
          text-align: center;
          padding: 3rem;
          animation: slideIn 0.5s ease-out;
        }
        .login-content {
          margin: 2rem 0;
        }
        .login-content p {
          color: var(--text-secondary);
          font-size: 0.9rem;
          margin-bottom: 2rem;
        }
        .google-login-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          background: white;
          color: #374151;
          transition: all 0.3s;
        }
        .google-login-btn:hover {
          background: #f9fafb;
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        .login-error {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.3);
          color: #f87171;
          border-radius: 12px;
          padding: 0.8rem 1.2rem;
          font-size: 0.85rem;
          margin-bottom: 1rem;
        }
        .login-footer {
          margin-top: 2rem;
          font-size: 0.7rem;
          color: var(--text-secondary);
          opacity: 0.5;
        }
      `}</style>
    </div>
  );
};

export default Login;
