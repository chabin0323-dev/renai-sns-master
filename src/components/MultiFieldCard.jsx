import './MultiFieldCard.css';

/**
 * 複数の項目（タイトル・本文・ハッシュタグなど）を持つセクションを1枚のカードに表示する。
 * 各項目は完全に独立しており、コピー時に他の項目と混ざることはない。
 *
 * videoAction（任意）: { onClick, disabled } を渡した場合のみ、カード下部に
 * 「🎬 この投稿でバズ動画を作る」ボタンを表示する。渡されなければ何も表示されない
 * ため、Instagram/X/Threads/note/WordPressなど他のカードの見た目には一切影響しない。
 *
 * accent（任意）: 'tiktok' | 'instagram' | 'x' | 'threads' | 'note' | 'wordpress'
 * SNSごとにカードの背景色・枠線・タイトル色を色分けするためのキー。渡さない場合は
 * 従来どおりのゴールド基調のまま表示される（既存の見た目を壊さない）。
 */
export default function MultiFieldCard({ label, icon, fields, onChangeField, onCopyField, videoAction, extraBlock, accent }) {
  return (
    <article className="mf-card" data-accent={accent}>
      <div className="mf-card__corner mf-card__corner--tl" aria-hidden="true" />
      <div className="mf-card__corner mf-card__corner--tr" aria-hidden="true" />
      <header className="mf-card__header">
        <h2 className="mf-card__title">
          <span className="mf-card__icon" aria-hidden="true">{icon}</span>
          {label}
        </h2>
      </header>

      <div className="mf-card__fields">
        {fields.map((field) => {
          const isEmpty = !field.value || !field.value.trim();
          return (
            <div className="mf-field" key={field.key}>
              <div className="mf-field__header">
                <span className="mf-field__label">{field.label}</span>
                <button
                  className="mf-field__copy"
                  onClick={() => onCopyField(field.key, field.label)}
                  disabled={isEmpty}
                  type="button"
                >
                  📋 {field.copyText || 'コピー'}
                </button>
              </div>
              <textarea
                className="mf-field__textarea"
                value={field.value}
                onChange={(e) => onChangeField(field.key, e.target.value)}
                placeholder={field.placeholder || `${field.label}がここに表示されます`}
                rows={field.rows || 4}
              />
            </div>
          );
        })}
      </div>

      {extraBlock && <div className="mf-card__extra">{extraBlock}</div>}

      {videoAction && (
        <button
          className="mf-card__video-btn"
          onClick={videoAction.onClick}
          disabled={videoAction.disabled}
          type="button"
        >
          🎬 この投稿でバズ動画を作る
        </button>
      )}
    </article>
  );
}
