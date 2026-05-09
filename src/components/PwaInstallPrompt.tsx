"use client";
import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosPrompt, setShowIosPrompt] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already running as PWA
    const standalone = window.matchMedia("(display-mode: standalone)").matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
    if (standalone) return;

    // Check if previously dismissed
    if (localStorage.getItem("pwa-install-dismissed")) {
      setDismissed(true);
      return;
    }

    // Android/Desktop: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS detection
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /safari/i.test(navigator.userAgent) && !/chrome|crios|fxios/i.test(navigator.userAgent);
    if (isIos && isSafari) {
      setShowIosPrompt(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  }

  function handleDismiss() {
    setDismissed(true);
    setDeferredPrompt(null);
    setShowIosPrompt(false);
    localStorage.setItem("pwa-install-dismissed", "1");
  }

  if (isStandalone || dismissed) return null;
  if (!deferredPrompt && !showIosPrompt) return null;

  return (
    <div className="bg-primary-50 border border-primary-200 rounded-2xl p-4 flex items-start gap-3">
      <div className="shrink-0 w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center">
        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        {deferredPrompt ? (
          <>
            <p className="text-sm font-medium text-primary-800">Instalá Nivelo en tu dispositivo</p>
            <p className="text-xs text-primary-600 mt-0.5">Accedé más rápido desde tu pantalla de inicio.</p>
            <div className="flex gap-2 mt-3">
              <button onClick={handleInstall}
                className="bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition">
                Instalar
              </button>
              <button onClick={handleDismiss}
                className="text-primary-600 text-sm font-medium px-4 py-1.5 hover:bg-primary-100 rounded-lg transition">
                Ahora no
              </button>
            </div>
          </>
        ) : showIosPrompt ? (
          <>
            <p className="text-sm font-medium text-primary-800">Instalá Nivelo en tu iPhone</p>
            <p className="text-xs text-primary-600 mt-0.5">
              Tocá el botón <span className="inline-block align-middle">
                <svg className="w-4 h-4 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              </span> Compartir y luego <strong>&quot;Agregar a pantalla de inicio&quot;</strong>.
            </p>
            <button onClick={handleDismiss}
              className="text-primary-600 text-xs font-medium mt-2 hover:underline">
              Entendido
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
