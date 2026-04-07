'use client';

import { useState, useEffect } from 'react';
import { 
  Bell, 
  Trash2, 
  Moon, 
  Sun, 
  Monitor, 
  Info, 
  Wifi, 
  WifiOff, 
  RefreshCw,
  ChevronRight,
  ShieldCheck,
  Zap,
  HardDrive
} from 'lucide-react';
import { useTheme } from 'next-themes';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [isStandalone, setIsStandalone] = useState(false);
  const [cacheSize, setCacheSize] = useState<string>('Calculating...');
  const [isClearing, setIsClearing] = useState(false);

  // Avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    setIsOnline(navigator.onLine);
    
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }

    // Check if app is installed (standalone)
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);

    // Calculate cache size (rough estimate)
    calculateCacheSize();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const calculateCacheSize = async () => {
    if (!('caches' in window)) {
      setCacheSize('Not supported');
      return;
    }

    try {
      const keys = await caches.keys();
      let size = 0;
      for (const key of keys) {
        const cache = await caches.open(key);
        const requests = await cache.keys();
        for (const request of requests) {
          const response = await cache.match(request);
          if (response) {
            const blob = await response.blob();
            size += blob.size;
          }
        }
      }
      setCacheSize(`${(size / (1024 * 1024)).toFixed(1)} MB`);
    } catch (e) {
      setCacheSize('Unknown');
    }
  };

  const handleClearCache = async () => {
    if (!confirm('Are you sure you want to clear the app cache? This will redownload all assets on next visit.')) return;
    
    setIsClearing(true);
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
      
      // Also clear storage if needed, but usually cache is enough for PWA assets
      // localStorage.clear(); 
      
      await calculateCacheSize();
      alert('Cache cleared successfully!');
      window.location.reload();
    } catch (error) {
      console.error('Error clearing cache:', error);
      alert('Failed to clear cache.');
    } finally {
      setIsClearing(false);
    }
  };

  const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support desktop notifications');
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    
    if (permission === 'granted') {
      new Notification('Notifications Enabled', {
        body: 'You will now receive real-time updates for GeM tenders.',
        icon: '/favicon.png'
      });
    }
  };

  const handleUpdateCheck = async () => {
    if (!('serviceWorker' in navigator)) return;
    
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
      alert('Checking for updates... If a new version is available, you will see a prompt or the app will refresh.');
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  };

  if (!mounted) return null;

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 pt-24 pb-12 px-4">
      <div className="max-w-3xl mx-auto">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            Settings
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            Configure your app experience and manage your PWA data.
          </p>
        </header>

        <div className="space-y-6">
          {/* Notifications Section */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
                <Bell className="w-5 h-5 text-blue-500" />
                Notifications
              </h2>
              
              <div className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Push Notifications</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Receive real-time alerts for matched tenders</p>
                </div>
                <button 
                  onClick={requestNotificationPermission}
                  disabled={notificationPermission === 'granted'}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                    notificationPermission === 'granted' 
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 cursor-default'
                      : 'bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg active:scale-95'
                  }`}
                >
                  {notificationPermission === 'granted' ? 'Enabled' : 'Enable'}
                </button>
              </div>

              {notificationPermission === 'denied' && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-xl flex items-start gap-3">
                  <Info className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Notifications are currently blocked. Please reset permission in your browser settings to receive alerts.
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Performance & Storage Section */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
                <HardDrive className="w-5 h-5 text-indigo-500" />
                Storage & Performance
              </h2>
              
              <div className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Offline Cache</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Current app size in local storage: <span className="font-semibold text-indigo-600 dark:text-indigo-400">{cacheSize}</span></p>
                </div>
                <button 
                  onClick={handleClearCache}
                  disabled={isClearing}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isClearing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Clear Cache
                </button>
              </div>

              <div className="flex items-center justify-between py-4">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Offline Availability</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 font-mono">
                    {isOnline ? (
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <Wifi className="w-3 h-3" /> Online - Updates fetching
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <WifiOff className="w-3 h-3" /> Offline - Using cached data
                      </span>
                    )}
                  </p>
                </div>
                <div className={`w-3 h-3 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-amber-500'} animate-pulse`} />
              </div>
            </div>
          </section>

          {/* Appearance Section */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
                <Sun className="w-5 h-5 text-amber-500" />
                Appearance
              </h2>
              
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => setTheme('light')}
                  className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    theme === 'light' 
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-500/5' 
                      : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <Sun className={`w-6 h-6 ${theme === 'light' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium ${theme === 'light' ? 'text-blue-600' : 'text-slate-500'}`}>Light</span>
                </button>

                <button
                  onClick={() => setTheme('dark')}
                  className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    theme === 'dark' 
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-500/5' 
                      : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <Moon className={`w-6 h-6 ${theme === 'dark' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium ${theme === 'dark' ? 'text-blue-600' : 'text-slate-500'}`}>Dark</span>
                </button>

                <button
                  onClick={() => setTheme('system')}
                  className={`flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all ${
                    theme === 'system' 
                      ? 'border-blue-600 bg-blue-50/50 dark:bg-blue-500/5' 
                      : 'border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <Monitor className={`w-6 h-6 ${theme === 'system' ? 'text-blue-600' : 'text-slate-400'}`} />
                  <span className={`text-sm font-medium ${theme === 'system' ? 'text-blue-600' : 'text-slate-500'}`}>System</span>
                </button>
              </div>
            </div>
          </section>

          {/* About Section */}
          <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
                <Info className="w-5 h-5 text-slate-500" />
                About App
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">App Version</span>
                  <span className="font-mono font-medium text-slate-900 dark:text-white">v1.2.0-stable</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Installation Status</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                    isStandalone 
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' 
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}>
                    {isStandalone ? 'Installed as App' : 'Browser Access'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Secured with</span>
                  <span className="flex items-center gap-1 font-medium text-slate-900 dark:text-white">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" /> HTTPS / SSL
                  </span>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                <button 
                  onClick={handleUpdateCheck}
                  className="w-full flex items-center justify-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  Check for Updates
                </button>
              </div>
            </div>
          </section>

          <p className="text-center text-xs text-slate-400 py-4">
            &copy; 2026 GeMTenders.org. Built with ❤️ for Indian Businesses.
          </p>
        </div>
      </div>
    </main>
  );
}
