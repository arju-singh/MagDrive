import { createElement } from 'react';
import Icon, { svgMarkup } from './Icon.jsx';

// File-kind → SVG icon name (real vector artwork, see Icon.jsx).
export const KIND_ICON_NAME = {
  image: 'image',
  video: 'video',
  audio: 'audio',
  pdf: 'pdf',
  doc: 'doc',
  other: 'other',
};

export const KIND_LABEL = {
  image: 'Photos',
  video: 'Videos',
  audio: 'Audio',
  pdf: 'PDFs',
  doc: 'Documents',
  other: 'Other',
};

const nameFor = (kind) => KIND_ICON_NAME[kind] || 'other';

// React element for a file kind — drop-in replacement for the old emoji `icon()`.
// (Plain JS, not JSX, so this .js module needs no JSX transform.)
export function KindIcon({ kind, size = 40, ...rest }) {
  return createElement(Icon, { name: nameFor(kind), size, ...rest });
}

// Raw SVG string for imperative DOM use (e.g. <img> onError fallbacks).
export const kindIconMarkup = (kind, size) => svgMarkup(nameFor(kind), size);
