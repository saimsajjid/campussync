import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppContent } from './App';
import { AppProvider } from './context/AppContext';
import './index.css';

import { registerSW } from 'virtual:pwa-register';

// Register Service Worker via Workbox / vite-plugin-pwa with build-generated precache
const updateSW = registerSW({
  onNeedRefresh() {
    console.log('[CampusSync PWA] New version detected! Refreshing app shell...');
    updateSW(true);
  },
  onOfflineReady() {
    console.log('[CampusSync PWA] App shell precached with hashed assets. Offline ready.');
  },
  onRegistered(r) {
    console.log('[CampusSync PWA] Service Worker registered successfully:', r?.scope);
  },
  onRegisterError(err) {
    console.error('[CampusSync PWA] Service Worker registration failed:', err);
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <AppContent />
    </AppProvider>
  </React.StrictMode>
);
