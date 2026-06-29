import { useRef, useState } from 'react';
import { uploadFiles } from '../api.js';
import Icon from './Icon.jsx';

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
      const { files: created, failed } = await uploadFiles(files, { folderId, onProgress: setProgress });
      onUploaded?.(created || []);
      if (failed?.length) setErr(`${failed.length} file${failed.length > 1 ? 's' : ''} could not be saved (storage error).`);
    } catch (ex) {
      if (ex.status === 413) setErr('A file exceeds the size limit.');
      else if (ex.status === 507 || ex.data?.error === 'insufficient_storage') setErr('Out of storage space — free up disk and try again.');
      else setErr('Upload failed. Please try again.');
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
          <div style={{ display: 'grid', placeItems: 'center', marginBottom: 8 }}><Icon name="upload" size={36} /></div>
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
