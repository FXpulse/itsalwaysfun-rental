# It's Always Fun — Admin Platform Manual
## HeyGen-Ready Video Script

**Total runtime estimate:** ~35–45 minutes
**Format:** AI narrated walkthrough with screen recordings + screenshots
**Tone:** Friendly, confident, professional. Talk to the admin like a peer.
**Pacing target:** ~150 words/minute, ~30–45 seconds per section narration block.

---

## 🎬 How to use this document with HeyGen

1. **Choose ONE avatar + voice** for the whole manual (consistency). Recommended: clear, warm female or male voice, American English accent.
2. For each section below: capture the screenshots/recordings listed → paste the narration text into HeyGen as a scene → set the visual to your screen recording.
3. Use HeyGen's **caption track** for the on-screen call-outs (text overlay highlighting UI elements).
4. Render sections individually (easier to update one screen than re-render the whole thing).

---

# 🎯 OPENER

**Runtime:** ~25 seconds
**Visual:** Static title card with the It's Always Fun logo + "Admin Platform Manual" subtitle. Soft fade to admin dashboard screenshot.

**Narration:**
> Welcome to your It's Always Fun admin platform. In the next forty minutes you'll learn how to run your entire rental business from one dashboard — from taking online bookings to dispatching your team in the morning to keeping customers happy after the event. Let's get started.

---

# SECTION 1 — Your Daily Home: The Dashboard

**Runtime:** ~45 seconds
**Screenshots / recordings:**
- Full dashboard view (`/admin/dashboard`)
- Close-up of the "X need attention" pill in header
- Close-up of an alert panel (e.g. pending payments)

**Narration:**
> Every morning, start here. The dashboard is your home base — it shows you exactly what needs attention today. The pill at the top counts everything: pending payments, unresolved damages, payouts ready, customer messages, expiring quotes. Click any alert panel to jump straight to that work. The four cards across the top give you today's numbers at a glance: bookings today, bookings this week, revenue this week, and pending payments. If those numbers don't match your expectations, you'll know in five seconds.

**On-screen call-outs:**
- Pill: "X need attention"
- KPI cards
- Alert panels expand

**Transition:** "Now let's see where those bookings actually come from."

---

# SECTION 2 — How Customers Book Online

**Runtime:** ~60 seconds
**Screenshots / recordings:**
- Public homepage
- Click "Order by Date" → date picker
- Pick a category → product
- Customer info step (highlight: address, surface, power, waiver, COI)
- Stripe payment step
- Confirmation screen

**Narration:**
> The public site is built to convert. Customers land on your homepage, pick a date, browse by category, choose a rental, and fill in their event details. Notice the smart fields: surface type tells us if we need extra anchors, the power supply question triggers the optional power package, and the liability waiver gets signed right here with their typed name as a digital signature. They pay 100% upfront through Stripe — no deposits, no follow-up calls — and the moment the payment clears, the booking is confirmed, the customer gets an email and SMS, and you'll see it on your dashboard.

**On-screen call-outs:**
- Calendar with blocked dates
- Waiver checkbox + signature field
- "Pay & Confirm Rental" button
- Confirmation screen

**Transition:** "That booking lands in your bookings list — let's see what you do with it."

---

# SECTION 3 — Managing Bookings

**Runtime:** ~50 seconds
**Screenshots / recordings:**
- `/admin/bookings` list view
- Filter by status
- Open one booking → detail page
- Show: addons, damages, refund button

**Narration:**
> Every booking lives in this list. Filter by status: pending payment, confirmed, delivered, completed, or cancelled. Click any booking to open the detail page — here you see everything: customer contact, event date, address, products and add-ons, payment status, and the signed waiver record. You can record damages, mark refunds, modify dates, or cancel with one click. The delivery checklist on the right shows exactly what to load on the truck for this booking, computed from your product setup. No more sticky notes.

**On-screen call-outs:**
- Status filter tabs
- Delivery checklist box
- Refund button
- Damage record form

**Transition:** "Speaking of products — let's set yours up properly."

---

# SECTION 4 — Products: Your Rentable Catalog

