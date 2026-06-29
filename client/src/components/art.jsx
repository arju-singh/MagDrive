import { useState } from 'react';

// Anime / cartoon avatars via DiceBear (free, no key, deterministic SVG, SFW).
// Styles used: 'lorelei' & 'adventurer' (anime-ish), 'fun-emoji' & 'big-smile' (cartoon).
const DB = 'https://api.dicebear.com/9.x';
export const avatarUrl = (seed, style = 'lorelei') =>
  `${DB}/${style}/svg?seed=${encodeURIComponent(String(seed))}`;

// ---------- Local neo-brutalist doodle stickers (always work, even offline) ----------
export function Mascot({ size = 96, className = '' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <rect x="9" y="30" width="82" height="58" rx="9" fill="#ffd23f" stroke="#111" strokeWidth="4" />
      <rect x="33" y="16" width="30" height="18" rx="4" fill="#ff5d3b" stroke="#111" strokeWidth="4" />
      <circle cx="50" cy="59" r="21" fill="#fff" stroke="#111" strokeWidth="4" />
      <circle cx="50" cy="59" r="10" fill="#38d4e0" stroke="#111" strokeWidth="3" />
      <circle cx="46" cy="55" r="3" fill="#fff" />
      <circle cx="80" cy="42" r="3.5" fill="#111" />
      <path d="M22 47 q4 -5 9 0" stroke="#111" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export function Sparkle({ size = 26, className = '', color = '#ffd23f' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <path d="M14 0 L17 11 L28 14 L17 17 L14 28 L11 17 L0 14 L11 11 Z" fill={color} stroke="#111" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function Star({ size = 26, className = '', color = '#ff7eb6' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <path d="M14 1 l3.7 8.6 9.3 .8 -7 6.1 2.1 9.1 -8.1 -4.9 -8.1 4.9 2.1 -9.1 -7 -6.1 9.3 -.8 Z" fill={color} stroke="#111" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function Bolt({ size = 26, className = '', color = '#b8ff3b' }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <path d="M16 1 L5 16 H13 L11 27 L23 11 H15 Z" fill={color} stroke="#111" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

// ---------- Avatar (top bar): anime avatar with letter fallback ----------
export function Avatar({ seed, label, style = 'fun-emoji', size = 38 }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <div className="avatar">{label}</div>;
  return (
    <img className="avatar avatar--img" width={size} height={size} alt=""
      src={avatarUrl(seed, style)} onError={() => setFailed(true)} />
  );
}

// ---------- Character (decorative): big anime image, falls back to the Mascot ----------
export function Character({ seed, style = 'lorelei', size = 96, className = '' }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <Mascot size={size} className={className} />;
  return (
    <img className={`character ${className}`} width={size} height={size} alt="" loading="lazy"
      src={avatarUrl(seed, style)} onError={() => setFailed(true)} />
  );
}

// A playful row of characters for hero / empty areas.
export function CharacterStrip({ size = 64 }) {
  const cast = [
    ['hikari', 'lorelei'], ['sora', 'adventurer'], ['yuki', 'fun-emoji'], ['ren', 'big-smile'],
  ];
  return (
    <div className="char-strip">
      {cast.map(([seed, style]) => <Character key={seed} seed={seed} style={style} size={size} />)}
    </div>
  );
}
