'use client';

import { useEffect, useState } from 'react';

/**
 * PWA Registration Component
 * Registers the service worker and handles PWA installation/update flows
 */
export default function PWARegister() {
  const [isOnline, setIsOnline] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState(false);

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
      // e.preventDefault();
      console.log('[PWA] beforeinstallprompt event fired. The app is officially installable.');
      // Stash the event so it can be triggered later if you have a custom install button
      // setDeferredPrompt(e);
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

  return null;
}