**Runtime:** ~55 seconds
**Screenshots / recordings:**
- `/admin/products` list
- Open a product detail page
- Image gallery section (upload + reorder)
- Inventory requirements section
- "Per day" checkbox for propane

**Narration:**
> Products are the bouncers, slides, and add-ons your customers rent. Each one has a name, price per day, optional weekend rate, stock count, and a primary cover image. But there's more under the hood. The photo gallery lets you add multiple shots customers can flip through with a lightbox carousel. Inventory requirements tell the system what to load with each rental — sandbags for concrete surface, a propane tank per day for the generator, you name it. Configure once, and every booking automatically gets the right delivery checklist.

**On-screen call-outs:**
- Upload button on gallery
- "Set as primary" star
- Per-day checkbox in requirements
- 🗓 consumable badge

**Transition:** "Behind the products is your operational gear — let's go there."

---

# SECTION 5 — Inventory: Track Every Piece of Gear

**Runtime:** ~55 seconds
**Screenshots / recordings:**
- `/admin/inventory` list with categories grouped
- Open an item → individual units panel
- Bulk-add example (BLW + 14)
- Show units list with conditions

**Narration:**
> Inventory is your operational gear: generators, blowers, anchors, cables, tarps. Categories keep things organized — manage them with the panel at the top. For high-value items like blowers, turn on individual unit tracking. Click "Bulk add", enter a prefix like BLW and a count of fourteen, and instantly you have BLW-01 through BLW-14, each with its own condition, serial number, and history. Now when something breaks, you know exactly which unit, which booking, and which driver had it last.

**On-screen call-outs:**
- "Bulk add (auto-tag)" button
- Condition status dots (green / amber / red)
- "On route" column

**Transition:** "Those units travel on your fleet — let's set that up."

---

# SECTION 6 — Fleet: Vehicles + Trailers

**Runtime:** ~50 seconds
**Screenshots / recordings:**
- `/admin/fleet` page
- Open vehicle modal → VIN + tag + compatible items
- Show table with "Can carry" tags

**Narration:**
> Your fleet — trucks, vans, trailers — lives here. Each vehicle has a name, VIN, license tag, capacity notes, and importantly, a list of what special gear it can carry. If only Trailer A has the hitch for your electric dolly, mark it here. The fleet table shows compatibility tags at a glance, so when you're planning a delivery that needs special equipment, you instantly know which truck to send.

**On-screen call-outs:**
- VIN + License tag fields (uppercase monospace)
- "Can carry / mount" checkboxes
- Blue tags in the table

**Transition:** "Now let's plan the day's deliveries."

---

# SECTION 7 — Dispatch: Plan Your Day

**Runtime:** ~60 seconds
**Screenshots / recordings:**
- `/admin/dispatch` calendar
- Click a date → planning view
- Create route → assign vehicle + driver
- Drag-assign bookings to the route
- Show truck load (aggregated) + pick units modal

**Narration:**
> Dispatch is where your morning starts. Pick a date, create a delivery route, assign a vehicle and a driver. Then drag the day's bookings into the route. As you do, the truck load panel automatically aggregates everything that needs to be on board — every bouncer, every chair, every propane tank for multi-day rentals. If you have unit tracking on, click "Pick units" to choose the specific BLW units going on this truck. Save, and your driver has a complete loading list before they even pour their coffee.

**On-screen call-outs:**
- Date picker + "Plan tomorrow"
- "Truck load (aggregated)" yellow panel
- Pick units modal with checkboxes
- Tag display (BLW-03 BLW-07)

**Transition:** "Let's see what your driver sees in the field."

---

# SECTION 8 — The Driver View

**Runtime:** ~45 seconds
**Screenshots / recordings:**
- Mobile-sized view of `/driver` or `/admin/dispatch/route/[id]`
- Tap navigation, mark delivered, capture proof + signature

**Narration:**
> Send your driver a magic link, and they get this mobile-optimized view on their phone. The whole route is there in order: customer name, address with a tap-to-navigate button, phone with tap-to-call, and the exact products to drop off at each stop. They mark each stop delivered, capture proof photos and the customer's signature on screen, and record any damages right there. Everything syncs back to your admin in real time.

