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
 * 台本の文字量・行数から動画の想定尺（秒）を見積もる。
 *
 * 【修正3】30秒固定にせず、台本の文字量（読み上げ時間）と行数（間の取り方）の
 * 両方から尺を算出する。基本方針は30秒前後を優先し、25〜40秒の範囲に
 * 収まるよう調整する。台本の内容量が明らかにこの範囲と矛盾する場合
 * （極端に短い/長い台本）は、範囲外であることをnoteに明記した上で
 * 25〜40秒の推奨範囲を維持する（CapCut側での尺調整の目安として）。
 *
 * 算出式の考え方（TikTok向けショート動画のテロップ滞在時間をベースにする）：
 * ・テロップ滞在時間 = 行数 × 2.6秒（1行＝1テロップが画面に留まる基本時間。
 *   本アプリのTikTok台本は「1行20文字以内・行間に空行」という短文形式のため、
 *   読み上げ速度そのものより「テロップを読み切るための滞在時間」の方が支配的）
 * ・文字量による補正 = 総文字数 ÷ 10（長い行がある場合に滞在時間を少し延ばす）
 * ・冒頭フックと終盤CTAの「呼吸」のための固定バッファ 2秒
 *
 * @param {string[]} lines
 * @returns {{ totalSeconds: number, rawEstimateSeconds: number, note: string | null }}
 */
export function estimateDurationSeconds(lines) {
  const PREFERRED_MIN = 25;
  const PREFERRED_MAX = 40;

  if (!lines || lines.length === 0) {
    return { totalSeconds: PREFERRED_MIN, rawEstimateSeconds: 0, note: '台本が空のため仮の尺（25秒）を設定しています。' };
  }

  const totalChars = lines.join('').length;
  const dwellSeconds = lines.length * 2.6;
  const charBonusSeconds = totalChars / 10;
  const buffer = 2;
  const rawEstimateSeconds = Math.round(dwellSeconds + charBonusSeconds + buffer);

  let totalSeconds = rawEstimateSeconds;
  let note = null;

  if (rawEstimateSeconds < PREFERRED_MIN) {
    totalSeconds = PREFERRED_MIN;
    note = `台本の文字量から算出した目安は約${rawEstimateSeconds}秒でしたが、テンポが速すぎないよう推奨範囲（25〜40秒）の下限に調整しています。`;
  } else if (rawEstimateSeconds > PREFERRED_MAX) {
    totalSeconds = PREFERRED_MAX;
    note = `台本の文字量から算出した目安は約${rawEstimateSeconds}秒でした。台本量が多いため、実際の読み上げ速度によっては40秒を超える可能性があります。CapCut側で尺を調整してください。`;
  }

  return { totalSeconds, rawEstimateSeconds, note };
}

/**
 * 台本の行を5つのビート（HOOK/共感/本題/意外性/CTA）に配分し、
 * 各ビートの秒数レンジ・担当テロップ行・カメラワークを組み立てる。
 * 行数が少ない場合でも各ビートに最低0行以上が割り当てられるよう調整する。
 *
 * 【修正1】CTAビートは「新たにCTA文言を生成する」のではなく、台本の末尾行
 * （＝既存のTikTok投稿にすでに設定されている導線）をそのまま割り当てる。
 * これにより、既存のTikTok投稿の着地・導線方針を一切変更しない。
 *
 * @param {string[]} lines
 * @returns {{ totalSeconds: number, rawEstimateSeconds: number, durationNote: string | null, beats: Array }}
 */
export function buildVideoTimeline(lines) {
  const { totalSeconds, rawEstimateSeconds, note: durationNote } = estimateDurationSeconds(lines);

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

  return { totalSeconds, rawEstimateSeconds, durationNote, beats };
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
 *
 * 【修正1】CTAは外部（wordpress_cta等）から取得しない。TikTok用動画のため、
 * 台本自体の末尾（CTAビートの行＝既存のTikTok投稿の導線）をそのまま案内する。
 *
 * @param {{ theme: string, title: string, timeline: { totalSeconds: number, beats: Array, durationNote: string|null }, hasImagePrompt: boolean }} params
 * @returns {string}
 */
export function buildCapCutInstructions({ theme, title, timeline, hasImagePrompt }) {
  const lines = [];
  lines.push('【CapCut編集指示】');
  lines.push('');
  lines.push(`・動画尺：${timeline.totalSeconds}秒想定`);
  lines.push('・BGM：小さめ（感情系・恋愛心理向け）');
  lines.push('・冒頭：強いフック＋ズームイン、軽いインパクト音');
  lines.push('・中盤：共感→本題（テンポを変えずゆったり）');
  lines.push('・CTA前：少し盛り上げる（BGMを一段上げる）');
  lines.push('・終盤：台本末尾のCTA（下記CTAビート参照）を強調、テロップを大きめに');
  if (timeline.durationNote) {
    lines.push(`※${timeline.durationNote}`);
  }
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
  lines.push('');
  lines.push('※CTAは台本にすでに含まれている既存の導線（上記CTAビートの行）をそのまま使用してください。新しいCTA文言は追加していません。');
  if (title) {
    lines.push('');
    lines.push(`参考タイトル：${title}`);
  }
  if (theme) {
    lines.push(`参考テーマ：${theme}`);
  }
  return lines.join('\n');
}
