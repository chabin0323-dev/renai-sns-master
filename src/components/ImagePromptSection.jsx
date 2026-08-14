import { IMAGE_SUB_DEFS } from '../utils/parser.js';
import './ImagePromptSection.css';

const VARIANTS = [
  { key: 'withText', icon: '📝', label: '文字入り版', hint: '基本はこちらを使用（日本語が崩れた場合は文字なし版へ）' },
  { key: 'noText', icon: '🖼️', label: '文字なし版', hint: '日本語文字が崩れた場合の代替、または動画素材用' },
];

export default function ImagePromptSection({ prompts, onChangeSub, onCopySub, onCopyAllPrompts }) {
  const hasAny = Object.values(prompts).some(
    (v) => v && ((v.withText && v.withText.trim()) || (v.noText && v.noText.trim()))
  );

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
          const slot = prompts[def.key] || { withText: '', noText: '' };
          return (
            <div className="image-sub-card" key={def.key}>
              <div className="image-sub-card__header">
                <span className="image-sub-card__label">{def.label}</span>
              </div>
              <p className="image-sub-card__role">→ {def.role}</p>

              {VARIANTS.map((variant) => {
                const value = slot[variant.key] || '';
                const isEmpty = !value.trim();
                return (
                  <div className="image-variant" key={variant.key}>
                    <div className="image-variant__header">
                      <span className="image-variant__label">
                        {variant.icon} {variant.label}
                      </span>
                      <button
                        className="image-variant__copy"
                        onClick={() => onCopySub(def.key, variant.key, `${def.copyLabel}（${variant.label}）`)}
                        disabled={isEmpty}
                        type="button"
                      >
                        📋 コピー
                      </button>
                    </div>
                    <p className="image-variant__hint">{variant.hint}</p>
                    <textarea
                      className="image-sub-card__textarea"
                      value={value}
                      onChange={(e) => onChangeSub(def.key, variant.key, e.target.value)}
                      placeholder="GEMの出力にこのプロンプトがまだ含まれていません"
                      rows={4}
                    />
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </article>
  );
}
