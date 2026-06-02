"use client";

import { useEffect, useState } from "react";
import { Download, Check, X, Apple, Smartphone, MoreVertical, Plus, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<void>;
}

type Device = "ios-safari" | "ios-other" | "android-chrome" | "android-other" | "desktop";

function detectDevice(): Device {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  const isChromeOnIOS = /crios/.test(ua);
  const isChromeOnAndroid = /chrome/.test(ua) && !/edg|opr|samsungbrowser/.test(ua);

  if (isIOS && !isChromeOnIOS) return "ios-safari";
  if (isIOS) return "ios-other";
  if (isAndroid && isChromeOnAndroid) return "android-chrome";
  if (isAndroid) return "android-other";
  return "desktop";
}

export function InstallButton({
  businessName = "It's Always Fun",
  logoUrl = null,
}: {
  businessName?: string;
  logoUrl?: string | null;
}) {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [device, setDevice] = useState<Device>("desktop");
  const [installed, setInstalled] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    setDevice(detectDevice());

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setInstalled(true);
      return;
    }

    function handler(e: Event) {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handler);

    function installedHandler() {
      setInstalled(true);
    }
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  async function handleClick() {
    // If Chrome captured the install event, use it directly
    if (installEvent) {
      try {
        await installEvent.prompt();
        const choice = await installEvent.userChoice;
        if (choice.outcome === "accepted") {
          setInstalled(true);
        }
        return;
      } catch (e) {
        console.error("Install prompt failed:", e);
      }
    }
    // Otherwise show modal with manual instructions
    setShowModal(true);
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

  return (
    <>
      {/* Always-visible install card */}
      <div className="bg-gradient-to-br from-brand-navy via-indigo-900 to-violet-900 text-white rounded-2xl p-6 text-center shadow-2xl">
        {logoUrl ? (
          <div className="inline-block bg-white rounded-2xl p-3 mb-4 shadow-lg">
            <img
              src={logoUrl}
              alt={businessName}
              className="h-16 w-auto max-w-[180px] object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        ) : (
          <div className="inline-block bg-brand-yellow text-brand-navy rounded-2xl p-4 mb-4 shadow-lg font-bold text-2xl">
            {businessName.split(" ").map((w) => w[0]).join("").slice(0, 3)}
          </div>
        )}
        <h2 className="text-2xl font-bold mb-2">{businessName}</h2>
        <p className="text-sm text-white/80 mb-5">
          Tap below to add the app to your home screen
        </p>
        <button
          onClick={handleClick}
          className="bg-brand-yellow text-brand-navy font-bold rounded-xl px-8 py-4 inline-flex items-center gap-2 hover:bg-yellow-300 transition shadow-lg text-base w-full sm:w-auto"
        >
          <Download className="h-5 w-5" />
          {installEvent ? "Install now" : "Get the app"}
        </button>
        {!installEvent && (
          <p className="text-[11px] text-white/50 mt-3">
            We'll show you how based on your phone
          </p>
        )}
      </div>

      {/* Modal with platform-specific instructions */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h2 className="font-bold text-brand-navy text-lg">How to install</h2>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5">
              {(device === "ios-safari" || device === "ios-other") && (
                <IOSInstructions chromeOnIOS={device === "ios-other"} />
              )}
              {(device === "android-chrome" || device === "android-other") && (
                <AndroidInstructions />
              )}
              {device === "desktop" && <DesktopInstructions />}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function IOSInstructions({ chromeOnIOS }: { chromeOnIOS: boolean }) {
  return (
    <div>
      {chromeOnIOS && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4 text-xs text-amber-900">
          <strong>⚠️ You're using Chrome on iOS.</strong> Chrome on iPhone/iPad can't install apps —
          you need to open this page in <strong>Safari</strong>. Tap the address bar, copy the URL,
          paste it in Safari, then follow the steps below.
        </div>
      )}
      <ol className="space-y-4">
        <Step n={1} icon={<Share className="h-5 w-5 text-blue-500" />}>
          Tap the <strong>Share</strong> button{" "}
          <span className="inline-block align-middle">
            <Share className="inline h-4 w-4 text-blue-500" />
          </span>{" "}
          at the bottom of Safari
        </Step>
        <Step n={2} icon={<Plus className="h-5 w-5 text-slate-500" />}>
          Scroll down and tap <strong>"Add to Home Screen"</strong>
        </Step>
        <Step n={3} icon={<Check className="h-5 w-5 text-emerald-600" />}>
          Tap <strong>"Add"</strong> in the top-right corner
        </Step>
      </ol>
      <p className="text-[11px] text-slate-500 mt-4 pt-3 border-t border-slate-100">
        <Apple className="inline h-3 w-3 mr-1" />
        iOS only supports install through Safari (not Chrome or Firefox).
      </p>
    </div>
  );
}

function AndroidInstructions() {
  return (
    <div>
      <ol className="space-y-4">
        <Step n={1} icon={<MoreVertical className="h-5 w-5 text-slate-500" />}>
          Tap the <strong>three dots ⋮</strong> in the top-right of Chrome
        </Step>
        <Step n={2} icon={<Plus className="h-5 w-5 text-slate-500" />}>
          Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>
        </Step>
        <Step n={3} icon={<Check className="h-5 w-5 text-emerald-600" />}>
          Tap <strong>"Install"</strong> on the confirmation
        </Step>
      </ol>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4 text-xs text-blue-900">
        <strong>Don't see "Install app" in the menu?</strong>
        <ul className="list-disc list-inside mt-1 space-y-0.5">
          <li>Stay on this page for 30+ seconds first</li>
          <li>Make sure you're using Chrome (not Samsung Internet)</li>
          <li>Try Chrome → Settings → Site Settings → clear data for itsalwaysfun.net, then come back</li>
        </ul>
      </div>
    </div>
  );
}

function DesktopInstructions() {
  return (
    <div>
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-center mb-4">
        <Smartphone className="h-10 w-10 mx-auto text-slate-400 mb-2" />
        <p className="text-sm text-slate-700 font-semibold mb-1">Open on your phone</p>
        <p className="text-xs text-slate-600">
          The app is for mobile use. Open <code className="bg-white px-1.5 py-0.5 rounded">itsalwaysfun.net/app</code> on your phone to install.
        </p>
      </div>
      <p className="text-xs text-slate-500">
        You can also install on desktop Chrome: click the install icon{" "}
        <Download className="inline h-3 w-3" /> in the right side of the address bar.
      </p>
    </div>
  );
}

function Step({
  n,
  icon,
  children,
}: {
  n: number;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3 items-start">
      <span className="bg-brand-navy text-white font-bold rounded-full h-7 w-7 flex items-center justify-center shrink-0 text-sm">
        {n}
      </span>
      <div className="flex-1 pt-0.5">
        <div className="text-sm text-slate-800">{children}</div>
        <div className="mt-1.5 opacity-50">{icon}</div>
      </div>
    </li>
  );
}
