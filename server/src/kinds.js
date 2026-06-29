// Map a MIME type to a coarse "kind" used by the UI tabs + magazine blocks.
export function kindFromMime(mime = '') {
  const m = mime.toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('audio/')) return 'audio';
  if (m === 'application/pdf') return 'pdf';
  if (
    m.startsWith('text/') ||
    m.includes('word') ||
    m.includes('spreadsheet') ||
    m.includes('presentation') ||
    m.includes('officedocument') ||
    m.includes('opendocument') ||
    m === 'application/rtf'
  )
    return 'doc';
  return 'other';
}

export const KINDS = ['image', 'video', 'audio', 'pdf', 'doc', 'other'];
