// linkFit.js
// X（旧Twitter）・Threadsで「本文＋誘導文＋URL」が文字数制限内に収まるよう、
// 必要な場合だけ本文を自然な区切りで短縮するロジック。外部APIは使用しない。

export const CTA_TEXT = 'あの人との相性は？👇';
export const X_LIMIT = 280;
export const THREADS_LIMIT = 500;

// Xの実際の文字数カウント方式に合わせた近似実装。
// ひらがな・カタカナ・漢字・全角文字などは「幅2」としてカウントされるため、
// 単純な文字数（.length）だけで判定すると実際の上限を超えてしまう。
// 該当するUnicode範囲を「幅2」として扱う。
const WIDE_RANGES = [
  [0x1100, 0x115f],
  [0x2e80, 0x303e],
  [0x3041, 0x33ff],
  [0x3400, 0x4dbf],
  [0x4e00, 0x9fff],
  [0xa000, 0xa4cf],
  [0xac00, 0xd7a3],
  [0xf900, 0xfaff],
  [0xff00, 0xff60],
  [0xffe0, 0xffe6],
];

function isWideCodePoint(cp) {
  return WIDE_RANGES.some(([start, end]) => cp >= start && cp <= end);
}

/**
 * Xの文字数カウント方式に近似した「重み付き文字数」を計算する。
 * @param {string} text
 * @returns {number}
 */
export function calcXLength(text) {
  if (!text) return 0;
  let total = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    total += isWideCodePoint(cp) ? 2 : 1;
  }
  return total;
}

/**
 * Threadsの文字数カウント（Meta系は全角/半角を区別しない単純カウントのため、
 * Unicode文字単位でそのままカウントする）。
 * @param {string} text
 * @returns {number}
 */
export function calcThreadsLength(text) {
  if (!text) return 0;
  return Array.from(text).length;
}

/**
 * 本文を「意味の通る単位」に分割する。
 * まず空行（段落）で分割し、長すぎる段落はさらに句点等の文末記号で分割する。
 * @param {string} body
 * @returns {string[]}
 */
function splitIntoUnits(body) {
  const paragraphs = body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const units = [];
  for (const para of paragraphs) {
    // 段落自体は改行込みで1ユニットとして扱う（TikTok台本のような短文形式とは異なり、
    // X/Threadsの本文は通常の文章のため、段落単位を基本の分割粒度にする）
    units.push(para);
  }
  return units;
}

/**
 * さらに細かく、文末（。！？）で分割する（1段落が長すぎる場合のフォールバック）。
 * @param {string} paragraph
 * @returns {string[]}
 */
function splitBySentence(paragraph) {
  const matches = paragraph.match(/[^。！？\n]*[。！？\n]|[^。！？\n]+$/g);
  return matches ? matches.map((s) => s.trim()).filter(Boolean) : [paragraph];
}

/**
 * 本文＋誘導文＋URLを、文字数制限内に収まるよう組み立てる。
 * 優先順位: ① URL ② 誘導文（CTA_TEXT） ③ 本文
 * 本文は「意味の通る単位」（段落→文）でしか削らず、文の途中では絶対に切らない。
 *
 * @param {{ body: string, url: string, limit: number, lengthFn: (text: string) => number }} params
 * @returns {{ finalText: string, wasTruncated: boolean, length: number, limit: number, overLimitEvenEmpty: boolean }}
 */
export function fitPostWithLink({ body, url, limit, lengthFn }) {
  const trimmedBody = (body || '').trim();
  const trimmedUrl = (url || '').trim();

  if (!trimmedUrl) {
    // リンク未選択の場合はCTA・URLを付けず、本文そのまま返す
    return {
      finalText: trimmedBody,
      wasTruncated: false,
      length: lengthFn(trimmedBody),
      limit,
      overLimitEvenEmpty: false,
    };
  }

  const suffix = `\n\n${CTA_TEXT}\n${trimmedUrl}`;
  const suffixLength = lengthFn(suffix);
  const budget = limit - suffixLength;

  if (budget <= 0) {
    // 誘導文とURLだけで制限を超えてしまう極端なケース（URLが非常に長い等）
    return {
      finalText: `${CTA_TEXT}\n${trimmedUrl}`,
      wasTruncated: true,
      length: lengthFn(`${CTA_TEXT}\n${trimmedUrl}`),
      limit,
      overLimitEvenEmpty: true,
    };
  }

  const fullText = trimmedBody + suffix;
  if (lengthFn(fullText) <= limit) {
    return { finalText: fullText, wasTruncated: false, length: lengthFn(fullText), limit, overLimitEvenEmpty: false };
  }

  // 本文を段落単位→文単位で分割し、budget内に収まる範囲で先頭から採用する
  let units = splitIntoUnits(trimmedBody);
  // 1段落だけで既にbudgetを超える場合に備え、文単位への分割も準備
  units = units.flatMap((u) => (lengthFn(u) > budget ? splitBySentence(u) : [u]));

  const kept = [];
  let usedLength = 0;
  for (const unit of units) {
    const unitLength = lengthFn(unit);
    const separator = kept.length > 0 ? 2 : 0; // 段落間の空行を考慮した概算
    if (usedLength + unitLength + separator > budget) break;
    kept.push(unit);
    usedLength += unitLength + separator;
  }

  const shortenedBody = kept.join('\n\n');
  const finalText = shortenedBody ? shortenedBody + suffix : `${CTA_TEXT}\n${trimmedUrl}`;

  return {
    finalText,
    wasTruncated: true,
    length: lengthFn(finalText),
    limit,
    overLimitEvenEmpty: !shortenedBody,
  };
}
