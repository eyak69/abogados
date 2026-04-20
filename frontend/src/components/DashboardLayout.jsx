import Header from './Header';

export default function DashboardLayout({ children }) {
  return (
    <div className="app-container">
      <Header />
      <main className="bento-grid">
        {children}
      </main>
      <footer className="app-footer">
        <p>© 2026 Abogados & Asociados - Sistema de Inteligencia Legal Confidencial</p>
      </footer>
    </div>
  );
}
