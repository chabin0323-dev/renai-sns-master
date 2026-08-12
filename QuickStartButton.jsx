import './QuickStartButton.css';

const TRIGGER_TEXT = '今日の投稿を1本作って';

export default function QuickStartButton({ onCopied }) {
  const handleClick = async () => {
    onCopied(TRIGGER_TEXT);
  };

  return (
    <div className="quick-start">
      <button className="quick-start__btn" onClick={handleClick} type="button">
        ✨ 今日の投稿を1本作る
      </button>
      <p className="quick-start__hint">
        タップすると「{TRIGGER_TEXT}」をコピーします。GEMに貼り付けて実行してください。
      </p>
    </div>
  );
}
