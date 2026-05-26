# AI Image-Generation Prompts for It's Always Fun Packages

Copy-paste these prompts into Claude, ChatGPT (with DALL-E), Midjourney, or any
image generator to create custom branded images for each package. Then upload
via `/admin/packages/[id]` → Image field → Upload button.

---

## 🎨 Brand style guide (applies to ALL prompts)

When generating, append this style line to keep visual consistency:

> **Style:** bright cheerful photography, golden hour outdoor lighting,
> shallow depth of field, professional event photography. Color palette
> warm yellows (#FFD700) and navy blue (#1a1a6e) as subtle accents.
> Family-friendly, kid-safe, festive atmosphere. 4K, high detail,
> sharp focus on subject. Aspect ratio 1:1 (square) for card display.

---

## 📦 The 8 starter packages — prompts ready to paste

### 1. Birthday Party Classic ($299)

```
A colorful inflatable bounce house in a sunny suburban backyard, decorated
for a kid's birthday party. One folding table with a yellow tablecloth in
the foreground holds a birthday cake and party hats. Six small chairs
arranged around it. Kids' laughter implied by motion blur of one child mid-jump
visible through the bouncer's mesh window. Warm afternoon sunlight, green
grass, white picket fence in soft background. Square 1:1 format. Bright,
cheerful, family-friendly photography style.
```

### 2. Birthday Bash Premium ($549)

```
Large red and blue bounce house with attached yellow slide combo in a
spacious backyard. Two long picnic tables with twelve chairs in the
foreground, set with party plates and a cotton candy machine spinning pink
sugar. Multiple kids visible enjoying the bouncer + slide. Bright primary
colors, blue sky, party-perfect vibe. Photo style, hero-shot framing,
golden hour lighting. 1:1 aspect ratio.
```

### 3. Tiny Tots Special ($199)

```
Small pastel-colored bounce house (mint green and soft pink) sized for
toddlers age 2-5, set up on grass in a fenced backyard. Lower walls
visible. Tiny child-sized table with four small chairs in the foreground
with toy tea set. Stuffed animals on the grass. Soft, gentle lighting,
peaceful and safe atmosphere. Photo style, square 1:1, warm tones.
```

### 4. Splash Day Special ($449)

```
Tall colorful inflatable water slide with cascading water, set up on
green grass in a sunny backyard. A blue inflatable splash pool at the
bottom. Foreground: ice-filled cooler with bottled drinks visible. Kids
silhouetted mid-slide with water spray catching sunlight. Bright tropical
summer feel, palm tree shadows on grass. Square 1:1 format, vibrant blues
and yellows. Photo style.
```

### 5. Backyard Bash ($399)

```
Wide-angle photograph of a large bounce house and separate dry slide set up
side-by-side in a generous suburban backyard. A power supply unit (small
black box) discreetly visible at the base. Kids ages 5-12 mid-activity:
some jumping in the bouncer, others sliding down the slide. Bright summer
day, lush green lawn, oak trees in background (Jacksonville style).
Energetic, action-packed composition. Photo style, square 1:1.
```

### 6. Family Reunion XL ($849)

```
A large grassy park or open backyard hosting a family reunion. Big
multi-color bounce house combo (with slide attached) in the back. Four
long picnic tables with white tablecloths and 24 chairs set up in two
rows in the foreground. A popcorn machine and snow cone cart on a serving
table. Adults chatting in soft background, multiple kids playing on the
bouncer. Late afternoon golden light, festive but elegant. Photo style,
1:1 square.
```

### 7. Corporate / Community Event ($1,249)

```
Two large adjacent bounce houses (one classic shape, one castle-themed)
plus a dry slide, set up at a community event or school carnival. Tables
with white linens, 30 chairs, professional event signage. A few adults in
business-casual attire chatting; kids playing. Tasteful and organized
rather than chaotic. School building or community center in background.
Daytime, slightly overcast for even lighting. Photo style, 1:1 square.
```

### 8. Princess Tea Party ($349)

```
A pink-and-white princess castle bounce house with turret towers and gold
trim, set up on grass. Foreground: small round table with white linen
tablecloth, six tiny chairs decorated with pink tulle bows, miniature tea
set with pink cupcakes, plastic tiaras laid out. Glittery balloons (pink,
white, gold) tied to chairs. Two young girls (ages 5-8) in princess
dresses near the table. Soft magical lighting, pastel pinks and golds.
Photo style, square 1:1.
```

---

## ⚡ Tips for best results

- **Crop after generation**: most generators output 1024×1024 — that's perfect for our card display (square). If you need a wide hero version (1920×800), generate a second variant with "wide cinematic format" added.

- **No real faces of identifiable kids**: If the generated image shows kids' faces clearly, regenerate asking for "kids with faces obscured by motion blur or facing away from camera" — avoids legal issues.

- **Multiple variants**: Generate 2-3 versions of each prompt and pick the best.

- **Iterate**: If first attempt doesn't match your brand, add specifics — e.g. "matte finish, less saturated colors" or "more cinematic, less stock photo feel".

- **For Claude**: paste a prompt and add "Generate this image." If you have Claude with image generation available, it'll produce it directly. Otherwise it'll suggest using a separate tool.

- **For DALL-E (via ChatGPT)**: paste the prompt prefixed with "Generate an image:". Add the style guide at the end.

- **For Midjourney**: append `--ar 1:1 --v 6 --style raw` for best results.

---

## 🆕 Want a different package?

Use this template:

```
A [bouncer/slide/combo description with colors] set up on [setting:
backyard/park/school]. Foreground: [tables/chairs/extras]. [Number] kids
ages [X-Y] [activity]. [Time of day] lighting, [color palette]. Photo
style, square 1:1.
```

Append the brand style guide at the top of this doc.
