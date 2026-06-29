export const KIND_ICON = {
  image: '🖼️',
  video: '🎬',
  audio: '🎵',
  pdf: '📕',
  doc: '📄',
  other: '📦',
};

export const KIND_LABEL = {
  image: 'Photos',
  video: 'Videos',
  audio: 'Audio',
  pdf: 'PDFs',
  doc: 'Documents',
  other: 'Other',
};

export const icon = (kind) => KIND_ICON[kind] || KIND_ICON.other;
