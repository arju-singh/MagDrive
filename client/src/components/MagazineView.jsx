import Carousel from './Carousel.jsx';

// Read-only magazine renderer. Mirrors the editor's reader pane but with no
// controls/inputs. `media(fileId)` resolves a media URL (owner-token in the app,
// share-token URL on the public page).
export default function MagazineView({ magazine, media }) {
  const { title, theme = 'editorial', layout } = magazine;
  const blocks = layout?.blocks || [];

  return (
    <div className={`reader theme-${theme}`}>
      <div style={{ borderBottom: '3px double currentColor', paddingBottom: 12, marginBottom: 28 }}>
        <div className="tag">{theme} · issue</div>
        <h1 style={{ fontSize: 'var(--fs-2xl)', margin: '4px 0 0' }}>{title || 'Untitled'}</h1>
      </div>

      {blocks.map((b) => (
        <div key={b.id} className={`blk size-${b.size} align-${b.align}`}>
          {b.type === 'cover' && (
            <div className="blk-cover" style={{ background: '#222' }}>
              {b.fileId && <img src={media(b.fileId)} alt="" />}
              {b.text && <div className="ctext">{b.text}</div>}
            </div>
          )}
          {b.type === 'heading' && <h2 className="blk-heading">{b.text}</h2>}
          {b.type === 'text' && <p className="blk-text" style={{ whiteSpace: 'pre-wrap' }}>{b.text}</p>}
          {b.type === 'quote' && <blockquote className="blk-quote">{b.text}</blockquote>}
          {b.type === 'image' && b.fileId && <img className="blk-img" src={media(b.fileId)} alt="" />}
          {b.type === 'video' && b.fileId && <video className="blk-img" src={media(b.fileId)} controls />}
          {b.type === 'gallery' && b.fileIds?.length > 0 && (
            <div className="blk-gallery">
              {b.fileIds.map((fid) => <img key={fid} src={media(fid)} alt="" />)}
            </div>
          )}
          {b.type === 'carousel' && (
            <Carousel fileIds={b.fileIds} variant={b.variant} caption={b.text} size={b.size} resolveUrl={media} />
          )}
          {b.type === 'spacer' && <div className="blk-spacer" />}
        </div>
      ))}
    </div>
  );
}
