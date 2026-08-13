import './CopyAllBar.css';

export default function CopyAllBar({ onCopyAll, onSave, theme, onCreateVideo, videoDisabled }) {
  return (
    <div className="copy-all-bar">
      <div className="copy-all-bar__inner">
        <div className="copy-all-bar__theme">
          <span className="copy-all-bar__theme-label">選定テーマ</span>
          <span className="copy-all-bar__theme-value">{theme || '（テーマ未検出）'}</span>
        </div>
        <div className="copy-all-bar__actions">
          <button className="copy-all-bar__save" onClick={onSave} type="button">
            💾 保存
          </button>
          <button className="copy-all-bar__copy" onClick={onCopyAll} type="button">
            📋 全部コピー
          </button>
          {onCreateVideo && (
            <button
              className="copy-all-bar__video"
              onClick={onCreateVideo}
              disabled={videoDisabled}
              type="button"
            >
              🎬 この投稿でバズ動画を作る
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