**On-screen call-outs:**
- Tap-to-call icon
- "Mark delivered" button
- Signature pad
- Photo proof

**Transition:** "Once delivered, the customer experience continues."

---

# SECTION 9 — Customer Portal

**Runtime:** ~45 seconds
**Screenshots / recordings:**
- `/portal` magic-link login
- Dashboard with loyalty banner
- Booking detail with actions (confirm, modify, cancel, weather)
- Referral page

**Narration:**
> Customers get their own portal too — a place to see their bookings, earn loyalty points, share referral links for commission, and manage their event. They can confirm event details, modify the date up to 48 hours before, or self-cancel due to bad weather and instantly get a gift card credit valid for one year. The weather cancellation flow keeps your revenue intact while giving the customer a hassle-free path to rebook.

**On-screen call-outs:**
- Loyalty points balance
- "Bad weather forecast?" blue card
- Referral link + share buttons

**Transition:** "Speaking of referrals and gift cards — let's open the marketing toolbox."

---

# SECTION 10 — Packages: Bundled Deals

**Runtime:** ~55 seconds
**Screenshots / recordings:**
- `/admin/packages` list with toggles
- Section-level toggle (top of page)
- Open a package editor → image upload + items
- Public `/packages` page

**Narration:**
> Packages bundle multiple products at a fixed price — "Birthday Premium" is one click for the customer instead of building a cart. Create one, upload a custom image, pick the products that go inside, set your price. Each package has a quick LIVE/OFFLINE toggle in the list, and there's a master switch at the top to hide the entire packages section from your public site when you need to. The starter pack seeds eight common bundles you can configure in minutes.

**On-screen call-outs:**
- "Public Packages section ON/OFF" master toggle
- Per-package LIVE switch
- Image upload + preview thumbnail

**Transition:** "Want to grow repeat business? Gift cards are your friend."

---

# SECTION 11 — Gift Cards

**Runtime:** ~55 seconds
**Screenshots / recordings:**
- `/admin/gift-cards` list with toggles
- Issue gift card modal
- Public `/gift-cards` purchase flow
- Redemption at checkout (🎁 field)

**Narration:**
> Gift cards work two ways. You can issue one manually from admin — set the amount, enter the recipient email, and the system generates a unique code and emails it instantly. Or you can let customers buy them directly from the public site at /gift-cards. The codes redeem at checkout in the gift icon field, the balance decreases automatically, and any remainder stays on the card for next time. The public sales toggle at the top lets you pause online purchases anytime without taking down the admin tools.

**On-screen call-outs:**
- "Issue gift card" button
- Generated code (monospace)
- 🎁 field at checkout
- "Public gift card sales ON/OFF" toggle

**Transition:** "Now let's keep customers happy after the sale."

---

# SECTION 12 — Customer Reviews

**Runtime:** ~40 seconds
**Screenshots / recordings:**
- `/admin/reviews` list
- Add a review (form)
- Featured toggle
- Homepage carousel + `/reviews` page

**Narration:**
> Real reviews drive bookings. Copy a review from your Google or Facebook page, paste it here with the customer name, rating, and date. Toggle "Featured" to put your best ones in the homepage carousel that rotates every seven seconds. There's also a dedicated reviews page customers can browse, plus a "Leave us a Google review" call-to-action that points right back to your Google Maps listing. Curate the story you want to tell.

**On-screen call-outs:**
- Featured toggle (star)
- Source dropdown (Google, Facebook, etc.)
- Carousel preview on homepage

**Transition:** "And when a customer writes to you, here's where it lands."

---

# SECTION 13 — Contact Inbox

**Runtime:** ~55 seconds
**Screenshots / recordings:**
- `/admin/inbox` list
- Click a message → reply composer
- Dashboard alert panel for new messages
- Cloudflare email forwarding (mention only)

**Narration:**
> Every message from your public contact form lands in the inbox — and it never gets lost, even if email or your CRM fails. You get an instant email notification too. Click any message to reply directly from here using your bookings email address. Customers reply right back into the inbox, creating a clean thread. Mark resolved when you're done, optionally noting how you handled it. New messages also pop on your dashboard with an amber alert so you never miss one.

