/* Inline-SVG icon set — real vector artwork (not emoji glyphs).
   All icons draw with `currentColor`, so they inherit the surrounding text
   color and look right in light mode, dark mode, and on the active gradient.
   One source of truth: PATHS feeds both the <Icon> component and svgMarkup()
   (used where an SVG string is needed imperatively). */

const PATHS = {
  image: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><circle cx="8.5" cy="9" r="1.6"/><path d="m21 16-4.5-4.5L7 21"/>',
  video: '<rect x="2.5" y="5" width="19" height="14" rx="3"/><path d="m10 9.5 5 2.5-5 2.5z" fill="currentColor" stroke="none"/>',
  audio: '<path d="M9 18V6l11-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  pdf: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5H6.5A2.5 2.5 0 0 0 4 21z"/><path d="M4 21V5.5"/><path d="M9 8.5h7M9 12h7"/>',
  doc: '<path d="M14 2.5V8h5.5"/><path d="M7 2.5h7L19.5 8v11.5a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 7 2.5z"/><path d="M9.5 13.5h5M9.5 16.5h5"/>',
  other: '<path d="M21 8.5 12 3.5 3 8.5v7L12 20.5l9-5z"/><path d="M3 8.5l9 5 9-5M12 13.5V20.5"/>',
  library: '<path d="m12 3 9 4.8-9 4.8-9-4.8z"/><path d="m3 12.6 9 4.8 9-4.8"/>',
  star: '<path d="m12 3 2.6 5.6 6.1.7-4.5 4.1 1.2 6L12 16.9 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" fill="currentColor" stroke="none"/>',
  browse: '<circle cx="12" cy="12" r="9"/><path d="m14.8 9.2-1.8 4-4 1.8 1.8-4z" fill="currentColor" stroke="none"/>',
  magazines: '<path d="M3.5 5.5h13v13a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M16.5 8.5H20v9.5a1.5 1.5 0 0 1-1.5 1.5"/><path d="M6.5 9h7M6.5 12.5h7M6.5 16h4"/>',
  billing: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 9.5h19"/>',
  support: '<path d="M20.5 11.5a8 8 0 0 1-11.5 7.2L4 20.5l1.8-4.7A8 8 0 1 1 20.5 11.5z"/>',
  upload: '<path d="M12 19v-7"/><path d="m8.5 14.5 3.5-3.5 3.5 3.5"/><path d="M19.5 16A4 4 0 0 0 17 8.8 6.5 6.5 0 1 0 5 13.7"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M4 4l1.8 1.8M18.2 18.2 20 20M2 12h2.5M19.5 12H22M4 20l1.8-1.8M18.2 5.8 20 4"/>',
  moon: '<path d="M21 12.5A8.5 8.5 0 1 1 11.5 3 6.5 6.5 0 0 0 21 12.5z"/>',
  monitor: '<rect x="2.5" y="3.5" width="19" height="13" rx="2"/><path d="M8.5 20.5h7M12 16.5v4"/>',
  // Magazine block types
  cover: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M4 7.5h16"/><circle cx="8.5" cy="12" r="1.4"/><path d="m6 18 3.5-3.5 2.5 2.5 2-2 4 4"/>',
  heading: '<path d="M6 4v16M18 4v16M6 12h12"/>',
  text: '<path d="M5 6h14M5 10h14M5 14h14M5 18h9"/>',
  quote: '<path d="M6 5v14"/><path d="M11 8h8M11 12h8M11 16h5"/>',
  gallery: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  carousel: '<rect x="6.5" y="6" width="11" height="12" rx="2"/><path d="M3.5 9v6M20.5 9v6"/>',
  spacer: '<path d="M4 7h16M4 17h16"/><path d="M12 10v4"/><path d="m10.5 11.2 1.5-1.5 1.5 1.5M10.5 12.8l1.5 1.5 1.5-1.5"/>',
};

const COMMON = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export default function Icon({ name, size = 20, className, style, title }) {
  const inner = PATHS[name] || PATHS.other;
  return (
    <svg
      {...COMMON}
      width={size}
      height={size}
      className={className}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      style={{ display: 'block', flex: '0 0 auto', ...style }}
      dangerouslySetInnerHTML={{ __html: (title ? `<title>${title}</title>` : '') + inner }}
    />
  );
}

// Raw "<svg>…</svg>" string for imperative DOM use (e.g. <img> onError fallbacks).
export function svgMarkup(name, size = 28) {
  const inner = PATHS[name] || PATHS.other;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}
