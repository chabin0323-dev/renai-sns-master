import './HistoryPanel.css';

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (err) {
    return iso;
  }
}

export default function HistoryPanel({ open, history, onClose, onSelect, onDelete, onClearAll }) {
  if (!open) return null;

  return (
    <div className="history-overlay" onClick={onClose}>
      <aside className="history-panel" onClick={(e) => e.stopPropagation()}>
        <header className="history-panel__header">
          <h2 className="history-panel__title">📚 投稿履歴</h2>
          <button className="history-panel__close" onClick={onClose} type="button" aria-label="閉じる">
            ✕
          </button>
        </header>

        {history.length === 0 ? (
          <p className="history-panel__empty">
            まだ保存された投稿がありません。整理した投稿を「💾 保存」すると、ここに一覧が表示されます。
          </p>
        ) : (
          <>
            <div className="history-panel__list">
              {history.map((item) => (
                <div className="history-item" key={item.id}>
                  <button
                    className="history-item__main"
                    onClick={() => onSelect(item)}
                    type="button"
                  >
                    <span className="history-item__theme">{item.theme || '（テーマ未設定）'}</span>
                    <span className="history-item__date">{formatDate(item.createdAt)}</span>
                  </button>
                  <button
                    className="history-item__delete"
                    onClick={() => onDelete(item.id)}
                    type="button"
                    aria-label="この投稿を削除"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
            <button className="history-panel__clear" onClick={onClearAll} type="button">
              すべての履歴を削除
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