**On-screen call-outs:**
- Reply composer inline
- Delivery badges (Email ✓ / GHL ✓)
- Dashboard alert panel

**Transition:** "For venues that require it, you've got Certificates of Insurance covered too."

---

# SECTION 14 — Certificates of Insurance (COI)

**Runtime:** ~40 seconds
**Screenshots / recordings:**
- Customer checkout COI section
- `/admin/coi` admin panel
- Upload COI → email customer

**Narration:**
> Schools, parks, and corporate venues often require a Certificate of Insurance. At checkout, customers check a box, fill in the venue name and additional insured details, and you see the request in /admin/coi. Call your broker, generate the certificate, upload the PDF — the customer gets an email instantly and can download it from their portal to forward to their venue. No more lost paperwork, no more last-minute scrambles.

**On-screen call-outs:**
- Customer COI section at checkout
- Admin upload button
- "Mark delivered to venue" status

**Transition:** "Let's talk about your loyalty program and how you pay your referrers."

---

# SECTION 15 — Loyalty + Referral Payouts

**Runtime:** ~55 seconds
**Screenshots / recordings:**
- `/admin/loyalty` overview
- Customer profile detail (points + commission)
- Payout requests panel
- W9 view (private signed URL)

**Narration:**
> Every paying customer earns loyalty points and gets a unique referral link. When their friend books through that link, the original customer earns commission. They can cash out from their portal — either as a gift card credit (no tax form required, auto-issued) or cash payout via Stripe or Venmo, which requires a W9 form upload. You'll see all pending requests at the top of /admin/loyalty. View the W9 securely through a time-limited link, approve, and either let the system auto-issue the credit or mark cash as paid once you've transferred it. At year-end, those W9s let you file 1099 forms cleanly.

**On-screen call-outs:**
- Payout requests panel (yellow)
- "View W9 form" button
- Approve / Mark paid buttons

**Transition:** "Need to send a custom quote? That's a few clicks away."

---

# SECTION 16 — Quotes

**Runtime:** ~40 seconds
**Screenshots / recordings:**
- `/admin/quotes` list
- Create new quote → line items + customer
- Magic link customer view
- Convert to booking

**Narration:**
> For corporate events or custom requests, create a quote instead of a regular booking. Add line items, customer details, your company name, and an expiration date — fourteen days by default. The customer gets a magic link to view, approve, and pay the quote directly. Once paid, it converts to a real booking on your calendar. All without a single back-and-forth email.

**On-screen call-outs:**
- "+ New quote" button
- Customer-facing view (clean)
- "Convert to booking" button

**Transition:** "Now let's customize how your site looks and feels."

---

# SECTION 17 — Site Content + Font Picker

**Runtime:** ~55 seconds
**Screenshots / recordings:**
- `/admin/site` page
- Site Font Picker widget (top of appearance)
- Pick Quicksand → preview
- Per-zone color customization
- Logo upload

**Narration:**
> Your website is yours to shape. The site content page lets you edit every word on the public site — hero title, taglines, trust strip, footer. The site font picker at the top of the appearance section lets you switch the entire site's typography in seconds, with curated Google Font presets like Quicksand, Nunito, and Inter. Want Louis George Cafe specifically? Upload the font file right here and it activates without any code changes. Per-zone colors and fonts let you customize individual sections — your hero can look different from your featured products area if you want.

**On-screen call-outs:**
- Site Font Picker dropdown
- Live preview of font
- Color pickers per zone

**Transition:** "Behind the scenes, your emails go out automatically too."

---

# SECTION 18 — Email Templates

**Runtime:** ~40 seconds
**Screenshots / recordings:**
- `/admin/email-templates` list
- Open one → edit HTML + plain text
- Send test email

**Narration:**
> Every email your business sends — booking confirmation, reminder, review request, refund notice, gift card delivery — has an editable template here. Edit the subject, the HTML, the plain text fallback, and even send a test to yourself before going live. Use the variable tokens shown at the top of each template to insert customer-specific data dynamically. Your brand voice everywhere, no developer needed.

