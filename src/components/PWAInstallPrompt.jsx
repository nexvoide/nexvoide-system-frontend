import React, { useState, useEffect } from 'react';
import { X, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches || 
        window.navigator.standalone === true ||
        (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)) {
      setIsInstalled(true);
      return;
    }

    // Check if deferredPrompt is already available
    if (window.deferredPrompt) {
      setDeferredPrompt(window.deferredPrompt);
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setTimeout(() => {
          setShowPrompt(true);
        }, 3000);
      }
    }

    // Listen for custom event from main.jsx
    const handleInstallAvailable = () => {
      if (window.deferredPrompt) {
        setDeferredPrompt(window.deferredPrompt);
        const dismissed = localStorage.getItem('pwa-install-dismissed');
        if (!dismissed) {
          setTimeout(() => {
            setShowPrompt(true);
          }, 3000);
        }
      }
    };

    // Listen for beforeinstallprompt event (fallback)
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      window.deferredPrompt = e;
      setDeferredPrompt(e);
      
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) {
        setTimeout(() => {
          setShowPrompt(true);
        }, 3000);
      }
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
      window.deferredPrompt = null;
      localStorage.removeItem('pwa-install-dismissed');
    };

    window.addEventListener('pwa-install-available', handleInstallAvailable);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('pwa-install-available', handleInstallAvailable);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    const prompt = deferredPrompt || window.deferredPrompt;
    if (!prompt) return;

    try {
      // Show the install prompt
      await prompt.prompt();

      // Wait for the user to respond
      const { outcome } = await prompt.userChoice;

      if (outcome === 'accepted') {
        console.log('✅ User accepted the install prompt');
      } else {
        console.log('❌ User dismissed the install prompt');
      }
    } catch (error) {
      console.error('Error showing install prompt:', error);
    }

    // Clear the deferred prompt
    setDeferredPrompt(null);
    window.deferredPrompt = null;
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  // Don't show if already installed or no prompt available
  if (isInstalled || !showPrompt || (!deferredPrompt && !window.deferredPrompt)) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
      >
        <div className="glass rounded-2xl p-4 shadow-2xl border border-slate-200/20 dark:border-slate-800/50">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 p-2 rounded-xl bg-blue-500/20">
              <Download size={20} className="text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
                Install Nexvoide App
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                Install our app for a better experience. Access it quickly from your home screen!
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleInstall}
                  className="btn btn-primary text-xs px-4 py-2 touch-manipulation"
                >
                  <Download size={14} className="mr-1.5" />
                  Install Now
                </button>
                <button
                  onClick={handleDismiss}
                  className="btn btn-secondary text-xs px-3 py-2 touch-manipulation"
                >
                  Maybe Later
                </button>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close"
            >
              <X size={16} className="text-slate-500 dark:text-slate-400" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}


