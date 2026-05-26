# PWA Icons

Place these 3 files in this folder (`public/icons/`) so the PWA install
prompt shows the brand icon instead of a fallback:

- `icon-192.png` — 192×192 (Android home screen, badges)
- `icon-512.png` — 512×512 (Android splash screen, larger displays)
- `icon-180.png` — 180×180 (Apple touch icon for iOS Safari)

## Quick way to generate them

1. Get your high-res logo (square, transparent background works best, navy/yellow brand colors)
2. Go to https://realfavicongenerator.net/ or https://favicon.io/
3. Upload your logo → it generates all the sizes
4. Download the bundle → extract → copy these 3 files into this folder
5. Commit + push

## What happens if these files are missing

The PWA installs fine but uses a generic browser icon. Customers/drivers
can still install + use the app — it just doesn't look branded.

## Maskable icons

For best Android UX, set the icons as "maskable" in `manifest.json`
(already configured). This means the icon stays visible across all
Android launcher shapes (square, circle, squircle). The icon design
should keep important content within the inner 80% (safe zone) — leave
20% padding around the edges that may get cropped.
