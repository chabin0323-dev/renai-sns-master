// parser.js
// GEMが生成した投稿テキストを、柔軟に各SNSセクションへ分解するユーティリティ。
// 見出しの書式ゆらぎ（【】■#▼など）や、コロンの有無に対応する。
//
// 対応するGEM出力形式:
// 【選定テーマ】【TikTokタイトル】【TikTok台本】【TikTokハッシュタグ】
// 【Instagram】【Instagramハッシュタグ】【X】【Xハッシュタグ】
// 【Threads】【Threadsハッシュタグ】【noteタイトル】【note本文】【noteハッシュタグ】
// 【WordPress SEOタイトル】【WordPress記事タイトル】【WordPressメタディスクリプション】
// 【WordPressキーワード】【WordPress本文】【WordPress CTA】
// 【画像生成プロンプト】① 〜 ⑤

const DECOR_CHARS = /[■□▼▲◆●○★☆\*#`~\-—・:：\[\]【】「」『』\s]/g;

function stripDecoration(line) {
  return line.replace(DECOR_CHARS, '');
}

// セクション定義：キー、見出しとして認識するエイリアス（装飾を除いた形で比較）。
// 【重要】「Xハッシュタグ」は「X」のプレフィックスを含むため、
// ハッシュタグ系の定義は必ず対応する本文系の定義より前に置くこと（先勝ちマッチのため）。
const SECTION_DEFS = [
  { key: 'theme', aliases: ['選定テーマ', '選定した最新トレンドテーマ', 'テーマ'] },

  { key: 'tiktok_hashtags', aliases: ['TikTokハッシュタグ'] },
  { key: 'tiktok_title', aliases: ['TikTokタイトル'] },
  { key: 'tiktok_script', aliases: ['TikTok台本'] },

  { key: 'instagram_hashtags', aliases: ['Instagramハッシュタグ'] },
  { key: 'instagram', aliases: ['Instagram', 'インスタグラム', 'インスタ'] },

  { key: 'x_hashtags', aliases: ['Xハッシュタグ'] },
  { key: 'x', aliases: ['X(Twitter)', 'X（Twitter）', 'XTwitter', 'X', 'Twitter'] },

  { key: 'threads_hashtags', aliases: ['Threadsハッシュタグ'] },
  { key: 'threads', aliases: ['Threads', 'スレッズ'] },

  { key: 'note_hashtags', aliases: ['noteハッシュタグ'] },
  { key: 'note_title', aliases: ['noteタイトル', 'note用タイトル'] },
  { key: 'note_body', aliases: ['note本文', 'note記事本文'] },

  { key: 'wordpress_seo_title', aliases: ['WordPress SEOタイトル', 'WordPressSEOタイトル'] },
  { key: 'wordpress_article_title', aliases: ['WordPress記事タイトル'] },
  { key: 'wordpress_meta_description', aliases: ['WordPressメタディスクリプション'] },
  { key: 'wordpress_keywords', aliases: ['WordPressキーワード'] },
  { key: 'wordpress_cta', aliases: ['WordPress CTA', 'WordPressCTA'] },
  { key: 'wordpress_body', aliases: ['WordPress本文', 'WordPress'] },

  { key: 'image', aliases: ['画像生成用プロンプト', '画像生成プロンプト', '画像プロンプト'] },
];

// 画像プロンプトのサブ見出し（「① TikTok動画素材・文字なし・9:16」等）や
// 旧形式の「TikTok用（縦型 9:16）」「1. 文字なし」等は、
// 主要セクション見出しとして誤検出しないよう除外する
const IMAGE_SUBHEADING_EXCLUDE = /文字なし|文字あり|文字入り|縦型|横型|アイキャッチ|動画素材|サムネイル|記事画像|^[①②③④⑤]|^[1-5][\.\)]|ar\s*9:16|ar\s*16:9|9:16|16:9/;

function splitHeadingAndValue(rawLine) {
  const idx = Math.max(rawLine.indexOf('：'), rawLine.indexOf(':'));
  if (idx === -1) return { headingPart: rawLine, valuePart: '' };
  return {
    headingPart: rawLine.slice(0, idx),
    valuePart: rawLine.slice(idx + 1).trim(),
  };
}

