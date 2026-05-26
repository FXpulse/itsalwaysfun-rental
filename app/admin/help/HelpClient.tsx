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
            This is your complete rental management system for It's Always Fun. It
            handles bookings, payments, customers, inventory, dispatch, drivers,
            damages — everything end-to-end.
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
      title: "Step 7 — Email setup (Resend)",
      icon: Mail,
      content: (
        <div className="space-y-3 text-sm">
          <p>
            Resend handles 10 automated emails (booking confirmation, reminders,
            quotes, etc.). Already configured — domain <code>itsalwaysfun.com</code> verified.
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
      title: "Step 8 — SMS setup (Twilio)",
      icon: Smartphone,
      content: (
        <div className="space-y-3 text-sm">
          <p>SMS auto-sends for booking confirmation + reminder (3 days before event).</p>
          <p>If not working yet, paste these env vars in Vercel:</p>
          <ul className="list-disc pl-5 space-y-1 text-xs font-mono bg-slate-50 p-2 rounded">
            <li>TWILIO_ACCOUNT_SID</li>
            <li>TWILIO_AUTH_TOKEN</li>
            <li>TWILIO_FROM_NUMBER (E.164 format, e.g. +18336604284)</li>
          </ul>
          <p className="text-xs">Twilio cost: ~$0.0075 per SMS US + $1.15/month per number.</p>
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
          <p><strong>Coupons</strong> — discount codes (percent or fixed amount):</p>
          <ol className="list-decimal pl-5 space-y-1 text-xs">
            <li>Go to <code>Coupons</code> → Add</li>
            <li>Customer enters code at checkout</li>
            <li>Create <code>LOYAL10</code> → auto-shown to returning customers in /portal</li>
          </ol>

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
            <li>Disable the option at checkout by toggling <code>coi_request_enabled</code> in <code>/admin/site</code> → legal category</li>
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
            <li><strong>Emailed to admin</strong> via Resend → goes to <code>ADMIN_ALERT_EMAIL</code> env var (defaults to admin@itsalwaysfun.com). Reply-to is set to the customer's email so hitting Reply goes straight to them.</li>
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
            handle first.
          </p>

          <div className="bg-blue-50 border-l-4 border-blue-400 rounded p-3 mt-3 space-y-2">
            <p className="font-bold text-blue-900 text-sm">
              📥 Receive emails sent to bookings@itsalwaysfun.com directly in the inbox
            </p>
            <p className="text-xs text-blue-900">
              Customers replying to booking confirmations or anyone emailing
              bookings@ directly can land in <code>/admin/inbox</code> as new
              messages (with subject + body). One-time setup using Cloudflare
              Email Workers (FREE):
            </p>
            <ol className="list-decimal pl-5 text-xs space-y-1 text-blue-900">
              <li>Verify your domain (itsalwaysfun.com) is on Cloudflare DNS</li>
              <li>Cloudflare dashboard → Email → Email Routing → enable for the domain (this adds MX records)</li>
              <li>Workers & Pages → Create → Email Worker. Paste the Worker code from <code>/email-worker-template.js</code> (see below)</li>
              <li>Set 2 Worker secrets: <code>INBOX_WEBHOOK_URL</code> = your <code>https://itsalwaysfun-rental.vercel.app/api/email/inbound</code> and <code>INBOX_SECRET</code> = a random string</li>
              <li>In Vercel env vars: set <code>INBOUND_EMAIL_SECRET</code> = the SAME random string. Redeploy.</li>
              <li>Email Routing → Routes → custom address <code>bookings@itsalwaysfun.com</code> → "Send to Worker" → pick the one you created</li>
            </ol>
            <p className="text-xs text-blue-900">
              <strong>Test</strong>: send an email from Gmail to <code>bookings@itsalwaysfun.com</code> →
              within ~30s it should appear in <code>/admin/inbox</code> as a new message
              with a blue "Email" badge. Reply from the inbox like any other message.
            </p>
            <p className="text-xs text-blue-900">
              💡 The Worker template is provided in this repo at <code>cloudflare/email-worker.js</code>.
              Copy that whole file into the Worker editor and just deploy.
            </p>
          </div>

          <p className="font-semibold mt-3">Replying directly from the inbox:</p>
          <ul className="list-disc pl-5 text-xs space-y-1">
            <li>Click <strong>Reply</strong> → inline composer opens (no need to leave the app)</li>
            <li>Type the reply in plain text — blank lines become paragraphs</li>
            <li>Customer receives a clean HTML email from <code>bookings@itsalwaysfun.com</code> with your message, sign-off, and the original collapsed at the bottom</li>
            <li><strong>Reply-To is set to your email</strong> so if they reply, it goes to your inbox (not Resend)</li>
            <li>Check <strong>"Mark resolved after sending"</strong> to close the message in one click</li>
            <li>Every reply is logged in the message's thread (sent_by + timestamp), so staff can see what was already said before replying again</li>
            <li>If Resend fails to deliver, the reply still saves to the log with the error — you can copy the text and resend manually</li>
          </ul>
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
            <li>☐ Create staff + driver users → login as each → verify role gating</li>
            <li>☐ Driver marks stop delivered → captures proof photos + signature</li>
            <li>☐ Record damage with protection vs without → check chargeable amounts</li>
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
          Need help with something not covered here? Email <strong>admin@itsalwaysfun.com</strong>{" "}
          or check the GitHub repo for technical details.
        </p>
      </div>
    </div>
  );
}
