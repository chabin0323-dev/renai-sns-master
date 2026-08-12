// parser.js
// GEMが生成した投稿テキストを、柔軟に各SNSセクションへ分解するユーティリティ。
// 見出しの書式ゆらぎ（【】■#▼など）や、コロンの有無に対応する。

const DECOR_CHARS = /[■□▼▲◆●○★☆\*#`~\-—・:：\[\]【】「」『』\s]/g;

function stripDecoration(line) {
  return line.replace(DECOR_CHARS, '');
}

// セクション定義：キー、見出しとして認識するエイリアス（装飾を除いた形で比較）
const SECTION_DEFS = [
  { key: 'theme', aliases: ['選定した最新トレンドテーマ', '選定テーマ', 'テーマ'] },
  { key: 'tiktok', aliases: ['TikTok用台本', 'TikTok台本', 'TikTok用タイトル', 'TikTokタイトル', 'TikTok'] },
  { key: 'instagram', aliases: ['Instagram', 'インスタグラム', 'インスタ'] },
  { key: 'x', aliases: ['X(Twitter)', 'X（Twitter）', 'XTwitter', 'X', 'Twitter'] },
  { key: 'threads', aliases: ['Threads', 'スレッズ'] },
  { key: 'note', aliases: ['note用タイトル', 'note記事本文', 'note'] },
  { key: 'wordpress', aliases: ['WordPress', 'Wordpress', 'ワードプレス'] },
  { key: 'image', aliases: ['画像生成用プロンプト', '画像生成プロンプト', '画像プロンプト'] },
];

// 画像プロンプトのサブセクション定義
const IMAGE_SUB_DEFS = [
  { key: 'tiktok_no_text', numAliases: ['①', '1', '1.'], mustInclude: ['TikTok'], mustInclude2: ['文字なし'] },
  { key: 'tiktok_text', numAliases: ['②', '2', '2.'], mustInclude: ['TikTok'], mustInclude2: ['文字あり'] },
  { key: 'note_no_text', numAliases: ['③', '3', '3.'], mustInclude: ['note'], mustInclude2: ['文字なし'] },
  { key: 'note_text', numAliases: ['④', '4', '4.'], mustInclude: ['note'], mustInclude2: ['文字あり'] },
  { key: 'wordpress_eyecatch', numAliases: ['⑤', '5', '5.'], mustInclude: ['WordPress', 'アイキャッチ'], mustInclude2: [] },
];

// 画像プロンプトのサブ見出し（「TikTok用（縦型 9:16）」「1. 文字なし」等）は
// 主要セクション見出しとして誤検出しないよう除外する
const IMAGE_SUBHEADING_EXCLUDE = /文字なし|文字あり|縦型|横型|アイキャッチ|^[①②③④⑤]|^[1-5][\.\)]|ar\s*9:16|ar\s*16:9/;

