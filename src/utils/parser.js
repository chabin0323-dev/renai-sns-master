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

/**
 * 【重要・修正済み】見出し判定は必ず「行の先頭が完全一致する場合」のみとする。
 * 以前は stripped.includes(strippedAlias) を使っていたため、
 * 「彼のInstagramを見て」のような本文中の単語（Instagram等）まで
 * 誤って見出しとして検出し、そこでセクションが分断される重大な不具合があった。
 * startsWith + 長さの上限チェックにすることで、本文中の単語は絶対に
 * 見出しとして誤検出されない。
 */
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
      } else if (stripped === strippedAlias || (stripped.startsWith(strippedAlias) && stripped.length <= strippedAlias.length + 10)) {
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
 * TikTok台本の音声読み上げ（CapCut等）対策：
 * 英単語をそのまま残すと「Instagram」を「インスタグラム」ではなく
 * ローマ字読みしてしまうなど、読み上げが不自然になるケースがある。
 * よく登場する英単語を、あらかじめ自然な発音のカタカナへ変換する。
 * ※ tiktok_script以外には一切使用しない。
 * ※ 単語の追加は、このリストに1行足すだけでよい。
 */
const ENGLISH_TO_KATAKANA_MAP = [
  { pattern: /instagram/gi, katakana: 'インスタグラム' },
  { pattern: /tiktok/gi, katakana: 'ティックトック' },
  { pattern: /threads/gi, katakana: 'スレッズ' },
  { pattern: /wordpress/gi, katakana: 'ワードプレス' },
  { pattern: /twitter/gi, katakana: 'ツイッター' },
  { pattern: /youtube/gi, katakana: 'ユーチューブ' },
  { pattern: /facebook/gi, katakana: 'フェイスブック' },
  { pattern: /\bline\b/gi, katakana: 'ライン' },
  { pattern: /\bdm\b/gi, katakana:
