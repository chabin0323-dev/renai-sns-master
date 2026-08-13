// videoPlan.js
// 「恋愛バズ動画メーカー」用のロジック。
// 外部APIは一切使用せず、既存のTikTok台本（テキスト）だけを解析して
// 動画構成・テロップ・CapCut用編集指示を組み立てる純粋関数群。

// 5つの構成ビート（比率ベース。台本の行数に応じて秒数は動的に伸縮する）
export const BEAT_DEFS = [
  { key: 'hook', label: 'HOOK（つかみ）', ratio: 0.10, camera: 'ゆっくりズームイン' },
  { key: 'empathy', label: '共感', ratio: 0.17, camera: 'ゆっくりパン' },
  { key: 'main', label: '本題', ratio: 0.23, camera: '少し拡大' },
  { key: 'twist', label: '意外性・気づき', ratio: 0.27, camera: 'ゆっくりズームアウト' },
  { key: 'cta', label: 'CTA', ratio: 0.23, camera: '中央固定（軽いズーム）' },
];

/**
 * TikTok台本を「1行=1テロップ」として分割する。
 * GEM側の書式（1行20文字以内・行間に空行）にそのまま対応できるよう、
 * 空行を区切りとして扱い、空文字の行は除去する。
 * @param {string} script
 * @returns {string[]}
 */
export function splitScriptToLines(script) {
  if (!script) return [];
  return script
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

/**
 * 台本の行数から動画の想定尺（秒）を見積もる。
 * 1行あたり約3秒（読み上げ+間）を目安にし、20〜60秒の範囲に収める。
 * 台本が短ければ30秒より短く、長ければ30秒より長い尺を提案する。
 * @param {number} lineCount
 * @returns {number}
 */
export function estimateDurationSeconds(lineCount) {
  if (lineCount <= 0) return 30;
  const estimated = Math.round(lineCount * 3);
  return Math.max(20, Math.min(60, estimated));
}

/**
 * 台本の行を5つのビート（HOOK/共感/本題/意外性/CTA）に配分し、
 * 各ビートの秒数レンジ・担当テロップ行・カメラワークを組み立てる。
 * 行数が少ない場合でも各ビートに最低0行以上が割り当てられるよう調整する。
 * @param {string[]} lines
 * @returns {{ totalSeconds: number, beats: Array }}
 */
export function buildVideoTimeline(lines) {
  const totalSeconds = estimateDurationSeconds(lines.length);

  // 各ビートの行数を比率から算出（合計が行数と一致するよう最後のビートで調整）
  const lineCounts = BEAT_DEFS.map((b) => Math.round(lines.length * b.ratio));
  const diff = lines.length - lineCounts.reduce((a, c) => a + c, 0);
  if (lineCounts.length > 0) {
    lineCounts[lineCounts.length - 1] += diff;
  }

  let lineCursor = 0;
  let secondCursor = 0;
  const beats = BEAT_DEFS.map((def, idx) => {
    const count = Math.max(0, lineCounts[idx] || 0);
    const beatLines = lines.slice(lineCursor, lineCursor + count);
    lineCursor += count;

    const beatSeconds = Math.max(1, Math.round(totalSeconds * def.ratio));
    const startSec = secondCursor;
    const endSec = idx === BEAT_DEFS.length - 1 ? totalSeconds : Math.min(totalSeconds, startSec + beatSeconds);
    secondCursor = endSec;

    return {
      key: def.key,
      label: def.label,
      camera: def.camera,
      startSec,
      endSec,
      lines: beatLines,
    };
  });

  return { totalSeconds, beats };
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatBeatRange(beat) {
  return `${formatTime(beat.startSec)}〜${formatTime(beat.endSec)}`;
}

/**
 * CapCutにそのまま貼り付けられる編集指示テキストを生成する。
 * すべてローカルのテンプレート処理で、外部APIは使用しない。
 * @param {{ theme: string, title: string, timeline: { totalSeconds: number, beats: Array }, hasImagePrompt: boolean, cta: string }} params
 * @returns {string}
 */
export function buildCapCutInstructions({ theme, title, timeline, hasImagePrompt, cta }) {
  const lines = [];
  lines.push('【CapCut編集指示】');
  lines.push('');
  lines.push(`・動画尺：${timeline.totalSeconds}秒想定`);
  lines.push('・BGM：小さめ（感情系・恋愛心理向け）');
  lines.push('・冒頭：強いフック＋ズームイン、軽いインパクト音');
  lines.push('・中盤：共感→本題（テンポを変えずゆったり）');
  lines.push('・CTA前：少し盛り上げる（BGMを一段上げる）');
  lines.push('・終盤：CTA強調、テロップを大きめに');
  lines.push('');
  lines.push('画像：');
  lines.push('- 9:16縦動画');
  lines.push(hasImagePrompt ? '- 文字なし画像プロンプトを使用（① TikTok動画素材）' : '- 文字なし画像プロンプトが未検出（SNS投稿マスター側で生成してください）');
  lines.push('');
  lines.push('構成タイムライン：');
  for (const beat of timeline.beats) {
    lines.push(`${formatBeatRange(beat)}｜${beat.label}｜カメラ：${beat.camera}`);
    beat.lines.forEach((l) => lines.push(`  ・${l}`));
  }
  if (cta && cta.trim()) {
    lines.push('');
    lines.push('CTA文言：');
    lines.push(cta.trim());
  }
  if (title) {
    lines.push('');
    lines.push(`参考タイトル：${title}`);
  }
  if (theme) {
    lines.push(`参考テーマ：${theme}`);
  }
  return lines.join('\n');
}
