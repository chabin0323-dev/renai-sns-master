import './Header.css';

export default function Header({ onOpenHistory, historyCount, onOpenLinks, onOpenBuzzCheck }) {
  return (
    <header className="app-header">
      <div className="app-header__crest" aria-hidden="true">
        <svg viewBox="0 0 40 40" className="app-header__diamond">
          <polygon points="20,3 34,20 20,37 6,20" />
          <polygon points="20,10 27,20 20,30 13,20" className="app-header__diamond-inner" />
        </svg>
      </div>
      <div className="app-header__text">
        <h1 className="app-header__title">恋愛SNS投稿マスター</h1>
        <p className="app-header__desc">
          GEMで作成した投稿を貼り付けるだけ。SNS投稿を整理して、すぐコピーできます。
        </p>
      </div>
      <div className="app-header__actions">
        <button className="app-header__links-btn" onClick={onOpenLinks} type="button">
          🔗 リンク管理
        </button>
        <button className="app-header__links-btn" onClick={onOpenBuzzCheck} type="button">
          🔥 バズ診断
        </button>
        <button className="app-header__history-btn" onClick={onOpenHistory} type="button">
          📚 投稿履歴
          {historyCount > 0 && <span className="app-header__badge">{historyCount}</span>}
        </button>
      </div>
    </header>
  );
}
