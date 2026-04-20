import { APP_VERSION } from '../version.js';

export default function Header() {
  return (
    <header className="brand-header">
      <div className="logo-container">
        <h1>VERITAS <span className="gold-italic">LEGAL</span></h1>
        <div className="version-badge">v{APP_VERSION}</div>
      </div>
      <div className="header-meta">
        <div className="connection-status">
          <span className="dot pulse"></span>
          <span className="status-text">Nodo Seguro</span>
        </div>
      </div>
      <style>{`
        .brand-header {
          padding: 1.5rem 0;
          border-bottom: 1px solid var(--glass-border);
          margin-bottom: 1rem;
        }
        .logo-container h1 {
          font-family: var(--font-serif);
          font-size: 1.6rem;
          margin: 0;
          letter-spacing: 2px;
          color: var(--text-primary);
        }
        .gold-italic {
          color: var(--accent-gold);
          font-style: italic;
          font-weight: 300;
        }
        .version-badge {
          font-size: 0.6rem;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: var(--accent-gold);
          opacity: 0.7;
          margin-top: 0.2rem;
          font-weight: 700;
        }
        .connection-status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 1rem;
        }
        .dot {
          width: 6px;
          height: 6px;
          background: var(--status-success);
          border-radius: 50%;
          box-shadow: 0 0 10px var(--status-success);
        }
        .dot.pulse {
          animation: statusPulse 2s infinite;
        }
        .status-text {
          font-size: 0.65rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        @keyframes statusPulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.5); opacity: 0.5; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </header>
  );
}
