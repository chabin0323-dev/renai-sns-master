import './MultiFieldCard.css';

/**
 * 複数の項目（タイトル・本文・ハッシュタグなど）を持つセクションを1枚のカードに表示する。
 * 各項目は完全に独立しており、コピー時に他の項目と混ざることはない。
 */
export default function MultiFieldCard({ label, icon, fields, onChangeField, onCopyField }) {
  return (
    <article className="mf-card">
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
    </article>
  );
}
