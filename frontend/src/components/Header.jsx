export default function Header() {
  return (
    <header className="brand-header">
      <div className="logo-container">
        <h1>VERITAS <span>LEGAL</span></h1>
        <div className="badge">AI PROXY v2.0</div>
      </div>
      <div className="header-meta">
        <span className="status-dot"></span>
        <span className="node-info">Secure Node: n8n-cluster-01</span>
      </div>
    </header>
  );
}