function matchSectionHeading(rawLine) {
  const trimmed = rawLine.trim();
  if (!trimmed) return null;

  // ハッシュタグを含む行（本文の一部）は見出しとして扱わない。
  if (/#[^\s#　]+/.test(trimmed)) return null;

  if (IMAGE_SUBHEADING_EXCLUDE.test(trimmed)) return null;

  const { headingPart } = splitHeadingAndValue(trimmed);
  const stripped = stripDecoration(headingPart);
  if (!stripped) return null;

  if (stripped.length > 24) return null;

  for (const def of SECTION_DEFS) {
    for (const alias of def.aliases) {
      const strippedAlias = stripDecoration(alias);
      if (!strippedAlias) continue;
      if (strippedAlias.length <= 2) {
        if (stripped === strippedAlias || (stripped.startsWith(strippedAlias) && stripped.length <= strippedAlias.length + 6)) {
          return def.key;
        }
      } else if (stripped === strippedAlias || stripped.includes(strippedAlias)) {
        return def.key;
      }
    }
  }
  return null;
}

function extractInlineValue(rawLine) {
  return splitHeadingAndValue(rawLine).valuePart;
}

const EMPTY_SECTIONS_TEMPLATE = {
  theme: '',
  tiktok_title: '',
  tiktok_script: '',
  tiktok_hashtags: '',
  instagram: '',
  instagram_hashtags: '',
  x: '',
  x_hashtags: '',
  threads: '',
  threads_hashtags: '',
  note_title: '',
  note_body: '',
  note_hashtags: '',
  wordpress_seo_title: '',
  wordpress_article_title: '',
  wordpress_meta_description: '',
  wordpress_keywords: '',
  wordpress_body: '',
  wordpress_cta: '',
  image: '',
};

// ハッシュタグを保持する項目のキー一覧
const HASHTAG_FIELD_KEYS = [
  'tiktok_hashtags',
  'instagram_hashtags',
  'x_hashtags',
  'threads_hashtags',
  'note_hashtags',
];

const MAX_HASHTAGS = 5;

/**
 * ハッシュタグの文字列から「#タグ」だけを重複なく最大5個まで抽出し、
 * 1行・半角スペース区切りの文字列に整形する。
 */
export function normalizeHashtags(text) {
  if (!text) return '';
  const matches = text.match(/#[^\s#　]+/g);
  if (!matches) return '';

  const seen = new Set();
  const unique = [];
  for (const tag of matches) {
    if (!seen.has(tag)) {
      seen.add(tag);
      unique.push(tag);
    }
  }
  return unique.slice(0, MAX_HASHTAGS).join(' ');
}

/**
 * TikTok台本の可読性向上のための整形。
 * 既存の改行（段落区切り）は維持しつつ、実質10行を超えたら
 * 句点「。」の直後などきりの良い位置で空行（段落区切り）を追加する。
 * ※ tiktok_script以外には一切使用しない。
 */
function formatScriptForReadability(text) {
  if (!text || !text.trim()) return text;

  const lines = text.split('\n');
  const outputLines = [];
  let nonEmptyCount = 0;

  for (const line of lines) {
    outputLines.push(line);
    if (line.trim() !== '') {
      nonEmptyCount++;
      // 10行たまったら、次が空行でなければ区切りを追加
      if (nonEmptyCount % 10 === 0) {
        outputLines.push('');
      }
    }
  }

  // 連続する空行を1つにまとめる
  return outputLines.join('\n').replace(/\n{3,}/g, '\n\n');
}

export function parseSections(raw) {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const result = { ...EMPTY_SECTIONS_TEMPLATE };

  let currentKey = null;
  let buffer = [];

  const flush = () => {
    if (currentKey && buffer.length) {
      const text = buffer.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
      if (text) {
        result[currentKey] = result[currentKey]
          ? `${result[currentKey]}\n${text}`
          : text;
      }
    }
    buffer = [];
  };

  for (const rawLine of lines) {
    const headingKey = matchSectionHeading(rawLine);
    if (headingKey) {
      flush();
      currentKey = headingKey;
      const inline = extractInlineValue(rawLine);
      if (inline) buffer.push(inline);
      continue;
    }
    if (currentKey) {
      buffer.push(rawLine);
    }
  }
  flush();

  result.theme = result.theme.replace(/^[「『]/, '').replace(/[」』]$/, '').trim();

  for (const key of HASHTAG_FIELD_KEYS) {
    result[key] = normalizeHashtags(result[key]);
  }

  result.tiktok_script = formatScriptForReadability(result.tiktok_script);

  return result;
}

// 画像生成プロンプトの表示項目定義（役割・サイズ・使用する種別つき）。
// activeVariant: この項目で実際に使用・表示・コピー対象とする種別（'withText' または 'noText'）。
// もう一方の種別はUI上に一切表示しない。
// 【重要】③note記事画像は本一覧から意図的に除外している（項目自体を非表示にするため）。
// パース処理自体（①→⑤の境界検出）には影響しない。境界検出は本配列とは独立した
// 内部ロジック（orderKeyMap）で行っているため、③を除外してもGEM出力の④⑤の
// 位置特定は壊れない。
export const IMAGE_SUB_DEFS = [
  {
    key: 'tiktok_video',
    order: 1,
    label: '① TikTok動画素材・9:16（1080×1920px）',
    role: 'CapCutで動画素材として使用',
    copyLabel: 'TikTok動画素材プロンプトをコピー',
    activeVariant: 'noText',
    variantLabel: '文字なし版',
  },
  {
    key: 'tiktok_thumbnail',
    order: 2,
    label: '② TikTokサムネイル・9:16（1080×1920px）',
    role: 'TikTokのサムネイルとして使用',
    copyLabel: 'TikTokサムネイルプロンプトをコピー',
    activeVariant: 'withText',
    variantLabel: '文字入り版',
  },
  {
    key: 'note_thumbnail',
    order: 4,
    label: '③ noteサムネイル・16:9（1280×720px）',
    role: 'noteのサムネイルとして使用',
    copyLabel: 'noteサムネイルプロンプトをコピー',
    activeVariant: 'withText',
    variantLabel: '文字入り版',
  },
  {
    key: 'wordpress_eyecatch',
    order: 5,
    label: '④ WordPressアイキャッチ・16:9（1280×720px）',
    role: 'WordPress記事のアイキャッチ画像として使用（GEMが④のみ出力する場合は④と同じ内容）',
    copyLabel: 'WordPressアイキャッチプロンプトをコピー',
    activeVariant: 'withText',
    variantLabel: '文字入り版',
  },
];

const CIRCLED_NUM_MAP = { '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5 };

const WITH_TEXT_SUBHEADING = /文字(入り|あり)/;
const NO_TEXT_SUBHEADING = /文字なし/;
const VARIANT_SUBHEADING_MAX_LEN = 24;

/**
 * ①〜⑤の各ブロック本文を、【文字入り版】【文字なし版】の2種類に分割する。
 */
function splitPromptVariants(text, defaultVariant) {
  if (!text || !text.trim()) return { withText: '', noText: '' };

  const lines = text.split('\n');
  const marks = [];
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.length > VARIANT_SUBHEADING_MAX_LEN) return;
    if (NO_TEXT_SUBHEADING.test(trimmed)) {
      marks.push({ idx, variant: 'noText' });
    } else if (WITH_TEXT_SUBHEADING.test(trimmed)) {
      marks.push({ idx, variant: 'withText' });
    }
  });

  if (marks.length === 0) {
    return defaultVariant === 'withText'
      ? { withText: text.trim(), noText: '' }
      : { noText: text.trim(), withText: '' };
  }

  const result = { withText: '', noText: '' };
  for (let i = 0; i < marks.length; i++) {
    const start = marks[i].idx + 1;
    const end = i + 1 < marks.length ? marks[i + 1].idx : lines.length;
    const chunk = lines
      .slice(start, end)
      .map((l) => l.trim())
      .filter((l) => l && l !== '```text' && l !== '```' && !/^```/.test(l))
      .join('\n')
      .trim();
    if (chunk) {
      const v = marks[i].variant;
      result[v] = result[v] ? `${result[v]}\n${chunk}` : chunk;
    }
  }
  return result;
}

/**
 * 画像生成プロンプトのセクションを5つのサブセクション（①〜⑤）に分解する。
 * ①②③④⑤ または 1./2./3./4./5. の番号を「絶対的な位置」として扱い、
 * その番号順に5つの枠へ割り当てる（見出しの文言が多少変わっても壊れないようにするため）。
 */
export function parseImagePrompts(imageRaw) {
  const rawSubResult = {
    tiktok_video: '',
    tiktok_thumbnail: '',
    note_image: '',
    note_thumbnail: '',
    wordpress_eyecatch: '',
  };

  const finalize = () => {
    const result = {};
    for (const def of IMAGE_SUB_DEFS) {
      result[def.key] = splitPromptVariants(rawSubResult[def.key], def.activeVariant);
    }
    return result;
  };

  if (!imageRaw || !imageRaw.trim()) return finalize();

  const lines = imageRaw.replace(/\r\n/g, '\n').split('\n');

  const rawBoundaries = [];
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const circled = trimmed.match(/^([①②③④⑤])/);
    if (circled) {
      rawBoundaries.push({ idx, num: CIRCLED_NUM_MAP[circled[1]] });
      return;
    }
    const numbered = trimmed.match(/^([1-5])[\.\)、]/);
    if (numbered) {
      rawBoundaries.push({ idx, num: Number(numbered[1]) });
    }
  });

  // 【重要】⑤等のプロンプト本文が長く詳細になるほど、本文中に
  // 「1. 記事タイトルを表示する」のような番号付きの指示が含まれる可能性が高くなる。
  // これを新しい区切りと誤認識すると、本文の一部が欠落してしまう。
  // そのため、①→②→③→④→⑤の「厳密な昇順」に一致する行だけを本物の区切りとして採用し、
  // それ以外（本文中に偶然現れた番号）は区切りとして扱わず、そのまま本文の一部として保持する。
  const boundaries = [];
  let expectedNum = 1;
  for (const b of rawBoundaries) {
    if (b.num === expectedNum) {
      boundaries.push(b);
      expectedNum++;
      if (expectedNum > 5) break;
    }
  }

  const orderKeyMap = {
    1: 'tiktok_video',
    2: 'tiktok_thumbnail',
    3: 'note_image',
    4: 'note_thumbnail',
    5: 'wordpress_eyecatch',
  };

  if (boundaries.length > 0) {
    for (let i = 0; i < boundaries.length; i++) {
      const start = boundaries[i].idx;
      const end = i + 1 < boundaries.length ? boundaries[i + 1].idx : lines.length;
      const num = boundaries[i].num;
      const key = orderKeyMap[num];
      if (!key) continue;

      const segmentLines = lines.slice(start, end);
      let bodyLines = segmentLines.slice(1);

      if (bodyLines.every((l) => !l.trim())) {
        const labelLine = segmentLines[0];
        const afterRatio = labelLine.match(/(?:9:16|16:9)\s*[、,。\s]*(.+)$/);
        if (afterRatio && afterRatio[1] && afterRatio[1].trim()) {
          bodyLines = [afterRatio[1]];
        }
      }

      const cleaned = bodyLines
        .map((l) => l.trim())
        .filter((l) => l !== '```text' && l !== '```' && !/^```/.test(l))
        .join('\n')
        .trim();

      if (cleaned) {
        rawSubResult[key] = rawSubResult[key] ? `${rawSubResult[key]}\n${cleaned}` : cleaned;
      }
    }

    // 【重要】GEM側のカスタム指示が「④はnote・WordPress共用サムネイル」という
    // 4項目構成（①②③④のみ、⑤は存在しない）に変更された場合への対応。
    // GEMが⑤（WordPressアイキャッチ）を独立して出力しなかった場合、
    // ④（note_thumbnail）の内容をそのままWordPressアイキャッチとしても使う。
    // これにより、GEMの設計（④を共用）とアプリの表示（note用カード／WordPress用カードを
    // 別々に維持）の両方を、既存の見た目を変えずに両立できる。
    if (!rawSubResult.wordpress_eyecatch.trim() && rawSubResult.note_thumbnail.trim()) {
      rawSubResult.wordpress_eyecatch = rawSubResult.note_thumbnail;
    }

    return finalize();
  }

  const fenceRegex = /```[a-zA-Z]*\n([\s\S]*?)```/g;
  const order = ['tiktok_video', 'tiktok_thumbnail', 'note_image', 'note_thumbnail', 'wordpress_eyecatch'];
  let match;
  let i = 0;
  while ((match = fenceRegex.exec(imageRaw)) !== null && i < order.length) {
    rawSubResult[order[i]] = match[1].trim();
    i++;
  }
  if (!rawSubResult.wordpress_eyecatch.trim() && rawSubResult.note_thumbnail.trim()) {
    rawSubResult.wordpress_eyecatch = rawSubResult.note_thumbnail;
  }
  return finalize();
}

