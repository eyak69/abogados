export default function DashboardLayout({ sidebar, children }) {
  return (
    <div className="app-container">
      <aside className="sidebar">
        {sidebar}
      </aside>
      <main className="chat-main">
        <header className="chat-header">
           <h2>Expediente Activo: <span>General</span></h2>
           <div className="user-profile">
              <span className="node-info">v2.1 Stable</span>
           </div>
        </header>
        {children}
      </main>
    </div>
  );
}
