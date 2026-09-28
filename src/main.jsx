import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    const isLocalhost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

    if (isLocalhost) {
      // Development must depend on the Vite server only. Remove any old PWA worker/cache
      // that could otherwise make localhost look available after the dev server is closed.
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(registration => registration.unregister()));
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.filter(name => name.startsWith('br-telecom-shell-')).map(name => caches.delete(name)));
        }
      } catch (_) {}
      return;
    }

    navigator.serviceWorker.register('/sw.js').catch(()=>{});
  });
}

