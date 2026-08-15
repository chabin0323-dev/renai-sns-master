import { useMemo } from 'react';
import { fitPostWithLink } from '../utils/linkFit.js';
import './SocialLinkBlock.css';

export default function SocialLinkBlock({
  links,
  selectedId,
  onSelect,
  body,
  limit,
  lengthFn,
  onCopyFinal,
}) {
  const selected = selectedId === 'none' ? null : links.find((l) => String(l.id) === String(selectedId));

  const result = useMemo(
    () => fitPostWithLink({ body, url: selected?.url || '', limit, lengthFn }),
    [body, selected, limit, lengthFn]
  );

  return (
    <div className="social-link-block">
      <div className="social-link-block__header">
        <span className="social-link-block__label">🔗 相性診断への誘導リンク</span>
        <select
          className="social-link-block__select"
          value={selectedId}
          onChange={(e) => onSelect(e.target.value)}
        >
          <option value="none">なし</option>
          {links.map((link, idx) => (
            <option key={link.id} value={link.id}>
              {['①', '②', '③', '④', '⑤'][idx]} {link.name || '（名前未設定）'}
            </option>
          ))}
        </select>
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
