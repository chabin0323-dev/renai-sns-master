import './Toast.css';

export default function Toast({ message, visible }) {
  return (
    <div className={`toast ${visible ? 'toast--visible' : ''}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}
