import { useCallback, useMemo, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import InputPanel from './components/InputPanel.jsx';
import CopyAllBar from './components/CopyAllBar.jsx';
import ResultCard from './components/ResultCard.jsx';
import ImagePromptSection from './components/ImagePromptSection.jsx';
import HistoryPanel from './components/HistoryPanel.jsx';
import Toast from './components/Toast.jsx';
import { usePostHistory } from './hooks/useLocalStorage.js';
import { copyToClipboard } from './utils/clipboard.js';
import {
  parseSections,
  parseImagePrompts,
  extractHashtags,
  SECTION_ORDER,
  HASHTAG_SECTIONS,
} from './utils/parser.js';
import './App.css';

const ICONS = {
  theme: '💎',
  tiktok: '🎵',
  instagram: '📸',
  x: '𝕏',
  threads: '🧵',
  note: '📝',
  wordpress: '🌐',
};

const SECTION_LABELS = {
  theme: '選定テーマ',
  tiktok: 'TikTok',
  instagram: 'Instagram',
  x: 'X',
  threads: 'Threads',
  note: 'note',
  wordpress: 'WordPress',
};

const IMAGE_SUB_LABELS = {
  tiktok_no_text: '① TikTok・文字なし',
  tiktok_text: '② TikTok・文字あり',
  note_no_text: '③ note・文字なし',
  note_text: '④ note・文字あり',
  wordpress_eyecatch: '⑤ WordPress・アイキャッチ',
};

const EMPTY_SECTIONS = {
  theme: '',
  tiktok: '',
  instagram: '',
  x: '',
  threads: '',
  note: '',
  wordpress: '',
};

const EMPTY_IMAGE_PROMPTS = {
  tiktok_no_text: '',
  tiktok_text: '',
  note_no_text: '',
  note_text: '',
  wordpress_eyecatch: '',
};

function buildCopyAllText(sections, imagePrompts) {
  const parts = [];
  const order = ['tiktok', 'instagram', 'x', 'threads', 'note', 'wordpress'];
  for (const key of order) {
    const body = sections[key];
    if (body && body.trim()) {
      parts.push(`■ ${SECTION_LABELS[key]}\n${body.trim()}`);
    }
  }
  const imageParts = [];
  for (const key of Object.keys(IMAGE_SUB_LABELS)) {
    if (imagePrompts[key] && imagePrompts[key].trim()) {
      imageParts.push(`${IMAGE_SUB_LABELS[key]}\n${imagePrompts[key].trim()}`);
    }
  }
  if (imageParts.length) {
    parts.push(`■ 画像生成プロンプト\n\n${imageParts.join('\n\n')}`);
  }
  return parts.join('\n\n' + '─'.repeat(20) + '\n\n');
}

export default function App() {
  const [rawInput, setRawInput] = useState('');
  const [sections, setSections] = useState(EMPTY_SECTIONS);
  const [imagePrompts, setImagePrompts] = useState(EMPTY_IMAGE_PROMPTS);
  const [organized, setOrganized] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toast, setToast] = useState({ message: '', visible: false });
  const toastTimer = useRef(null);

  const { history, savePost, deletePost, clearHistory } = usePostHistory();

  const showToast = useCallback((message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, visible: true });
    toastTimer.current = setTimeout(() => {
      setToast((t) => ({ ...t, visible: false }));
    }, 1800);
  }, []);

  const handleOrganize = useCallback(() => {
    if (!rawInput.trim()) {
      showToast('⚠️ 先にGEMの出力を貼り付けてください');
      return;
    }
    const parsed = parseSections(rawInput);
    const images = parseImagePrompts(parsed.image);
    setSections({
      theme: parsed.theme,
      tiktok: parsed.tiktok,
      instagram: parsed.instagram,
      x: parsed.x,
      threads: parsed.threads,
      note: parsed.note,
      wordpress: parsed.wordpress,
    });
    setImagePrompts(images);
    setOrganized(true);
    showToast('✨ 投稿を整理しました');
  }, [rawInput, showToast]);

  const updateSection = useCallback((key, value) => {
    setSections((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateImageSub = useCallback((key, value) => {
    setImagePrompts((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleCopySection = useCallback(async (key) => {
    const ok = await copyToClipboard(sections[key]);
    showToast(ok ? `📋 ${SECTION_LABELS[key]}をコピーしました` : '❌ コピーに失敗しました');
  }, [sections, showToast]);

  const handleCopyHashtags = useCallback(async (key) => {
    const tags = extractHashtags(sections[key]);
    const ok = await copyToClipboard(tags);
    showToast(ok ? `# ${SECTION_LABELS[key]}のハッシュタグをコピーしました` : '❌ コピーに失敗しました');
  }, [sections, showToast]);

  const handleCopyImageSub = useCallback(async (key, label) => {
    const ok = await copyToClipboard(imagePrompts[key]);
    showToast(ok ? `📋 ${label.replace('をコピー', '')}をコピーしました` : '❌ コピーに失敗しました');
  }, [imagePrompts, showToast]);

  const handleCopyAllImagePrompts = useCallback(async () => {
    const text = Object.keys(IMAGE_SUB_LABELS)
      .filter((k) => imagePrompts[k] && imagePrompts[k].trim())
      .map((k) => `${IMAGE_SUB_LABELS[k]}\n${imagePrompts[k].trim()}`)
      .join('\n\n');
    const ok = await copyToClipboard(text);
    showToast(ok ? '📋 画像プロンプトを5種類コピーしました' : '❌ コピーに失敗しました');
  }, [imagePrompts, showToast]);

  const handleCopyAll = useCallback(async () => {
    const text = buildCopyAllText(sections, imagePrompts);
    if (!text.trim()) {
      showToast('⚠️ コピーできる内容がありません');
      return;
    }
    const ok = await copyToClipboard(text);
    showToast(ok ? '📋 全部コピーしました' : '❌ コピーに失敗しました');
  }, [sections, imagePrompts, showToast]);

  const handleSave = useCallback(() => {
    const hasContent = Object.values(sections).some((v) => v && v.trim());
    if (!hasContent) {
      showToast('⚠️ 保存できる内容がありません');
      return;
    }
    savePost({
      theme: sections.theme,
      rawText: rawInput,
      sections: { ...sections, image: imagePrompts },
    });
    showToast('💾 投稿履歴に保存しました');
  }, [sections, imagePrompts, rawInput, savePost, showToast]);

  const handleSelectHistory = useCallback((item) => {
    setRawInput(item.rawText || '');
    const savedSections = item.sections || {};
    setSections({
      theme: savedSections.theme || '',
      tiktok: savedSections.tiktok || '',
      instagram: savedSections.instagram || '',
      x: savedSections.x || '',
      threads: savedSections.threads || '',
      note: savedSections.note || '',
      wordpress: savedSections.wordpress || '',
    });
    setImagePrompts(savedSections.image || EMPTY_IMAGE_PROMPTS);
    setOrganized(true);
    setHistoryOpen(false);
    showToast('📚 過去の投稿を読み込みました');
  }, [showToast]);

  const cardKeys = useMemo(() => SECTION_ORDER.filter((s) => s.key !== 'theme' && s.key !== 'image'), []);

  return (
    <div className="app">
      <Header onOpenHistory={() => setHistoryOpen(true)} historyCount={history.length} />

      <InputPanel
        value={rawInput}
        onChange={setRawInput}
        onOrganize={handleOrganize}
        disabled={!rawInput.trim()}
      />

      {organized && (
        <>
          <CopyAllBar onCopyAll={handleCopyAll} onSave={handleSave} theme={sections.theme} />

          <main className="app__results">
            <div className="app__grid">
              {cardKeys.map(({ key, label }) => (
                <ResultCard
                  key={key}
                  label={SECTION_LABELS[key] || label}
                  icon={ICONS[key]}
                  value={sections[key]}
                  onChange={(v) => updateSection(key, v)}
                  onCopy={() => handleCopySection(key)}
                  hashtags={HASHTAG_SECTIONS.includes(key) ? extractHashtags(sections[key]) : undefined}
                  onCopyHashtags={() => handleCopyHashtags(key)}
                />
              ))}

              <ImagePromptSection
                prompts={imagePrompts}
                onChangeSub={updateImageSub}
                onCopySub={handleCopyImageSub}
                onCopyAllPrompts={handleCopyAllImagePrompts}
              />
            </div>
          </main>
        </>
      )}

      {!organized && (
        <div className="app__empty">
          <p>💎 GEMで生成した投稿を貼り付けて「投稿を整理する」を押すと、ここにSNSごとの投稿カードが並びます。</p>
        </div>
      )}

      <HistoryPanel
        open={historyOpen}
        history={history}
        onClose={() => setHistoryOpen(false)}
        onSelect={handleSelectHistory}
        onDelete={(id) => {
          deletePost(id);
          showToast('🗑️ 削除しました');
        }}
        onClearAll={() => {
          clearHistory();
          showToast('🗑️ 履歴をすべて削除しました');
        }}
      />

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
}
