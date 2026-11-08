import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppContent } from './App';
import { AppProvider } from './context/AppContext';
import './index.css';

// Register Service Worker for Offline App Shell & Self-Hosted Fonts
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('[CampusSync] Service Worker registered successfully:', reg.scope);
      })
      .catch((err) => {
        console.error('[CampusSync] Service Worker registration failed:', err);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <AppContent />
    </AppProvider>
  </React.StrictMode>
);
