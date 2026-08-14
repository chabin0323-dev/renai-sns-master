import { useCallback, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import InputPanel from './components/InputPanel.jsx';
import QuickStartButton from './components/QuickStartButton.jsx';
import CopyAllBar from './components/CopyAllBar.jsx';
import MultiFieldCard from './components/MultiFieldCard.jsx';
import ImagePromptSection from './components/ImagePromptSection.jsx';
import HistoryPanel from './components/HistoryPanel.jsx';
import Toast from './components/Toast.jsx';
import VideoMaker from './components/VideoMaker.jsx';
import { usePostHistory } from './hooks/useLocalStorage.js';
import { copyToClipboard } from './utils/clipboard.js';
import {
  parseSections,
  parseImagePrompts,
  EMPTY_SECTIONS_TEMPLATE,
  IMAGE_SUB_DEFS,
} from './utils/parser.js';
import './App.css';

const EMPTY_IMAGE_PROMPTS = {
  tiktok_video: { withText: '', noText: '' },
  tiktok_thumbnail: { withText: '', noText: '' },
  note_image: { withText: '', noText: '' },
  note_thumbnail: { withText: '', noText: '' },
  wordpress_eyecatch: { withText: '', noText: '' },
};

// 【重要】localStorageに保存された旧バージョンの履歴データは、imagePromptsの各値が
// 文字列（例: "prompt text"）のままになっている。新バージョンは { withText, noText }
// というオブジェクト形式のため、古い履歴を読み込んでも壊れないよう変換する。
function normalizeImagePromptsShape(raw) {
  const result = { ...EMPTY_IMAGE_PROMPTS };
  if (!raw) return result;
  for (const key of Object.keys(EMPTY_IMAGE_PROMPTS)) {
    const v = raw[key];
    if (v && typeof v === 'object') {
      result[key] = { withText: v.withText || '', noText: v.noText || '' };
    } else if (typeof v === 'string' && v.trim()) {
      // 旧形式（文字列1本）は、従来どおり主に使われていた種別へ引き継ぐ
      const legacyDefault = key === 'tiktok_thumbnail' || key === 'note_thumbnail' || key === 'wordpress_eyecatch'
        ? 'withText'
        : 'noText';
      result[key] = { withText: '', noText: '', [legacyDefault]: v };
    }
  }
  return result;
}

const SECTION_LABEL_MAP = {
  theme: '選定テーマ',
  tiktok_title: 'TikTokタイトル',
  tiktok_script: 'TikTok台本',
  tiktok_hashtags: 'TikTokハッシュタグ',
  instagram: 'Instagram',
  instagram_hashtags: 'Instagramハッシュタグ',
  x: 'X',
  x_hashtags: 'Xハッシュタグ',
  threads: 'Threads',
  threads_hashtags: 'Threadsハッシュタグ',
  note_title: 'noteタイトル',
  note_body: 'note本文',
  note_hashtags: 'noteハッシュタグ',
  wordpress_seo_title: 'WordPress SEOタイトル',
  wordpress_article_title: 'WordPress記事タイトル',
  wordpress_meta_description: 'WordPressメタディスクリプション',
  wordpress_keywords: 'WordPressキーワード',
  wordpress_body: 'WordPress本文',
  wordpress_cta: 'WordPress CTA',
};

// 「📋 全部コピー」の並び順（依頼どおりの順序を厳守）
const COPY_ALL_ORDER = [
  'theme',
  'tiktok_title',
  'tiktok_script',
  'tiktok_hashtags',
  'instagram',
  'instagram_hashtags',
  'x',
  'x_hashtags',
  'threads',
  'threads_hashtags',
  'note_title',
  'note_body',
  'note_hashtags',
  // WordPressはひとまとまりとして扱う（依頼の並び順どおり）
  '__wordpress__',
];

function buildWordpressBlock(sections) {
  const parts = [];
  const wpFields = [
    ['SEOタイトル', sections.wordpress_seo_title],
    ['記事タイトル', sections.wordpress_article_title],
    ['メタディスクリプション', sections.wordpress_meta_description],
    ['キーワード', sections.wordpress_keywords],
    ['本文', sections.wordpress_body],
    ['CTA', sections.wordpress_cta],
  ];
  for (const [label, value] of wpFields) {
    if (value && value.trim()) {
      parts.push(`【${label}】\n${value.trim()}`);
    }
  }
  return parts.join('\n\n');
}

function buildCopyAllText(sections, imagePrompts) {
  const parts = [];
  for (const key of COPY_ALL_ORDER) {
    if (key === '__wordpress__') {
      const wpBlock = buildWordpressBlock(sections);
      if (wpBlock.trim()) {
        parts.push(`■ WordPress\n${wpBlock}`);
      }
      continue;
    }
    const body = sections[key];
    if (body && body.trim()) {
      parts.push(`■ ${SECTION_LABEL_MAP[key]}\n${body.trim()}`);
    }
  }

  const imageParts = [];
  for (const def of IMAGE_SUB_DEFS) {
    const slot = imagePrompts[def.key] || {};
    if (slot.withText && slot.withText.trim()) {
      imageParts.push(`${def.label}（📝文字入り版）\n${slot.withText.trim()}`);
    }
    if (slot.noText && slot.noText.trim()) {
      imageParts.push(`${def.label}（🖼️文字なし版）\n${slot.noText.trim()}`);
    }
  }
  if (imageParts.length) {
    parts.push(`■ 画像生成プロンプト\n\n${imageParts.join('\n\n')}`);
  }

  return parts.join('\n\n' + '─'.repeat(20) + '\n\n');
}

export default function App() {
  const [rawInput, setRawInput] = useState('');
  const [sections, setSections] = useState({ ...EMPTY_SECTIONS_TEMPLATE });
  const [imagePrompts, setImagePrompts] = useState({ ...EMPTY_IMAGE_PROMPTS });
  const [organized, setOrganized] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toast, setToast] = useState({ message: '', visible: false });
  // 恋愛バズ動画メーカー用の画面切り替え（既存のorganized等のstateパターンを踏襲）。
  // 'sns' = 通常の投稿マスター画面 / 'video' = 動画メーカー画面
  const [activeView, setActiveView] = useState('sns');
  const toastTimer = useRef(null);

  const { history, savePost, deletePost, clearHistory } = usePostHistory();

  const showToast = useCallback((message) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, visible: true });
    toastTimer.current = setTimeout(() => {
      setToast((t) => ({ ...t, visible: false }));
    }, 1800);
  }, []);

  const handleQuickStartCopy = useCallback(async (text) => {
    const ok = await copyToClipboard(text);
    showToast(ok ? '📋 コピーしました。GEMに貼り付けてください' : '❌ コピーに失敗しました');
  }, [showToast]);

  const handleClearInput = useCallback(() => {
    // 貼り付け欄のReact stateを確実に空文字にする。
    // rawInputはどこにも自動永続化されていないため、再読み込みしても復活しない。
    setRawInput('');
    showToast('🗑️ 前回の文章を削除しました');
  }, [showToast]);

  const handleOrganize = useCallback(() => {
    if (!rawInput.trim()) {
      showToast('⚠️ 先にGEMの出力を貼り付けてください');
      return;
    }
    const parsed = parseSections(rawInput);
    const images = parseImagePrompts(parsed.image);
    // imageキーはUI表示に使わないため除外しつつ他はそのまま反映
    const { image, ...restSections } = parsed;
    setSections({ ...EMPTY_SECTIONS_TEMPLATE, ...restSections });
    setImagePrompts({ ...EMPTY_IMAGE_PROMPTS, ...images });
    setOrganized(true);
    showToast('✨ 投稿を整理しました');
  }, [rawInput, showToast]);

  const updateField = useCallback((key, value) => {
    setSections((prev) => ({ ...prev, [key]: value }));
  }, []);

  const updateImageSub = useCallback((key, variant, value) => {
    setImagePrompts((prev) => ({
      ...prev,
      [key]: { ...prev[key], [variant]: value },
    }));
  }, []);

  const handleCopyField = useCallback(async (key, label) => {
    const ok = await copyToClipboard(sections[key]);
    showToast(ok ? `📋 ${label}をコピーしました` : '❌ コピーに失敗しました');
  }, [sections, showToast]);

  const handleCopyImageSub = useCallback(async (key, variant, label) => {
    const value = imagePrompts[key]?.[variant] || '';
    const ok = await copyToClipboard(value);
    showToast(ok ? `📋 ${label}をコピーしました` : '❌ コピーに失敗しました');
  }, [imagePrompts, showToast]);

  const handleCopyAllImagePrompts = useCallback(async () => {
    const parts = [];
    for (const def of IMAGE_SUB_DEFS) {
      const slot = imagePrompts[def.key] || {};
      if (slot.withText && slot.withText.trim()) {
        parts.push(`${def.label}（📝文字入り版）\n${slot.withText.trim()}`);
      }
      if (slot.noText && slot.noText.trim()) {
        parts.push(`${def.label}（🖼️文字なし版）\n${slot.noText.trim()}`);
      }
    }
    const text = parts.join('\n\n');
    const ok = await copyToClipboard(text);
    showToast(ok ? '📋 全プロンプトをコピーしました' : '❌ コピーに失敗しました');
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
      sections: { ...sections, __imagePrompts: imagePrompts },
    });
    showToast('💾 投稿履歴に保存しました');
  }, [sections, imagePrompts, rawInput, savePost, showToast]);

  const handleSelectHistory = useCallback((item) => {
    setRawInput(item.rawText || '');
    const saved = item.sections || {};
    const { __imagePrompts, ...restSaved } = saved;
    setSections({ ...EMPTY_SECTIONS_TEMPLATE, ...restSaved });
    // 旧バージョンの履歴（imagePromptsが文字列形式）でも壊れないよう正規化する
    setImagePrompts(normalizeImagePromptsShape(__imagePrompts));
    setOrganized(true);
    setHistoryOpen(false);
    showToast('📚 過去の投稿を読み込みました');
  }, [showToast]);

  // --- 恋愛バズ動画メーカー関連（追加分。既存ロジックには影響しない） ---
  const handleOpenVideoMaker = useCallback(() => {
    setActiveView('video');
  }, []);

  const handleBackToSns = useCallback(() => {
    setActiveView('sns');
  }, []);

  const handleVideoCopy = useCallback(async (text, label) => {
    const ok = await copyToClipboard(text);
    showToast(ok ? `📋 ${label}をコピーしました` : '❌ コピーに失敗しました');
  }, [showToast]);

  // SNS投稿マスターの既存stateから、動画メーカーに必要なデータだけを取り出す。
  // ページ遷移やlocalStorageを経由せず、propsとして直接渡すため再入力は発生しない。
  // 【修正1】CTAはwordpress_ctaを使わない。TikTok用動画のため、TikTok台本自体の
  // 末尾（＝既存のTikTok投稿にすでに設定されている導線）をそのままCTAとして扱う。
  // 【修正2】imageDataは実装しない。引き継ぐ画像情報はimagePrompts.tiktok_video（文字なし
  // 9:16画像生成プロンプト）のみとする。
  // ①TikTok動画素材は「文字なし版」を優先して動画メーカーへ渡す（動画側は自前でテロップを
  // 表示するため、画像に文字が焼き込まれていると重複・干渉してしまうため）。
  // 万一noTextが未検出の場合のみ、withTextをフォールバックとして使用する。
  const videoSourceData = {
    theme: sections.theme,
    tiktokTitle: sections.tiktok_title,
    tiktokScript: sections.tiktok_script,
    tiktokHashtags: sections.tiktok_hashtags,
    tiktokImagePrompt: imagePrompts.tiktok_video?.noText || imagePrompts.tiktok_video?.withText || '',
  };
  const videoDisabled = !sections.tiktok_script || !sections.tiktok_script.trim();

  // TikTok: タイトル・台本・ハッシュタグを完全に独立した3項目として表示
  const tiktokFields = [
    { key: 'tiktok_title', label: '【TikTokタイトル】', value: sections.tiktok_title, copyText: 'タイトルコピー', rows: 2 },
    { key: 'tiktok_script', label: '【TikTok台本】', value: sections.tiktok_script, copyText: '台本コピー', rows: 8 },
    { key: 'tiktok_hashtags', label: '【TikTokハッシュタグ】', value: sections.tiktok_hashtags, copyText: 'ハッシュタグコピー', rows: 2 },
  ];

  const instagramFields = [
    { key: 'instagram', label: '【Instagram】', value: sections.instagram, copyText: '本文コピー', rows: 5 },
    { key: 'instagram_hashtags', label: '【Instagramハッシュタグ】', value: sections.instagram_hashtags, copyText: 'ハッシュタグコピー', rows: 2 },
  ];

  const xFields = [
    { key: 'x', label: '【X】', value: sections.x, copyText: '本文コピー', rows: 4 },
    { key: 'x_hashtags', label: '【Xハッシュタグ】', value: sections.x_hashtags, copyText: 'ハッシュタグコピー', rows: 2 },
  ];

  const threadsFields = [
    { key: 'threads', label: '【Threads】', value: sections.threads, copyText: '本文コピー', rows: 4 },
    { key: 'threads_hashtags', label: '【Threadsハッシュタグ】', value: sections.threads_hashtags, copyText: 'ハッシュタグコピー', rows: 2 },
  ];

  const noteFields = [
    { key: 'note_title', label: '【noteタイトル】', value: sections.note_title, copyText: 'タイトルコピー', rows: 2 },
    { key: 'note_body', label: '【note本文】', value: sections.note_body, copyText: '本文コピー', rows: 6 },
    { key: 'note_hashtags', label: '【noteハッシュタグ】', value: sections.note_hashtags, copyText: 'ハッシュタグコピー', rows: 2 },
  ];

  const wordpressFields = [
    { key: 'wordpress_seo_title', label: '【SEOタイトル】', value: sections.wordpress_seo_title, copyText: 'コピー', rows: 2 },
    { key: 'wordpress_article_title', label: '【記事タイトル】', value: sections.wordpress_article_title, copyText: 'コピー', rows: 2 },
    { key: 'wordpress_meta_description', label: '【メタディスクリプション】', value: sections.wordpress_meta_description, copyText: 'コピー', rows: 3 },
    { key: 'wordpress_keywords', label: '【キーワード】', value: sections.wordpress_keywords, copyText: 'コピー', rows: 2 },
    { key: 'wordpress_body', label: '【本文】', value: sections.wordpress_body, copyText: 'コピー', rows: 8 },
    { key: 'wordpress_cta', label: '【CTA】', value: sections.wordpress_cta, copyText: 'コピー', rows: 3 },
  ];

  return (
    <div className="app">
      <Header onOpenHistory={() => setHistoryOpen(true)} historyCount={history.length} />

      {activeView === 'sns' && (
        <>
          <QuickStartButton onCopied={handleQuickStartCopy} />

          <InputPanel
            value={rawInput}
            onChange={setRawInput}
            onOrganize={handleOrganize}
            onClear={handleClearInput}
            disabled={!rawInput.trim()}
          />

          {organized && (
            <>
              <CopyAllBar
                onCopyAll={handleCopyAll}
                onSave={handleSave}
                theme={sections.theme}
              />

              <main className="app__results">
                <div className="app__grid">
                  <MultiFieldCard
                    label="TikTok"
                    icon="🎵"
                    fields={tiktokFields}
                    onChangeField={updateField}
                    onCopyField={handleCopyField}
                    videoAction={{ onClick: handleOpenVideoMaker, disabled: videoDisabled }}
                  />
                  <MultiFieldCard
                    label="Instagram"
                    icon="📸"
                    fields={instagramFields}
                    onChangeField={updateField}
                    onCopyField={handleCopyField}
                  />
                  <MultiFieldCard
                    label="X"
                    icon="𝕏"
                    fields={xFields}
                    onChangeField={updateField}
                    onCopyField={handleCopyField}
                  />
                  <MultiFieldCard
                    label="Threads"
                    icon="🧵"
                    fields={threadsFields}
                    onChangeField={updateField}
                    onCopyField={handleCopyField}
                  />
                  <MultiFieldCard
                    label="note"
                    icon="📝"
                    fields={noteFields}
                    onChangeField={updateField}
                    onCopyField={handleCopyField}
                  />
                  <MultiFieldCard
                    label="WordPress"
                    icon="🌐"
                    fields={wordpressFields}
                    onChangeField={updateField}
                    onCopyField={handleCopyField}
                  />

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
        </>
      )}

      {activeView === 'video' && (
        <VideoMaker data={videoSourceData} onBack={handleBackToSns} onCopy={handleVideoCopy} />
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
