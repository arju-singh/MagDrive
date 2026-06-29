// Magazine template catalog — 50+ ready-made samples across categories.
// Each template renders a realistic cover preview (sample photo + typography) so the
// user can browse a "newsstand" and pick a design, then just drop in their own content.
// Sample images are preview-only (Picsum, seeded so they're stable); the created layout
// has empty media slots the user fills from their own library.

export const THEME_BG = { editorial: '#f6f3ee', mono: '#ffffff', vogue: '#fbf7f4', zine: '#fffbe6', noir: '#14110f', y2k: '#cfe6ff', pastel: '#fff1f6', neon: '#0c0a18' };
export const THEME_INK = { editorial: '#14110f', mono: '#111', vogue: '#14110f', zine: '#1a1a1a', noir: '#f6f3ee', y2k: '#15123a', pastel: '#4a2c4d', neon: '#e9e6ff' };

// Gen-Z carousel visual styles. Keep keys in sync with CAROUSEL_VARIANTS in
// server/src/routes/magazines.js so they survive save/normalization.
export const CAROUSEL_VARIANTS = [
  { key: 'swipe', label: 'Clean Swipe' },
  { key: 'story', label: 'Story Bars' },
  { key: 'polaroid', label: 'Polaroid' },
  { key: 'filmstrip', label: 'Filmstrip' },
  { key: 'tape', label: 'Washi Tape' },
  { key: 'sticker', label: 'Sticker Pop' },
  { key: 'neon', label: 'Neon Glow' },
  { key: 'y2k', label: 'Y2K Chrome' },
  { key: 'bubble', label: 'Bubble' },
  { key: 'marquee', label: 'Marquee' },
  { key: 'peek', label: 'Peek Grid' },
  { key: 'cutout', label: 'Cut-out Collage' },
];
const VARIANT_KEYS = CAROUSEL_VARIANTS.map((v) => v.key);

