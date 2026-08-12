// parser.js
// GEMが生成した投稿テキストを、柔軟に各SNSセクションへ分解するユーティリティ。
// 見出しの書式ゆらぎ（【】■#▼など）や、コロンの有無に対応する。
//
// 対応するGEM出力形式（2026年更新版）:
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
const IMAGE_SUBHEADING_EXCLUDE = /文字なし|文字あり|縦型|横型|アイキャッチ|動画素材|サムネイル|記事画像|^[①②③④⑤]|^[1-5][\.\)]|ar\s*9:16|ar\s*16:9|9:16|16:9/;

function splitHeadingAndValue(rawLine) {
  // 「【選定テーマ】：値」のように、コロンより前を見出し候補、
  // 後ろを値として分離する（本文中のコロンで誤爆しないよう、見出し候補側だけを
  // 装飾除去して短い場合のみ見出し扱いにする）
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
  // 「#Threads」「#TikTok」「#Instagram」「#X」のようにセクション名を含む
  // ハッシュタグが本文中に現れても誤検出しないようにするための重要なガード。
  if (/#[^\s#　]+/.test(trimmed)) return null;

  if (IMAGE_SUBHEADING_EXCLUDE.test(trimmed)) return null;

  const { headingPart } = splitHeadingAndValue(trimmed);
  const stripped = stripDecoration(headingPart);
  if (!stripped) return null;

  // 見出し候補（コロンより前の部分）が長すぎる場合は本文とみなす
  if (stripped.length > 24) return null;

  for (const def of SECTION_DEFS) {
    for (const alias of def.aliases) {
      const strippedAlias = stripDecoration(alias);
      if (!strippedAlias) continue;
      if (strippedAlias.length <= 2) {
        // 短いエイリアス（例: 'X'）は、行全体がほぼそのエイリアスだけの場合に限定
        if (stripped === strippedAlias || (stripped.startsWith(strippedAlias) && stripped.length <= strippedAlias.length + 6)) {
          return def.key;
        }
      } else if (stripped === strippedAlias || stripped.includes(strippedAlias)) {
        // 長いエイリアスは、絵文字等の装飾が先頭に付いていても検出できるよう
        // includes判定にする（ハッシュタグ行は既に除外済みなので安全）
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

/**
 * GEM出力全体を主要セクションに分割する。
 * 改行は保持したまま返す（台本の改行をCapCut等にそのまま貼り付けられるようにするため、
 * ここでは行の結合・圧縮は一切行わない）。
 * @param {string} raw
 * @returns {Record<string, string>} セクションキー -> 本文（trim済み、複数行・改行保持）
 */
// ハッシュタグを保持する項目のキー一覧（この5項目だけが対象。
// WordPressキーワード等はハッシュタグではないため対象外）
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
 * 表示・コピーの両方がこの関数の戻り値を参照するため、
 * 6個目以降がコピーされてしまうことはない。
 * @param {string} text
 * @returns {string}
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

export function parseSections(raw) {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const result = { ...EMPTY_SECTIONS_TEMPLATE };

  let currentKey = null;
  let buffer = [];

  const flush = () => {
    if (currentKey && buffer.length) {
      // 前後の空行だけ落とし、内部の改行・空行は保持する
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

  // テーマ行に見出し以外の余計な装飾（「」など）が残っていたら簡易クリーンアップ
  result.theme = result.theme.replace(/^[「『]/, '').replace(/[」』]$/, '').trim();

  // 各SNSのハッシュタグを「重複なし・最大5個」に正規化する。
  // ここで正規化した値がそのままUI表示・コピー処理の両方に使われるため、
  // 6個目以降が紛れ込むことはない。
  for (const key of HASHTAG_FIELD_KEYS) {
    result[key] = normalizeHashtags(result[key]);
  }

  return result;
}

// 画像生成プロンプトの5つのサブセクション定義（役割つき）
export const IMAGE_SUB_DEFS = [
  {
    key: 'tiktok_video',
    order: 1,
    label: '① TikTok動画素材・文字なし・9:16',
    role: 'CapCutで動画素材として使用',
    copyLabel: 'TikTok動画素材プロンプトをコピー',
  },
  {
    key: 'tiktok_thumbnail',
    order: 2,
    label: '② TikTokサムネイル・文字あり・9:16',
    role: 'TikTokのサムネイルとして使用',
    copyLabel: 'TikTokサムネイルプロンプトをコピー',
  },
  {
    key: 'note_image',
    order: 3,
    label: '③ note記事画像・文字なし・16:9',
    role: 'note記事内の挿絵として使用',
    copyLabel: 'note記事画像プロンプトをコピー',
  },
  {
    key: 'note_thumbnail',
    order: 4,
    label: '④ noteサムネイル・文字あり・16:9',
    role: 'noteのサムネイルとして使用',
    copyLabel: 'noteサムネイルプロンプトをコピー',
  },
  {
    key: 'wordpress_eyecatch',
    order: 5,
    label: '⑤ WordPressアイキャッチ・16:9',
    role: 'WordPress記事のアイキャッチ画像として使用',
    copyLabel: 'WordPressアイキャッチプロンプトをコピー',
  },
];

const CIRCLED_NUM_MAP = { '①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5 };

/**
 * 画像生成プロンプトのセクションを5つのサブセクション（①〜⑤）に分解する。
 * ①②③④⑤ または 1./2./3./4./5. の番号を「絶対的な位置」として扱い、
 * その番号順に5つの枠へ割り当てる（見出しの文言が多少変わっても壊れないようにするため）。
 * コードフェンス（```text ... ```）が使われている場合は中身だけを取り出す。
 * @param {string} imageRaw
 * @returns {Record<string, string>} キー: tiktok_video, tiktok_thumbnail, note_image, note_thumbnail, wordpress_eyecatch
 */
export function parseImagePrompts(imageRaw) {
  const subResult = {
    tiktok_video: '',
    tiktok_thumbnail: '',
    note_image: '',
    note_thumbnail: '',
    wordpress_eyecatch: '',
  };
  if (!imageRaw || !imageRaw.trim()) return subResult;

  const lines = imageRaw.replace(/\r\n/g, '\n').split('\n');

  // 各行が「新しいサブセクションの開始」かどうかを判定し、開始位置と番号を記録する
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

  // 【重要】⑤のプロンプト本文が長く詳細になるほど、本文中に
  // 「1. 記事タイトルを表示する」のような番号付きの指示が含まれる可能性が高くなる。
  // これを新しい区切り（②③など）と誤認識すると、本文の一部が欠落してしまう。
  // そのため、①→②→③→④→⑤の「厳密な昇順」に一致する行だけを本物の区切りとして採用し、
  // それ以外（本文中に偶然現れた番号）は区切りとして扱わず、そのまま本文の一部として保持する。
  const boundaries = [];
  let expectedNum = 1;
  for (const b of rawBoundaries) {
    if (b.num === expectedNum) {
      boundaries.push(b);
      expectedNum++;
      if (expectedNum > 5) break; // 5つ揃ったら、以降は本文中の数字と判断してすべて無視
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
      // 先頭行はラベル行（① TikTok動画素材・文字なし・9:16 など）なので、
      // 本文としては使わず丸ごと除外する。実際のプロンプト本文は2行目以降。
      let bodyLines = segmentLines.slice(1);

      // 例外: ラベルと本文が同じ1行に収まっている場合のフォールバック
      // （① 〜16:9 の直後に本文が続くケース）。改行がまったく見つからない時のみ使用。
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
        subResult[key] = subResult[key] ? `${subResult[key]}\n${cleaned}` : cleaned;
      }
    }
    return subResult;
  }

  // フォールバック：番号が全く見つからない場合、コードフェンスの出現順で1〜5に割り当てる
  const fenceRegex = /```[a-zA-Z]*\n([\s\S]*?)```/g;
  const order = ['tiktok_video', 'tiktok_thumbnail', 'note_image', 'note_thumbnail', 'wordpress_eyecatch'];
  let match;
  let i = 0;
  while ((match = fenceRegex.exec(imageRaw)) !== null && i < order.length) {
    subResult[order[i]] = match[1].trim();
    i++;
  }
  return subResult;
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
