"use client";

import { useState } from "react";
import {
  Download,
  ChevronDown,
  ChevronRight,
  Settings,
  Package,
  Boxes,
  Tag,
  Truck,
  Users,
  Mail,
  Smartphone,
  Sparkles,
  ShieldCheck,
  Ticket,
  Image as ImageIcon,
  FileText,
  HelpCircle,
  Star,
  CloudRain,
  Hash,
  Inbox,
  AlertTriangle,
  History,
  CalendarCheck as CalendarCheckIcon,
  Calculator,
  Receipt,
  Key,
  Calendar as CalendarIcon,
  Webhook,
  Sparkles as SparklesIcon,
  BarChart3,
} from "lucide-react";

interface Section {
  id: string;
  title: string;
  icon: any;
  content: React.ReactNode;
}

const TEMPLATES = [
  { name: "Products", url: "/api/templates/products", icon: Package, desc: "Bouncy houses, slides, add-ons" },
  { name: "Inventory", url: "/api/templates/inventory", icon: Boxes, desc: "Generators, blowers, anchors, supplies" },
  { name: "Categories", url: "/api/templates/categories", icon: Tag, desc: "Product categories" },
  { name: "Vehicles", url: "/api/templates/vehicles", icon: Truck, desc: "Fleet vehicles" },
  { name: "Trailers", url: "/api/templates/trailers", icon: Truck, desc: "Fleet trailers" },
];

