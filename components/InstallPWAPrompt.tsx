"use client";

import { useState, useEffect } from "react";
import { Download, X, Apple } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

/** Install-as-PWA prompt. Auto-dismisses if user installed or already
 *  running as installed PWA. Persists "later" choice for 7 days. */
export function InstallPWAPrompt({ label = "Install this as an app" }: { label?: string }) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Already running as installed PWA? skip
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) return;

    // Recently dismissed? skip for 7 days
    const dismissedAt = localStorage.getItem("pwa_install_dismissed_at");
    if (dismissedAt && Date.now() - parseInt(dismissedAt, 10) < 7 * 86400000) return;

    // iOS Safari: no beforeinstallprompt — show our own helper
    const ua = navigator.userAgent.toLowerCase();
    const iOS = /iphone|ipad|ipod/.test(ua) && !(/crios|fxios/.test(ua)); // exclude Chrome/Firefox on iOS
    if (iOS) {
      setIsIOS(true);
      setShow(true);
      return;
    }

    // Android / Desktop Chrome: native event
    function handler(e: Event) {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setShow(true);
    }
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    localStorage.setItem("pwa_install_dismissed_at", String(Date.now()));
    setShow(false);
  }

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setShow(false);
    } else {
      dismiss();
    }
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-md bg-brand-navy text-white rounded-lg shadow-2xl p-4 border border-white/10">
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-2 right-2 text-white/60 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <div className="bg-brand-yellow text-brand-navy rounded-lg p-2 flex-shrink-0">
          <Download className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-sm">{label}</h3>
          {isIOS ? (
            <p className="text-xs text-white/80 mt-1">
              Tap <strong>Share</strong>{" "}
              <span className="inline-block align-text-bottom">
                <svg viewBox="0 0 24 24" fill="none" className="inline h-3.5 w-3.5">
                  <path d="M12 3v12m0-12l-4 4m4-4l4 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>{" "}
              at the bottom, then <strong>"Add to Home Screen"</strong>. Opens
              full-screen + works offline.
            </p>
          ) : (
            <p className="text-xs text-white/80 mt-1">
              Get the app icon on your home screen. Opens full-screen, loads
              instant, works offline at venues with bad signal.
            </p>
          )}
          {!isIOS && (
            <div className="mt-2 flex gap-2">
              <button
                onClick={install}
                className="bg-brand-yellow text-brand-navy text-xs font-bold rounded px-3 py-1.5 hover:bg-yellow-300"
              >
                Install
              </button>
              <button
                onClick={dismiss}
                className="text-xs text-white/60 hover:text-white px-2"
              >
                Maybe later
              </button>
            </div>
          )}
          {isIOS && (
            <p className="text-[10px] text-white/50 mt-2 inline-flex items-center gap-1">
              <Apple className="h-3 w-3" /> iOS only supports this through Safari
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
