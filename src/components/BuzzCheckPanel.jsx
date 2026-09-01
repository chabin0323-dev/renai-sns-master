import './BuzzCheckPanel.css';

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ja-JP', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (err) {
    return iso;
  }
}

export default function BuzzCheckPanel({ open, report, onClose, onCopyReminder }) {
  if (!open) return null;

  const { ctaTimeline, warnings } = report;

  return (
    <div className="buzz-overlay" onClick={onClose}>
      <aside className="buzz-panel" onClick={(e) => e.stopPropagation()}>
        <header className="buzz-panel__header">
          <h2 className="buzz-panel__title">🔥 バズ診断</h2>
          <button className="buzz-panel__close" onClick={onClose} type="button" aria-label="閉じる">
            ✕
          </button>
        </header>

        {ctaTimeline.length === 0 ? (
          <p className="buzz-panel__empty">
            まだ投稿履歴がありません。投稿を「💾 保存」すると、ここでCTAや画像の使い回しをチェックできます。
          </p>
        ) : (
          <>
            <section className="buzz-panel__section">
              <h3 className="buzz-panel__subtitle">直近のCTA</h3>
              <div className="buzz-timeline">
                {ctaTimeline.map((t) => (
                  <div className="buzz-timeline__item" key={t.id}>
                    <span className="buzz-timeline__label">{t.ctaLabel}</span>
                    <span className="buzz-timeline__date">{formatDate(t.createdAt)}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="buzz-panel__section">
              <h3 className="buzz-panel__subtitle">セルフチェック</h3>
              {warnings.length === 0 ? (
                <p className="buzz-panel__ok">✅ 現時点で使い回しの兆候は見つかりませんでした。</p>
              ) : (
                <ul className="buzz-warning-list">
                  {warnings.map((w, i) => (
                    <li className="buzz-warning-item" key={i}>
                      ⚠️ {w.message}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <button className="buzz-panel__copy" onClick={onCopyReminder} type="button">
              📋 この状況をGEMに伝える文をコピー
            </button>
          </>
        )}
      </aside>
    </div>
  );
}
