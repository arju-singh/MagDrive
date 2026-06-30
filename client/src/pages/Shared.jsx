import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, publicMediaUrl, formatBytes } from '../api.js';
import MagazineView from '../components/MagazineView.jsx';
import { KindIcon } from '../components/kindIcon.js';

// Public, no-auth page for a shared file or magazine: /s/:token
export default function Shared() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading'); // loading | ok | gone

  useEffect(() => {
    let live = true;
    api.getPublic(token)
      .then((d) => { if (live) { setData(d); setState('ok'); } })
      .catch(() => { if (live) setState('gone'); });
    return () => { live = false; };
  }, [token]);

  return (
    <div className="public-page">
      <header className="public-bar">
        <Link to="/" className="brand">MAG<span className="dot">.</span>DRIVE</Link>
        <span className="muted public-tag">shared with you</span>
      </header>

      <main className="public-main">
        {state === 'loading' && <div className="empty"><span className="spinner" /></div>}

        {state === 'gone' && (
          <div className="empty" style={{ paddingTop: 80 }}>
            <h3>Link unavailable</h3>
            <p className="muted">This link doesn’t exist or has been turned off by its owner.</p>
            <Link className="btn btn--primary" to="/">Go to MagDrive</Link>
          </div>
        )}

        {state === 'ok' && data?.type === 'file' && <SharedFile token={token} file={data.file} />}
        {state === 'ok' && data?.type === 'magazine' && (
          <MagazineView magazine={data.magazine} media={(fid) => publicMediaUrl(token, fid)} />
        )}
      </main>

      <footer className="public-foot">
        <span className="muted">Made with <Link to="/">MagDrive</Link></span>
      </footer>
    </div>
  );
}

function SharedFile({ token, file }) {
  const src = publicMediaUrl(token, file.id);
  const dl = publicMediaUrl(token, file.id, { download: true });
  return (
    <div className="public-file">
      <h1 className="public-file-name">{file.name}</h1>
      <div className="public-file-body">
        {file.kind === 'image' && <img src={src} alt={file.name} />}
        {file.kind === 'video' && <video src={src} controls autoPlay style={{ maxHeight: '78vh' }} />}
        {file.kind === 'audio' && <audio src={src} controls style={{ width: '100%' }} />}
        {file.kind === 'pdf' && <iframe title={file.name} src={src} />}
        {(file.kind === 'doc' || file.kind === 'other') && (
          <div className="center" style={{ padding: 40 }}>
            <div><KindIcon kind={file.kind} size={64} /></div>
            <p className="muted">{formatBytes(file.size)} · {file.mime}</p>
            <a className="btn btn--primary" href={dl} download>Download to view</a>
          </div>
        )}
      </div>
      <div className="center" style={{ marginTop: 'var(--sp-4)' }}>
        <a className="btn" href={dl} download>Download</a>
      </div>
    </div>
  );
}
