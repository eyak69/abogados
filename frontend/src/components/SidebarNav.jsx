import React from 'react';
import Header from './Header';
import FileUpload from './FileUpload';
import StatusTracker from './StatusTracker';
import { useAuth } from '../context/AuthContext';

export default function SidebarNav({ activeView, onViewChange }) {
  const { logout, user } = useAuth();

  return (
    <div className="sidebar-nav-container">
      <Header />
      
      <nav className="nav-menu">
        <button 
          className={`nav-item ${activeView === 'chat' ? 'active' : ''}`}
          onClick={() => onViewChange('chat')}
        >
          <span className="icon">💬</span>
          <span className="label">Chat Jurídico</span>
        </button>

        <button 
          className={`nav-item ${activeView === 'repositorio' ? 'active' : ''}`}
          onClick={() => onViewChange('repositorio')}
        >
          <span className="icon">📚</span>
          <span className="label">Repositorio</span>
        </button>

        {user?.role === 'EDITOR' && (
          <button 
            className={`nav-item ${activeView === 'cargas' ? 'active' : ''}`}
            onClick={() => onViewChange('cargas')}
          >
            <span className="icon">📟</span>
            <span className="label">Cargas & Logs</span>
          </button>
        )}
      </nav>

      <div className="sidebar-tools">
        {/* Los estados de carga se gestionan ahora íntegramente en el módulo "Cargas & Logs" */}
      </div>




      <div className="sidebar-footer">
        <div className="user-mini-info">
          <div className="user-avatar">
            {user?.picture ? (
              <img src={user.picture} alt={user.name} className="user-photo" />
            ) : (
              user?.name?.charAt(0) || 'U'
            )}
          </div>
          <div className="user-details">
            <span className="user-name">{user?.name}</span>
            <span className="user-role">{user?.role}</span>
          </div>
        </div>
        <button className="btn-logout-minimal" onClick={logout} title="Cerrar Sesión">
          🚪
        </button>
      </div>

      <style>{`
        .sidebar-nav-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          gap: 2rem;
        }
        .nav-menu {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.2rem;
          background: rgba(255,255,255,0.02);
          border: 1px solid transparent;
          border-radius: 14px;
          color: var(--sys-color-on-surface-variant);
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1);
          text-align: left;
          font-family: var(--font-sans);
          font-weight: 500;
        }
        .nav-item:hover {
          background: rgba(255,255,255,0.05);
          color: var(--sys-color-on-surface);
          transform: translateX(5px);
        }
        .nav-item.active {
          background: var(--sys-color-surface-bright);
          border-color: var(--sys-color-primary-container);
          color: var(--sys-color-primary);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        }
        .nav-item .icon {
          font-size: 1.2rem;
          filter: grayscale(1);
          transition: filter 0.3s;
        }
        .nav-item.active .icon {
          filter: grayscale(0);
        }
        .sidebar-tools {
          flex-grow: 1;
        }
        .sidebar-footer {
          margin-top: auto;
          padding: 1.2rem;
          background: var(--sys-color-surface-container);
          border-radius: 20px;
          border: 1px solid var(--sys-color-outline-variant);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .user-mini-info {
          display: flex;
          align-items: center;
          gap: 0.8rem;
        }
        .user-avatar {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: var(--sys-color-primary);
          color: var(--sys-color-on-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.2rem;
          box-shadow: 0 10px 20px rgba(0,0,0,0.3);
          overflow: hidden; /* Asegura que la foto no se salga del radio */
        }
        .user-photo {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .user-details {
          display: flex;
          flex-direction: column;
        }
        .user-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--sys-color-on-surface);
        }
        .user-role {
          font-size: 0.65rem;
          color: var(--sys-color-primary);
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 600;
          opacity: 0.8;
        }
        .btn-logout-minimal {
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--sys-color-outline-variant);
          width: 34px;
          height: 34px;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s;
        }
        .btn-logout-minimal:hover {
          background: var(--status-error);
          color: white;
          transform: rotate(90deg);
        }
      `}</style>
    </div>
  );
}
