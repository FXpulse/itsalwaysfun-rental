// Competitor comparison data — feeds /marketing/vs/[competitor] pages.
//
// Honest framing: we don't pretend RentalFlow has every feature these
// incumbents have. We highlight what's GENUINELY different + the AI-native
// angle. If a competitor is stronger in a column, say so — readers respect
// honesty and it filters out customers who'd be a bad fit anyway.

export interface ComparisonRow {
  feature: string;
  ours: string;
  theirs: string;
  winner: "us" | "them" | "tie";
}

export interface Competitor {
  slug: string;
  name: string;
  url: string;
  tagline: string;       // <60 chars, what THEY say about themselves
  customerCount: string; // their public claim
  founded: string;       // year
  pricing: string;       // public pricing summary
  positioning: string;   // 1-sentence honest framing of their strength
  whereTheyWin: string[]; // honest list of what they do better
  whereWeWin: string[];   // our differentiators
  rows: ComparisonRow[];
  cta: string;            // CTA line on the comparison page
}

export const COMPETITORS: Competitor[] = [
  {
    slug: "inflatableoffice",
    name: "InflatableOffice",
    url: "https://inflatableoffice.com",
    tagline: "The industry standard for party rental software",
    customerCount: "2,000+ rental businesses",
    founded: "2009",
    pricing: "Tiered, ~$99–$299/mo depending on features",
    positioning:
      "The incumbent. Established, feature-complete for traditional " +
      "operations. Built before the AI era — every workflow assumes " +
      "you, the operator, will do the work using their tools.",
    whereTheyWin: [
      "IO Phone integration (call logging, IVR menus)",
      "IO Workers — shift assignment, time tracking, payroll module",
      "IO Vendors — supplier management",
      "QuickBooks Online native integration (we offer CSV export)",
      "2,000+ customer install base — proven scale",
    ],
    whereWeWin: [
      "AI route optimizer — GPT-4o proposes Saturday routes in 1 click",
      "AI admin assistant — ask 'what made money last month' in plain English",
      "Modern multi-tenant SaaS architecture (their stack predates 2014 patterns)",
      "Custom domain per tenant (they give subdomains)",
      "Booking internal team chat with @mentions",
      "Built-in 1099-NEC generation for drivers",
      "Annual + Pause subscription options for seasonal operators",
      "90-day free beta — try the whole thing without commitment",
    ],
    rows: [
      { feature: "Online booking + checkout",       ours: "✓",                     theirs: "✓",                                winner: "tie"  },
      { feature: "Inventory + availability sync",    ours: "Real-time per unit",   theirs: "Real-time",                        winner: "tie"  },
      { feature: "AI route optimizer",               ours: "GPT-4o, 1-click plan", theirs: "Manual drag/drop",                 winner: "us"   },
      { feature: "AI admin assistant",               ours: "12 tools, plain English answers", theirs: "Standard reports",      winner: "us"   },
      { feature: "Phone / call logging",             ours: "Not built (use GHL)",  theirs: "IO Phone add-on",                  winner: "them" },
      { feature: "Worker scheduling + payroll",      ours: "Driver schedule profiles + 1099-NEC", theirs: "IO Workers full HR", winner: "them" },
      { feature: "Vendor management",                ours: "Not built",            theirs: "IO Vendors",                       winner: "them" },
      { feature: "QuickBooks integration",           ours: "CSV export (3-click QBO import)", theirs: "Native sync",            winner: "them" },
      { feature: "Email + SMS automation",           ours: "Per-tenant templates + Twilio", theirs: "Built-in",                 winner: "tie"  },
      { feature: "GHL CRM sync",                     ours: "Per-tenant sub-account (agency model)", theirs: "Manual export",    winner: "us"   },
      { feature: "Custom domain per tenant",         ours: "✓ Required policy",    theirs: "Subdomain only",                   winner: "us"   },
      { feature: "Booking internal team chat",       ours: "✓ with @mentions",     theirs: "—",                                winner: "us"   },
      { feature: "Inspections + digital checklists", ours: "ERPNext-style templates", theirs: "Basic",                         winner: "us"   },
      { feature: "Subscription options",             ours: "Monthly + Annual + Pause (seasonal)", theirs: "Monthly tiers",     winner: "us"   },
      { feature: "Public catalog",                   ours: "Branded, included",    theirs: "Included",                         winner: "tie"  },
      { feature: "Trial",                            ours: "90 days free",         theirs: "14-30 days",                       winner: "us"   },
    ],
    cta:
      "InflatableOffice is the safe choice for an operator who values the " +
      "incumbent's install base and doesn't care about AI-native automation. " +
      "RentalFlow is for operators who want the system to run more of the " +
      "business so they can run less of it.",
  },
  {
    slug: "goodshuffle-pro",
    name: "Goodshuffle Pro",
    url: "https://goodshufflepro.com",
    tagline: "All-in-one event rental software for serious businesses",
    customerCount: "Public count not disclosed",
    founded: "2015",
    pricing: "From $99/mo (Lite) up to enterprise tier",
    positioning:
      "The modern alternative to InflatableOffice — design-forward UI, " +
      "stronger for larger event rental companies. Heavy on lead-to-quote-to-" +
      "contract workflow. Pricing tier-gated; key features locked above the entry plan.",
    whereTheyWin: [
      "Polished UX (their design is genuinely good)",
      "Quote-to-contract pipeline is more mature for enterprise events",
      "Stronger lead source attribution + sales analytics",
      "Customer-facing payment portal is slick",
      "Vendor + warehouse module for multi-location",
    ],
    whereWeWin: [
      "Goodshuffle's full feature set sits behind $200+/mo tiers — RentalFlow ships it at $99",
      "AI route optimizer (Goodshuffle's routing is manual)",
      "AI admin assistant (Goodshuffle reports are static dashboards)",
      "Per-tenant custom domain (Goodshuffle gives subdomain unless on top tier)",
      "Built-in 1099-NEC + driver tax profiles (Goodshuffle = external)",
      "Booking internal chat with @mentions",
      "Annual + Pause subscriptions for seasonal operators",
    ],
    rows: [
      { feature: "Online booking + checkout",       ours: "✓",                     theirs: "✓",                              winner: "tie"  },
      { feature: "Inventory availability",          ours: "Real-time per unit",    theirs: "Real-time",                      winner: "tie"  },
      { feature: "AI route optimizer",              ours: "GPT-4o, 1-click",       theirs: "Manual drag/drop",               winner: "us"   },
      { feature: "AI admin assistant",              ours: "12 tools",              theirs: "Static reports",                 winner: "us"   },
      { feature: "Quote-to-contract pipeline",      ours: "Standard",              theirs: "Advanced (their strength)",      winner: "them" },
      { feature: "Customer payment portal",         ours: "Branded /portal page",  theirs: "Polished card UI (their strength)", winner: "them" },
      { feature: "Multi-location warehouse",        ours: "Single warehouse v1",   theirs: "Multi-location module",          winner: "them" },
      { feature: "Email + SMS automation",          ours: "Per-tenant templates",  theirs: "Built-in",                       winner: "tie"  },
      { feature: "GHL CRM sync (agency model)",     ours: "Per-tenant sub-account", theirs: "Manual export",                 winner: "us"   },
      { feature: "Custom domain per tenant",        ours: "Required",              theirs: "Top tier only",                  winner: "us"   },
      { feature: "Inspections + checklists",        ours: "ERPNext templates",     theirs: "Basic",                          winner: "us"   },
      { feature: "1099-NEC for drivers",            ours: "Built-in",              theirs: "External",                       winner: "us"   },
      { feature: "Booking team chat",               ours: "@mentions",             theirs: "—",                              winner: "us"   },
      { feature: "Pricing (entry plan)",            ours: "$99/mo, all features",  theirs: "$99/mo Lite, advanced tier-gated", winner: "us"   },
      { feature: "Trial",                           ours: "90 days free",          theirs: "14 days",                        winner: "us"   },
    ],
    cta:
      "Goodshuffle Pro is great if you need a mature enterprise quote-to-" +
      "contract pipeline and are willing to pay $200+/mo for it. " +
      "RentalFlow gives you AI automation + the day-to-day operations at the " +
      "entry plan — no tier-gated features.",
  },
  {
    slug: "booqable",
    name: "Booqable",
    url: "https://booqable.com",
    tagline: "Rental software for small businesses",
    customerCount: "Public count not disclosed",
    founded: "2014",
    pricing: "From $29/mo to ~$179/mo by features + items",
    positioning:
      "Generalist rental software, not party-rental specific. " +
      "Strong for camera, equipment, fashion rentals. " +
      "The cheapest entry point in the space — good UX, light on operations.",
    whereTheyWin: [
      "Lowest entry price (~$29/mo Starter)",
      "Great UX for small/solo operators",
      "Multi-currency + international VAT support",
      "Embeddable booking widget (very polished)",
      "Generalist — fits non-party verticals out of the box",
    ],
    whereWeWin: [
      "Built specifically for party/event rentals (delivery routes, drivers, COIs, inspections)",
      "AI route optimizer + AI admin assistant",
      "Driver mobile app + 1099-NEC tax tools",
      "Booking internal team chat with @mentions",
      "Inspection templates (Booqable is generic, not party-rental)",
      "Per-tenant GHL CRM integration (agency model)",
      "Custom domain per tenant on every plan",
    ],
    rows: [
      { feature: "Online booking + checkout",      ours: "✓ Party-rental specific", theirs: "✓ Generalist widget",            winner: "tie"  },
      { feature: "Delivery + driver routing",      ours: "Native dispatch + driver app + AI optimizer", theirs: "Manual / external", winner: "us"   },
      { feature: "Driver mobile app",              ours: "PWA installable",         theirs: "—",                               winner: "us"   },
      { feature: "AI route optimizer",             ours: "GPT-4o",                  theirs: "—",                               winner: "us"   },
      { feature: "AI admin assistant",             ours: "12 tools",                theirs: "—",                               winner: "us"   },
      { feature: "Pricing (entry plan)",           ours: "$99/mo",                  theirs: "$29/mo Starter",                  winner: "them" },
      { feature: "Embeddable booking widget",      ours: "Branded site only",       theirs: "Polished JS widget",              winner: "them" },
      { feature: "Multi-currency / international", ours: "USD only v1",             theirs: "Multi-currency + VAT",             winner: "them" },
      { feature: "Inspection templates",           ours: "ERPNext-style",           theirs: "—",                               winner: "us"   },
      { feature: "1099-NEC for drivers",           ours: "Built-in",                theirs: "—",                               winner: "us"   },
      { feature: "GHL CRM per-tenant sync",        ours: "✓",                       theirs: "Zapier-based",                    winner: "us"   },
      { feature: "Custom domain",                  ours: "Every plan",              theirs: "Top tier only",                   winner: "us"   },
      { feature: "Vertical fit",                   ours: "Party rentals (specific)", theirs: "Generalist rentals",             winner: "us"   },
    ],
    cta:
      "Booqable is great if you're a tiny party-rental operator (under 5 " +
      "events/month) AND price-sensitive AND don't need delivery routing. " +
      "RentalFlow is built for the next stage — when you have a fleet, drivers, " +
      "inspections, and want AI handling more of the busywork.",
  },
  {
    slug: "tapgoods",
    name: "TapGoods",
    url: "https://tapgoods.com",
    tagline: "Software for the rental industry",
    customerCount: "Public count not disclosed",
    founded: "2017",
    pricing: "Custom quote — no public pricing",
    positioning:
      "Enterprise-leaning rental software. Strong for larger party " +
      "rental + event production companies. No-public-pricing usually " +
      "means $300+/mo entry. Heavy on logistics + crew management.",
    whereTheyWin: [
      "Crew + labor scheduling module is more mature",
      "Multi-warehouse + transfer workflows",
      "Heavy-equipment rental support (drapery, AV, staging)",
      "Public-facing rental marketplace integration",
      "Established with bigger commercial operators",
    ],
    whereWeWin: [
      "Transparent $99/mo pricing (TapGoods is custom-quoted)",
      "AI route optimizer + AI admin assistant",
      "Self-serve signup (TapGoods is sales-led)",
      "Driver mobile app + 1099-NEC tools",
      "Booking internal chat with @mentions",
      "90-day free trial (TapGoods has demo + sales call)",
      "Annual + Pause subscriptions for seasonal operators",
      "AI native vs traditional — they were built before LLMs were viable",
    ],
    rows: [
      { feature: "Online booking + checkout",     ours: "Self-serve",            theirs: "✓ + marketplace",                winner: "tie"  },
      { feature: "Inventory + availability",       ours: "Real-time per unit",   theirs: "Real-time multi-warehouse",      winner: "them" },
      { feature: "Crew / labor scheduling",        ours: "Driver schedule profiles + AI optimizer", theirs: "Full crew module (their strength)", winner: "them" },
      { feature: "AI route optimizer",             ours: "GPT-4o",               theirs: "Manual routing",                 winner: "us"   },
      { feature: "AI admin assistant",             ours: "12 tools",             theirs: "Reports",                        winner: "us"   },
      { feature: "Multi-warehouse + transfers",    ours: "Single warehouse v1",  theirs: "Multi-warehouse mature",         winner: "them" },
      { feature: "Heavy-equipment / AV / staging", ours: "Inflatables-first",    theirs: "Broad equipment support",        winner: "them" },
      { feature: "Public marketplace",             ours: "—",                    theirs: "TapGoods marketplace",           winner: "them" },
      { feature: "Pricing transparency",           ours: "$99/mo public",        theirs: "Custom quote (no public price)", winner: "us"   },
      { feature: "Signup flow",                    ours: "Self-serve, 90d free", theirs: "Sales-led demo",                 winner: "us"   },
      { feature: "Driver mobile app",              ours: "PWA installable",     theirs: "Crew app",                       winner: "tie"  },
      { feature: "1099-NEC for drivers",           ours: "Built-in",             theirs: "Payroll integration external",  winner: "us"   },
      { feature: "Booking team chat",              ours: "@mentions",            theirs: "—",                              winner: "us"   },
      { feature: "Trial",                          ours: "90 days free",         theirs: "Demo + sales call",              winner: "us"   },
    ],
    cta:
      "TapGoods is the right call if you run a $1M+ event production " +
      "company with multi-warehouse logistics, heavy equipment, and need a " +
      "sales-led implementation. RentalFlow is for the operator who wants to " +
      "skip the sales call, sign up themselves, and let AI run more of the day.",
  },
];

export function getCompetitorBySlug(slug: string): Competitor | null {
  return COMPETITORS.find((c) => c.slug === slug) || null;
}
