import './InputPanel.css';

export default function InputPanel({ value, onChange, onOrganize, disabled }) {
  return (
    <section className="input-panel">
      <textarea
        className="input-panel__textarea"
        placeholder="GEMで作成した投稿をここに貼り付けてください"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={10}
        aria-label="GEM出力の貼り付け欄"
      />
      <button
        className="input-panel__btn"
        onClick={onOrganize}
        disabled={disabled}
        type="button"
      >
        ✨ 投稿を整理する
      </button>
    </section>
  );
}
