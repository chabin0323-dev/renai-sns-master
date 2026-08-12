import { IMAGE_SUB_DEFS } from '../utils/parser.js';
import './ImagePromptSection.css';

export default function ImagePromptSection({ prompts, onChangeSub, onCopySub, onCopyAllPrompts }) {
  const hasAny = Object.values(prompts).some((v) => v && v.trim());

  return (
    <article className="image-section">
      <div className="image-section__corner image-section__corner--tl" aria-hidden="true" />
      <div className="image-section__corner image-section__corner--tr" aria-hidden="true" />
      <header className="image-section__header">
        <h2 className="image-section__title">
          <span aria-hidden="true">🖼️</span> 画像生成プロンプト
        </h2>
        <button
          className="image-section__copy-all"
          onClick={onCopyAllPrompts}
          disabled={!hasAny}
          type="button"
        >
          📋 5種類まとめてコピー
        </button>
      </header>

      <div className="image-section__grid">
        {IMAGE_SUB_DEFS.map((def) => {
          const value = prompts[def.key] || '';
          const isEmpty = !value.trim();
          return (
            <div className="image-sub-card" key={def.key}>
              <div className="image-sub-card__header">
                <span className="image-sub-card__label">{def.label}</span>
                <button
                  className="image-sub-card__copy"
                  onClick={() => onCopySub(def.key, def.copyLabel)}
                  disabled={isEmpty}
                  type="button"
                >
                  📋
                </button>
              </div>
              <p className="image-sub-card__role">→ {def.role}</p>
              <textarea
                className="image-sub-card__textarea"
                value={value}
                onChange={(e) => onChangeSub(def.key, e.target.value)}
                placeholder="GEMの出力にこのプロンプトがまだ含まれていません"
                rows={5}
              />
            </div>
          );
        })}
      </div>
    </article>
  );
}
