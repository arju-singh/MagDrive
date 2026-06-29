import { useRef, useState } from 'react';
import { uploadFiles } from '../api.js';

// Drag-drop + click uploader with per-batch progress. Calls onUploaded(files) on success.
export default function Uploader({ folderId, onUploaded }) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const [progress, setProgress] = useState(null);
  const [err, setErr] = useState('');

  async function send(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setErr('');
    setProgress(0);
    try {
      const { files: created } = await uploadFiles(files, { folderId, onProgress: setProgress });
      onUploaded?.(created || []);
    } catch (ex) {
      setErr(ex.status === 413 ? 'A file exceeds the size limit.' : 'Upload failed. Please try again.');
    } finally {
      setProgress(null);
    }
  }

  return (
    <div
      className={`dropzone ${drag ? 'drag' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); send(e.dataTransfer.files); }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') inputRef.current?.click(); }}
    >
      <input ref={inputRef} type="file" multiple hidden onChange={(e) => send(e.target.files)} />
      {progress === null ? (
        <>
          <div style={{ fontSize: 32 }}>⬆️</div>
          <strong>Drop files here</strong> or click to upload
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>Photos, videos, PDFs, documents — anything.</div>
        </>
      ) : (
        <div className="upload-row">
          <span className="spinner" />
          <div className="progress"><div className="fill" style={{ width: `${progress}%` }} /></div>
          <span>{progress}%</span>
        </div>
      )}
      {err && <div className="err">{err}</div>}
    </div>
  );
}