function splitHeadingAndValue(rawLine) {
  // 「【選定した最新トレンドテーマ】：値」のように、コロンより前を見出し候補、
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
  // 「#インスタ映え」「#Threads」「#X投稿」のようにセクション名を含む
  // ハッシュタグが本文中に現れても誤検出しないようにするための重要なガード。
  if (/#[^\s#　]+/.test(trimmed)) return null;

  if (IMAGE_SUBHEADING_EXCLUDE.test(trimmed)) return null;

  const { headingPart } = splitHeadingAndValue(trimmed);
  const stripped = stripDecoration(headingPart);
  if (!stripped) return null;

  // 見出し候補（コロンより前の部分）が長すぎる場合は本文とみなす
  if (stripped.length > 20) return null;

  for (const def of SECTION_DEFS) {
    for (const alias of def.aliases) {
      const strippedAlias = stripDecoration(alias);
      if (!strippedAlias) continue;
      // 見出しは「アイテム名で始まる」ことを要求する（本文中の偶然の一致を防ぐ）。
      // 1〜2文字の短いエイリアス（例: 'X'）は、行全体がほぼそのエイリアスだけの
      // 場合に限定し、誤爆をさらに防ぐ。
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

/**
 * GEM出力全体を主要セクションに分割する
 * @param {string} raw
 * @returns {Record<string, string>} セクションキー -> 本文（trim済み、複数行）
 */
export function parseSections(raw) {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const result = {
    theme: '',
    tiktok: '',
    instagram: '',
    x: '',
    threads: '',
    note: '',
    wordpress: '',
    image: '',
  };

  let currentKey = null;
  let buffer = [];

  const flush = () => {
    if (currentKey && buffer.length) {
      const text = buffer.join('\n').trim();
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

  // テーマ行に見出し以外の余計な装飾が残っていたら簡易クリーンアップ
  result.theme = result.theme.replace(/^[「『]/, '').replace(/[」』]$/, '').trim();

  return result;
}

/**
 * 画像生成プロンプトのセクションを5つのサブセクションに分解する。
 * ```text ... ``` のコードフェンスを優先的に抽出し、直前の見出し行から種類を推定する。
 * @param {string} imageRaw
 * @returns {Record<string, string>}
 */
export function parseImagePrompts(imageRaw) {
  const subResult = {
    tiktok_no_text: '',
    tiktok_text: '',
    note_no_text: '',
    note_text: '',
    wordpress_eyecatch: '',
  };
  if (!imageRaw) return subResult;

  // コードフェンス（```text ... ``` や ``` ... ```）を抽出。直前50文字をラベル判定に使う。
  const fenceRegex = /```[a-zA-Z]*\n([\s\S]*?)```/g;
  const blocks = [];
  let match;
  let lastIndex = 0;
  while ((match = fenceRegex.exec(imageRaw)) !== null) {
    const before = imageRaw.slice(Math.max(0, match.index - 120), match.index);
    blocks.push({ label: before, content: match[1].trim() });
    lastIndex = fenceRegex.lastIndex;
  }

  // コードフェンスが見つからない場合、見出し区切りでフォールバック
  if (blocks.length === 0) {
    const segments = imageRaw.split(/\n(?=[①②③④⑤]|[1-5][\.\)])/);
    for (const seg of segments) {
      blocks.push({ label: seg.slice(0, 60), content: seg.trim() });
    }
  }

  const used = new Set();
  for (const block of blocks) {
    const label = block.label;
    let matched = null;
    for (const def of IMAGE_SUB_DEFS) {
      if (used.has(def.key)) continue;
      const hasNum = def.numAliases.some((n) => label.includes(n));
      const hasMain = def.mustInclude.some((k) => label.includes(k));
      const hasSub = def.mustInclude2.length === 0 || def.mustInclude2.some((k) => label.includes(k));
      if ((hasNum || hasMain) && hasMain && hasSub) {
        matched = def.key;
        break;
      }
    }
    if (matched) {
      subResult[matched] = block.content;
      used.add(matched);
    }
  }

  // それでも埋まらないサブセクションは、出現順に未使用の枠へ順番に割り当てる（フォールバック）
  const order = ['tiktok_no_text', 'tiktok_text', 'note_no_text', 'note_text', 'wordpress_eyecatch'];
  const unassignedBlocks = blocks.filter((b) => !order.some((k) => subResult[k] === b.content));
  let idx = 0;
  for (const key of order) {
    if (!subResult[key] && unassignedBlocks[idx]) {
      subResult[key] = unassignedBlocks[idx].content;
      idx++;
    }
  }

  return subResult;
}

const HASHTAG_LINE_REGEX = /(^|\s)#[^\s#]+/;

/**
 * セクション本文からハッシュタグ行だけを抽出して結合する
 * @param {string} sectionText
 * @returns {string}
 */
export function extractHashtags(sectionText) {
  if (!sectionText) return '';
  const lines = sectionText.split('\n');
  const tagLines = lines.filter((l) => HASHTAG_LINE_REGEX.test(l));
  if (tagLines.length === 0) return '';
  // 各行からハッシュタグだけを取り出して1行にまとめる
  const tags = [];
  for (const line of tagLines) {
    const found = line.match(/#[^\s#　]+/g);
    if (found) tags.push(...found);
  }
  return tags.join(' ');
}

/**
 * CTA文言などを除いた「投稿本文だけ」を返す（コピー用）。
 * 現状はセクション全文をそのまま返すが、将来的な拡張ポイントとして分離。
 */
export function getCopyableBody(sectionText) {
  return sectionText.trim();
}

export const SECTION_ORDER = [
  { key: 'theme', label: '選定テーマ' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'x', label: 'X' },
  { key: 'threads', label: 'Threads' },
  { key: 'note', label: 'note' },
  { key: 'wordpress', label: 'WordPress' },
  { key: 'image', label: '画像生成プロンプト' },
];

export const HASHTAG_SECTIONS = ['tiktok', 'instagram', 'x', 'threads', 'note'];
