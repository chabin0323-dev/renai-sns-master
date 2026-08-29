// WordPress専用：本文中の既存の見出しらしい行だけをH2/H3のHTMLに変換する。
// 新しい文章は生成しない。
// 判定できない行は一切変更しない。
// sectionsのstate自体は変更しない。

const H2_SUFFIX_PATTERNS = [
  /とは$/,
  /^まとめ$/,
  /^最後に$/,
  /総括/,
];

const H3_SUFFIX_PATTERNS = [
  /理由$/,
  /原因$/,
  /方法$/,
  /ポイント$/,
  /特徴$/,
  /すべきこと$/,
  /してはいけない/,
  /注意点$/,
  /対処法$/,
];

function classifyHeadingLevel(trimmedLine) {
  // 既にHTML見出しなら二重変換しない
  if (/^<h[23]>.*<\/h[23]>$/i.test(trimmedLine)) {
    return null;
  }

  if (trimmedLine.length < 2 || trimmedLine.length > 20) {
    return null;
  }

  // 通常の文章は見出しにしない
  if (/[。、！？]$/.test(trimmedLine)) {
    return null;
  }

  if (H2_SUFFIX_PATTERNS.some((p) => p.test(trimmedLine))) {
    return 'h2';
  }

  if (H3_SUFFIX_PATTERNS.some((p) => p.test(trimmedLine))) {
    return 'h3';
  }

  return null;
}

function isPrecedingLineComplete(lines, index) {
  if (index === 0) return true;

  const prev = lines[index - 1].trim();

  // 空行の直後は見出し候補
  if (prev === '') return true;

  // 前の文章が完結している場合も見出し候補
  return /[。！？]$/.test(prev);
}

// WordPress本文専用の変換。
// sectionsやnote側は一切変更しない。
export function toWordPressHeadings(bodyText) {
  if (!bodyText) return bodyText;

  const lines = bodyText.split('\n');

  // 最初の有効行を記事タイトルとしてH2化する。
  // ただし、既にHTML見出しなら変更しない。
  let firstContentIndex = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() !== '') {
      firstContentIndex = i;
      break;
    }
  }

  const out = lines.map((line, i) => {
    const trimmed = line.trim();

    if (!trimmed) return line;

    // 既存のHTML見出しはそのまま
    if (/^<h[23]>.*<\/h[23]>$/i.test(trimmed)) {
      return line;
    }

    // 最初の有効行＝記事タイトルをH2化
    if (i === firstContentIndex) {
      if (
        trimmed.length >= 2 &&
        trimmed.length <= 40 &&
        !/[。、！？]$/.test(trimmed)
      ) {
        return `<h2>${trimmed}</h2>`;
      }

      // 記事タイトルとして明確に判定できない場合は変更しない
      return line;
    }

    if (!isPrecedingLineComplete(lines, i)) {
      return line;
    }

    const level = classifyHeadingLevel(trimmed);

    if (level === 'h2') {
      return `<h2>${trimmed}</h2>`;
    }

    if (level === 'h3') {
      return `<h3>${trimmed}</h3>`;
    }

    return line;
  });

  return out.join('\n');
}
