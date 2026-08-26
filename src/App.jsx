import { useCallback, useEffect, useRef, useState } from 'react';
import Header from './components/Header.jsx';
import InputPanel from './components/InputPanel.jsx';
import QuickStartButton from './components/QuickStartButton.jsx';
import CopyAllBar from './components/CopyAllBar.jsx';
import MultiFieldCard from './components/MultiFieldCard.jsx';
import ImagePromptSection from './components/ImagePromptSection.jsx';
import HistoryPanel from './components/HistoryPanel.jsx';
import LinksPanel from './components/LinksPanel.jsx';
import NoteLinkBlock from './components/NoteLinkBlock.jsx';
import SocialLinkBlock from './components/SocialLinkBlock.jsx';
import Toast from './components/Toast.jsx';
import VideoMaker from './components/VideoMaker.jsx';
import { usePostHistory } from './hooks/useLocalStorage.js';
import { useLinks } from './hooks/useLinks.js';
import { loadCurrentPost, saveCurrentPost, clearCurrentPost } from './hooks/useCurrentPost.js';
import { copyToClipboard } from './utils/clipboard.js';
import { calcXLength, calcThreadsLength, X_LIMIT, THREADS_LIMIT } from './utils/linkFit.js';
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
    const value = slot[def.activeVariant];
    if (value && value.trim()) {
      imageParts.push(`${def.label}\n${value.trim()}`);
    }
  }
  if (imageParts.length) {
    parts.push(`■ 画像生成プロンプト\n\n${imageParts.join('\n\n')}`);
  }

  return parts.join('\n\n' + '─'.repeat(20) + '\n\n');
}

