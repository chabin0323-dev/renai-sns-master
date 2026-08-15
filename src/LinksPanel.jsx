import { copyToClipboard } from '../utils/clipboard.js';
import './LinksPanel.css';

export default function LinksPanel({ open, links, onUpdateLink, onClose, onCopied }) {
  if (!open) return null;

  const handleCopy = async (url, name) => {
    if (!url || !url.trim()) return;
    const ok = await copyToClipboard(url.trim());
    onCopied(ok ? `📋 ${name || 'リンク'}のURLをコピーしました` : '❌ コピーに失敗しました');
  };

  return (
    <div className="links-overlay" onClick={onClose}>
      <aside className="links-panel" onClick={(e) => e.stopPropagation()}>
        <header className="links-panel__header">
          <h2 className="links-panel__title">🔗 共通リンク管理</h2>
          <button className="links-panel__close" onClick={onClose} type="button" aria-label="閉じる">
            ✕
          </button>
        </header>

        <p className="links-panel__desc">
          登録したリンクは、note・X・Threadsの投稿で共通して利用できます。ページを再読み込みしても保存されます。
        </p>

        <div className="links-panel__list">
          {links.map((link, idx) => (
            <div className="link-item" key={link.id}>
              <span className="link-item__index">リンク{['①', '②', '③', '④', '⑤'][idx]}</span>
              <div className="link-item__fields">
                <input
                  className="link-item__input"
                  type="text"
                  placeholder="リンク名（例：あの人との相性を診断する）"
                  value={link.name}
                  onChange={(e) => onUpdateLink(link.id, 'name', e.target.value)}
                />
                <input
                  className="link-item__input"
                  type="text"
                  placeholder="URL（例：https://example.com/）"
                  value={link.url}
                  onChange={(e) => onUpdateLink(link.id, 'url', e.target.value)}
                />
              </div>
              <button
                className="link-item__copy"
                onClick={() => handleCopy(link.url, link.name)}
                disabled={!link.url.trim()}
                type="button"
              >
                📋 コピー
              </button>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
