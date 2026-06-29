// Magazine template catalog — 50+ ready-made samples across categories.
// Each template renders a realistic cover preview (sample photo + typography) so the
// user can browse a "newsstand" and pick a design, then just drop in their own content.
// Sample images are preview-only (Picsum, seeded so they're stable); the created layout
// has empty media slots the user fills from their own library.

export const THEME_BG = { editorial: '#f6f3ee', mono: '#ffffff', vogue: '#fbf7f4', zine: '#fffbe6', noir: '#14110f' };
export const THEME_INK = { editorial: '#14110f', mono: '#111', vogue: '#14110f', zine: '#1a1a1a', noir: '#f6f3ee' };

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

export const TEMPLATES = buildCatalog();

export const CATEGORY_FILTERS = [
  { key: 'all', label: 'All' },
  ...CATEGORIES.map((c) => ({ key: c.key, label: c.label })),
];
