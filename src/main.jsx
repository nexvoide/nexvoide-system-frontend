import React from "react";
import { createRoot } from "react-dom/client";
import App from "./pages/App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import "./index.css";

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  // Register immediately, don't wait for load
  navigator.serviceWorker.register('/sw.js', { scope: '/' })
    .then((registration) => {
      console.log('✅ Service Worker registered successfully:', registration.scope);
      
      // Check for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New service worker available, prompt user to refresh
              if (confirm('A new version is available! Would you like to refresh?')) {
                window.location.reload();
              }
            }
          });
        }
      });
    })
    .catch((error) => {
      console.warn('⚠️ Service Worker registration failed:', error);
      console.warn('Error details:', error.message);
    });
}

// Handle PWA install prompt - store globally for PWAInstallPrompt component
window.deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered later
  window.deferredPrompt = e;
  console.log('📱 PWA install prompt available');
  
  // Dispatch custom event for PWAInstallPrompt component
  window.dispatchEvent(new CustomEvent('pwa-install-available'));
});

// Track when app is installed
window.addEventListener('appinstalled', () => {
  console.log('🎉 PWA was installed');
  window.deferredPrompt = null;
});

const container = document.getElementById("root");
if (!container) {
  console.error("Root container not found!");
} else {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
}