export function HelpClient() {
  const [openSection, setOpenSection] = useState<string | null>("intro");

  const sections: Section[] = [
    {
      id: "intro",
      title: "Welcome — what this platform does",
      icon: Sparkles,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            This is your complete rental management system. It handles bookings,
            payments, customers, inventory, dispatch, drivers, damages —
            everything end-to-end.
          </p>
          <p>The platform is split into <strong>4 sections</strong>:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>/admin</strong> — you (admin) and your staff manage the business</li>
            <li><strong>/portal</strong> — customers log in to see their bookings + earn points</li>
            <li><strong>/driver</strong> — your crew sees today's routes on their phone</li>
            <li><strong>/</strong> (public) — where customers book online</li>
          </ul>
          <p className="bg-amber-50 border border-amber-200 rounded p-3 mt-3">
            ⏱ <strong>Time to first booking:</strong> Setup takes ~1 hour if you bulk-upload
            your products/inventory. After that, customers can book online + pay 24/7.
          </p>
        </div>
      ),
    },
    {
      id: "products",
      title: "Step 1 — Add your rental products",
      icon: Package,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Products are what customers rent: bounce houses, slides, accessories.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-2">
            <p className="font-semibold">Option A: One by one</p>
            <ol className="list-decimal pl-5 space-y-1 text-xs">
              <li>Go to <code className="bg-white px-1 rounded">Products</code> → click <strong>+ Add product</strong></li>
              <li>Fill name, slug (auto), category, price/day, cost (internal), stock, image URL</li>
              <li>Optional: weekend rate, setup area, age group</li>
              <li>Save</li>
            </ol>
          </div>
          <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-2">
            <p className="font-semibold">Option B: Bulk via CSV (faster for 5+ products)</p>
            <ol className="list-decimal pl-5 space-y-1 text-xs">
              <li>Go to <code>Products</code> → click <strong>Bulk upload</strong></li>
              <li>Click <strong>Download CSV template</strong></li>
              <li>Open in Excel/Google Sheets, fill rows, save as <code>.csv</code></li>
              <li>Upload + import. Errors show inline per row.</li>
            </ol>
            <p className="text-xs text-slate-600">
              💡 <strong>Pro tip:</strong> Use bulk upload for the initial 14-product seed,
              then edit individuals as needed.
            </p>
            <p className="font-semibold mt-2 text-xs">CSV columns:</p>
            <ul className="list-disc pl-5 space-y-0.5 text-[11px] text-slate-700">
              <li><code>name</code>, <code>slug</code> (optional — auto from name), <code>category</code>, <code>description</code></li>
              <li><code>price_per_day_dollars</code>, <code>cost_dollars</code>, <code>stock</code>, <code>image_url</code></li>
              <li><code>is_active</code> (true/false), <code>is_addon</code> (true/false), <strong><code>tax_exempt</code></strong> (true/false — new!)</li>
              <li><code>weekend_price_per_day_dollars</code>, <code>setup_area</code>, <code>actual_size</code>, <code>outlets_required</code>, <code>age_group</code></li>
            </ul>
            <p className="text-[11px] text-emerald-700">
              ✓ Set <code>tax_exempt=true</code> on rows where the product shouldn't be taxed (gift cards, fees, non-taxable services). Revenue still counts toward booking totals; just no tax on that row.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "inventory",
      title: "Step 2 — Track operational gear (inventory)",
      icon: Boxes,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            <strong>Inventory ≠ Products.</strong> Inventory is operational gear (generators,
            blowers, anchors, sandbags, cleaning supplies). Products are what
            customers rent. Inventory is what you bring to make the rental work.
          </p>
          <p>Why track inventory:</p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>Driver checklist: "Truck 1 needs 4 blowers + 12 sandbags"</li>
            <li>Maintenance log per item (repair history, ROI)</li>
            <li>Damage tracking</li>
          </ul>
          <div className="bg-slate-50 border border-slate-200 rounded p-3">
            <p className="font-semibold mb-1">Setup:</p>
            <ol className="list-decimal pl-5 space-y-1 text-xs">
              <li>Go to <code>Inventory</code> → use Bulk upload or Add item</li>
              <li>For each Product, go to <code>Products → Edit → Inventory checklist</code></li>
              <li>Add what the product needs (e.g. Game On = 1 blower + 6 stakes if grass)</li>
              <li>Use "Copy from another product" to clone settings between similar bouncys</li>
            </ol>
          </div>
        </div>
      ),
    },
    {
      id: "important-tips",
      title: "Important tips & policies — shows up in 4 places",
      icon: AlertTriangle,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            One block of customer-facing policies (payment methods, surface
            restrictions, staking, weather/cancellation, park requirements,
            setup time) is now editable in one place and surfaced everywhere
            customers might need to see it.
          </p>
          <p className="font-semibold">Edit once at:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>
              <code>/admin/site</code> → scroll to <strong>Important tips</strong>{" "}
              (textarea). Edit freely — use blank lines between paragraphs.
            </li>
          </ul>
          <p className="font-semibold">Shows up in:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>
              <strong>Booking confirmation email</strong> — appended in a
              yellow accent box at the bottom of the email body.
            </li>
            <li>
              <strong>Quote email</strong> (when you click Send to customer)
              — same yellow accent box, so the customer reads the policies
              before they approve.
            </li>
            <li>
              <strong>Public page</strong>{" "}
              <code>/info/policies</code> — full-page version with the
              tenant's phone + email at the bottom. Link from anywhere.
            </li>
            <li>
              <strong>FAQs</strong> at <code>/info/faqs</code> — each tip
              auto-seeded as its own FAQ entry. Customers searching common
              questions find the answers in their native format.
            </li>
          </ul>
          <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded p-2">
            ⚠️ This is OPERATIONAL policy, not legal. The liability waiver
            at <code>/admin/waiver</code> is separate — keep it focused on
            legal language (assumption of risk, indemnification) and put
            day-to-day reminders here.
          </p>
        </div>
      ),
    },
    {
      id: "tax",
      title: "Sales tax / IVA / VAT — per-tenant configurable",
      icon: Calculator,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Each tenant can turn on sales tax at their own rate. When
            enabled, tax is calculated automatically on every public
            booking and every quote approval, and stored separately on
            <code> bookings.tax_cents</code> so it can be reported and
            itemized on receipts.
          </p>
          <p className="font-semibold">Setup (one-time):</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>
              Go to <code>/admin/site</code> → scroll to the new
              <strong> Sales tax / IVA / VAT</strong> section.
            </li>
            <li>
              <strong>Tax enabled</strong>: Yes / No dropdown. Default: No.
            </li>
            <li>
              <strong>Tax rate percent</strong>: decimal like
              <code> 7.5</code> for 7.5%. Florida ≈ 7%, NY ≈ 8.875%,
              CA ≈ 7.25–10.25%. Check your jurisdiction.
            </li>
            <li>
              <strong>Tax label</strong>: how it shows to customers
              ("Sales tax", "IVA", "VAT").
            </li>
          </ul>
          <p className="font-semibold">Where it applies:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>
              <strong>Public booking</strong> (<code>/order-by-date</code>):
              tax is calculated on the taxable base (after discounts +
              gift cards + points), added to the total, and saved on
              the booking.
            </li>
            <li>
              <strong>Quote approval</strong>: tax auto-calculates on
              (line items + damage protection + power supply) at the
              moment the customer approves. The live breakdown in the
              setup form shows the tax row alongside the other extras.
            </li>
            <li>
              <strong>Admin quote editor</strong>: the <code>Tax</code>{" "}
              field stays — set it manually to override the auto-rate
              for an exempt customer or an out-of-state event. If you
              leave it at 0, the auto-rate fires at approval time.
            </li>
          </ul>
          <p className="font-semibold">Where to find collected tax for filing:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>
              <code>/admin/reports</code> shows a "<strong>Sales tax
              collected (period to declare)</strong>" section directly
              under the P&amp;L card. Shows total pre-tax revenue + tax
              collected + customer-paid total + monthly breakdown.
            </li>
            <li>
              The "Total revenue" summary card displays a subtitle like{" "}
              <code>$X,XXX pre-tax + $YY.YY sales tax</code> when tax is
              collected — so the headline figure is transparent.
            </li>
            <li>
              <strong>Tax collected CSV export</strong> button in the
              accounting section: per-booking detail rows with event
              date, customer, product, pre-tax + tax + total. Last row
              is a TOTAL summary. Drop straight into your sales-tax
              return.
            </li>
          </ul>
          <p className="font-semibold">Two ways to exempt from tax:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>
              <strong>Per-product</strong> — edit the product, tick "Tax
              exempt" (or set <code>tax_exempt=true</code> in the bulk
              CSV). The product's revenue counts toward the booking total
              but is excluded from the taxable base. Use this for gift
              cards, fees, or any non-taxable line. Shows up with a green{" "}
              <strong>TAX EXEMPT</strong> badge in the customer's quote
              view and the admin line items table.
            </li>
            <li>
              <strong>Per-customer (per-quote)</strong> — tick the{" "}
              <strong>Tax exempt customer</strong> checkbox next to the
              Tax field in the quote editor. Skips tax on the WHOLE quote.
              Use this for nonprofits, schools, gov, resellers with an
              exemption certificate. Document the certificate # in
              internal notes.
            </li>
          </ul>
          <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded p-2">
            ⚠️ This is a flat-rate tax. If you operate in multiple
            jurisdictions with different rates by zip code, you'll need
            to set the rate that covers your most common case and
            handle exceptions per-quote.
          </p>
        </div>
      ),
    },
    {
      id: "setup-surfaces",
      title: "Configurable setup surface options",
      icon: Tag,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            The list of setup surfaces shown to customers (Grass, Dirt,
            Concrete, etc.) is now editable per tenant. Manage them at the
            bottom of <code>/admin/categories</code> in the new "Setup
            surface options" section.
          </p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>
              <strong>Add</strong> any surface you need (Sand, Wood Deck,
              Indoor, etc.) — just a label and a lowercase internal value.
            </li>
            <li>
              <strong>Reorder</strong> with the display_order field — lower
              numbers appear first.
            </li>
            <li>
              <strong>Deactivate</strong> options you don't use. Past
              bookings keep their recorded surface; inactive ones just hide
              from the public booking + quote forms going forward.
            </li>
            <li>
              <strong>Delete</strong> when no longer relevant. Past bookings
              keep their recorded value verbatim.
            </li>
          </ul>
          <p className="bg-amber-50 border border-amber-200 rounded p-2 text-xs">
            <strong>Where it shows:</strong> the public booking wizard's
            "Setup surface" step <em>and</em> the quote approval form. Any
            change reflects there immediately (next page load — no deploy
            needed). Active surfaces only.
          </p>
          <p className="text-xs text-slate-500">
            Defaults seeded for every tenant: Grass, Dirt, Concrete, Paver,
            Asphalt, Other.
          </p>
        </div>
      ),
    },
    {
      id: "categories",
      title: "Step 3 — Organize with categories",
      icon: Tag,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Categories group your products on the public website (e.g. "Bounce
            Houses", "Slides", "Add-ons").
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li>Go to <code>Categories</code> → Add or Bulk upload</li>
            <li>Each category: name, optional image, display order, active flag</li>
            <li>"Active" categories show in public navigation; inactive are hidden</li>
          </ol>
          <p className="bg-amber-50 border border-amber-200 rounded p-2 text-xs">
            ⚠ Category <strong>"Add-ons"</strong> is special: products in it (with is_addon=true)
            are hidden from public catalog but available as upsells at checkout (chairs, tables, generator).
          </p>
        </div>
      ),
    },
    {
      id: "fleet",
      title: "Step 4 — Set up your fleet (vehicles + trailers)",
      icon: Truck,
      content: (
        <div className="space-y-3 text-sm">
          <p>Required for dispatch route planning.</p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li>Go to <code>Fleet</code></li>
            <li>Add each <strong>Vehicle</strong>: name, type (truck/van/pickup), needs trailer? capacity</li>
            <li>Add each <strong>Trailer</strong>: name, capacity</li>
            <li>Or use Bulk upload buttons</li>
          </ol>
          <p className="text-xs">
            Later, when you plan dispatch routes for a day, you pick a vehicle and
            (if it needs one) a trailer per route.
          </p>
        </div>
      ),
    },
    {
      id: "users",
      title: "Step 5 — Add your team (staff + drivers)",
      icon: Users,
      content: (
        <div className="space-y-3 text-sm">
          <p>3 roles available:</p>
          <table className="text-xs w-full border-collapse">
            <thead>
              <tr className="bg-slate-100">
                <th className="text-left p-2">Role</th>
                <th className="text-left p-2">What they can do</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="p-2 font-semibold">Admin</td>
                <td className="p-2">Everything (you, owner)</td>
              </tr>
              <tr className="border-b">
                <td className="p-2 font-semibold">Staff</td>
                <td className="p-2">Bookings, Customers, Inventory, Dispatch, Calendar, Availability</td>
              </tr>
              <tr className="border-b">
                <td className="p-2 font-semibold">Driver</td>
                <td className="p-2">ONLY their day's routes (mobile-optimized) + capture proofs</td>
              </tr>
            </tbody>
          </table>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li>Go to <code>Users</code> → <strong>New user</strong></li>
            <li>Enter email, temp password, role</li>
            <li>Share credentials with the team member</li>
            <li>They log in at <code>/admin/login</code> → drivers auto-redirect to <code>/driver</code></li>
          </ol>
        </div>
      ),
    },
    {
      id: "stripe",
      title: "Step 6 — Connect Stripe for payments",
      icon: ShieldCheck,
      content: (
        <div className="space-y-3 text-sm">
          <p>Right now you're in <strong>Stripe test mode</strong>. For real payments:</p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li>Wait for Stripe business verification approval</li>
            <li>Get live keys from Stripe Dashboard → Developers → API Keys</li>
            <li>In Vercel → Settings → Env vars:
              <ul className="list-disc pl-5 mt-1">
                <li>Update <code>STRIPE_SECRET_KEY</code> (starts with sk_live_)</li>
                <li>Update <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> (starts with pk_live_)</li>
                <li>Update <code>STRIPE_WEBHOOK_SECRET</code> (regenerate after pointing webhook to live)</li>
              </ul>
            </li>
            <li>Redeploy from Vercel</li>
          </ol>
        </div>
      ),
    },
    {
      id: "emails",
      title: "Step 7 — Email setup",
      icon: Mail,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Email delivery is included with your plan — RentalFlow handles the
            sending. 10 automated emails go out automatically (booking
            confirmation, reminders, quotes, etc.).
          </p>
          <p>To customize email templates:</p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li>Go to <code>Email templates</code></li>
            <li>Click any template (e.g. "Booking confirmation")</li>
            <li>Edit subject, header, HTML body, plain-text fallback</li>
            <li>Use <code>{`{{firstName}}`}</code>, <code>{`{{productName}}`}</code>, etc.</li>
            <li><strong>Preview</strong> + <strong>Send test</strong> to yourself before saving</li>
          </ol>
        </div>
      ),
    },
    {
      id: "sms",
      title: "Step 8 — SMS setup",
      icon: Smartphone,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            SMS delivery is included with your plan — RentalFlow handles the
            sending. SMS auto-sends for booking confirmation + reminder (3 days
            before event).
          </p>
          <p>
            If you don't see SMS going out, check the <code>Diagnostics</code>
            page — if it says "SMS delivery: Not configured", contact RentalFlow
            support and they'll enable it for your account.
          </p>
        </div>
      ),
    },
    {
      id: "loyalty",
      title: "Step 9 — Loyalty + referrals",
      icon: Sparkles,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Customers earn points for bookings + commission for referrals.
            Configure in <code>Website content → Loyalty & referrals</code>.
          </p>
          <table className="text-xs w-full border-collapse">
            <tbody>
              <tr className="border-b"><td className="p-1 font-semibold">Points per $1</td><td>1 (default)</td></tr>
              <tr className="border-b"><td className="p-1 font-semibold">Points → $1</td><td>100 (default)</td></tr>
              <tr className="border-b"><td className="p-1 font-semibold">Referral commission</td><td>10% of referred 1st booking</td></tr>
              <tr className="border-b"><td className="p-1 font-semibold">Payout threshold</td><td>$50 (alert admin)</td></tr>
            </tbody>
          </table>
          <p className="text-xs">
            Pay out commission manually via <code>Loyalty</code> → click customer → Record payout.
          </p>
        </div>
      ),
    },
    {
      id: "coupons-gifts",
      title: "Step 10 — Coupons + Gift cards",
      icon: Ticket,
      content: (
        <div className="space-y-3 text-sm">
          <p><strong>Coupons</strong> — discount codes. 3 types available:</p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li>Go to <code>Coupons</code> → Add</li>
            <li>Pick a type:
              <ul className="list-disc pl-5 mt-1">
                <li><strong>Percent off</strong> — e.g. 10% off the entire total</li>
                <li><strong>Fixed amount off</strong> — e.g. $25 off in dollars</li>
                <li><strong>Overnight free</strong> — waives ONLY the 30% second-day surcharge. Valid <em>only</em> for 2-day (overnight) rentals. Rejected with a clear message on 1-day or 3+ day rentals.</li>
              </ul>
            </li>
            <li>Customer enters code at checkout</li>
            <li>Create <code>LOYAL10</code> → auto-shown to returning customers in /portal</li>
          </ol>
          <p className="text-xs text-blue-800 bg-blue-50 border border-blue-200 rounded p-2">
            💡 <strong>"Overnight free" use case:</strong> seed the OVERNIGHT
            coupon (in <code>coupon_overnight_type.sql</code>) and advertise as
            "free overnight upgrade — book 2 days, pay for 1". The discount
            amount is calculated dynamically from the day-2 surcharge — you
            don't enter a value yourself.
          </p>

          <p className="mt-3"><strong>Gift cards — admin issued</strong> (you give one away or sell by phone):</p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li>Go to <code>Gift cards</code> → Issue gift card</li>
            <li>Enter amount + recipient email</li>
            <li>System emails recipient the code automatically</li>
            <li>Recipient enters code at checkout in the 🎁 field</li>
            <li>Balance auto-decreases; remaining stays on the card</li>
          </ol>

          <div className="bg-green-50 border border-green-200 rounded p-3 mt-4 space-y-2">
            <p className="font-semibold text-green-900">🆕 Customers can BUY gift cards online</p>
            <p className="text-xs">
              Public page: <code>/gift-cards</code> (also in the nav as "🎁 Gift Cards").
              Customer picks an amount ($10–$10,000), enters recipient info, pays via
              Stripe, recipient gets the code by email automatically.
            </p>
            <ul className="list-disc pl-5 text-xs space-y-1">
              <li>Each online sale shows up in <code>Gift cards</code> like any other card</li>
              <li>Customer pays via Stripe → webhook issues the card → no manual work</li>
              <li>Purchaser gets a receipt email with the code (in case the recipient loses it)</li>
            </ul>
          </div>

          <p className="font-semibold">Quick online/offline toggle per gift card:</p>
          <p className="text-xs">
            In the gift cards table at <code>/admin/gift-cards</code>, the last
            column has a <strong>green/grey switch</strong>. Click to disable
            (customer can't redeem) or re-enable. Useful for fraud holds,
            disputes, or expired-but-still-active cards. The toggle works in
            both directions now — you can re-enable anything you disabled.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-2">
            <p className="font-semibold text-amber-900">⚙️ Turn online sales ON or OFF</p>
            <p className="text-xs">
              At the top of <code>Gift cards</code> you have a green/grey switch.
            </p>
            <ul className="list-disc pl-5 text-xs space-y-1">
              <li><strong>ON (default):</strong> <code>/gift-cards</code> shows the buy form</li>
              <li><strong>OFF:</strong> <code>/gift-cards</code> shows "Online sales paused — call us" with your phone. You can still issue cards manually from this page.</li>
            </ul>
            <p className="text-xs">
              Use this if you ever need to pause sales (holiday cap, promo cooldown,
              fraud concern) without removing the page from the site.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "payouts-w9",
      title: "Step 10b — Referral payouts + W9 tax forms",
      icon: ShieldCheck,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            When customers refer friends, they earn commission (see Step 9). They
            can cash out from their <code>/portal/referrals</code> page. There are
            <strong> two payout types</strong>:
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-2">
            <p className="font-semibold">🎁 Credit (no W9, auto-issued)</p>
            <p className="text-xs">
              Customer chooses "rental credit" → on admin approval the system
              auto-issues a gift card for the amount, emails them the code, and
              moves the money from pending → paid. No tax form needed (it's not
              a cash payment).
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-2">
            <p className="font-semibold">💵 Cash (Stripe / Venmo / Zelle — W9 required)</p>
            <p className="text-xs">
              Customer chooses "cash payout" → must upload their W9 form
              (PDF/JPG/PNG). The IRS requires a 1099-NEC at year-end if a
              non-employee earns $600+ in cash from your business.
            </p>
          </div>

          <p className="font-semibold mt-2">Your workflow when a request comes in:</p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li>You'll see a yellow "Payout requests" panel at the top of <code>Loyalty</code></li>
            <li>For cash requests: click <strong>View W9 form</strong> to open the PDF (signed link, valid 10 min)</li>
            <li>Click <strong>Approve</strong>:
              <ul className="list-disc pl-5 mt-1">
                <li>Credit → gift card auto-issued + emailed</li>
                <li>Cash → marked approved, waiting for you to pay externally</li>
              </ul>
            </li>
            <li>For cash: send the money via Stripe/Venmo/Zelle, then click <strong>Mark as paid</strong> + enter the transfer ID/confirmation #</li>
            <li>Click <strong>Reject</strong> with a reason if the request isn't legitimate</li>
          </ol>

          <div className="bg-blue-50 border border-blue-200 rounded p-3 space-y-2">
            <p className="font-semibold text-blue-900">🔒 W9 forms are stored securely</p>
            <p className="text-xs">
              W9s contain SSNs, so they live in a <strong>private</strong> Supabase
              bucket (<code>w9-forms</code>). They're NOT accessible by URL —
              admins view them via short-lived signed links generated when you
              click "View W9 form". The link expires in 10 minutes.
            </p>
            <p className="text-xs">
              At year-end (before Jan 31), use these W9s to file 1099-NECs with
              the IRS for any referrer who earned ≥$600 cash. The W9 has the SSN
              + legal name + address you need.
            </p>
          </div>

          <p className="text-xs text-slate-500">
            💡 Customers can re-upload their W9 anytime — the new file replaces
            the old one and the upload date updates so you know which tax year
            it applies to.
          </p>
        </div>
      ),
    },
    {
      id: "inventory-categories",
      title: "Step 10c — Manage inventory categories",
      icon: Tag,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Inventory categories (Generators, Blowers, Tools…) live in the
            <code> Manage inventory categories </code> panel at the top of the
            <code> Inventory </code> page (admin only — click to expand).
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li><strong>Add</strong> a category → it immediately shows up in the dropdown when creating/editing items</li>
            <li><strong>Rename</strong> → the change cascades to every item that uses it (no orphans)</li>
            <li><strong>Hide</strong> → keeps it on existing items but removes it from the dropdown (use for deprecated categories you don't want new items to land in)</li>
            <li><strong>Delete</strong> → blocks if items are still using it. Confirm to reassign those items to "Other" then delete.</li>
          </ol>
          <p className="text-xs text-slate-500">
            💡 This is different from <code>/admin/categories</code>, which controls
            rental product categories that show on the public site. Inventory
            categories are internal — customers never see them.
          </p>
        </div>
      ),
    },
    {
      id: "reviews",
      title: "Customer reviews + Google link",
      icon: Star,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Reviews shown on the public site are curated manually — you decide
            what appears. Manage them at <code>/admin/reviews</code>.
          </p>
          <p className="font-semibold">How it works:</p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li>Copy the text of a review from Google/Facebook/Yelp/email</li>
            <li>In <code>/admin/reviews</code> click <strong>Add review</strong> → paste it, set name, rating, source, optional photo + date</li>
            <li>Toggle <strong>Featured</strong> to put it in the homepage carousel (limit 3 visible at a time, they auto-rotate every 7s)</li>
            <li>Toggle <strong>Visible</strong> off to hide without deleting</li>
          </ol>
          <p className="font-semibold">Where they show up:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li><strong>Homepage carousel</strong> above the trust strip — only "Featured + Active" ones, max 12 in rotation</li>
            <li><strong>/reviews page</strong> — ALL active reviews, sorted Featured first, then most recent</li>
            <li>Linked from the public header (Info → Reviews)</li>
          </ul>
          <p className="text-xs text-slate-500">
            💡 The <strong>"Leave us a Google review"</strong> CTA on both pages
            uses the <code>google_review_url</code> setting (default points to
            your maps.app.goo.gl link). Edit it in <code>/admin/site</code>
            under the "reviews" category if your Google place ID changes.
          </p>
          <p className="text-xs text-slate-500">
            💡 Phase 2 idea: auto-sync from Google Places API so new reviews
            appear without manual copy-paste. Requires Google Cloud project +
            API key + billing. Ask when you want to set this up.
          </p>
        </div>
      ),
    },
    {
      id: "coi",
      title: "Certificates of Insurance (COI) for venues",
      icon: ShieldCheck,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Many venues (schools, parks, churches, HOAs, corporate offices)
            require proof of insurance with them listed as additional insured
            before they let you set up bounce houses on their property.
          </p>
          <p className="font-semibold">How the flow works:</p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li>At checkout, customer checks <strong>"My venue requires a Certificate of Insurance"</strong></li>
            <li>They fill venue name, address, who to list as additional insured, any special instructions</li>
            <li>On booking creation, a row is added to <code>coi_requests</code> with status <strong>requested</strong></li>
            <li>You see the request in <code>/admin/coi</code> with all the venue details</li>
            <li>You call/email your insurance broker → they generate the COI PDF</li>
            <li>Back in <code>/admin/coi</code>, click <strong>Upload COI</strong>, attach the PDF</li>
            <li>Customer gets emailed automatically + the COI shows on their <code>/portal/bookings/[id]</code> page with a download button</li>
            <li>Optionally click <strong>Mark delivered to venue</strong> after you've sent it directly to the venue contact</li>
          </ol>
          <p className="font-semibold">Where to manage:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li><code>/admin/coi</code> — pending requests panel with upload</li>
            <li>Each booking detail page links to its COI request</li>
            <li>Disable the checkbox at checkout with the green/grey toggle at the top of <code>/admin/coi</code> (mirrors the Packages + Gift cards toggles)</li>
          </ul>
          <p className="text-xs text-slate-500">
            💡 The PDF lives in your public Supabase storage (site-assets bucket).
            That's fine — COIs aren't sensitive (they just name your insurance
            carrier + policy number).
          </p>
        </div>
      ),
    },
    {
      id: "packages",
      title: "Package deals (bundle multiple products at a fixed price)",
      icon: Package,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Packages bundle several products into one fixed-price reservation
            (e.g. "Birthday Premium = bouncer + slide + 2 tables + 12 chairs +
            cotton candy for $549"). Customers see them on <code>/packages</code>
            and reserve the bundle like one product — internally it reserves
            the whole list.
          </p>
          <p className="font-semibold">Creating a package:</p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li><code>/admin/packages</code> → <strong>+ New package</strong></li>
            <li>Fill name, slug (URL-safe), description, fixed price (dollars)</li>
            <li><strong>Image</strong>: paste a URL OR click <strong>Upload</strong> to push a file directly to Supabase storage. Preview thumbnail appears below.</li>
            <li>In "Items in bundle": pick products from the dropdown, set quantities (e.g. 1× Game On bouncer, 6× folding chair, 1× cotton candy machine)</li>
            <li>Save → toggle <strong>Active</strong> to publish on /packages</li>
          </ol>
          <p className="font-semibold">Starter packages (8 pre-seeded — INACTIVE):</p>
          <p className="text-xs">
            Running <code>supabase/seed_starter_packages.sql</code> creates 8
            common packages (Birthday Classic, Premium, Tiny Tots, Splash,
            Backyard Bash, Family Reunion, Corporate, Princess Tea). They come
            with names + descriptions + suggested prices. <strong>Items list is
            empty</strong> — you must edit each package and add YOUR products
            before activating it. Toggle <code>is_active</code> to true once
            configured.
          </p>
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
            ⚠ The seed initially included Unsplash placeholder images, but
            some IDs may not resolve. Run <code>supabase/fix_package_images.sql</code>{" "}
            to clear them — then upload custom AI-generated images via the
            editor's Upload button (recommended anyway for brand consistency).
          </p>
          <p className="font-semibold">Custom AI-generated images:</p>
          <p className="text-xs">
            See <code>docs/package-image-prompts.md</code> in the repo — has
            ready-to-paste prompts for Claude/DALL-E/Midjourney for each of the
            8 packages, plus a brand style guide and template for new packages.
            Generate → download → upload via the package editor's Upload button.
          </p>
          <p className="font-semibold">Uploading images:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li><code>/admin/packages/[id]</code> → "Image" field has an <strong>Upload</strong> button next to the URL input</li>
            <li>Accepts any image format (PNG, JPG, WebP, SVG)</li>
            <li>File goes to your Supabase storage <code>site-assets/packages/</code></li>
            <li>Preview thumbnail appears below the field once uploaded</li>
            <li>URL field still works for manually pasting an externally-hosted image</li>
          </ul>
          <p className="font-semibold">Quick online/offline toggle (per package):</p>
          <p className="text-xs">
            In the packages list at <code>/admin/packages</code>, each card has
            a <strong>green/grey switch</strong> on the right. Click to toggle
            between LIVE (visible on /packages publicly) and OFFLINE (hidden).
            No need to enter the package detail — 1 click activates/deactivates.
          </p>
          <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-2 mt-3">
            <p className="font-semibold text-amber-900">🌐 Hide the ENTIRE Packages section from the public site</p>
            <p className="text-xs">
              At the top of <code>/admin/packages</code> there's a big{" "}
              <strong>"Public Packages section ON/OFF"</strong> switch.
            </p>
            <ul className="list-disc pl-5 text-xs space-y-1">
              <li><strong>ON (default):</strong> /packages page works + "Packages" link visible in the header nav</li>
              <li><strong>OFF:</strong> /packages shows "Coming soon — call us" with your phone. The "Packages" link disappears from the nav. Per-package toggles still work for when you turn it back on.</li>
            </ul>
            <p className="text-xs">
              Same pattern as the gift cards toggle: nav link is hidden too
              when the section is off, so customers don't see broken links.
            </p>
          </div>
        </div>
      ),
    },
    {
      id: "product-gallery",
      title: "Product photo galleries (multiple photos per bouncer)",
      icon: ImageIcon,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Each product can now have multiple photos. Customers see a carousel
            on the product detail page (with thumbnails + click-to-zoom lightbox).
            The "Image URL" field on the product form is still the <strong>primary
            cover</strong> (used on cards/search); the gallery is additive.
          </p>
          <p className="font-semibold">To add photos:</p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li>Go to <code>/admin/products/[id]</code></li>
            <li>Scroll to the new <strong>"Photo gallery"</strong> section</li>
            <li>Click <strong>Upload photo</strong> (file picker) or <strong>Add by URL</strong> (paste link from elsewhere)</li>
            <li>Repeat for as many photos as you want</li>
          </ol>
          <p className="font-semibold">Per-photo actions in the grid:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li><strong>← / →</strong> arrows — reorder the photo within the carousel</li>
            <li><strong>⭐ star</strong> — promote this gallery photo to be the primary cover (updates the product's main image_url, shown everywhere on the public site)</li>
            <li><strong>🗑 trash</strong> — remove from gallery (also deletes from storage if uploaded)</li>
          </ul>
          <p className="text-xs text-slate-500">
            💡 The primary cover shows a gold "Primary" badge in the gallery
            grid so you always know which one is "the" image.
          </p>
          <p className="text-xs text-slate-500">
            💡 Customer view: large image at top with hover ← → arrows, thumbnail
            strip below, click main image to open full-screen lightbox with
            keyboard arrow nav. No work needed on your end — it just works.
          </p>
        </div>
      ),
    },
    {
      id: "per-day-consumables",
      title: "Per-day consumables (propane, fuel, ice)",
      icon: Package,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Some inventory items get <em>consumed</em> per day of rental — a
            generator needs 1 propane tank per day, an ice chest needs 3 bags
            of ice per day, etc. The system multiplies these automatically.
          </p>
          <p className="font-semibold">How to configure:</p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li>Go to <code>/admin/products/[id]</code></li>
            <li>In <strong>Inventory checklist</strong> → click <strong>Add item</strong></li>
            <li>Select the consumable (e.g. "Propane tank 20lb")</li>
            <li>Enter qty <strong>per day</strong> (e.g. <code>1</code>)</li>
            <li>Check the box <strong>"Per day (multiply qty × rental days)"</strong></li>
            <li>Save</li>
          </ol>
          <p className="font-semibold">What happens at booking time:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>1-day rental → list shows <strong>1 tank</strong></li>
            <li>3-day rental → list shows <strong>3 tanks</strong></li>
            <li>Truck load aggregation sums these multiplied quantities across all bookings on the route</li>
            <li>The reason column shows "1/day × 3 days" so it's transparent why the count went up</li>
          </ul>
          <p className="text-xs text-slate-500">
            💡 Combine with "Only when needs Power Supply" so propane only
            shows up when the customer actually rented power. Both checkboxes
            can be active simultaneously.
          </p>
          <p className="text-xs text-slate-500">
            💡 The blue "🗓 consumable" badge in the requirements list makes
            it easy to spot which items will scale up vs static items
            (anchors, cables, etc.).
          </p>
        </div>
      ),
    },
    {
      id: "unit-tracking",
      title: "Per-unit asset tracking (which BLW-05 went where?)",
      icon: Hash,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            For valuable items where you need to know <em>which physical unit</em>{" "}
            was on which truck (blowers, generators, large bouncers), you can
            tag each unit individually (BLW-01, BLW-02, ...) and assign specific
            units to a route from dispatch.
          </p>

          <p className="font-semibold">One-time setup:</p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li>Go to <code>Inventory</code> → click the item (e.g. "Blowers")</li>
            <li>Click <strong>Enable unit tracking</strong></li>
            <li>Click <strong>Bulk add (auto-tag)</strong> → prefix <code>BLW</code>, count <code>14</code> → creates BLW-01 through BLW-14 instantly</li>
            <li>Optionally edit each unit to add serial number, acquired date, notes ("cracked housing", etc.)</li>
            <li>Physically label each unit with a sharpie / sticker matching its tag</li>
          </ol>

          <p className="font-semibold">Daily flow (per dispatch):</p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li>Open <code>/admin/dispatch/[date]</code> → planned routes show the Truck Load section</li>
            <li>For each item that tracks units, you'll see "no units picked" + a <strong>Pick units</strong> button</li>
            <li>Click → modal lists every active unit with status dot (good / needs_repair / broken)</li>
            <li>Pick the specific units going on that truck → save</li>
            <li>The truck load card now shows tags like <code>BLW-03 BLW-07 BLW-11</code> instead of just "3× Blowers"</li>
            <li>Units assigned to another route on a different day are flagged red so you can't double-book</li>
          </ol>

          <p className="font-semibold">When a unit comes back damaged:</p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li>Go to <code>Inventory</code> → item → find the unit → click pencil to edit</li>
            <li>Change condition to <code>needs_repair</code> or <code>broken</code>, add a note</li>
            <li>The status dot in dispatch dropdown will now show amber/red so you don't accidentally assign it again</li>
          </ol>

          <p className="text-xs text-slate-500">
            💡 Don't enable unit tracking for high-volume consumables (sandbags,
            cables, tarps). The overhead of picking specific units per route
            isn't worth it. Reserve it for items you'd legitimately want to
            trace ("which generator was at the Mendez delivery when it broke?").
          </p>
          <p className="text-xs text-slate-500">
            💡 Phase 2 idea: driver scans QR codes printed on each unit to
            confirm loading/return. Worth doing once you have 30+ tracked
            units and crew rotation issues. Ask when ready.
          </p>
        </div>
      ),
    },
    {
      id: "weather-cancellation",
      title: "Weather cancellation policy",
      icon: CloudRain,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Bounce houses can't run in unsafe weather (winds 15+ mph, lightning,
            heavy rain). Instead of refunding cash (you lose revenue + your
            crew's reserved day), the system auto-issues a <strong>gift card
            credit</strong> for the full paid amount, valid 1 year.
          </p>
          <p className="font-semibold">How the flow works (customer side):</p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li>Customer sees a blue "Bad weather forecast?" card on their <code>/portal/bookings/[id]</code> page — only up to <strong>6 hours before</strong> event start (configurable)</li>
            <li>They click → see the policy + the amount they'll get credited</li>
            <li>Confirm → booking is cancelled, gift card is auto-generated, email is sent with the code</li>
          </ol>
          <p className="font-semibold">What you (admin) see:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>The booking shows <code>cancelled</code> + flag <code>cancelled_due_to_weather=true</code></li>
            <li>The gift card appears in <code>/admin/gift-cards</code> with note "weather cancellation credit"</li>
            <li>An audit line is appended to the booking notes</li>
          </ul>
          <p className="font-semibold">Tune the policy:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li><code>weather_cancellation_enabled</code> — true/false to allow self-service at all</li>
            <li><code>weather_cancellation_cutoff_hours</code> — default 6. Increase to 24 to close the option the day before. Decrease to 2 if you want last-minute decisions allowed.</li>
            <li><code>weather_cancellation_policy_text</code> — full policy shown to customer in the confirmation dialog</li>
          </ul>
          <p className="text-xs text-slate-500">
            💡 After the cutoff, the option disappears and customers must call
            you. That's intentional — gives YOU the judgment call when it's
            within hours of the event.
          </p>
        </div>
      ),
    },
    {
      id: "waiver",
      title: "Liability waiver e-signature (legal)",
      icon: ShieldCheck,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Every customer signs a liability waiver at checkout. The waiver text
            you have set in <code>/admin/waiver</code> is what they see and what
            gets snapshotted per booking (so editing it later doesn't change
            past signatures — keeps them legally defensible).
          </p>
          <div className="bg-red-50 border-l-4 border-red-400 rounded p-3 text-xs">
            <p className="font-semibold text-red-900 mb-1">
              ⚠ Get this reviewed by a Florida attorney before going live
            </p>
            <p className="text-red-900">
              The default text is built from common bounce-house industry
              language but isn't legal advice. Wrong wording can be unenforceable
              under Florida law.
            </p>
          </div>
          <p className="font-semibold">Where to manage it:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li><code>/admin/waiver</code> — edit text, toggle on/off, see signed count</li>
            <li><code>/info/waiver</code> — public page customers can save/print before booking</li>
            <li>Linked from the public site footer alongside Privacy/Terms</li>
          </ul>
          <p className="font-semibold">What gets recorded per signature:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>Booking ID + customer's full legal name (typed)</li>
            <li>Email + IP address + browser user agent</li>
            <li>Exact waiver title + text shown at that moment</li>
            <li>Timestamp</li>
          </ul>
          <p className="text-xs text-slate-500">
            💡 If you ever need a defensible record for a claim, query the
            <code> booking_waivers </code> table by booking_id — every field is
            captured. Future enhancement: download as PDF directly from the
            booking detail page.
          </p>
        </div>
      ),
    },
    {
      id: "fleet-compatible-items",
      title: "Fleet: mark which trucks can carry special gear",
      icon: Truck,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Some inventory items (electric dolly, ramps, lifts, oversized cargo)
            only fit certain vehicles/trailers. Mark which fleet units are
            equipped to carry what so you can spot mismatches before sending
            the wrong truck.
          </p>
          <p className="font-semibold">Setup (per vehicle/trailer):</p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li>Go to <code>/admin/fleet</code></li>
            <li>Click pencil on a vehicle or trailer</li>
            <li>In <strong>Can carry / mount (special inventory)</strong> section, check the items this unit can physically carry (electric dolly, ramps, etc.)</li>
            <li>Save</li>
          </ol>
          <p className="font-semibold">Where it shows up:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>Fleet table has a new <strong>"Can carry"</strong> column with blue tags showing each unit's compatibilities at a glance</li>
            <li>When planning dispatch, glance at the assigned truck's tags vs the truck load — if the load needs the dolly but the truck doesn't have it tagged, pick a different truck</li>
          </ul>
          <p className="text-xs text-slate-500">
            💡 Combine with per-unit asset tracking (BLW-01...): the truck
            load shows specific tags AND the truck's compatibility list, so
            you have full visibility into what's loaded + whether the truck
            can actually carry it.
          </p>
        </div>
      ),
    },
    {
      id: "fleet-vin-tag",
      title: "Step 10d — Fleet: VIN + license tag",
      icon: Truck,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Each vehicle and trailer in <code>Fleet</code> can store its
            <strong> License tag</strong> (plate #) and <strong>VIN</strong>.
            Both are optional but useful for insurance claims, traffic stops,
            DMV renewals, and identifying which truck to take.
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li>Go to <code>Fleet</code></li>
            <li>Click <strong>Add vehicle / trailer</strong> or the pencil to edit one</li>
            <li>Fill <strong>License tag</strong> and/or <strong>VIN</strong> — they auto-uppercase + trim</li>
            <li>Save. The columns now show on the Fleet table for quick lookup.</li>
          </ol>
          <p className="text-xs text-slate-500">
            💡 Bulk upload supports both fields too — download a fresh
            <code> vehicles </code> or <code> trailers </code> CSV template from
            the top of this Help page.
          </p>
        </div>
      ),
    },
    {
      id: "site-font",
      title: "Step 11a — Change the site font (Louis George Cafe etc.)",
      icon: ImageIcon,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            The entire public site uses one global font. Change it from{" "}
            <code>/admin/site</code> → top of the <strong>Appearance</strong>{" "}
            section → "Site-wide font" picker.
          </p>
          <p className="font-semibold">Free presets (load instantly from Google Fonts CDN):</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li><strong>Quicksand</strong> — recommended. The free Google Fonts twin of Louis George Cafe (rounded geometric sans-serif, brand-friendly for kids/family events).</li>
            <li><strong>Nunito</strong>, <strong>Poppins</strong> — similar rounded sans-serif vibe</li>
            <li><strong>Inter</strong>, <strong>Montserrat</strong> — clean modern sans-serif</li>
            <li><strong>Playfair Display</strong> — elegant serif if you want a more upscale feel</li>
          </ul>
          <p className="font-semibold">Custom: type any Google Font</p>
          <p className="text-xs">
            Pick "Custom (type your own)" → enter the family name + paste the
            Google Fonts stylesheet URL (from fonts.google.com → pick font →
            "Get embed code" → copy the href).
          </p>
          <p className="font-semibold">Louis George Cafe (self-hosted, brand-exact)</p>
          <p className="text-xs text-green-800 bg-green-50 border border-green-200 rounded p-2">
            ✨ <strong>New:</strong> NO need to edit code or redeploy anymore.
            Pick "Louis George Cafe (self-hosted)" in the picker → click{" "}
            <strong>Upload Louis George Cafe (.woff2)</strong> button →
            select the .woff2 file you downloaded from 1001fonts.com → Save
            settings. The picker handles everything: uploads to Supabase,
            stores the URL, emits the right @font-face automatically.
          </p>
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
            License note: 1001fonts.com offers LGC free for personal use; some
            font licenses require purchase for commercial use. Verify your
            license before going live commercially — or stick with{" "}
            <strong>Quicksand</strong> (SIL Open Font License, free for any
            use, looks ~95% identical to LGC).
          </p>
          <p className="text-xs text-slate-500">
            💡 Per-zone fonts (in the Appearance section below) still work and
            OVERRIDE the global font for specific sections. Most people use only
            the global setting and leave per-zone empty.
          </p>
        </div>
      ),
    },
    {
      id: "site",
      title: "Step 11 — Customize the public site",
      icon: ImageIcon,
      content: (
        <div className="space-y-3 text-sm">
          <p>Go to <code>Website content</code> to edit ALL public copy + colors:</p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li>Hero title + subtitle</li>
            <li>Section titles</li>
            <li>Trust strip copy</li>
            <li>Footer description</li>
            <li>Per-zone colors + fonts (Hero, Categories, Featured, Trust, Footer)</li>
          </ul>
          <p>Go to <code>Home banners</code> to upload carousel images (1920×600 recommended).</p>
        </div>
      ),
    },
    {
      id: "contact-inbox",
      title: "Contact form inbox — where messages land",
      icon: Inbox,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Every submission from the public <code>/contact</code> page goes
            through three channels simultaneously so a message can't slip
            through the cracks:
          </p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li><strong>Saved to DB</strong> (<code>contact_messages</code>) — source of truth, always works</li>
            <li><strong>Emailed to admin</strong> → goes to your configured admin alert email. Reply-to is set to the customer's email so hitting Reply goes straight to them.</li>
            <li><strong>Pushed to GHL</strong> via webhook → workflow 1 creates/updates the contact with tag <code>general_inquiry</code></li>
          </ol>
          <p className="font-semibold">Manage from <code>/admin/inbox</code>:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>Open messages show at the top; resolved ones at the bottom (greyed out)</li>
            <li>Click <strong>Reply</strong> to open your email client pre-addressed to the sender</li>
            <li>Click <strong>Mark resolved</strong> after handling, optionally add a note ("called back, booked")</li>
            <li>Green/red badges show delivery status per channel (email ✓ / GHL ✓). If GHL failed, you'll see the error — message is still safe in DB.</li>
            <li>Admin can <strong>Reopen</strong> or <strong>Delete</strong> any message</li>
          </ul>
          <p className="text-xs text-slate-500">
            💡 The "Delivery issues" stat at the top counts unresolved messages
            where email or GHL didn't go through — those are the ones to
            handle first. When a delivery fails, you'll see a <strong>red banner
            inside the message card</strong> with the exact email/GHL error
            (no need to dig in deployment logs).
          </p>
          <p className="text-xs text-slate-500">
            💡 New unresolved messages also show as a <strong>red alert panel
            on the Dashboard</strong> (top 5 with sender, subject, badge). The
            "X need attention" pill in the header counts them.
          </p>

          <div className="bg-blue-50 border-l-4 border-blue-400 rounded p-3 mt-3 space-y-2">
            <p className="font-bold text-blue-900 text-sm">
              📥 Optional: receive emails to your own address directly in the inbox
            </p>
            <p className="text-xs text-blue-900">
              Want customer replies (and direct emails to e.g.{" "}
              <code>bookings@yourdomain.com</code>) to land in{" "}
              <code>/admin/inbox</code> automatically? This needs a small
              one-time setup. Contact RentalFlow support and we'll walk you
              through it — takes about 10 minutes if your domain is on
              Cloudflare DNS.
            </p>
          </div>

          <p className="font-semibold mt-3">Replying directly from the inbox:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>Click <strong>Reply</strong> → inline composer opens (no need to leave the app)</li>
            <li>Type the reply in plain text — blank lines become paragraphs</li>
            <li>Customer receives a clean HTML email from your configured sender address with your message, sign-off, and the original collapsed at the bottom</li>
            <li><strong>Reply-To is set to your email</strong> so if they reply, it goes to your inbox</li>
            <li>Check <strong>"Mark resolved after sending"</strong> to close the message in one click</li>
            <li>Every reply is logged in the message's thread (sent_by + timestamp), so staff can see what was already said before replying again</li>
            <li>If email delivery fails, the reply still saves to the log with the error — you can copy the text and resend manually</li>
          </ul>
        </div>
      ),
    },
    {
      id: "customer-tracking",
      title: "Customer tracking page (Domino's-style timeline)",
      icon: Sparkles,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Every customer booking detail page at <code>/portal/bookings/[id]</code>
            now shows a 6-step visual timeline that updates in real time as the
            booking moves through its lifecycle. No more "where's my rental?"
            phone calls.
          </p>
          <p className="font-semibold">The 6 steps:</p>
          <ol className="list-decimal pl-5 text-xs space-y-1">
            <li>✅ <strong>Payment confirmed</strong> — green check once Stripe clears</li>
            <li>⏳ <strong>X days until your event</strong> — countdown with context-aware copy ("we'll send a reminder 3 days before" / "your event is tomorrow!")</li>
            <li>📦 <strong>Loaded on the truck</strong> — activates when admin marks the route as <code>loaded</code> in /admin/dispatch. Shows driver + vehicle name.</li>
            <li>🚚 <strong>Driver on the way</strong> — activates when route status is <code>out_for_delivery</code></li>
            <li>✨ <strong>Delivered & set up</strong> — when delivery stop is marked completed</li>
            <li>📅 <strong>Picked up</strong> — when the pickup route is completed</li>
          </ol>
          <p className="text-xs">
            The active step pulses with a yellow ring; done steps are green
            with strikethrough. Special states handled: cancelled bookings
            short-circuit to a single "Cancelled" card; weather cancellations
            show the credit message.
          </p>
          <p className="text-xs text-slate-500">
            💡 To make the timeline progress through "loaded" and "out for
            delivery", you (admin) need to update the <code>dispatch_routes.status</code>
            field as the day goes on — in <code>/admin/dispatch/[date]</code> there
            should be a status dropdown per route.
          </p>
        </div>
      ),
    },
    {
      id: "extend-rental",
      title: "Customer extends rental from portal (self-service)",
      icon: CalendarCheckIcon,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            On the customer's portal booking detail, an amber "Extend rental"
            card lets them add days to an active booking. The customer picks
            a new end date, the system validates availability + computes the
            additional cost (30% per added day, honoring weekend rates), then
            charges them via Stripe.
          </p>
          <p className="font-semibold">Validation rules:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>Booking must be PAID (no extensions on unpaid)</li>
            <li>Not cancelled or completed</li>
            <li>New end date must be AFTER current end date</li>
            <li>Total rental can't exceed 14 days</li>
            <li>Each new day must be available (no conflict with other bookings or blocked dates)</li>
            <li>Cutoff: must request at least 6 hours before event start</li>
          </ul>
          <p className="font-semibold">Payment flow:</p>
          <ol className="list-decimal pl-5 text-xs space-y-1">
            <li>Customer picks new end date → "Check price"</li>
            <li>System creates a row in <code>booking_extensions</code> (pending) + Stripe PaymentIntent</li>
            <li>Stripe Elements appears inline → customer pays</li>
            <li>Webhook fires <code>payment_intent.succeeded</code> with <code>metadata.type=booking_extension</code></li>
            <li>Webhook bumps <code>bookings.event_end_date</code>, adds to <code>total_amount</code>, appends audit line to notes</li>
            <li>Customer's tracking timeline updates with the new end date</li>
          </ol>
          <p className="text-xs text-slate-500">
            💡 Extension rows in <code>booking_extensions</code> table give you a
            clean refund target if needed — refund the extension PaymentIntent
            directly without touching the original booking charge.
          </p>
        </div>
      ),
    },
    {
      id: "quote-followup",
      title: "Quote follow-up reminder (auto)",
      icon: Mail,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Quotes sent but not accepted often sit in a customer's inbox and
            get forgotten. A daily cron at 4 PM EST finds quotes that are{" "}
            <strong>3+ days old, still in 'sent' or 'viewed' status, not
            expired</strong> — and emails a friendly reminder with a big
            "View and Accept" button.
          </p>
          <p className="font-semibold">Logic:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>Runs daily at 16:00 UTC (cron in vercel.json)</li>
            <li>Only sends ONE reminder per quote (followup_sent_at marks it)</li>
            <li>Skips paid, declined, or expired quotes</li>
            <li>Up to 50 reminders per run (cap to avoid bursts)</li>
            <li>Email tagged as <code>quote_followup</code> for analytics</li>
          </ul>
          <p className="text-xs text-slate-500">
            💡 To trigger manually for testing:{" "}
            <code>curl -H "Authorization: Bearer $CRON_SECRET" https://itsalwaysfun-rental.vercel.app/api/cron/quote-followup</code>
          </p>
        </div>
      ),
    },
    {
      id: "quote-approval-flow",
      title: "Quotes — approval flow + 24h hold + payment reminder",
      icon: Ticket,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Full picture of what happens between a quote being sent and
            payment confirming.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded p-3">
            <p className="font-semibold mb-2">1. Admin creates the quote</p>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li>
                <strong>Existing customer dropdown</strong> at the top of the
                Customer section — auto-fills name, email, phone, address from
                past bookings.
              </li>
              <li>
                <strong>Customer message</strong> pre-fills from your site
                settings (business name, service area, social handle, public
                URL). Edit freely or "↺ Reset to default template".
              </li>
              <li>
                <strong>Customer choices on approval</strong> section — you
                only decide what to OFFER:
                <ul className="list-disc pl-5 mt-1">
                  <li>
                    ☐ Offer damage protection on this quote (+ price snapshot).
                    The customer chooses yes/no.
                  </li>
                  <li>
                    ☐ Require liability waiver signature before payment
                    (defaults ON).
                  </li>
                </ul>
              </li>
              <li>
                Surface type + power source are NOT here — the customer fills
                those when they approve.
              </li>
            </ul>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded p-3">
            <p className="font-semibold mb-2">2. Customer receives quote → clicks "Approve quote"</p>
            <p className="text-xs mb-1">A setup form appears with (in order):</p>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li>Setup surface (grass/dirt/concrete/paver/asphalt/other) — required</li>
              <li>Power source (has outlet / bring generator) — required</li>
              <li>Damage protection accept/decline (only if you offered it)</li>
              <li>Liability waiver text + checkbox + typed-name signature (only if you required it)</li>
            </ul>
            <p className="text-xs mt-2 text-slate-600">
              On "Approve & continue to payment": system runs an availability
              check on the primary product. If still available, creates a
              booking with a <strong>24-hour hold</strong> and proceeds to
              Stripe Elements. If someone reserved the same date in the
              meantime, returns "Sorry, no longer available" — first to
              approve wins.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded p-3">
            <p className="font-semibold mb-2">3. Hold + payment window</p>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li>
                The booking blocks inventory for 24 hours after approval. Other
                customers can't book the same product/date during that window.
              </li>
              <li>
                If payment completes (Stripe webhook) → booking becomes
                <code>confirmed</code> and the hold becomes permanent. Quote
                status → <code>converted</code>.
              </li>
              <li>
                If 24h pass without payment → the hold expires automatically.
                The inventory becomes available to other customers again. The
                booking row stays but is no longer counted as occupying the slot.
              </li>
            </ul>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded p-3">
            <p className="font-semibold mb-2">4. Hourly reminder cron (auto)</p>
            <p className="text-xs mb-1">
              <code>/api/cron/quote-hold-reminder</code> runs every hour and
              finds approved quotes whose 24h hold is about to expire (within
              the next 6 hours), payment hasn't completed, and no reminder was
              sent yet.
            </p>
            <p className="text-xs mb-1">
              Sends the customer a "Your reservation expires in Xh — complete
              payment to lock it in" email with quote total + expiry timestamp
              + payment link.
            </p>
            <p className="text-xs">
              Idempotent via <code>quotes.hold_reminder_sent_at</code>. Email
              tagged <code>quote_hold_reminder</code> for analytics.
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded p-3">
            <p className="font-semibold mb-2">5. Customer returns after hold expired</p>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li>
                When the customer lands on the public quote page (their unique
                magic link), if the 24h hold already expired and the booking
                is still pending payment → the system runs the availability
                check again across ALL line items.
              </li>
              <li>
                If everything is still free → extends the hold by 1 hour so
                the customer has time to complete payment via Stripe.
              </li>
              <li>
                If anything got booked in the meantime → shows a red banner
                "This reservation is no longer available" and hides the
                payment button. The customer is asked to contact you for
                alternative dates or substitute items.
              </li>
            </ul>
          </div>

          <p className="text-xs text-slate-600 bg-emerald-50 border border-emerald-200 rounded p-3">
            <strong>Multi-product quotes — full availability check + hold:</strong>
            <br />
            All secondary line items (and the power supply if requested) are
            written to <code>bookings.addons</code> when the quote is approved.
            The availability check counts occupied inventory from BOTH each
            booking's <code>product_id</code> AND items inside each booking's{" "}
            <code>addons</code> array. So a 24h hold from a quote now blocks
            every product in the bundle — not just the primary item. This also
            means addons booked through the public flow (chairs, tables,
            generators) get counted correctly against stock.
          </p>

          <p className="text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded p-3">
            <strong>Auto-priced power supply + damage protection:</strong>
            When the customer says they need a generator during approval, the
            system looks up the <code>power-supply</code> add-on product
            (must have <code>slug="power-supply"</code> and{" "}
            <code>is_addon=true</code>) and adds price-per-day × number of
            rental days to the total. Damage protection does the same with the
            quote's snapshot price. The setup form shows a live breakdown
            ("Original quote $X + Damage protection $Y + Power supply $Z =
            Total $T") and the final "Approve & pay" button displays the
            full amount they're about to charge.
            <br />
            <br />
            <strong>Per-tenant requirement:</strong> for power supply pricing
            to fire, each tenant needs a product in their catalog with{" "}
            <code>slug="power-supply"</code> + <code>is_addon=true</code> +{" "}
            <code>is_active=true</code>. If missing, the booking still records
            "customer needs generator" in the dispatch notes but no auto-charge
            is added — you handle pricing manually.
          </p>

          <p className="text-xs text-slate-600 bg-blue-50 border border-blue-200 rounded p-3">
            <strong>Editable reminder email:</strong> the 24h hold reminder is
            now an editable template at{" "}
            <code>/admin/email-templates</code> with key{" "}
            <code>quote_hold_reminder</code>. Available merge vars:{" "}
            <code>firstName</code>, <code>brandName</code>,{" "}
            <code>quoteNumber</code>, <code>totalDollars</code>,{" "}
            <code>quoteUrl</code>, <code>expiryLabel</code>,{" "}
            <code>hoursLeft</code>, <code>hoursLeftPlural</code>. If the
            template is missing from the DB, the cron falls back to a
            hardcoded version with the same content.
          </p>
        </div>
      ),
    },
    {
      id: "audit-log",
      title: "Audit log — who did what, when",
      icon: History,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Every sensitive admin action is recorded automatically in{" "}
            <code>/admin/audit-log</code> with: who did it (email), what they
            did (action name), what entity (booking/gift card/payout/etc.),
            when, IP address, and a JSON details blob with the relevant context
            (amounts, codes, customer email, etc.).
          </p>
          <p className="font-semibold">What gets logged today:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li><code>booking.refunded</code> — admin refunded a paid booking (amount, method, Stripe refund ID, customer)</li>
            <li><code>payout.approved.credit</code> — referrer payout approved as gift card credit</li>
            <li><code>payout.approved.cash</code> — referrer payout approved as cash (W9 required)</li>
            <li><code>gift_card.deactivated</code> / <code>.reactivated</code> — code disabled or re-enabled</li>
          </ul>
          <p className="text-xs">
            Filter by user email, entity type, or action contains text. Last
            500 events kept (older ones auto-rotate). Staff only see their own
            actions; admins see everyone's.
          </p>
          <p className="text-xs text-slate-500">
            💡 Use cases: investigate "who refunded that booking?" — search by
            customer email or booking ID. Comply with audit requests from
            insurance / IRS. Track if a new staff member is making mistakes.
          </p>
          <p className="text-xs text-slate-500">
            💡 More actions can be hooked into the audit log easily — ask if
            you want to track other things (e.g. customer cancellations from
            portal, product price changes, user role changes).
          </p>
        </div>
      ),
    },
    {
      id: "error-monitoring",
      title: "Error monitoring — RentalFlow catches bugs for you",
      icon: AlertTriangle,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            RentalFlow watches your app 24/7 for crashes — both browser-side
            (a customer clicks something and gets an error) and server-side
            (booking creation fails, email sends throw exceptions). When
            something breaks, our team gets notified automatically so we can
            push a fix without you having to report it.
          </p>
          <p className="text-xs text-slate-500">
            💡 You don't need to set anything up — this comes with your plan.
            If you suspect something is broken, just contact support and we'll
            check the logs.
          </p>
        </div>
      ),
    },
    {
      id: "pwa",
      title: "Driver mobile app (PWA — install on phone home screen)",
      icon: Smartphone,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            The driver view at <code>/driver</code> can now be installed on
            phones as an app — icon on home screen, full-screen mode (no
            browser bar), offline support for venues with bad signal.
          </p>
          <p className="font-semibold">Driver onboarding (one time per phone):</p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li>Driver opens <code>https://itsalwaysfun-rental.vercel.app/driver</code> in their phone browser</li>
            <li><strong>Android (Chrome)</strong>: a navy banner appears bottom of screen — "Install the driver app" → tap <strong>Install</strong> → done</li>
            <li><strong>iPhone (Safari)</strong>: same banner shows iOS-specific instructions — tap Share button → "Add to Home Screen"</li>
            <li>App icon "IAF Driver" appears on home screen — tap to open in standalone mode</li>
          </ol>
          <p className="font-semibold">What it does:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>Opens full-screen (no URL bar / tabs) — looks like a native app</li>
            <li>Loads in &lt;1 second after first install (cached)</li>
            <li>Routes + booking data work offline (cached); marking stops, photos, signatures sync when signal returns</li>
            <li>Auto-updates when you deploy changes — driver never needs to reinstall</li>
            <li>Customer portal + admin pages also installable (same manifest covers the whole app)</li>
          </ul>
          <p className="font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
            ⚠ <strong>For best icon branding:</strong> upload 3 PNG files to{" "}
            <code>public/icons/</code>:
            <code className="block mt-1">icon-192.png · icon-512.png · icon-180.png</code>
            Use <a href="https://realfavicongenerator.net/" target="_blank" rel="noopener noreferrer" className="underline">realfavicongenerator.net</a> to generate
            them from your logo. Without these the PWA still works — just uses a
            generic browser icon. See <code>public/icons/README.md</code> in the
            repo for details.
          </p>
          <p className="text-xs text-slate-500">
            💡 The install prompt remembers if the driver dismissed it for 7
            days so they're not nagged. After 7 days it shows again.
          </p>
          <p className="text-xs text-slate-500">
            💡 PWA is built on the same domain — no Apple Developer account or
            Google Play submission required. Drivers can install it free in
            seconds from the website.
          </p>
        </div>
      ),
    },
    {
      id: "realtime",
      title: "Live notifications — bookings, messages, payouts, COI",
      icon: Sparkles,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            The admin gets <strong>instant push notifications</strong> via Supabase
            Realtime when key things happen — no need to refresh the page. A toast
            pops up in the top-right corner and the relevant list/dashboard
            auto-refreshes.
          </p>
          <p className="font-semibold">What triggers a notification:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>📨 <strong>New contact message</strong> (form submission OR inbound email to bookings@) — shows sender + subject</li>
            <li>📅 <strong>New booking</strong> — shows customer + product + event date. Differentiates between PAID (💰) and pending payment.</li>
            <li>💵 <strong>Payout request</strong> from a referrer — shows amount + type (credit / cash)</li>
            <li>📄 <strong>COI request</strong> at checkout — shows venue name</li>
          </ul>
          <p className="text-xs text-slate-500">
            Each toast has a <strong>Refresh</strong> button if you want to
            jump straight to the updated data. Toasts auto-dismiss after 6
            seconds.
          </p>
          <p className="text-xs text-slate-500">
            💡 Notifications work across ALL admin pages — leave the dashboard
            open in one browser tab while you work elsewhere; new events still
            pop on top of whatever page you're viewing.
          </p>
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
            ⚙️ <strong>Setup required (one time):</strong> run{" "}
            <code>supabase/realtime_publication.sql</code> in the Supabase SQL
            editor to enable Realtime broadcasts on the 4 tables. Without it
            the dashboard works fine, just no live push.
          </p>
        </div>
      ),
    },
    {
      id: "dispatch-mirror",
      title: "Dispatch: pickup route auto-mirrors delivery",
      icon: Truck,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            When you assign a booking to a <strong>delivery</strong> route, the
            system now automatically creates (or finds) a matching{" "}
            <strong>pickup</strong> route on the booking's end date — using the
            same vehicle, trailer, and driver as the delivery — and assigns the
            booking there too. No more building pickup routes manually for every
            day.
          </p>
          <p className="font-semibold">How it works:</p>
          <ol className="list-decimal pl-5 text-xs space-y-1">
            <li>Assign Booking A to Delivery Route X (Truck 1, John)</li>
            <li>System checks Booking A's <code>event_end_date</code></li>
            <li>If a pickup route on that date with Truck 1 exists → adds Booking A as a stop</li>
            <li>If not → creates a new pickup route (same Truck 1, John, etc.) + adds Booking A</li>
            <li>Toast confirms: "Assigned + pickup route auto-created for 2026-06-15"</li>
          </ol>
          <p className="font-semibold">When the auto-mirror is SKIPPED:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>Booking already has a manually-assigned pickup stop (respects your override)</li>
            <li>You're assigning to a pickup route directly (no delivery to mirror from)</li>
            <li>If anything errors during mirror → silent skip (delivery assignment never blocked)</li>
          </ul>
          <p className="font-semibold">When you need to change pickup manually:</p>
          <p className="text-xs">
            Go to the pickup date's dispatch page → find the auto-created route
            (notes say "Auto-created from delivery route") → reassign the
            booking to a different route, or change the vehicle/driver on the
            auto route itself.
          </p>
          <p className="text-xs text-slate-500">
            💡 For 1-day rentals (event_end_date = event_date), the pickup route
            is created on the same day. You'll see TWO routes on that date —
            one delivery (morning), one pickup (evening).
          </p>
        </div>
      ),
    },
    {
      id: "daily-ops",
      title: "Daily operations — what to do each day",
      icon: Settings,
      content: (
        <div className="space-y-3 text-sm">
          <p className="font-semibold">Morning routine:</p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li>Open <code>Dashboard</code> → see alerts (pending payments, damages, payouts)</li>
            <li>Open <code>Calendar</code> or <code>Bookings</code> → review today's events</li>
            <li>Open <code>Dispatch → today's routes</code> → make sure drivers know assignments</li>
          </ol>
          <p className="font-semibold mt-3">Day before each event:</p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li><code>Dispatch → Plan tomorrow</code> → create routes + assign bookings</li>
            <li>Each route shows aggregated truck load (what to bring)</li>
            <li>Send driver the <strong>Driver view</strong> link via WhatsApp</li>
          </ol>
          <p className="font-semibold mt-3">After event (pickup day):</p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li>Driver captures pickup proof + records any damages</li>
            <li>Admin reviews damages in <code>Bookings → [id]</code> → mark customer responsible / covered by protection / charged</li>
          </ol>
        </div>
      ),
    },
    {
      id: "backups",
      title: "Backups — manual + weekly automatic",
      icon: Calculator,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Two-layer DB backup beyond Supabase's built-in plan backups:
          </p>
          <p className="font-semibold">1. Manual on-demand (any time)</p>
          <p className="text-xs">
            <code>/admin/diagnostics</code> → scroll to the blue "Backups" card →
            click <strong>"Download backup now"</strong>. Generates a JSON file
            with every critical table (bookings, expenses, customers, products,
            settings, etc.) + auth user metadata. Saves to your Downloads
            folder as <code>iaf-backup-YYYY-MM-DD.json</code>.
          </p>
          <p className="text-xs">
            Use it before any risky change ("about to mass-edit products → let
            me backup first") or for ad-hoc archival.
          </p>

          <p className="font-semibold">2. Weekly automatic (cron)</p>
          <p className="text-xs">
            Every Sunday 3 AM UTC, the cron at <code>/api/cron/weekly-backup</code>:
          </p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>Generates the same JSON dump</li>
            <li>Uploads to the private <code>backups</code> Supabase Storage bucket</li>
            <li>Prunes files older than 84 days (~12 weeks)</li>
            <li>Emails you (ADMIN_ALERT_EMAIL) a 7-day signed download link</li>
          </ul>
          <p className="text-xs">
            All scheduled backups are visible in the "Backups" card on
            diagnostics (file list with sizes).
          </p>

          <p className="text-xs text-slate-500">
            💡 Need a backup right now (off-cycle)? Contact RentalFlow support
            and we can run it on demand.
          </p>
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
            ⚠ <strong>Setup required (one time):</strong> run{" "}
            <code>supabase/backups_bucket.sql</code> to create the private
            <code>backups</code> bucket. Without it the cron's upload step fails
            (manual download still works without the bucket).
          </p>
          <p className="text-xs text-red-800 bg-red-50 border border-red-200 rounded p-2">
            ⚠ <strong>Doesn't include uploaded files</strong> (waivers PDFs, COI files,
            W9s, product photos, gift card backgrounds). Those live in Supabase
            Storage and are managed by Supabase's own bucket lifecycle. On Free
            plan there's no automatic bucket backup — consider upgrading to Pro
            ($25/mo) for full Supabase-managed backups.
          </p>
        </div>
      ),
    },
    {
      id: "billing",
      title: "Billing — invoices, card on file, next charge",
      icon: Receipt,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            <code>/admin/settings/billing</code> shows everything about your
            RentalFlow subscription (separate from Stripe Connect — which
            handles customer payments to your bank).
          </p>
          <p className="font-semibold">What's there:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>
              <strong>Current subscription card</strong> — plan, status,
              next renewal date. "Manage" button opens Stripe's hosted
              billing portal where you can cancel, change plan, update
              billing email, etc.
            </li>
            <li>
              <strong>Next charge</strong> — exact amount + date of the
              upcoming invoice. Cancels show "No future charges".
            </li>
            <li>
              <strong>Paid this year</strong> — running total of paid
              invoices in the current calendar year. Useful when
              deducting RentalFlow as a business expense at tax time.
            </li>
            <li>
              <strong>Payment method on file</strong> — card brand + last 4
              + expiry, with red/amber alerts if expired or about to
              expire. "Update card" opens Stripe's secure portal — we
              never store your card number.
            </li>
            <li>
              <strong>Invoice history</strong> — last 12 invoices with
              date, billing period, amount, status pill, and a "PDF"
              download link straight from Stripe.
            </li>
          </ul>
          <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded p-2">
            🔒 RentalFlow never stores your card. The "Manage" / "Update
            card" buttons all redirect to Stripe's PCI-compliant portal;
            after you're done there, you come back here.
          </p>
        </div>
      ),
    },
    {
      id: "diagnostics",
      title: "System diagnostics (health check)",
      icon: Settings,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            <code>/admin/diagnostics</code> is a one-click health check that
            verifies your environment is wired correctly before you run real
            tests or launch. Admin-only.
          </p>
          <p className="font-semibold">What it checks (≈25 items, grouped):</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li><strong>Environment</strong> — Stripe mode (live vs test) + key parity, Webhook secret, Email delivery, Admin alert email, App URL, Cron secret, GHL webhook, SMS delivery, Error monitoring, Inbound email secret</li>
            <li><strong>Database tables</strong> — existence + row counts for all critical tables (bookings, products, inventory, audit_log, accounting tables, 1099-NEC tables, etc.). Catches missing migrations.</li>
            <li><strong>Site settings</strong> — required keys present (driver rate, 1099 threshold, low-stock email, damage protection toggle, lead time, etc.)</li>
            <li><strong>Data state</strong> — at least 1 active product, 1 active fleet, 1 admin user; warns if 0 low-stock thresholds set or 0 overhead recorded</li>
            <li><strong>Cron health</strong> — recent audit_log activity, last inbound email worker hit, count of failed email deliveries</li>
          </ul>
          <p className="font-semibold">How to read the output:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li><strong>🚨 Blockers</strong> (red) — fix before launching / testing. Bookings, payments, or core features will fail.</li>
            <li><strong>⚠ Warnings</strong> (amber) — not blocking but worth fixing (e.g., SMS delivery not enabled for your account)</li>
            <li><strong>OK</strong> (green) — verified working</li>
            <li><strong>Info</strong> (grey) — informational counts, not a pass/fail check</li>
          </ul>
          <p className="text-xs text-slate-500">
            💡 Run this BEFORE your first real Stripe charge to confirm live keys are
            in place. Run it AFTER every redeploy if you changed env vars.
            Run it monthly as a sanity check.
          </p>
        </div>
      ),
    },
    {
      id: "1099-nec",
      title: "1099-NEC year-end report (contractor tax filing)",
      icon: FileText,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            The IRS requires a 1099-NEC for every non-employee paid{" "}
            <strong>$600 or more</strong> in a calendar year. This page does the
            compilation work for you so January doesn't become a scramble.
          </p>
          <p className="font-semibold">Where to find it:</p>
          <p className="text-xs">
            <code>/admin/reports/1099-nec</code> — also reachable via the green
            "1099-NEC year-end →" button on <code>/admin/reports</code>.
          </p>

          <p className="font-semibold">How it works:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>Sums every booking expense where the category has the{" "}
              <strong>supports_payroll_hours</strong> flag (payroll, setup_labor,
              teardown_labor, or any custom labor category) — grouped by{" "}
              <code>driver_email</code> — for the selected calendar year</li>
            <li>Each row shows: total paid, hours, bookings, W9 status, TIN last 4,
              address completeness, filed status</li>
            <li>Qualifying drivers (≥ threshold) are shown first; non-qualifying
              ones below for reference</li>
            <li>The 5-stat header tracks: drivers w/ payments, qualifying count,
              total paid out, missing W9 count, filed progress</li>
          </ul>

          <p className="font-semibold">January workflow:</p>
          <ol className="list-decimal pl-5 text-xs space-y-1">
            <li>Switch to the closing tax year (year selector at top)</li>
            <li>For each qualifying driver missing W9, name, TIN, or address:
              click <strong>Profile</strong> to fill it in, click <strong>W9</strong>{" "}
              to mark received</li>
            <li>Download CSV → upload to your filing service (Track1099,
              eFile4Biz, or hand to accountant)</li>
            <li>After each filing, click <strong>Mark filed</strong> so you can
              track progress at a glance</li>
            <li>IRS deadline: <strong>January 31</strong> for both recipient copy +
              IRS filing</li>
          </ol>

          <p className="text-xs text-slate-500">
            💡 <strong>TIN storage:</strong> only the last 4 digits are stored in
            the DB (for verification). The full SSN/EIN lives in the W9 PDF in
            private Supabase storage (bucket: <code>w9</code>). Never paste a
            full SSN into the notes field.
          </p>
          <p className="text-xs text-slate-500">
            💡 The $600 threshold is configurable in{" "}
            <code>site_settings.1099_nec_threshold_cents</code> — change it if
            the IRS raises the limit.
          </p>
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
            ⚙️ <strong>Setup required (one time):</strong> run{" "}
            <code>supabase/driver_1099.sql</code>. Creates the{" "}
            <code>driver_tax_profiles</code> table and seeds the threshold
            site setting.
          </p>
        </div>
      ),
    },
    {
      id: "reports-advanced",
      title: "Advanced reports — cash flow, monthly trends, drivers, LTV",
      icon: Calculator,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            <code>/admin/reports</code> now has four advanced cards beyond the P&amp;L
            summary. They appear in this order:
          </p>

          <p className="font-semibold">1. Cash flow projection (next 90 days)</p>
          <p className="text-xs">
            Bucketed into <strong>Next 7d / 8–30d / 31–60d / 61–90d</strong>. For
            each bucket: confirmed (paid) vs pending payment in dollars, plus
            booking counts. Stacked bar chart shows distribution at a glance.
          </p>
          <p className="text-xs">
            Use it to: plan staffing for busy weekends, see if the rest of the
            month is going to be slow (run a promo), spot when pending bookings
            are too high (chase those payments).
          </p>

          <p className="font-semibold">2. Monthly P&amp;L (last 12 months side-by-side)</p>
          <p className="text-xs">
            One column per month: Bookings count, Revenue, − Direct costs,
            = Gross profit, − Overhead, = NET. Plus a Total column on the right.
            Independent of the date filter (always trailing 12 months).
          </p>
          <p className="text-xs">
            Use it to: spot seasonality (which months are profitable vs which
            burn cash), see if margins are improving month over month, identify
            outlier months that need investigation.
          </p>

          <p className="font-semibold">3. Top drivers / crew (labor hours in date range)</p>
          <p className="text-xs">
            Sums any booking expense whose category has the{" "}
            <strong>supports_payroll_hours</strong> flag (payroll, setup_labor,
            teardown_labor, or any custom you add), grouped by{" "}
            <code>driver_email</code>. Shows hours, payroll $, $ per hour,
            bookings count.
          </p>
          <p className="text-xs">
            Use it to: prepare payroll runs (export the date range, pay each
            driver), spot top performers, prep 1099-NEC year-end totals (set
            the range to YTD).
          </p>
          <p className="text-xs text-amber-700">
            ⚠ This only shows drivers when the <code>driver_email</code> field is
            filled on the expense. Make sure your team fills it when recording
            payroll on a booking.
          </p>

          <p className="font-semibold">4. Customer LTV (lifetime value, top 25)</p>
          <p className="text-xs">
            All-time totals per customer. Shows bookings, lifetime revenue,
            avg per booking, first/last booking date, days since last, plus a
            status badge:
          </p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>🐳 <strong>Whale</strong> — top 3 by LTV with 2+ bookings</li>
            <li><strong>Active</strong> — booked in last 90 days + repeat</li>
            <li><strong>Returning</strong> — repeat customer</li>
            <li><strong>One-time</strong> — single booking on record</li>
            <li><strong>Lapsed 1yr+</strong> — booked once but hasn't in over a year (great win-back targets)</li>
          </ul>
          <p className="text-xs">
            Use it to: send a personal thank-you to whales, win-back coupons to
            lapsed customers, mass-tag active customers in GHL for VIP campaigns.
          </p>
        </div>
      ),
    },
    {
      id: "low-stock",
      title: "Inventory low-stock alerts (auto)",
      icon: AlertTriangle,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Each inventory item can set a <strong>Low-stock alert at ≤</strong>{" "}
            threshold (in the item form). A daily cron at 1 PM UTC scans every
            active item and emails the admin if{" "}
            <code>(quantity_owned - quantity_in_use) ≤ threshold</code>.
          </p>
          <p className="font-semibold">Smart re-alert logic:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>You only get ONE email per item per low-stock event</li>
            <li>Once you restock above the threshold, the alert flag resets — next time it dips below you get a fresh alert</li>
            <li>0 (default) disables the alert for that item</li>
          </ul>
          <p className="font-semibold">Where alerts appear:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li><strong>Email digest</strong> — grouped by category, shows available/owned, threshold, location. Goes to <code>low_stock_alert_email</code> site setting (or <code>ADMIN_ALERT_EMAIL</code> env var if blank)</li>
            <li><strong>Amber banner on /admin/inventory</strong> — always-on, shows ALL items currently below threshold (not just newly-low). Updates live whenever you refresh the page.</li>
            <li><strong>Per-row "low" badge</strong> in the inventory table — amber AlertTriangle next to the available count</li>
          </ul>
          <p className="text-xs text-slate-500">
            💡 To trigger manually for testing:{" "}
            <code>curl -H "Authorization: Bearer $CRON_SECRET" https://itsalwaysfun-rental.vercel.app/api/cron/low-stock-alert</code>
          </p>
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
            ⚙️ <strong>Setup required (one time):</strong> run{" "}
            <code>supabase/inventory_low_stock.sql</code> in the Supabase SQL editor.
            This adds <code>low_stock_threshold</code> + <code>low_stock_alerted_at</code>{" "}
            columns to <code>inventory_items</code> and seeds the <code>low_stock_alert_email</code>{" "}
            site setting.
          </p>
        </div>
      ),
    },
    {
      id: "accounting",
      title: "Accounting — true profit per booking + monthly overhead",
      icon: Calculator,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Most rental businesses look at booking <strong>revenue</strong> and call it a
            day. To know your <strong>real</strong> profit you also need: (a) the
            direct costs of running each event (gas, payroll, tolls, propane,
            damage repairs) and (b) the fixed monthly burden you carry whether
            you book or not (rent, insurance, software, vehicle payments). The
            accounting module gives you both.
          </p>

          <p className="font-semibold">1. Direct costs per booking</p>
          <p className="text-xs">
            Open any booking in <code>/admin/bookings/[id]</code> — there's now a{" "}
            <strong>Costs for this booking</strong> card under Damages with a live
            margin summary (Revenue / Direct costs / Gross margin). Click{" "}
            <strong>+ Add expense</strong>:
          </p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>⛽ <strong>Gas / fuel</strong>, 🛣 <strong>Tolls</strong>, 📦 <strong>Consumables</strong> (propane, ice, batteries), 🔧 <strong>Damage repair</strong>, 📋 <strong>Permit / venue fee</strong>, 🧼 <strong>Cleaning fee</strong>, 🅿️ <strong>Parking</strong>, 🏨 <strong>Lodging</strong>, 🗂 <strong>Other</strong> — type description + amount</li>
            <li>👥 <strong>Payroll (driver hours)</strong>, 🔨 <strong>Setup labor</strong>, 🧹 <strong>Teardown labor</strong> — enter the hours; the form auto-suggests the dollar amount from the default driver hourly rate (set as <code>default_driver_hourly_rate_cents</code> in site_settings, defaults to $20/hr). Optionally tag a driver email for payroll attribution.</li>
            <li className="text-slate-500">Click <strong>Categories</strong> next to the Add expense button to manage the list — add new categories (e.g. "Vehicle rental"), edit labels, deactivate ones you don't use. Categories with the labor-hours flag show the hours UI automatically.</li>
          </ul>
          <p className="text-xs">
            Every expense is logged in the audit log (<code>expense.gas</code>,{" "}
            <code>expense.payroll</code>, etc.) with the admin email + amount, so
            you have an immutable record for tax season.
          </p>

          <p className="font-semibold">2. Monthly overhead</p>
          <p className="text-xs">
            Go to <code>/admin/overhead</code> (admin-only nav entry). Add one
            line per fixed monthly cost. The category dropdown is{" "}
            <strong>fully editable</strong> — click <em>Manage categories</em>{" "}
            at the top to add/edit/deactivate categories. Seeded with ~36
            standard chart-of-accounts categories grouped by:
          </p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li><strong>Occupancy</strong> — Rent, Storage/warehouse, Utilities, Phone/internet</li>
            <li><strong>Insurance</strong> — General liability, Vehicle, Workers comp, Property/equipment</li>
            <li><strong>Vehicles &amp; equipment</strong> — Vehicle payments, Vehicle maintenance, Equipment maintenance, Equipment lease, Depreciation</li>
            <li><strong>Personnel</strong> — Salaried payroll, Payroll taxes, Benefits</li>
            <li><strong>Professional</strong> — Accountant, Attorney, Consultants</li>
            <li><strong>Financial</strong> — Merchant fees (Stripe %), Loan/debt service, Interest, Bank fees</li>
            <li><strong>Marketing</strong> — Advertising, Listings (GigSalad/The Bash), Print/signage, Trade shows</li>
            <li><strong>Software</strong> — SaaS subs, Memberships/dues (Chamber, IAAPA), Training</li>
            <li><strong>Operations</strong> — Permits/licenses, Office supplies, Cleaning supplies, Uniforms, Travel/mileage, Meals</li>
            <li><strong>Taxes (recurring)</strong> — Property tax, Franchise tax, Business license tax</li>
            <li><strong>Other</strong> — catch-all</li>
          </ul>
          <p className="text-xs">
            Each item has an <strong>Effective from</strong> date (when the cost
            started) and optional <strong>Effective to</strong> (if it ended — use
            the <em>End</em> button on the row). Cost changes are recorded as new
            rows so you have history (e.g. insurance went from $400 → $450 in
            Feb). Deactivating a category just hides it from the dropdown —
            historical overhead rows that used it stay intact.
          </p>

          <p className="font-semibold">3. Profit &amp; Loss report</p>
          <p className="text-xs">
            <code>/admin/reports</code> now shows a yellow-bordered{" "}
            <strong>Profit &amp; Loss</strong> card at the top, scoped to the
            same date range as the rest of the page:
          </p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li><strong>Revenue</strong> — paid bookings whose event_date falls in range</li>
            <li><strong>Direct costs</strong> — sum of all booking_expenses for those bookings, broken down by category</li>
            <li><strong>Gross profit</strong> — Revenue − Direct costs (with % margin)</li>
            <li><strong>Overhead allocated</strong> — monthly overhead prorated by days the cost was active during the period (e.g. $1500/mo over 30 days = $50/day × 30 days = $1500). Broken down by category.</li>
            <li><strong>NET PROFIT</strong> — Gross profit − Allocated overhead, with net margin %. Green ring if positive, amber if negative.</li>
          </ul>

          <p className="text-xs text-slate-500">
            💡 <strong>If your "net profit" shows 100%</strong>, you have zero
            costs recorded — you'll see an amber warning telling you to record
            expenses + overhead. Most rentals run at 30-50% real margin once
            gas + payroll + overhead are honest.
          </p>
          <p className="text-xs text-slate-500">
            💡 The P&amp;L pulls revenue by <strong>event_date</strong> (not
            created_at) — this matches the way the rest of the reports page
            thinks about "when revenue happened" (the day you delivered),
            which is also how your accountant will want to see it.
          </p>

          <p className="font-semibold">4. CSV export for accountant / QuickBooks</p>
          <p className="text-xs">
            Below the P&amp;L card on <code>/admin/reports</code> there's a green
            "Accounting CSV export" box with three download buttons (scoped to
            the same date range):
          </p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li><strong>Booking expenses</strong> — one row per per-booking expense (date, category label, amount, booking ID, customer, event date, driver hours, etc.)</li>
            <li><strong>Overhead</strong> — one row per fixed monthly line active in the period (with group, category, monthly + annual amounts)</li>
            <li><strong>P&amp;L summary</strong> — single multi-line CSV (Revenue, each direct-cost category, Gross profit, each overhead category, NET PROFIT)</li>
          </ul>
          <p className="text-xs text-slate-500">
            💡 Send the three files to your accountant at tax time, or import
            into QuickBooks Online / Xero / a spreadsheet. Dates are ISO format
            (YYYY-MM-DD) and amounts are plain decimals with no $ signs — universally
            compatible.
          </p>
          <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
            ⚙️ <strong>Setup required (one time, in this order):</strong>
            <ol className="list-decimal pl-5 mt-1">
              <li>Run <code>supabase/accounting.sql</code> — creates{" "}
                <code>booking_expenses</code> + <code>overhead_costs</code>{" "}
                tables, RLS, and <code>default_driver_hourly_rate_cents</code>{" "}
                setting</li>
              <li>Run <code>supabase/overhead_categories.sql</code> — creates
                the dynamic <code>overhead_categories</code> table, drops the
                fixed CHECK on <code>overhead_costs.category</code>, and seeds
                ~36 standard categories</li>
              <li>Run <code>supabase/booking_expense_categories.sql</code> —
                creates the dynamic <code>booking_expense_categories</code>{" "}
                table (with <code>supports_payroll_hours</code> flag for
                labor-style categories), drops the fixed CHECK on{" "}
                <code>booking_expenses.category</code>, and seeds 12 categories</li>
            </ol>
            Until you run all three, <code>/admin/overhead</code> and booking
            detail pages will throw errors.
          </p>
        </div>
      ),
    },
    {
      id: "api-keys",
      title: "API keys — integrate with Zapier, Make, your back-office",
      icon: Key,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Generate API tokens to read your data from external tools.
            Manage at <code>/admin/api-keys</code>.
          </p>
          <p className="font-semibold">Available endpoints (GET only, JSON):</p>
          <ul className="list-disc pl-5 space-y-1 text-xs">
            <li><code>/api/v1/bookings</code> — list bookings. Query: <code>?limit=50&amp;since=2026-01-01&amp;status=confirmed</code></li>
            <li><code>/api/v1/customers</code> — list customer profiles</li>
            <li><code>/api/v1/products</code> — list catalog products</li>
          </ul>
          <p className="font-semibold">Quick start:</p>
          <pre className="bg-slate-900 text-emerald-300 text-xs p-3 rounded overflow-x-auto">
{`curl https://getrentalflow.com/api/v1/bookings \\
  -H "Authorization: Bearer rfk_..."`}
          </pre>
          <p className="font-semibold">Scopes:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li><code>bookings:read</code> — read bookings</li>
            <li><code>customers:read</code> — read customers</li>
            <li><code>products:read</code> — read products</li>
            <li><code>*</code> — read ALL current + future endpoints</li>
          </ul>
          <p className="bg-amber-50 border border-amber-200 rounded p-2 text-xs">
            ⚠️ The full key (starting <code>rfk_</code>) is shown ONCE at
            creation. Copy it immediately — we only store a hash. If lost,
            revoke and create a new one.
          </p>
          <p className="font-semibold">Expiry options:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li><strong>Never</strong> — default, persists until you revoke</li>
            <li><strong>30d / 90d / 1y</strong> — auto-expires for security rotation</li>
          </ul>
          <p className="text-xs text-slate-500">
            Each key tracks <code>last_used_at</code> + <code>last_used_ip</code>
            automatically. Click any key in the list to see when it was last
            called.
          </p>
        </div>
      ),
    },
    {
      id: "calendar-feed",
      title: "Calendar ICS feed — sync bookings to Google Cal / Apple Cal",
      icon: CalendarIcon,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Subscribe to your bookings calendar in any calendar app. Read-only
            feed that auto-refreshes (every 1-24h depending on the calendar app).
          </p>
          <p className="font-semibold">Get your feed URL:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>Go to <code>/admin/settings</code> → scroll to <strong>Calendar feed</strong></li>
            <li>Copy the secret URL (format: <code>https://getrentalflow.com/api/calendar/&lt;your-token&gt;.ics</code>)</li>
            <li>Click <strong>Regenerate token</strong> if you ever need to revoke an existing subscription</li>
          </ul>
          <p className="font-semibold">Add to Google Calendar:</p>
          <ol className="list-decimal pl-5 text-xs space-y-1">
            <li>Open Google Calendar</li>
            <li>Left sidebar: <strong>Other calendars → +  → From URL</strong></li>
            <li>Paste your ICS feed URL → <strong>Add calendar</strong></li>
            <li>Bookings appear within ~15 min, then sync hourly</li>
          </ol>
          <p className="font-semibold">Add to Apple Calendar (Mac):</p>
          <ol className="list-decimal pl-5 text-xs space-y-1">
            <li>Calendar app → <strong>File → New Calendar Subscription</strong></li>
            <li>Paste your ICS URL → choose auto-refresh interval (1h recommended)</li>
          </ol>
          <p className="font-semibold">What's included per event:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>Event title: <code>Booking #&lt;id&gt; — &lt;Customer name&gt;</code></li>
            <li>Time: delivery_time → pickup_time (or event_date if same-day)</li>
            <li>Location: delivery address</li>
            <li>Notes: products, total, customer phone</li>
            <li>Status: cancelled bookings excluded from feed</li>
          </ul>
          <p className="bg-amber-50 border border-amber-200 rounded p-2 text-xs">
            ⚠️ The URL contains a secret token. Anyone with the URL can view
            your bookings. Don't share it publicly. Regenerate if exposed.
          </p>
        </div>
      ),
    },
    {
      id: "webhooks",
      title: "Webhooks — get notified the instant something happens",
      icon: Webhook,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Subscribe to events in your business via HTTP POST. Manage at{" "}
            <code>/admin/webhooks</code>. Perfect for Zapier, Make, custom apps.
          </p>
          <p className="font-semibold">Available events:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li><code>booking.created</code> — new booking submitted</li>
            <li><code>booking.confirmed</code> — payment received, slot locked in</li>
            <li><code>booking.paid</code> — fully paid</li>
            <li><code>booking.cancelled</code> — booking cancelled</li>
            <li><code>customer.created</code> — new customer profile</li>
            <li><code>quote.sent</code>, <code>quote.approved</code></li>
            <li><code>*</code> — wildcard, subscribe to ALL events</li>
          </ul>
          <p className="font-semibold">Payload format:</p>
          <pre className="bg-slate-900 text-emerald-300 text-xs p-3 rounded overflow-x-auto">
{`POST <your URL>
Content-Type: application/json
X-RentalFlow-Event: booking.created
X-RentalFlow-Signature: sha256=<hex>

{
  "event": "booking.created",
  "tenant_id": "uuid",
  "timestamp": "2026-05-30T12:34:56Z",
  "data": {
    "booking_id": "...",
    "customer_email": "...",
    "event_date": "2026-06-15",
    "total_amount": 25000
  }
}`}
          </pre>
          <p className="font-semibold">Signature verification (recommended):</p>
          <p className="text-xs">
            Compute <code>HMAC-SHA256(secret, body)</code> and compare with the{" "}
            <code>X-RentalFlow-Signature</code> header. The secret is shown ONCE
            when you create the webhook — store it safely. If the signatures
            match, the request came from us.
          </p>
          <p className="font-semibold">Connecting to Zapier:</p>
          <ol className="list-decimal pl-5 text-xs space-y-1">
            <li>In Zapier, create a "Webhook by Zapier" → "Catch Hook" zap</li>
            <li>Copy the Zapier hook URL</li>
            <li>In RentalFlow <code>/admin/webhooks</code>, click <strong>New webhook</strong></li>
            <li>Paste URL, name "Zapier", check <code>booking.created</code></li>
            <li>Click <strong>Send test event</strong> (button on the webhook row)</li>
            <li>Back in Zapier, test should appear → continue building automation</li>
          </ol>
          <p className="font-semibold">Delivery details:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>10-second timeout per delivery — your endpoint should respond quickly</li>
            <li>Return HTTP 2xx for success. Anything else = failure</li>
            <li>No automatic retries in MVP (will be added) — failed deliveries are logged but not retried</li>
            <li>Pause/resume any webhook with the power button</li>
            <li>Send a test event anytime to verify your endpoint</li>
          </ul>
          <p className="bg-amber-50 border border-amber-200 rounded p-2 text-xs">
            ⚠️ The signing secret <code>whsec_…</code> is shown ONLY at creation.
            Lost it? Delete the webhook and create a new one.
          </p>
        </div>
      ),
    },
    {
      id: "ai-business-assistant",
      title: "AI business assistant — ask questions about your business",
      icon: SparklesIcon,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Click the <strong>emerald sparkles button</strong> at the bottom-right
            of any /admin page. A chat panel opens where you can ask anything
            about your rental business state.
          </p>
          <p className="font-semibold">Example questions:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>¿Cuántas reservas tengo este mes?</li>
            <li>What's my busiest day in the last 90 days?</li>
            <li>Top 3 products by bookings</li>
            <li>How much revenue last 30 days?</li>
            <li>How many customers signed up this month?</li>
            <li>How do I issue a refund? (it'll search your knowledge base)</li>
          </ul>
          <p className="font-semibold">Features:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li><strong>Voice input</strong> — mic button (Chrome/Edge). Auto-detects Spanish or English.</li>
            <li><strong>Live data</strong> — answers are pulled from YOUR live business state, never invented.</li>
            <li><strong>Tool transparency</strong> — under each AI reply, you see which database queries it ran.</li>
            <li><strong>Privacy</strong> — sees ONLY your business. No cross-tenant data.</li>
          </ul>
          <p className="font-semibold">Limitations:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>Can't take actions (refunds, edits, sends) — read-only by design</li>
            <li>For actions, it'll point you to the right /admin page</li>
            <li>Doesn't have memory between sessions (each conversation starts fresh)</li>
          </ul>
          <p className="text-xs text-slate-500 bg-emerald-50 border border-emerald-200 rounded p-2">
            💡 Use it to quickly check stats without clicking through pages.
            Replaces the question "where do I see X?" with "just ask".
          </p>
        </div>
      ),
    },
    {
      id: "goals",
      title: "Goals tracker — set targets, watch progress live",
      icon: Tag,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Set business goals at <code>/admin/goals</code>. The page shows
            live progress + a projected hit date based on your current
            velocity.
          </p>
          <p className="font-semibold">Metrics you can track:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li><strong>Bookings in last 30 days</strong> — counts non-cancelled bookings</li>
            <li><strong>Revenue in last 30 days</strong> — sums paid total_amount</li>
            <li><strong>New customers in last 30 days</strong> — from customer_profiles</li>
            <li><strong>Repeat customer rate (%)</strong> — customers with 2+ bookings ÷ total customers</li>
          </ul>
          <p className="font-semibold">Status colors:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>🟢 <strong>Ahead</strong> — projected to hit target 7+ days early</li>
            <li>🔵 <strong>On track</strong> — projected to hit target on time</li>
            <li>🟡 <strong>Behind</strong> — projected to miss by up to 7 days</li>
            <li>🔴 <strong>Missed</strong> — past target date without hitting</li>
            <li>✅ <strong>Achieved</strong> — current value ≥ target</li>
          </ul>
          <p className="text-xs text-slate-500">
            💡 Projection assumes constant velocity. If you set a goal early
            in the month, the projection adjusts as more data accumulates.
            Delete + re-create if your strategy changes.
          </p>
        </div>
      ),
    },
    {
      id: "api-v1-write",
      title: "API v1 — create bookings + check availability programmatically",
      icon: Key,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            In addition to read endpoints (see "API keys" above), the v1 API
            now supports creating bookings and checking availability from
            external systems.
          </p>
          <p className="font-semibold"><code>POST /api/v1/bookings</code> — create a booking draft</p>
          <p className="text-xs">Scope required: <code>bookings:write</code></p>
          <pre className="bg-slate-900 text-emerald-300 text-xs p-3 rounded overflow-x-auto">
{`curl -X POST https://getrentalflow.com/api/v1/bookings \\
  -H "Authorization: Bearer rfk_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "customer_first_name": "Jane",
    "customer_last_name": "Doe",
    "customer_email": "jane@example.com",
    "customer_phone": "555-1234",
    "event_date": "2026-07-15",
    "product_id": "uuid-of-product",
    "total_amount": 25000,
    "address": "123 Main St",
    "city": "Jacksonville",
    "state": "FL",
    "zip": "32256",
    "external_ref": "your-system-id"
  }'`}
          </pre>
          <p className="text-xs">
            Returns the new booking with status <code>pending_payment</code>.
            Customer still needs to be invoiced/paid through your normal flow.
            Fires <code>booking.created</code> webhook (source: "api").
          </p>
          <p className="font-semibold mt-3"><code>GET /api/v1/availability</code> — what dates are open</p>
          <p className="text-xs">Scope required: <code>bookings:read</code></p>
          <pre className="bg-slate-900 text-emerald-300 text-xs p-3 rounded overflow-x-auto">
{`curl "https://getrentalflow.com/api/v1/availability?product_id=PRODUCT_UUID&start=2026-07-01&end=2026-07-31" \\
  -H "Authorization: Bearer rfk_..."`}
          </pre>
          <p className="text-xs">
            Returns day-by-day: <code>booked</code> count, <code>available</code>{" "}
            (stock − booked), <code>sold_out</code> boolean. Perfect for
            building a custom checkout / Zapier branching.
          </p>
          <p className="bg-amber-50 border border-amber-200 rounded p-2 text-xs">
            ⚠️ The new <code>bookings:write</code> scope must be selected when
            creating the API key. Existing read-only keys can't POST.
          </p>
        </div>
      ),
    },
    {
      id: "custom-reports",
      title: "Custom Report Builder — build any report you want",
      icon: BarChart3,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            At <code>/admin/reports</code> click the violet <strong>"✨ Custom
            report builder"</strong> button to open <code>/admin/reports/custom</code>.
            Build, save, and revisit any report combining dimensions + metrics
            + filters.
          </p>
          <p className="font-semibold">How it works:</p>
          <ol className="list-decimal pl-5 text-xs space-y-1">
            <li><strong>Name</strong> the report (e.g. "Monthly revenue by product")</li>
            <li><strong>Group by</strong> 1-2 dimensions: day/week/month, product, status, surface, customer</li>
            <li><strong>Show me</strong> 1-3 metrics: count of bookings, sum revenue, sum paid, avg booking value, unique customers, count cancelled</li>
            <li><strong>Filter</strong> by date range, status, payment, product</li>
            <li><strong>Display as</strong> Bar / Line / Table</li>
            <li>Click <strong>Preview</strong> to see results without saving</li>
            <li>Click <strong>Save</strong> to keep it forever — find it again at <code>/admin/reports/custom</code></li>
          </ol>
          <p className="font-semibold">Common reports to try:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li><strong>Monthly revenue trend</strong>: dim=Month, metric=Sum paid, filter=status ≠ cancelled, chart=Line</li>
            <li><strong>Top products</strong>: dim=Product, metric=Count bookings + Sum revenue, chart=Bar</li>
            <li><strong>Busiest days of week</strong>: dim=Day, metric=Count, sort by metric desc, chart=Bar</li>
            <li><strong>Cancellation rate by product</strong>: dim=Product, metric=Count + Count cancelled, chart=Table</li>
            <li><strong>Customer concentration</strong>: dim=Customer, metric=Sum revenue, sort desc, chart=Table</li>
          </ul>
          <p className="font-semibold">Tips:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>Add a date range filter (event_date ≥ X and ≤ Y) to narrow what's pulled — faster + cleaner</li>
            <li>Sort by metric desc to find top performers</li>
            <li>Use 2 dimensions for a pivot effect (e.g. Month × Product)</li>
            <li>Saved reports remember everything — name, filters, chart type</li>
            <li>Star a report (⭐) to pin it to the top of the list</li>
          </ul>
          <p className="bg-amber-50 border border-amber-200 rounded p-2 text-xs">
            ⚠️ Engine reads up to 5000 bookings per query. If you have more,
            tighten the date range filter. Bookings older than the filter
            range aren't included.
          </p>
        </div>
      ),
    },
    {
      id: "home-sections",
      title: "Home page extra sections — Stats, Why us, CTA, Custom HTML",
      icon: SparklesIcon,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            At <code>/admin/site/sections</code> you can turn on/off 4 extra
            sections for your public home page. Each section has a simple
            form — fill it in, toggle it on, it appears on your site
            automatically.
          </p>
          <p className="font-semibold">The 4 sections:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li><strong>📊 Stats banner</strong> — 3 numbers + labels (e.g. "10+ years experience"). Goes right after your hero.</li>
            <li><strong>✨ Why choose us</strong> — 3 feature cards explaining why customers should book with you.</li>
            <li><strong>🎯 Call-to-action banner</strong> — big banner before the footer with one button (e.g. "Ready to book?").</li>
            <li><strong>🧩 Custom HTML block</strong> — for power users. Paste your own HTML. Auto-sanitized for safety.</li>
          </ul>
          <p className="font-semibold">How to use:</p>
          <ol className="list-decimal pl-5 text-xs space-y-1">
            <li>Go to <code>/admin/site/sections</code></li>
            <li>Toggle "Shown" on the section you want</li>
            <li>Fill in the fields (defaults are pre-filled — you can use them as-is)</li>
            <li>Click <strong>Save</strong></li>
            <li>Open your public site in a new tab — refresh — see the section live</li>
          </ol>
          <p className="font-semibold">Display order:</p>
          <p className="text-xs">
            Each section has a number (lower = higher on the page). Sections
            with order &lt; 50 appear after the hero. Sections with order ≥ 50
            appear before the footer. Adjust the number to move them around.
          </p>
          <p className="bg-amber-50 border border-amber-200 rounded p-2 text-xs">
            ⚠️ Custom HTML: <code>&lt;script&gt;</code>, <code>&lt;iframe&gt;</code>,
            inline event handlers, and <code>javascript:</code> URLs are
            automatically stripped for security. Use it for layout HTML +
            inline styles only.
          </p>
        </div>
      ),
    },
    {
      id: "referrer-coupons",
      title: "Referrer-assigned coupons — track referrals via coupon code",
      icon: Ticket,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            At <code>/admin/coupons</code> you can <strong>assign a coupon to
            a specific customer</strong>. When anyone uses that coupon, the
            assigned customer earns the referral commission automatically —
            no cookie tracking needed.
          </p>
          <p className="font-semibold">How to assign:</p>
          <ol className="list-decimal pl-5 text-xs space-y-1">
            <li>Go to <code>/admin/coupons</code></li>
            <li>Click <strong>+ Add coupon</strong> (or edit existing)</li>
            <li>Fill in code (e.g. <code>MARIA20</code>), discount, etc.</li>
            <li>In the violet box <strong>"Assign to a customer"</strong>, search by email</li>
            <li>Pick the customer → they're linked as referrer</li>
            <li>Save</li>
          </ol>
          <p className="font-semibold">What the customer sees:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>The coupon appears in their <code>/portal/referrals</code> page</li>
            <li>They share it via Copy / WhatsApp / Email</li>
            <li>Each use earns them commission (% of post-discount, pre-tax total)</li>
          </ul>
          <p className="font-semibold">Commission rules (anti-double-pay):</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li><strong>If buyer was referred via cookie</strong> (the <code>?ref=</code> link), that referrer gets commission — coupon attribution is ignored.</li>
            <li><strong>If only coupon</strong> is used → the coupon's assigned referrer gets commission.</li>
            <li><strong>Never both</strong> — exactly one commission per booking.</li>
            <li><strong>First paid booking only</strong> per customer email — repeat bookings don't pay commission.</li>
          </ul>
          <p className="font-semibold">Commission calculation:</p>
          <p className="text-xs">
            Commission = <strong>(total_amount − tax)</strong> × <code>referral_commission_pct</code>.
            Always post-discount, pre-tax. Tax we collect for the state isn't part of the referrer's earnings.
          </p>
          <p className="bg-amber-50 border border-amber-200 rounded p-2 text-xs">
            ⚠️ Customer must have logged into the portal at least once for them
            to appear in the search. New customers without portal accounts
            can't be assigned a coupon yet.
          </p>
          <p className="bg-emerald-50 border border-emerald-200 rounded p-2 text-xs">
            💡 <strong>Why this is better than just ref links:</strong> if a friend opens
            the site directly (no cookie) or shares the coupon code outside
            the link, you still know who referred them. No attribution lost.
          </p>
        </div>
      ),
    },
    {
      id: "tests",
      title: "Testing checklist",
      icon: HelpCircle,
      content: (
        <div className="space-y-2 text-sm">
          <p>Before going live, test these end-to-end:</p>
          <ul className="space-y-1 text-xs">
            <li>☐ Public booking → Stripe test card <code>4242 4242 4242 4242</code> → check email + SMS arrive</li>
            <li>☐ Create quote → send → approve as customer → pay</li>
            <li>☐ Login to portal → see bookings → cancel one → confirm email goes out</li>
            <li>☐ Refund a booking from admin → check Stripe + email</li>
            <li>☐ Issue gift card (admin) → use in another booking → check balance decreases</li>
            <li>☐ Buy gift card from <code>/gift-cards</code> (public) → recipient gets email → purchaser gets receipt → card appears in admin list</li>
            <li>☐ Toggle "Public gift card sales" OFF on <code>/admin/gift-cards</code> → confirm <code>/gift-cards</code> shows "call us" message → toggle back ON</li>
            <li>☐ As a referrer in /portal/referrals: request CREDIT payout → admin approves → recipient gets gift card email automatically</li>
            <li>☐ As a referrer: request CASH payout → upload W9 → admin clicks "View W9 form" (opens private signed PDF) → approve → mark as paid with transfer ID</li>
            <li>☐ Book a rental as a customer → sign the liability waiver (test card 4242...) → check signed record exists by querying <code>booking_waivers</code></li>
            <li>☐ Book a rental + check "My venue requires a COI" → fill venue info → admin sees it in <code>/admin/coi</code> → uploads PDF → customer gets email + sees download in portal</li>
            <li>☐ As a customer with a paid booking 8+ hours out: click "Bad weather forecast?" → confirm → gift card code appears in email + booking shows cancelled</li>
            <li>☐ Add a review in <code>/admin/reviews</code> → toggle Featured ON → check it appears in homepage carousel + on <code>/reviews</code> page</li>
            <li>☐ Upload extra product photos in <code>/admin/products/[id]</code> → public <code>/items/[slug]</code> shows carousel + lightbox</li>
            <li>☐ Enable unit tracking on Blowers → bulk-add 14 (BLW-01..BLW-14) → in dispatch, "Pick units" → confirm tags show in truck load</li>
            <li>☐ Add a propane requirement to a generator product with "Per day" checked → book 3 days → checklist shows 3 tanks (not 1)</li>
            <li>☐ In <code>/admin/fleet</code> edit a trailer → mark "electric dolly" as compatible → tag shows in the "Can carry" column</li>
            <li>☐ Add VIN + tag on a vehicle → confirm columns render with uppercase monospace</li>
            <li>☐ Add a CRUD inventory category → confirm it appears in the dropdown when creating an item</li>
            <li>☐ Submit the public <code>/contact</code> form → check (1) row appears in <code>/admin/inbox</code>, (2) admin gets email at ADMIN_ALERT_EMAIL, (3) GHL contact created with general_inquiry tag</li>
            <li>☐ Reply to a contact message from <code>/admin/inbox</code> → check customer receives the reply email, reply appears in the thread, and message is marked resolved</li>
            <li>☐ With unresolved messages: dashboard shows amber "X unread messages in Contact Inbox" panel with top 5</li>
            <li>☐ Run seed_starter_packages.sql → 8 packages appear in <code>/admin/packages</code> (all inactive)</li>
            <li>☐ Edit a package → add 2-3 products from inventory → upload custom image via Upload button → toggle Active → confirm it appears at <code>/packages</code> public</li>
            <li>☐ Change site font: <code>/admin/site</code> → SiteFontPicker → "Quicksand" → Save → public homepage refresh shows new font everywhere</li>
            <li>☐ Self-hosted font: pick "Louis George Cafe (self-hosted)" → upload a .woff2 → Save → public site loads it via @font-face (check page source for the @font-face rule)</li>
            <li>☐ (When configured) Send a test email to your inbound address → appears in /admin/inbox within ~30s with blue "Email" badge</li>
            <li>☐ Create staff + driver users → login as each → verify role gating</li>
            <li>☐ Driver marks stop delivered → captures proof photos + signature</li>
            <li>☐ Record damage with protection vs without → check chargeable amounts</li>
            <li>☐ Run <code>supabase/accounting.sql</code> → in <code>/admin/overhead</code> add a $1500/mo rent line (effective from today) → in any paid booking add a $40 gas expense + 3hr payroll → open <code>/admin/reports</code> → P&amp;L card shows Revenue / Direct costs / Gross / Overhead / NET correctly</li>
          </ul>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Downloadable templates */}
      <div className="card bg-amber-50 border-amber-200">
        <h2 className="font-bold text-brand-navy flex items-center gap-2 mb-3">
          <Download className="h-5 w-5" /> CSV Templates for bulk upload
        </h2>
        <p className="text-xs text-slate-600 mb-3">
          Download each template, fill in your data in Excel/Google Sheets,
          save as CSV, then upload via the "Bulk upload" button on the relevant
          admin page.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {TEMPLATES.map((t) => {
            const Icon = t.icon;
            return (
              <a
                key={t.name}
                href={t.url}
                download
                className="block bg-white border border-slate-200 rounded p-2 hover:border-brand-navy hover:shadow-sm transition"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-brand-navy" />
                  <div className="font-semibold text-sm">{t.name}</div>
                  <Download className="h-3 w-3 text-slate-400 ml-auto" />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">{t.desc}</p>
              </a>
            );
          })}
        </div>
      </div>

      {/* Manual sections */}
      <div className="space-y-2">
        {sections.map((s) => {
          const isOpen = openSection === s.id;
          const Icon = s.icon;
          return (
            <div key={s.id} className="card p-0">
              <button
                onClick={() => setOpenSection(isOpen ? null : s.id)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition"
              >
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-slate-400 flex-shrink-0" />
                )}
                <Icon className="h-5 w-5 text-brand-navy flex-shrink-0" />
                <span className="font-semibold text-brand-navy flex-1">{s.title}</span>
              </button>
              {isOpen && (
                <div className="px-4 pb-4 pt-1 border-t border-slate-100 ml-7">
                  {s.content}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer help */}
      <div className="card text-center text-slate-500 text-sm">
        <p>
          Need help with something not covered here? Email{" "}
          <strong>support@getrentalflow.com</strong> and we'll get back to you.
        </p>
      </div>
    </div>
  );
}
