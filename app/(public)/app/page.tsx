import { Truck, Zap, WifiOff, Camera, MapPin, Clock } from "lucide-react";
import { InstallButton } from "./InstallButton";

export const metadata = {
  title: "Get the It's Always Fun app",
  description: "Install the It's Always Fun driver + customer app on your phone. Works offline, full-screen, fast.",
};

export const dynamic = "force-static";

const FEATURES = [
  {
    icon: Truck,
    title: "Today's routes at a glance",
    description: "Drivers see all stops, tap to navigate, mark deliveries with photos + signature.",
  },
  {
    icon: WifiOff,
    title: "Works offline",
    description: "Bad cell signal at the venue? Captured photos sync as soon as you're back online.",
  },
  {
    icon: Zap,
    title: "Faster than the browser",
    description: "Opens full-screen, no address bar, instant load. Feels like a real app.",
  },
  {
    icon: Camera,
    title: "Capture proof + signature",
    description: "Snap photos on delivery, sign on the screen, done in 30 seconds.",
  },
  {
    icon: MapPin,
    title: "Tap to navigate",
    description: "One tap opens the address in Google Maps or Apple Maps.",
  },
  {
    icon: Clock,
    title: "Real-time updates",
    description: "Routes update live — no need to refresh the page.",
  },
];

export default function GetAppPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-block bg-brand-yellow text-brand-navy text-xs font-bold tracking-widest px-3 py-1 rounded-full mb-4">
            DRIVER APP
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-brand-navy mb-3">
            Get the It's Always Fun app
          </h1>
          <p className="text-lg text-slate-600">
            Manage today's deliveries from your phone. Works offline, captures
            photos + signatures, takes 10 seconds to install.
          </p>
        </div>

        {/* Install card */}
        <div className="mb-10">
          <InstallButton />
        </div>

        {/* Features */}
        <div className="space-y-3 mb-10">
          <h2 className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3 px-1">
            What you get
          </h2>
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3">
                <div className="bg-brand-yellow/20 text-brand-navy rounded-lg p-2 shrink-0">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-brand-navy text-sm">{f.title}</h3>
                  <p className="text-xs text-slate-600 mt-0.5">{f.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Help */}
        <div className="bg-slate-100 border border-slate-200 rounded-xl p-5 text-center">
          <h3 className="font-bold text-slate-700 text-sm mb-1">Need help installing?</h3>
          <p className="text-xs text-slate-600 mb-3">
            Call us at <a href="tel:9045843047" className="text-brand-navy font-semibold hover:underline">(904) 584-3047</a> and we'll walk you through it.
          </p>
        </div>
      </div>
    </div>
  );
}
