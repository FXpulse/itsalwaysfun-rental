import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-brand-navy to-brand-navy-dark text-white flex items-center justify-center p-8">
      <div className="max-w-xl text-center">
        <div className="inline-block bg-brand-yellow text-brand-navy text-xs font-bold tracking-widest px-3 py-1 rounded-full mb-6">
          INTERNAL TOOL
        </div>
        <h1 className="text-4xl font-bold mb-4">It's Always Fun, LLC</h1>
        <p className="text-lg text-white/80 mb-8">
          Rental Inventory Management — internal admin dashboard for staff.
        </p>
        <Link href="/admin/login" className="btn-accent">
          Sign in to dashboard →
        </Link>
        <p className="mt-12 text-sm text-white/50">
          Customers should visit{" "}
          <a
            href="https://itsalwaysfun.net"
            className="underline hover:text-brand-yellow"
          >
            itsalwaysfun.net
          </a>{" "}
          to book a rental.
        </p>
      </div>
    </main>
  );
}
