import { useEffect, useState } from 'react';

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
const isMobileDevice = () => /android|iphone|ipad|ipod/i.test(window.navigator.userAgent || '');

export default function InstallPromptBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (event) => {
      if (isStandalone() || !isMobileDevice()) {
        return;
      }
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const handleInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    if (isStandalone()) {
      setInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (!deferredPrompt || dismissed || installed) {
    return null;
  }

  const install = async () => {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    } else {
      setDismissed(true);
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 rounded-2xl border border-gray-200 bg-white p-4 shadow-lg sm:left-auto sm:right-6 sm:w-80">
      <div className="font-semibold text-sm text-gray-900">Install SawConnect</div>
      <p className="mt-1 text-xs text-gray-600">
        Add SawConnect to your home screen for faster access and instant notifications when new jobs go live.
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => { setDismissed(true); setDeferredPrompt(null); }}
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-600"
        >
          Not now
        </button>
        <button
          onClick={install}
          className="flex-1 rounded-lg bg-gray-900 px-3 py-2 text-xs font-semibold text-white"
        >
          Install
        </button>
      </div>
    </div>
  );
}
