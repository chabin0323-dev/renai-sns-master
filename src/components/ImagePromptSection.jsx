import './ImagePromptSection.css';

const SUB_DEFS = [
  { key: 'tiktok_no_text', label: '① TikTok・文字なし', copyLabel: 'TikTok画像プロンプトをコピー（文字なし）' },
  { key: 'tiktok_text', label: '② TikTok・文字あり', copyLabel: 'TikTok画像プロンプトをコピー（文字あり）' },
  { key: 'note_no_text', label: '③ note・文字なし', copyLabel: 'note画像プロンプトをコピー（文字なし）' },
  { key: 'note_text', label: '④ note・文字あり', copyLabel: 'note画像プロンプトをコピー（文字あり）' },
  { key: 'wordpress_eyecatch', label: '⑤ WordPress・アイキャッチ', copyLabel: 'WordPress画像プロンプトをコピー' },
];

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
        {SUB_DEFS.map((def) => {
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
              <textarea
                className="image-sub-card__textarea"
                value={value}
                onChange={(e) => onChangeSub(def.key, e.target.value)}
                placeholder="このプロンプトはまだ検出されていません"
                rows={5}
              />
            </div>
          );
        })}
      </div>
    </article>
  );
}
