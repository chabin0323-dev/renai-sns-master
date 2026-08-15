import { IMAGE_SUB_DEFS } from '../utils/parser.js';
import './ImagePromptSection.css';

export default function ImagePromptSection({ prompts, onChangeSub, onCopySub, onCopyAllPrompts }) {
  const hasAny = IMAGE_SUB_DEFS.some((def) => {
    const slot = prompts[def.key];
    const v = slot && slot[def.activeVariant];
    return v && v.trim();
  });

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
          📋 全プロンプトをコピー
        </button>
      </header>

      <div className="image-section__grid">
        {IMAGE_SUB_DEFS.map((def) => {
          const slot = prompts[def.key] || {};
          const value = slot[def.activeVariant] || '';
          const isEmpty = !value.trim();
          return (
            <div className="image-sub-card" key={def.key}>
              <div className="image-sub-card__header">
                <span className="image-sub-card__label">{def.label}</span>
                <button
                  className="image-sub-card__copy"
                  onClick={() => onCopySub(def.key, def.activeVariant, def.copyLabel)}
                  disabled={isEmpty}
                  type="button"
                >
                  📋 コピー
                </button>
              </div>
              <p className="image-sub-card__role">→ {def.role}（{def.variantLabel}）</p>
              <textarea
                className="image-sub-card__textarea"
                value={value}
                onChange={(e) => onChangeSub(def.key, def.activeVariant, e.target.value)}
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
