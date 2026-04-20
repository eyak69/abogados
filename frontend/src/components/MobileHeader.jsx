import React from 'react';

export default function MobileHeader({ onOpenMenu }) {
  return (
    <div className="mobile-top-bar">
      <div className="mobile-logo">
        Lex <span>Crystal</span>
      </div>
      <button className="hamburger-btn" onClick={onOpenMenu} aria-label="Abrir menú">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="12" x2="21" y2="12"></line>
          <line x1="3" y1="6" x2="21" y2="6"></line>
          <line x1="3" y1="18" x2="21" y2="18"></line>
        </svg>
      </button>
    </div>
  );
}
