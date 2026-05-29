# SEO Setup — It's Always Fun (itsalwaysfun.net)

Code-side está listo. Esta guía cubre los pasos que hacés vos UNA sola vez
en Google Search Console y Bing Webmaster Tools para registrar el sitio.

---

## 1. Después del deploy: verificar que el SEO técnico funciona

Una vez que Vercel deploye los cambios, andá a estas URLs y confirmá que cargan:

- https://itsalwaysfun.net/sitemap.xml — debería mostrar XML con todos tus productos + categorías
- https://itsalwaysfun.net/robots.txt — debería decir `Allow: /` y `Sitemap: https://itsalwaysfun.net/sitemap.xml`

Test rápido del JSON-LD:
- Abrí https://search.google.com/test/rich-results
- Pegá `https://itsalwaysfun.net/`
- Buscá "LocalBusiness" en los detectados ✅
- Pegá `https://itsalwaysfun.net/items/[cualquier-slug]/` — buscá "Product" ✅

---

## 2. Google Search Console (lo más importante)

### a. Crear la propiedad

1. Andá a https://search.google.com/search-console
2. Login con la cuenta Google del negocio (ideal la que ya tiene Google Business Profile)
3. **Add property** → **URL prefix** → escribí `https://itsalwaysfun.net`
4. Verificación: elegí **HTML tag** (la más fácil)
5. Te da un `<meta name="google-site-verification" content="ABC123..." />`
6. Pasame ese código y lo agrego al `<head>` del layout — después clickeás **Verify**

   (Alternativa sin código: descargás un archivo `google[...].html` y lo subís a `/public/` del repo. Tarda 1 min más.)

### b. Submit del sitemap

Una vez verificada la propiedad:

1. En el menú izquierdo: **Sitemaps**
2. Escribí: `sitemap.xml`
3. **Submit**
4. En 24–48 horas vas a ver cuántas URLs indexó Google

### c. Pedile a Google que indexe rápido

1. Arriba hay un buscador "Inspeccionar cualquier URL"
2. Pegá `https://itsalwaysfun.net/`
3. Cuando salga el reporte → clic **Request indexing**
4. Repetí con las URLs más importantes: `/order-by-date`, `/category/bounce-houses`, top 5 productos

Esto le dice a Google "andá YA". Sin esto puede tardar 2–6 semanas.

---

## 3. Bing Webmaster Tools (5 min, no lo saltees — Bing alimenta DuckDuckGo, Yahoo, Ecosia)

1. Andá a https://www.bing.com/webmasters
2. Login con cuenta Microsoft (podés crear una nueva con el email del negocio)
3. **Import from Google Search Console** (si ya hiciste el paso 2 te ahorra todo el setup)
   - Si no querés conectar GSC: **Add a site manually** → `https://itsalwaysfun.net`
4. Verificá (igual que en Google: HTML tag o archivo)
5. En menú izquierdo: **Sitemaps** → **Submit sitemap** → `https://itsalwaysfun.net/sitemap.xml`

---

## 4. Google Business Profile (CRÍTICO para "near me" + local pack)

Esto te hace aparecer en Google Maps + en el "local pack" (las 3 fichas con mapa arriba de los resultados).

1. https://business.google.com → **Manage now**
2. Buscá "It's Always Fun" — si ya existe, claim it. Si no, **Add your business**
3. Categoría primaria: **Bounce House Rental Service** (es categoría oficial de Google)
4. Categorías secundarias: **Party Equipment Rental**, **Event Planner**
5. Address: 8917 Western Way, Jacksonville, FL 32256
6. Service area: Jacksonville + 30 mi (podés marcar "I serve customers at their locations" → hide address)
7. Hours: lo que tengas en /admin/site (Mon-Sat 8am-6pm)
8. Phone: (904) 584-3047
9. Website: `https://itsalwaysfun.net`
10. **Subí fotos**: logo + 5–10 fotos de inflables en eventos reales (este es uno de los factores más fuertes de ranking)
11. Pedile a clientes contentos: **review link** → mandalo por SMS/email después de cada evento

⏱️ Google manda postal con código PIN a la dirección (~5–14 días) para confirmar que sos vos.

---

## 5. Cosas que ayudan al ranking (en orden de impacto)

| Acción | Impacto | Tiempo |
|---|---|---|
| Google Business Profile activo + 20+ reviews | ⭐⭐⭐⭐⭐ | 2h setup + ongoing |
| Backlinks de webs locales (Cámara de Comercio Jax, blogs locales de eventos, partners) | ⭐⭐⭐⭐ | 4-8h |
| Reviews en Google (apuntá a 50+ con 4.8+ avg) | ⭐⭐⭐⭐ | ongoing |
| Page speed (ya tenés Vercel Edge, debería estar bien) | ⭐⭐⭐ | check con PageSpeed Insights |
| Contenido (blog posts tipo "Best bounce houses for 5-year-olds in Jacksonville") | ⭐⭐⭐ | 2h/post |
| Schema JSON-LD (ya está hecho) | ⭐⭐ | listo |
| Sitemap + robots.txt (ya está) | ⭐⭐ | listo |
| Meta titles/descriptions únicos por página (ya está) | ⭐⭐ | listo |

---

## 6. Para tenants de RentalFlow (los clientes futuros)

Todo lo que hicimos está al nivel del **código del template**, no hardcodeado a IAF. Cuando cualquier tenant nuevo:

- Sube su dominio custom (ej. `bouncerental.com`) → su `/sitemap.xml` automáticamente lista SUS productos
- Configura `business_address` en /admin/site → su JSON-LD LocalBusiness usa ESA dirección
- Sube logo → es el favicon y la OG image automáticamente

Lo único manual sigue siendo: cada cliente hace su propio Google Search Console + Google Business Profile con su dominio. Pero ESO se lo podemos meter en el onboarding como step opcional.

---

## 7. Métricas para mirar después de 30 días

En Google Search Console → **Performance**:

- Impressions: cuántas veces aparecimos en resultados
- Clicks: cuántos hicieron click
- Top queries: qué buscan los que llegan (gold mine para más contenido)
- Pages: qué páginas rankean mejor

Si después de 30 días tenés < 100 impressions/día → tema de backlinks o page authority. Hacé más Google Business Profile + reviews.
