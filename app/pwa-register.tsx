'use client';

import { useEffect, useState } from 'react';

/**
 * PWA Registration Component
 * Registers the service worker and handles PWA installation/update flows
 */
export default function PWARegister() {
  const [isOnline, setIsOnline] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Set initial online status
    setIsOnline(navigator.onLine);

    // Track online/offline status
    const handleOnline = () => {
      setIsOnline(true);
      console.log('[PWA] App is online');
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('[PWA] App is offline');
    };

    const handleBeforeInstallPrompt = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      console.log('[PWA] beforeinstallprompt event intercepted. Delaying prompt...');
      
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);

      // Delay showing our custom install banner (60 seconds)
      const timer = setTimeout(() => {
        const dismissed = localStorage.getItem('pwa_install_dismissed');
        if (!dismissed) {
          setShowInstallBanner(true);
        }
      }, 60000);

      return () => clearTimeout(timer);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Register service worker
    registerServiceWorker();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  /**
   * Register the service worker
   */
  const registerServiceWorker = async () => {
    // Check if service workers are supported
    if (!('serviceWorker' in navigator)) {
      console.log('[PWA] Service Workers not supported');
      return;
    }

    try {
      console.log('[PWA] Registering service worker...');
      const registration = await navigator.serviceWorker.register('/service-worker.js', {
        scope: '/',
      });

      console.log('[PWA] Service Worker registered successfully:', registration);

      // Check for updates periodically
      setInterval(() => {
        registration.update();
      }, 60000); // Check every 60 seconds

      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New service worker available
            console.log('[PWA] Update available');
            setUpdateAvailable(true);

            // Optionally show notification
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification('GeMTenders Update Available', {
                body: 'A new version is available. Refresh to update.',
                icon: '/favicon.png',
              });
            }
          }
        });
      });

      // Handle controller change (new SW activated)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] New service worker activated');
      });
    } catch (error) {
      console.error('[PWA] Service Worker registration failed:', error);
    }
  };

  /**
   * Reload the app to activate new service worker
   */
  const handleReload = () => {
    window.location.reload();
  };

  /**
   * Trigger the PWA installation
   */
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] User response to install prompt: ${outcome}`);

    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setShowInstallBanner(false);
  };

  /**
   * Dismiss the install banner
   */
  const dismissInstallBanner = () => {
    localStorage.setItem('pwa_install_dismissed', 'true');
    setShowInstallBanner(false);
    setIsDismissed(true);
  };

  // Only show update notification in development
  if (updateAvailable && process.env.NODE_ENV === 'development') {
    return (
      <div className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50">
        <span className="text-sm">Update available</span>
        <button
          onClick={handleReload}
          className="font-semibold hover:bg-blue-700 px-2 py-1 rounded text-xs transition-colors"
        >
          Reload
        </button>
      </div>
    );
  }

  // Show custom PWA install banner
  if (showInstallBanner && !isDismissed) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-2xl z-[100] animate-in slide-in-from-bottom-5 duration-500">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
            <svg className="w-6 h-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Install GeMTenders App</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Get instant alerts and access tenders faster from your home screen.
            </p>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleInstallClick}
                className="flex-1 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold py-2 px-3 rounded-lg transition-colors"
              >
                Install Now
              </button>
              <button
                onClick={dismissInstallBanner}
                className="px-3 py-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
