import React, { useState } from 'react';
import MobileHeader from './MobileHeader';

export default function DashboardLayout({ sidebar, children }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className="app-container">
      {/* Solo visible en mobile via CSS */}
      <MobileHeader onOpenMenu={toggleSidebar} />

      {/* Overlay para cerrar al tocar fuera */}
      <div 
        className={`sidebar-overlay ${isSidebarOpen ? 'visible' : ''}`} 
        onClick={closeSidebar}
      />

      <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        {sidebar}
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}