**On-screen call-outs:**
- Template list
- Edit form with preview
- "Send test" button

**Transition:** "Let's see how your business is doing financially."

---

# SECTION 19 — Reports

**Runtime:** ~40 seconds
**Screenshots / recordings:**
- `/admin/reports` page
- Date range picker
- Revenue chart, top products, top customers
- Fleet profitability section

**Narration:**
> The reports page gives you the numbers that matter. Pick a date range and instantly see: total revenue, top-selling products, top-spending customers, coupon usage. Scroll further for fleet profitability — for every truck and trailer you own, see lifetime cost versus revenue generated, with ROI badges showing which units have already paid for themselves. Use this every month to spot what's working and where to invest.

**On-screen call-outs:**
- Date range picker
- Top products list
- ROI badge on fleet item

**Transition:** "Finally, your team."

---

# SECTION 20 — Users + Roles

**Runtime:** ~40 seconds
**Screenshots / recordings:**
- `/admin/users` list
- Add user form
- Role dropdown (admin / staff / driver)

**Narration:**
> Add your team here with the right role: admin for full access, staff for daily operations like bookings, dispatch, and inventory but not destructive actions or finance, or driver for just the mobile route view. Each role only sees what they need. Add their email, pick the role, and they get an invitation to log in with a magic link. No passwords to manage, no admin permissions accidentally given away.

**On-screen call-outs:**
- Role dropdown
- Invitation flow

**Transition:** "There's one more thing every business owner should know about."

---

# SECTION 21 — Bulk CSV Upload + Help Section

**Runtime:** ~45 seconds
**Screenshots / recordings:**
- Bulk upload button on products page
- Help & Setup page with templates

**Narration:**
> Setting up dozens of products one by one is slow. Every list page — products, inventory, categories, fleet — has a bulk upload button at the top right. Download the CSV template, fill in your data in Excel, upload, and the system creates everything at once with per-row validation. And if you ever forget how something works, the Help & Setup page has step-by-step guides for every feature, downloadable templates, and a testing checklist for going live.

**On-screen call-outs:**
- Bulk upload button
- Help & Setup page sections

**Transition:** "Let's wrap it up."

---

# 🎬 CLOSER

**Runtime:** ~30 seconds
**Visual:** Return to dashboard screenshot, then fade to logo card with phone number + website URL.

**Narration:**
> That's your It's Always Fun admin platform. You now have everything you need to run a modern rental business — online bookings, automated emails and texts, dispatch, inventory tracking, marketing tools, and reporting. Anything you forgot? Check the Help & Setup section anytime. Questions? Reach us at the number on screen. Now go make some memorable parties happen.

---

## 📋 Production Checklist

Before you start recording with HeyGen:

- ☐ Take all screenshots in 1920×1080 resolution at minimum
- ☐ Use a clean test data set (no real customer names)
- ☐ Hide the chat widget during recording (or move it off-frame)
- ☐ Use consistent browser zoom (100%)
- ☐ Record short screen clips for any "click and see" demonstration (use Loom or OBS — free)
- ☐ Pick ONE HeyGen avatar and stick with it
- ☐ Pick ONE voice (warm, professional, ~150wpm pace)
- ☐ Add a background music track at low volume (HeyGen has free options)
- ☐ Use lower-third captions for key terms (e.g. "Stripe", "BLW-01", "Louis George Cafe")
- ☐ Export at 1080p, mp4, with captions baked in OR as a separate .srt

## 🎨 Brand consistency tips for HeyGen scenes

- **Intro/outro cards**: navy background (`#1a1a6e`), yellow accent text (`#FFD700`), white logo
- **Section title cards**: same color palette, large sans-serif heading
- **Lower-third captions**: yellow text on semi-transparent navy bar
- **Background music**: upbeat but not distracting — try "Acoustic Optimistic" or similar in HeyGen's library

## 📤 Distribution suggestions

Once rendered:
- Upload to YouTube as Unlisted → embed on /admin/help page
- Chunk into per-section clips → upload as a playlist for chapter navigation
- Send the playlist link to new staff during onboarding
- If you sell this as SaaS later, this manual is a massive product differentiator
