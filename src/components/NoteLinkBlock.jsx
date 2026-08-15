import './NoteLinkBlock.css';

export default function NoteLinkBlock({ links, selectedId, onSelect, onCopyName, onCopyUrl }) {
  const selected = selectedId === 'none' ? null : links.find((l) => String(l.id) === String(selectedId));

  return (
    <div className="note-link-block">
      <div className="note-link-block__header">
        <span className="note-link-block__label">🔗 CTAで使うリンク</span>
        <select
          className="note-link-block__select"
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="none">なし</option>
          {links.map((link, idx) => (
            <option key={link.id} value={link.id}>
              {['①', '②', '③', '④', '⑤'][idx]} {link.name || '（名前未設定）'}
            </option>
          ))}
        </select>
      </div>

      {selected && (
        <div className="note-link-block__preview">
          <div className="note-link-block__row">
            <span className="note-link-block__value">{selected.name || '（名前未設定）'}</span>
            <button className="note-link-block__copy" onClick={() => onCopyName(selected.name)} type="button">
              📋 名前コピー
            </button>
          </div>
          <div className="note-link-block__row">
            <span className="note-link-block__value note-link-block__value--url">{selected.url || '（URL未設定）'}</span>
            <button
              className="note-link-block__copy"
              onClick={() => onCopyUrl(selected.url)}
              disabled={!selected.url}
              type="button"
            >
              📋 URLコピー
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