// Stable sample photos without an API key. onError in the UI falls back to a gradient.
export const sampleUrl = (seed, w = 480, h = 640) => `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;

// ---- Layout archetypes: each builds a block list for a given context {name,label} ----
const ARCHETYPES = {
  photoEssay: (c) => [
    { type: 'cover', text: c.name.toUpperCase(), size: 'full' },
    { type: 'heading', text: `A ${c.label} Story` },
    { type: 'text', text: 'Open with a short standfirst that sets the scene in a sentence or two…' },
    { type: 'image', size: 'full', align: 'center' },
    { type: 'quote', text: 'A line that captures the mood of the piece.' },
    { type: 'gallery' },
    { type: 'text', text: 'Continue the narrative here. Keep paragraphs tight and let the images breathe.' },
    { type: 'image', size: 'l', align: 'center' },
  ],
  coverStory: (c) => [
    { type: 'cover', text: c.name.toUpperCase(), size: 'full' },
    { type: 'heading', text: 'The Headline of the Season' },
    { type: 'text', text: 'A short, stylish intro to the subject…' },
    { type: 'image', size: 'full', align: 'center' },
    { type: 'gallery' },
    { type: 'quote', text: 'A statement worth pulling out big.' },
    { type: 'image', size: 'l', align: 'center' },
  ],
  diary: (c) => [
    { type: 'cover', text: c.name.toUpperCase(), size: 'full' },
    { type: 'heading', text: 'Day One' },
    { type: 'text', text: 'Where you went, what you saw, how it felt…' },
    { type: 'gallery' },
    { type: 'image', size: 'l', align: 'center' },
    { type: 'heading', text: 'Day Two' },
    { type: 'text', text: 'Keep the journal going…' },
    { type: 'image', size: 'm', align: 'right' },
  ],
  portfolio: (c) => [
    { type: 'heading', text: c.name },
    { type: 'text', text: 'One line about what you do.' },
    { type: 'spacer' },
    { type: 'image', size: 'full', align: 'center' },
    { type: 'spacer' },
    { type: 'image', size: 'full', align: 'center' },
    { type: 'spacer' },
    { type: 'image', size: 'full', align: 'center' },
  ],
  interview: (c) => [
    { type: 'cover', text: 'IN CONVERSATION', size: 'full' },
    { type: 'heading', text: `A Conversation — ${c.label}` },
    { type: 'quote', text: 'The one quote you want everyone to remember.' },
    { type: 'text', text: 'Q: Your first question?\n\nA: The answer goes here…' },
    { type: 'image', size: 'l', align: 'center' },
    { type: 'text', text: 'Q: Another question?\n\nA: And the reply…' },
    { type: 'quote', text: 'A second memorable line.' },
  ],
  lookbook: (c) => [
    { type: 'cover', text: c.name.toUpperCase(), size: 'full' },
    { type: 'gallery' },
    { type: 'quote', text: 'A single statement to anchor the set.' },
    { type: 'gallery' },
    { type: 'image', size: 'full', align: 'center' },
  ],
  feature: (c) => [
    { type: 'cover', text: c.name.toUpperCase(), size: 'full' },
    { type: 'heading', text: 'The Feature Headline' },
    { type: 'text', text: 'A strong opening paragraph that draws the reader in…' },
    { type: 'image', size: 'l', align: 'center' },
    { type: 'text', text: 'Develop the story across a couple of paragraphs.' },
    { type: 'quote', text: 'The takeaway line.' },
    { type: 'gallery' },
    { type: 'text', text: 'Close it out.' },
  ],
  galleryGrid: (c) => [
    { type: 'heading', text: `${c.name} — Selected` },
    { type: 'gallery' },
    { type: 'gallery' },
    { type: 'gallery' },
  ],
  videoFeature: (c) => [
    { type: 'cover', text: c.name.toUpperCase(), size: 'full' },
    { type: 'heading', text: 'Watch the Story' },
    { type: 'text', text: 'Set up the video in a line…' },
    { type: 'video', size: 'full', align: 'center' },
    { type: 'text', text: 'Add context after the clip.' },
    { type: 'gallery' },
  ],
  howTo: (c) => [
    { type: 'cover', text: c.name.toUpperCase(), size: 'full' },
    { type: 'heading', text: 'How To / The Steps' },
    { type: 'text', text: 'Step 1 — explain the first step…' },
    { type: 'image', size: 'm', align: 'left' },
    { type: 'text', text: 'Step 2 — the next step…' },
    { type: 'image', size: 'm', align: 'right' },
    { type: 'text', text: 'Step 3 — and finally…' },
    { type: 'gallery' },
  ],
  single: (c) => [
    { type: 'cover', text: c.name.toUpperCase(), size: 'full' },
    { type: 'heading', text: 'One Strong Story' },
    { type: 'text', text: 'A single, focused piece…' },
    { type: 'image', size: 'full', align: 'center' },
    { type: 'text', text: 'A short, clean closing.' },
  ],
  zineSpread: (c) => [
    { type: 'cover', text: c.name.toUpperCase(), size: 'full' },
    { type: 'heading', text: 'Cut & Paste' },
    { type: 'gallery' },
    { type: 'quote', text: 'Loud, scrappy, yours.' },
    { type: 'image', size: 'm', align: 'left' },
    { type: 'text', text: 'Raw notes and ideas…' },
    { type: 'gallery' },
  ],
};

const ARCH_KEYS = Object.keys(ARCHETYPES);

const COVER_LINES = [
  'The big feature, inside',
  '12 pages of pure inspiration',
  'Plus: behind the scenes',
  'A new season begins',
  'Exclusive: the full story',
  'Notes, places & faces',
  'The shortlist you wanted',
  'Special collector’s issue',
];

// ---- Categories: each yields several titles → many templates ----
const CATEGORIES = [
  { key: 'photography', label: 'Photography', themes: ['editorial', 'mono'], arch: ['photoEssay', 'galleryGrid', 'portfolio'], titles: ['Light & Shadow', 'The Frame', 'Exposure', 'In Focus', 'Aperture'] },
  { key: 'fashion', label: 'Fashion', themes: ['vogue', 'noir'], arch: ['coverStory', 'lookbook', 'feature'], titles: ['Atelier', 'Runway', 'Mode', 'Silhouette', 'The Edit'] },
  { key: 'travel', label: 'Travel', themes: ['zine', 'editorial'], arch: ['diary', 'photoEssay', 'feature'], titles: ['Wanderlust', 'Off the Map', 'Far & Away', 'Horizons', 'Detour'] },
  { key: 'food', label: 'Food', themes: ['zine', 'editorial'], arch: ['howTo', 'feature', 'galleryGrid'], titles: ['Seasoned', 'The Table', 'Provisions', 'Feast', 'Harvest'] },
  { key: 'wedding', label: 'Wedding', themes: ['vogue', 'editorial'], arch: ['lookbook', 'photoEssay', 'single'], titles: ['Forever', 'The Vow', 'Two Hearts', 'Celebrate'] },
  { key: 'art', label: 'Art & Design', themes: ['mono', 'noir'], arch: ['portfolio', 'galleryGrid', 'single'], titles: ['Canvas', 'Form', 'Studio', 'Pigment'] },
  { key: 'music', label: 'Music', themes: ['noir', 'zine'], arch: ['videoFeature', 'interview', 'feature'], titles: ['On Tour', 'Backstage', 'Encore', 'Vinyl'] },
  { key: 'nature', label: 'Nature', themes: ['editorial', 'zine'], arch: ['photoEssay', 'galleryGrid', 'feature'], titles: ['Wild', 'Terrain', 'Field Notes', 'Bloom'] },
  { key: 'business', label: 'Business', themes: ['mono', 'editorial'], arch: ['feature', 'interview', 'single'], titles: ['Quarterly', 'The Brief', 'Ventures', 'Scale'] },
  { key: 'lifestyle', label: 'Lifestyle', themes: ['vogue', 'zine'], arch: ['diary', 'feature', 'galleryGrid'], titles: ['Daily', 'Dwell', 'Slow', 'Habit'] },
  { key: 'sports', label: 'Sports', themes: ['noir', 'editorial'], arch: ['videoFeature', 'photoEssay', 'feature'], titles: ['Game On', 'Endurance', 'The Arena', 'Overtime'] },
  { key: 'portfolio', label: 'Portfolio', themes: ['mono', 'noir'], arch: ['portfolio', 'galleryGrid', 'single'], titles: ['Selected Works', 'Folio', 'Case Study', 'Showcase'] },
];

function buildCatalog() {
  const list = [{ id: 'blank', name: 'Blank', label: 'Blank', category: 'all', theme: 'editorial', seed: 'blank', lines: [], blocks: [] }];
  let n = 0;
  for (const cat of CATEGORIES) {
    cat.titles.forEach((title, i) => {
      const archKey = cat.arch[i % cat.arch.length];
      const theme = cat.themes[i % cat.themes.length];
      const ctx = { name: title, label: cat.label };
      const lines = [COVER_LINES[n % COVER_LINES.length], COVER_LINES[(n + 3) % COVER_LINES.length]];
      list.push({
        id: `${cat.key}-${i}`,
        name: title,
        label: cat.label,
        category: cat.key,
        theme,
        seed: `${cat.key}-${i}-${theme}`,
        lines,
        blocks: ARCHETYPES[archKey](ctx),
      });
      n += 1;
    });
  }
  return list;
}

// ====================================================================
//  Gen-Z carousel templates — swipeable, scrapbook-y, made for a phone.
//  Every archetype is built around `carousel` blocks (the hero), each
//  carrying a `variant` that drives its look (polaroid, neon, y2k…).
//  fileIds start empty; the user drops in their own photos in the editor.
// ====================================================================

const carousel = (variant, text = '', size = 'l') => ({ type: 'carousel', variant, text, size, fileIds: [] });

const CAROUSEL_ARCHETYPES = {
  // Classic "photo dump" — one big swipe set + a couple of lines.
  photoDump: (c) => [
    { type: 'cover', text: c.name.toUpperCase(), size: 'full' },
    { type: 'heading', text: `${c.label} dump 📸` },
    { type: 'text', text: 'no thoughts just vibes. swipe →' },
    carousel(c.variant, 'swipe for the full set', 'full'),
    { type: 'quote', text: 'main character energy only.' },
    carousel(c.variant, 'pt. 2', 'l'),
  ],
  // Get-ready-with-me step swipe.
  grwm: (c) => [
    { type: 'cover', text: c.name.toUpperCase(), size: 'full' },
    { type: 'heading', text: 'grwm ✨' },
    { type: 'text', text: 'every step, start to finish — swipe through →' },
    carousel(c.variant, 'the routine', 'full'),
    { type: 'text', text: 'products + details in the next set 👇' },
    carousel(c.variant, 'the haul', 'l'),
    { type: 'quote', text: 'and that’s the look.' },
  ],
  // Mood board / aesthetic.
  moodBoard: (c) => [
    { type: 'cover', text: c.name.toUpperCase(), size: 'full' },
    { type: 'heading', text: `the ${c.label} mood` },
    carousel(c.variant, 'a whole vibe', 'full'),
    { type: 'quote', text: 'if it’s aesthetic it’s a personality trait.' },
    { type: 'text', text: 'colors, textures, little obsessions. →' },
    carousel(c.variant, 'more of the feeling', 'l'),
  ],
  // Outfit-of-the-day / fit check.
  ootd: (c) => [
    { type: 'cover', text: c.name.toUpperCase(), size: 'full' },
    { type: 'heading', text: 'fit check 👟' },
    carousel(c.variant, 'front · back · details', 'full'),
    { type: 'text', text: 'where it’s from + how I styled it →' },
    carousel(c.variant, 'the details', 'm'),
    { type: 'quote', text: 'serving, respectfully.' },
  ],
  // Full-bleed story swipe.
  storySwipe: (c) => [
    { type: 'cover', text: c.name.toUpperCase(), size: 'full' },
    { type: 'heading', text: c.name },
    { type: 'text', text: 'tap through the story →' },
    carousel(c.variant, '', 'full'),
    { type: 'quote', text: 'pov: you were there.' },
  ],
  // Two big swipe sets back to back.
  doubleTake: (c) => [
    { type: 'cover', text: c.name.toUpperCase(), size: 'full' },
    { type: 'heading', text: `${c.label}, part one` },
    carousel(c.variant, 'set one', 'full'),
    { type: 'heading', text: 'part two' },
    carousel(c.variant, 'set two', 'full'),
    { type: 'text', text: 'which one’s the carousel cover? you decide.' },
  ],
  // Recap / dump-of-the-week.
  recap: (c) => [
    { type: 'cover', text: c.name.toUpperCase(), size: 'full' },
    { type: 'heading', text: `${c.name} recap` },
    { type: 'text', text: 'a little bit of everything. swipe →' },
    carousel(c.variant, 'highlights', 'full'),
    { type: 'quote', text: 'felt cute, kept them all.' },
    carousel(c.variant, 'the b-sides', 'l'),
    { type: 'text', text: 'see you next drop ♡' },
  ],
};

// Gen-Z cover taglines.
const GENZ_LINES = [
  'swipe for the whole vibe →',
  'no thoughts, just photos',
  'a carousel, obviously',
  'pov: you opened the app',
  'main character behavior',
  'felt cute · might delete',
  'the aesthetic, curated',
  'tap tap tap →',
  'it’s giving editorial',
  'save this one fr',
];

// Each category → several titles → one carousel template apiece.
const GENZ_CATEGORIES = [
  { key: 'aesthetic', label: 'Aesthetic', themes: ['pastel', 'vogue'], arch: ['moodBoard', 'photoDump', 'storySwipe'], titles: ['Soft Era', 'Dreamcore', 'Clean Girl', 'Coastal', 'Cottagecore', 'That Girl'] },
  { key: 'photodump', label: 'Photo Dump', themes: ['zine', 'editorial'], arch: ['photoDump', 'recap', 'doubleTake'], titles: ['Weekly Dump', 'Camera Roll', 'BeReal', 'Lowlights', 'Disposable', 'Roll 36'] },
  { key: 'grwm', label: 'GRWM', themes: ['pastel', 'mono'], arch: ['grwm', 'ootd', 'storySwipe'], titles: ['Get Ready', 'Glow Up', 'No-Makeup', 'Soft Glam', 'Night Out'] },
  { key: 'fits', label: 'Fits / OOTD', themes: ['noir', 'vogue'], arch: ['ootd', 'doubleTake', 'moodBoard'], titles: ['Fit Check', 'Thrift Haul', 'Streetwear', 'Capsule', 'Sneaker Day'] },
  { key: 'y2k', label: 'Y2K', themes: ['y2k', 'neon'], arch: ['storySwipe', 'photoDump', 'moodBoard'], titles: ['Cyber Sweet', 'Frutiger Aero', 'McBling', 'Chrome Hearts', 'Butterfly Clips'] },
  { key: 'wander', label: 'Wander', themes: ['editorial', 'pastel'], arch: ['recap', 'storySwipe', 'photoDump'], titles: ['Soft Travel', 'City Pop', 'Beach Day', 'Euro Summer', 'Roadtrip'] },
  { key: 'foodie', label: 'Foodie', themes: ['zine', 'pastel'], arch: ['photoDump', 'recap', 'grwm'], titles: ['Cafe Hop', 'Matcha Era', 'Snack Run', 'Brunch Club', 'Recipe Swipe'] },
  { key: 'gigs', label: 'Gigs', themes: ['neon', 'noir'], arch: ['storySwipe', 'doubleTake', 'moodBoard'], titles: ['Concert Dump', 'Playlist', 'Vinyl Hours', 'Festival', 'On Repeat'] },
  { key: 'selfcare', label: 'Self-care', themes: ['pastel', 'vogue'], arch: ['moodBoard', 'grwm', 'recap'], titles: ['Slow Sunday', 'Romanticize It', 'Reset Day', 'Cozy Szn', 'Little Joys'] },
  { key: 'studygram', label: 'Studygram', themes: ['mono', 'editorial'], arch: ['recap', 'moodBoard', 'photoDump'], titles: ['Study With Me', 'Desk Setup', 'Note Aesthetic', 'Finals Week', 'Locked In'] },
  { key: 'fandom', label: 'Pop / Fandom', themes: ['neon', 'y2k'], arch: ['storySwipe', 'photoDump', 'doubleTake'], titles: ['Stan Era', 'Bias Wrecker', 'Comfort Show', 'Lore Drop', 'Era Tour'] },
];

function buildGenZCatalog(startN) {
  const list = [];
  let n = startN;
  for (const cat of GENZ_CATEGORIES) {
    cat.titles.forEach((title, i) => {
      const archKey = cat.arch[i % cat.arch.length];
      const theme = cat.themes[i % cat.themes.length];
      const variant = VARIANT_KEYS[n % VARIANT_KEYS.length];
      const ctx = { name: title, label: cat.label, variant };
      const lines = [GENZ_LINES[n % GENZ_LINES.length], GENZ_LINES[(n + 4) % GENZ_LINES.length]];
      list.push({
        id: `genz-${cat.key}-${i}`,
        name: title,
        label: cat.label,
        category: cat.key,
        theme,
        seed: `genz-${cat.key}-${i}-${variant}`,
        carousel: true,
        variant,
        lines,
        blocks: CAROUSEL_ARCHETYPES[archKey](ctx),
      });
      n += 1;
    });
  }
  return list;
}

const BASE_TEMPLATES = buildCatalog();
export const TEMPLATES = [...BASE_TEMPLATES, ...buildGenZCatalog(BASE_TEMPLATES.length)];

export const CATEGORY_FILTERS = [
  { key: 'all', label: 'All' },
  { key: '__carousel', label: '🎠 Carousels' },
  ...CATEGORIES.map((c) => ({ key: c.key, label: c.label })),
  ...GENZ_CATEGORIES.map((c) => ({ key: c.key, label: c.label })),
];
