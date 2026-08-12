import './ResultCard.css';

export default function ResultCard({
  label,
  icon,
  value,
  onChange,
  onCopy,
  hashtags,
  onCopyHashtags,
  placeholder,
}) {
  const isEmpty = !value || !value.trim();

  return (
    <article className="result-card">
      <div className="result-card__corner result-card__corner--tl" aria-hidden="true" />
      <div className="result-card__corner result-card__corner--tr" aria-hidden="true" />
      <header className="result-card__header">
        <h2 className="result-card__title">
          <span className="result-card__icon" aria-hidden="true">{icon}</span>
          {label}
        </h2>
        <button
          className="result-card__copy-btn"
          onClick={onCopy}
          disabled={isEmpty}
          type="button"
        >
          📋 コピー
        </button>
      </header>

      <textarea
        className="result-card__textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || `${label}の内容がここに表示されます`}
        rows={6}
      />

      {typeof hashtags === 'string' && (
        <div className="result-card__hashtag-row">
          <span className="result-card__hashtag-text">
            {hashtags ? hashtags : 'ハッシュタグ未検出'}
          </span>
          <button
            className="result-card__hashtag-btn"
            onClick={onCopyHashtags}
            disabled={!hashtags}
            type="button"
          >
            # コピー
          </button>
        </div>
      )}
    </article>
  );
}
