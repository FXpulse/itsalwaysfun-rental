"use client";

import { useEffect, useState } from "react";
import { Download, Check, Apple, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

type Platform = "android-eligible" | "android-pending" | "ios" | "installed" | "desktop" | "other";

export function InstallButton() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>("other");
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setPlatform("installed");
      setInstalled(true);
      return;
    }

    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua) && !(/crios|fxios/.test(ua));
    const isAndroid = /android/.test(ua);
    const isMobile = isIOS || isAndroid;

    if (isIOS) {
      setPlatform("ios");
      return;
    }
    if (isAndroid) {
      setPlatform("android-pending"); // waiting for beforeinstallprompt
    } else if (!isMobile) {
      setPlatform("desktop");
    }

    function handler(e: Event) {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setPlatform("android-eligible");
    }
    window.addEventListener("beforeinstallprompt", handler);

    // Detect successful install
    function installedHandler() {
      setInstalled(true);
      setPlatform("installed");
    }
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  async function handleInstall() {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      setPlatform("installed");
    }
  }

  if (installed) {
    return (
      <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-6 text-center">
        <Check className="h-12 w-12 mx-auto text-emerald-600 mb-3" />
        <h2 className="text-xl font-bold text-emerald-900 mb-1">App installed!</h2>
        <p className="text-sm text-emerald-800">
          Look for the It's Always Fun icon on your home screen.
        </p>
      </div>
    );
  }

  if (platform === "android-eligible") {
    return (
      <div className="bg-brand-navy text-white rounded-2xl p-6 text-center shadow-xl">
        <Smartphone className="h-12 w-12 mx-auto text-brand-yellow mb-3" />
        <h2 className="text-xl font-bold mb-2">Ready to install</h2>
        <p className="text-sm text-white/80 mb-4">
          Tap the button below to add It's Always Fun to your home screen.
        </p>
        <button
          onClick={handleInstall}
          className="bg-brand-yellow text-brand-navy font-bold rounded-lg px-6 py-3 inline-flex items-center gap-2 hover:bg-yellow-300 transition"
        >
          <Download className="h-5 w-5" />
          Install app
        </button>
      </div>
    );
  }

  if (platform === "ios") {
    return (
      <div className="bg-brand-navy text-white rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <Apple className="h-6 w-6 text-brand-yellow" />
          <h2 className="text-xl font-bold">Install on iPhone / iPad</h2>
        </div>
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="bg-brand-yellow text-brand-navy font-bold rounded-full h-6 w-6 flex items-center justify-center shrink-0">1</span>
            <span>
              Tap the <strong>Share</strong> button{" "}
              <span className="inline-block align-text-bottom">
                <svg viewBox="0 0 24 24" fill="none" className="inline h-4 w-4">
                  <path d="M12 3v12m0-12l-4 4m4-4l4 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>{" "}
              at the bottom of Safari
            </span>
          </li>
          <li className="flex gap-3">
            <span className="bg-brand-yellow text-brand-navy font-bold rounded-full h-6 w-6 flex items-center justify-center shrink-0">2</span>
            <span>
              Scroll down and tap <strong>"Add to Home Screen"</strong>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="bg-brand-yellow text-brand-navy font-bold rounded-full h-6 w-6 flex items-center justify-center shrink-0">3</span>
            <span>
              Tap <strong>"Add"</strong> in the top right
            </span>
          </li>
        </ol>
        <p className="text-[11px] text-white/60 mt-4 border-t border-white/10 pt-3">
          Note: iOS only supports this through Safari (not Chrome or Firefox).
        </p>
      </div>
    );
  }

  if (platform === "android-pending") {
    return (
      <div className="bg-brand-navy text-white rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <Smartphone className="h-6 w-6 text-brand-yellow" />
          <h2 className="text-xl font-bold">Install on Android</h2>
        </div>
        <ol className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="bg-brand-yellow text-brand-navy font-bold rounded-full h-6 w-6 flex items-center justify-center shrink-0">1</span>
            <span>
              Tap the <strong>three dots ⋮</strong> in the top right of Chrome
            </span>
          </li>
          <li className="flex gap-3">
            <span className="bg-brand-yellow text-brand-navy font-bold rounded-full h-6 w-6 flex items-center justify-center shrink-0">2</span>
            <span>
              Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>
            </span>
          </li>
          <li className="flex gap-3">
            <span className="bg-brand-yellow text-brand-navy font-bold rounded-full h-6 w-6 flex items-center justify-center shrink-0">3</span>
            <span>
              Tap <strong>"Install"</strong> on the confirmation
            </span>
          </li>
        </ol>
        <p className="text-[11px] text-white/60 mt-4 border-t border-white/10 pt-3">
          If you don't see "Install app", stay on this page for a few seconds — Chrome needs to recognize the site first.
        </p>
      </div>
    );
  }

  // Desktop
  return (
    <div className="bg-slate-100 border-2 border-slate-200 rounded-2xl p-6 text-center">
      <Smartphone className="h-12 w-12 mx-auto text-slate-400 mb-3" />
      <h2 className="text-xl font-bold text-slate-700 mb-1">Open this page on your phone</h2>
      <p className="text-sm text-slate-600">
        The app is designed for mobile use. Open <code className="bg-white px-1.5 py-0.5 rounded text-xs">itsalwaysfun.net/app</code> in your phone's browser to install.
      </p>
    </div>
  );
}
