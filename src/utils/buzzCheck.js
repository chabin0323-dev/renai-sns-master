// 🔥バズ診断: 直近の投稿履歴から CTA の使い回し・画像の汎用テンプレ流用・
// タイトルの重複を検出するための純粋関数群。
// App.jsxからはanalyzeHistory()だけを呼び出せばよい。

// CTAの分類パターン（このファイル内の判定にのみ使用。GEM側の指示文と表現を揃えている）
export const CTA_TYPES = [
  { key: 'profile', label: 'プロフィール誘導型', keywords: ['プロフィール', 'プロフ', '相性診断'] },
  { key: 'comment', label: 'コメント誘発型', keywords: ['コメント', 'どっち派', '教えて'] },
  { key: 'save', label: '保存誘導型', keywords: ['保存'] },
  { key: 'share', label: 'シェア誘導型', keywords: ['シェア', '送ってあげて', '友達に送'] },
  { key: 'continue', label: '続き示唆型', keywords: ['続きは', '続きを'] },
];

const NONE_TYPE = { key: 'none_or_other', label: 'CTAなし／その他' };

// 恋愛というテーマと無関係な、汎用バズテンプレでよく使われがちな動物・題材のキーワード。
// 画像プロンプトにこれらが含まれていたら要注意フラグを立てる。
const GENERIC_ANIMAL_KEYWORDS = [
  'サメ', 'shark', '象', 'ゾウ', 'elephant', '巨大な目', '猫', 'ネコ', 'cat',
];

// 使い回されがちな固定フレーズ（過去に実際に使われていた定型文）
const OVERUSED_PHRASES = [
  'どうなってるの', 'マジで意味不明すぎる',
];

function normalize(text) {
  return (text || '').replace(/\s+/g, '').trim();
}

/**
 * TikTok台本の末尾＋WordPress CTAのテキストから、CTAの型を判定する。
 * 複数の型のキーワードが混在する場合は、CTA_TYPES配列の並び順で最初に一致した型を採用する。
 */
export function classifyCta(sections) {
  const scriptTail = (sections?.tiktok_script || '').slice(-120);
  const wpCta = sections?.wordpress_cta || '';
  const text = scriptTail + '\n' + wpCta;

  for (const type of CTA_TYPES) {
    if (type.keywords.some((kw) => text.includes(kw))) {
      return type;
    }
  }
  return NONE_TYPE;
}

/**
 * 画像プロンプト一式（__imagePromptsの中身）から、テキスト全体を1本にまとめて返す。
 */
function flattenImagePrompts(imagePrompts) {
  if (!imagePrompts) return '';
  return Object.values(imagePrompts)
    .map((slot) => (slot ? `${slot.withText || ''} ${slot.noText || ''}` : ''))
    .join(' ');
}

/**
 * 投稿履歴（新しい順の配列）を分析し、バズ診断レポートを返す。
 * @param {Array} history - usePostHistory() の history（新しい順）
 * @param {number} lookback - 直近何件を対象にするか
 */
export function analyzeHistory(history, lookback = 8) {
  const recent = (history || []).slice(0, lookback);

  const ctaTimeline = recent.map((item) => {
    const type = classifyCta(item.sections || {});
    return {
      id: item.id,
      theme: item.theme || '（テーマ未設定）',
      createdAt: item.createdAt,
      ctaKey: type.key,
      ctaLabel: type.label,
    };
  });

  const warnings = [];

  // 1) CTAの型が直近3件で連続して同じ場合は警告
  if (ctaTimeline.length >= 3) {
    const [a, b, c] = ctaTimeline;
    if (a.ctaKey === b.ctaKey && b.ctaKey === c.ctaKey) {
      warnings.push({
        type: 'cta_repeat',
        message: `直近3件のCTAがすべて「${a.ctaLabel}」です。別のパターンにローテーションしてください。`,
      });
    }
  }

  // 2) 固定フレーズの使い回し検出（画像プロンプト内）
  const phraseHits = recent.filter((item) => {
    const flat = flattenImagePrompts(item.sections?.__imagePrompts);
    return OVERUSED_PHRASES.some((p) => flat.includes(p));
  });
  if (phraseHits.length >= 2) {
    warnings.push({
      type: 'phrase_reuse',
      message: `画像プロンプトで「どうなってるの!?マジで意味不明すぎる」系の固定フレーズが直近${lookback}件中${phraseHits.length}件で使われています。投稿ごとに違うキャッチコピーにしてください。`,
    });
  }

  // 3) テーマと無関係な汎用テンプレ動物の検出
  const animalHits = recent.filter((item) => {
    const flat = flattenImagePrompts(item.sections?.__imagePrompts);
    return GENERIC_ANIMAL_KEYWORDS.some((kw) => flat.includes(kw));
  });
  if (animalHits.length > 0) {
    warnings.push({
      type: 'generic_animal',
      message: `画像プロンプトに、恋愛テーマと無関係な汎用テンプレ（サメ・象・猫など）が直近${lookback}件中${animalHits.length}件で見つかりました。人物中心の恋愛シーンに差し替えてください。`,
    });
  }

  // 4) タイトルの重複検出
  const seenTitles = new Map();
  const duplicateTitles = [];
  recent.forEach((item) => {
    const title = normalize(item.sections?.tiktok_title);
    if (!title) return;
    if (seenTitles.has(title)) {
      duplicateTitles.push(item.sections.tiktok_title);
    } else {
      seenTitles.set(title, true);
    }
  });
  if (duplicateTitles.length > 0) {
    warnings.push({
      type: 'duplicate_title',
      message: `直近${lookback}件の中に、ほぼ同じTikTokタイトルが複数あります（例：「${duplicateTitles[0]}」）。`,
    });
  }

  return { ctaTimeline, warnings };
}

/**
 * GEMに貼り付けて伝えるための、直近状況の要約テキストを生成する。
 */
export function buildGemReminderText(report) {
  if (!report || report.ctaTimeline.length === 0) {
    return '直近の投稿履歴がまだありません。通常通り生成してください。';
  }

  const lines = [];
  const timelineStr = report.ctaTimeline
    .slice()
    .reverse()
    .map((t) => t.ctaLabel)
    .join('→');
  lines.push(`直近のCTAの流れ：${timelineStr}`);

  if (report.warnings.length === 0) {
    lines.push('特に問題は見つかっていません。上記の流れを踏まえ、別パターンのCTA・新しい構図の画像で生成してください。');
  } else {
    lines.push('【今回とくに直してほしい点】');
    report.warnings.forEach((w) => lines.push('・' + w.message));
  }

  return lines.join('\n');
}