export default function App() {
  // 【自動保存の復元】アプリ起動時、前回の作業中データ（画面に表示されていた投稿）が
  // localStorageに残っていれば、それを初期値として画面へ復元する。
  // ユーザーが明示的に「💾 保存」を押していなくても、閉じる直前の状態がそのまま戻る。
  const restoredCurrentPost = loadCurrentPost();

  const [rawInput, setRawInput] = useState(restoredCurrentPost?.rawInput || '');
  const [sections, setSections] = useState({
    ...EMPTY_SECTIONS_TEMPLATE,
    ...(restoredCurrentPost?.sections || {}),
  });
  const [imagePrompts, setImagePrompts] = useState(
    normalizeImagePromptsShape(restoredCurrentPost?.imagePrompts)
  );
  const [organized, setOrganized] = useState(!!restoredCurrentPost?.organized);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toast, setToast] = useState({ message: '', visible: false });
  // 恋愛バズ動画メーカー用の画面切り替え（既存のorganized等のstateパターンを踏襲）。
  // 'sns' = 通常の投稿マスター画面 / 'video' = 動画メーカー画面
  const [activeView, setActiveView] = useState('sns');
  // 共通リンク管理パネルの開閉、および note/X/Threads それぞれで選択中のリンクID
  const [linksOpen, setLinksOpen] = useState(false);
  const [noteLinkId, setNoteLinkId] = useState(restoredCurrentPost?.noteLinkId || 'none');
  const [xLinkId, setXLinkId] = useState(restoredCurrentPost?.xLinkId || 'none');
  const [threadsLinkId, setThreadsLinkId] = useState(restoredCurrentPost?.threadsLinkId || 'none');
  const toastTimer = useRef(null);

  const { history, savePost, deletePost, clearHistory } = usePostHistory();
  const { links, updateLink } = useLinks();

  // 【自動保存の実行】現在の作業状態が変化するたびに、localStorageへ自動保存する。
  // ユーザーの「保存」操作を必要とせず、ページ再読み込み・アプリ終了後も復元できるようにする。
  // 既存の「📚 投稿履歴」（usePostHistory）とは別のlocalStorageキーで管理しており、
  // 保存方式を二重化するものではない。
  useEffect(() => {
    saveCurrentPost({
      rawInput,
      sections,
      imagePrompts,
      organized,
      noteLinkId,
      xLinkId,
      threadsLinkId,
    });
  }, [rawInput, sections, imagePrompts, organized, noteLinkId, xLinkId, threadsLinkId]);

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
    setRawInput('');
    // rawInputだけでなく、自動保存されている現在の作業データそのものも明示的に消去する。
    // （直後にuseEffectがrawInput:''で上書き保存するが、ここで先にキー自体を削除しておく
    // ことで、生成済みの他データも含めて意図が明確になる。sections/imagePromptsは
    // useEffectにより直後に再保存されるため、投稿結果自体が消えることはない）
    clearCurrentPost();
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
    // 新しい投稿を整理したら、前回選択していたリンクをリセットする
    setNoteLinkId('none');
    setXLinkId('none');
    setThreadsLinkId('none');
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
      const value = slot[def.activeVariant];
      if (value && value.trim()) {
        parts.push(`${def.label}\n${value.trim()}`);
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

  // 現在選択中のリンク情報（投稿履歴に保存する用）。「なし」の場合はnull。
  const buildSelectedLinksSnapshot = useCallback(() => {
    const pick = (id) => {
      if (id === 'none') return null;
      const link = links.find((l) => String(l.id) === String(id));
      return link ? { id: link.id, name: link.name, url: link.url } : null;
    };
    return {
      note: pick(noteLinkId),
      x: pick(xLinkId),
      threads: pick(threadsLinkId),
    };
  }, [links, noteLinkId, xLinkId, threadsLinkId]);

  const handleSave = useCallback(() => {
    const hasContent = Object.values(sections).some((v) => v && v.trim());
    if (!hasContent) {
      showToast('⚠️ 保存できる内容がありません');
      return;
    }
    savePost({
      theme: sections.theme,
      rawText: rawInput,
      sections: {
        ...sections,
        __imagePrompts: imagePrompts,
        __selectedLinks: buildSelectedLinksSnapshot(),
      },
    });
    showToast('💾 投稿履歴に保存しました');
  }, [sections, imagePrompts, rawInput, savePost, showToast, buildSelectedLinksSnapshot]);

  const handleSelectHistory = useCallback((item) => {
    setRawInput(item.rawText || '');
    const saved = item.sections || {};
    const { __imagePrompts, __selectedLinks, ...restSaved } = saved;
    setSections({ ...EMPTY_SECTIONS_TEMPLATE, ...restSaved });
    // 旧バージョンの履歴（imagePromptsが文字列形式）でも壊れないよう正規化する
    setImagePrompts(normalizeImagePromptsShape(__imagePrompts));
    // 過去の投稿でどのリンクを使用していたかを復元する（未保存の古い履歴は「なし」扱い）
    setNoteLinkId(__selectedLinks?.note?.id ? String(__selectedLinks.note.id) : 'none');
    setXLinkId(__selectedLinks?.x?.id ? String(__selectedLinks.x.id) : 'none');
    setThreadsLinkId(__selectedLinks?.threads?.id ? String(__selectedLinks.threads.id) : 'none');
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

  // --- 共通リンク関連（追加分。既存ロジックには影響しない） ---
  const handleCopyLinkField = useCallback(async (text, label) => {
    if (!text) return;
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

  // note/X/Threadsの「リンク利用」拡張ブロック（共通リンクを参照するだけで、既存の
  // フィールド・コピー機能・GEM出力そのものには一切手を加えない）
  const noteExtraBlock = (
    <NoteLinkBlock
      links={links}
      selectedId={noteLinkId}
      onSelect={setNoteLinkId}
      onCopyName={(name) => handleCopyLinkField(name, 'リンク名')}
      onCopyUrl={(url) => handleCopyLinkField(url, 'URL')}
    />
  );

  const xExtraBlock = (
    <SocialLinkBlock
      links={links}
      selectedId={xLinkId}
      onSelect={setXLinkId}
      body={sections.x}
      limit={X_LIMIT}
      lengthFn={calcXLength}
      onCopyFinal={(text) => handleCopyLinkField(text, 'リンク付き投稿文')}
    />
  );

  const threadsExtraBlock = (
    <SocialLinkBlock
      links={links}
      selectedId={threadsLinkId}
      onSelect={setThreadsLinkId}
      body={sections.threads}
      limit={THREADS_LIMIT}
      lengthFn={calcThreadsLength}
      onCopyFinal={(text) => handleCopyLinkField(text, 'リンク付き投稿文')}
    />
  );

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
      <Header onOpenHistory={() => setHistoryOpen(true)} historyCount={history.length} onOpenLinks={() => setLinksOpen(true)} />

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
                    accent="tiktok"
                  />
                  <MultiFieldCard
                    label="Instagram"
                    icon="📸"
                    fields={instagramFields}
                    onChangeField={updateField}
                    onCopyField={handleCopyField}
                    accent="instagram"
                  />
                  <MultiFieldCard
                    label="X"
                    icon="𝕏"
                    fields={xFields}
                    onChangeField={updateField}
                    onCopyField={handleCopyField}
                    extraBlock={xExtraBlock}
                    accent="x"
                  />
                  <MultiFieldCard
                    label="Threads"
                    icon="🧵"
                    fields={threadsFields}
                    onChangeField={updateField}
                    onCopyField={handleCopyField}
                    extraBlock={threadsExtraBlock}
                    accent="threads"
                  />
                  <MultiFieldCard
                    label="note"
                    icon="📝"
                    fields={noteFields}
                    onChangeField={updateField}
                    onCopyField={handleCopyField}
                    extraBlock={noteExtraBlock}
                    accent="note"
                  />
                  <MultiFieldCard
                    label="WordPress"
                    icon="🌐"
                    fields={wordpressFields}
                    onChangeField={updateField}
                    onCopyField={handleCopyField}
                    accent="wordpress"
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

      <LinksPanel
        open={linksOpen}
        links={links}
        onUpdateLink={updateLink}
        onClose={() => setLinksOpen(false)}
        onCopied={showToast}
      />

      <Toast message={toast.message} visible={toast.visible} />
    </div>
  );
}