export const SECTION_ORDER = [
  { key: 'theme', label: '選定テーマ' },
  { key: 'tiktok_title', label: 'TikTokタイトル' },
  { key: 'tiktok_script', label: 'TikTok台本' },
  { key: 'tiktok_hashtags', label: 'TikTokハッシュタグ' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'instagram_hashtags', label: 'Instagramハッシュタグ' },
  { key: 'x', label: 'X' },
  { key: 'x_hashtags', label: 'Xハッシュタグ' },
  { key: 'threads', label: 'Threads' },
  { key: 'threads_hashtags', label: 'Threadsハッシュタグ' },
  { key: 'note_title', label: 'noteタイトル' },
  { key: 'note_body', label: 'note本文' },
  { key: 'note_hashtags', label: 'noteハッシュタグ' },
  { key: 'wordpress_seo_title', label: 'WordPress SEOタイトル' },
  { key: 'wordpress_article_title', label: 'WordPress記事タイトル' },
  { key: 'wordpress_meta_description', label: 'WordPressメタディスクリプション' },
  { key: 'wordpress_keywords', label: 'WordPressキーワード' },
  { key: 'wordpress_body', label: 'WordPress本文' },
  { key: 'wordpress_cta', label: 'WordPress CTA' },
];

export { EMPTY_SECTIONS_TEMPLATE };
