import { useMemo } from 'react';
import { fitPostWithLink } from '../utils/linkFit.js';
import './SocialLinkBlock.css';

// プルダウン選択はなくし、常に①番目に登録されたリンクを自動で使用する。
export default function SocialLinkBlock({
  links,
  body,
  limit,
  lengthFn,
  onCopyFinal,
}) {
  const selected = links[0] || null;

  const result = useMemo(
    () => fitPostWithLink({ body, url: selected?.url || '', limit, lengthFn }),
    [body, selected, limit, lengthFn]
  );

  return (
    <div className="social-link-block">
      <div className="social-link-block__header">
        <span className="social-link-block__label">🔗 相性診断への誘導リンク</span>
      </div>

      {selected && (
        <>
          <div className="social-link-block__preview-header">
            <span className="social-link-block__preview-label">📋 リンク付き投稿文（プレビュー）</span>
            <span className={`social-link-block__count ${result.length > result.limit ? 'social-link-block__count--over' : ''}`}>
              {result.length} / {result.limit}文字
            </span>
          </div>
          {result.wasTruncated && !result.overLimitEvenEmpty && (
            <p className="social-link-block__note">
              ℹ️ 文字数制限内に収めるため、本文を自然な区切りで短縮しています（元の本文は変更されません）。
            </p>
          )}
          {result.overLimitEvenEmpty && (
            <p className="social-link-block__note social-link-block__note--warn">
              ⚠️ 誘導文とURLだけで文字数制限を超えています。URLを短縮するなどの対応を検討してください。
            </p>
          )}
          <textarea
            className="social-link-block__textarea"
            value={result.finalText}
            readOnly
            rows={6}
          />
          <button
            className="social-link-block__copy"
            onClick={() => onCopyFinal(result.finalText)}
            disabled={!result.finalText.trim()}
            type="button"
          >
            📋 リンク付き投稿文をコピー
          </button>
        </>
      )}
    </div>
  );
}
