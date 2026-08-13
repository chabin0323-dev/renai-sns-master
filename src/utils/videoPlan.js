// videoPlan.js
// 「恋愛バズ動画メーカー」用のロジック。
// 外部APIは一切使用せず、既存のTikTok台本（テキスト）だけを解析して
// 動画構成・テロップ（秒単位）・画像演出・BGM方向性・CapCut用編集指示を
// 組み立てる純粋関数群。

// 5つの構成ビート（比率ベース。台本の行数・文字量に応じて秒数は動的に伸縮する）。
// 「同じ動きを毎回繰り返さない」よう、ビートごとに異なるカメラワークを割り当てる。
// CTAは指示どおり「一時停止（固定）」を基本とする。
export const BEAT_DEFS = [
  { key: 'hook', label: 'HOOK（つかみ）', ratio: 0.10, camera: 'ゆっくりズームイン' },
  { key: 'empathy', label: '共感', ratio: 0.17, camera: '左→右パン' },
  { key: 'main', label: '本題', ratio: 0.23, camera: '軽いズーム' },
  { key: 'twist', label: '意外性・気づき', ratio: 0.27, camera: '右→左パン' },
  { key: 'cta', label: 'CTA', ratio: 0.23, camera: '一時停止（固定）' },
];

// UI・CapCut指示に表示する「使用可能な演出」一覧（参考情報として提示する）
export const CAMERA_MOVE_OPTIONS = [
  'ゆっくりズームイン',
  'ゆっくりズームアウト',
  '左→右パン',
  '右→左パン',
  '上→下パン',
  '下→上パン',
  '一時停止',
  '軽いズーム',
  'CTA部分で固定',
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
 * 30秒固定にせず、台本の文字量（読み上げ時間）と行数（間の取り方）の
 * 両方から尺を算出する。基本方針は30秒前後を優先し、25〜40秒の範囲に
 * 収まるよう調整する。台本の内容量が明らかにこの範囲と矛盾する場合
 * （極端に短い/長い台本）は、範囲外であることをnoteに明記した上で
 * 25〜40秒の推奨範囲を維持する（CapCut側での尺調整の目安として）。
 *
 * 算出式の考え方（TikTok向けショート動画のテロップ滞在時間をベースにする）：
 * ・テロップ滞在時間 = 行数 × 2.6秒（1行＝1テロップが画面に留まる基本時間）
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
 * ビート内の各行（テロップ）に、開始秒・終了秒を割り当てる。
 * 文字数が多い行には少し長めの表示時間を割り当てつつ、
 * 極端に短くなりすぎないよう最低表示時間（0.8秒）を保証する。
 * @param {string[]} beatLines
 * @param {number} beatStart
 * @param {number} beatEnd
 * @returns {Array<{ text: string, startSec: number, endSec: number }>}
 */
function assignTelopTimings(beatLines, beatStart, beatEnd) {
  if (!beatLines || beatLines.length === 0) return [];

  const MIN_PER_LINE = 0.8;
  const beatDuration = Math.max(0.1, beatEnd - beatStart);
  const totalChars = beatLines.reduce((sum, l) => sum + l.length, 0) || beatLines.length;

  // 文字数比で仮配分し、最低表示時間を下回らないよう補正
  let rawDurations = beatLines.map((l) => Math.max(MIN_PER_LINE, (l.length / totalChars) * beatDuration));
  const rawSum = rawDurations.reduce((a, c) => a + c, 0);
  const scale = rawSum > 0 ? beatDuration / rawSum : 1;
  rawDurations = rawDurations.map((v) => v * scale);

  let cursor = beatStart;
  return beatLines.map((text, i) => {
    const isLast = i === beatLines.length - 1;
    const start = Math.round(cursor * 10) / 10;
    const end = isLast ? Math.round(beatEnd * 10) / 10 : Math.round((cursor + rawDurations[i]) * 10) / 10;
    cursor = end;
    return { text, startSec: start, endSec: end };
  });
}

/**
 * 台本の行を5つのビート（HOOK/共感/本題/意外性/CTA）に配分し、
 * 各ビートの秒数レンジ・担当テロップ（秒単位タイミング付き）・カメラワークを組み立てる。
 * 行数が少ない場合でも各ビートに最低0行以上が割り当てられるよう調整する。
 *
 * CTAビートは「新たにCTA文言を生成する」のではなく、台本の末尾行
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

    const telops = assignTelopTimings(beatLines, startSec, endSec);

    return {
      key: def.key,
      label: def.label,
      camera: def.camera,
      startSec,
      endSec,
      lines: beatLines,
      telops,
    };
  });

  return { totalSeconds, rawEstimateSeconds, durationNote, beats };
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(Math.floor(s)).padStart(2, '0')}`;
}

export function formatBeatRange(beat) {
  return `${formatTime(beat.startSec)}〜${formatTime(beat.endSec)}`;
}

export function formatTelopRange(telop) {
  return `${telop.startSec.toFixed(1)}〜${telop.endSec.toFixed(1)}秒`;
}

/**
 * 全テロップ（秒単位タイミング付き）を、ビートをまたいだ通しリストとして取得する。
 * @param {{ beats: Array }} timeline
 * @returns {Array<{ text: string, startSec: number, endSec: number, beatLabel: string }>}
 */
export function flattenTelops(timeline) {
  const result = [];
  for (const beat of timeline.beats) {
    for (const t of beat.telops) {
      result.push({ ...t, beatLabel: beat.label });
    }
  }
  return result;
}

// BGM方向性の判定キーワード（簡易ヒューリスティック。API不使用）
const BGM_MOOD_RULES = [
  { mood: 'ミステリアス（謎めいた・気になる系）', keywords: ['既読', 'スルー', '謎', '本音', '隠れた', '不安', '怖い', 'なぜ'] },
  { mood: '切ない（叶わない恋・寂しさ系）', keywords: ['切ない', '寂しい', '涙', '別れ', '辛い', '諦め', '片思い'] },
  { mood: '感情的（高まる気持ち・本気系）', keywords: ['好き', '愛', '本気', '気持ち', '運命', 'ときめき'] },
];

/**
 * 台本の内容から、テーマに合うBGMの方向性を簡易的に提案する。
 * ルールベースの判定のみで、外部APIは使用しない。
 * @param {string[]} lines
 * @returns {string}
 */
export function suggestBgmMood(lines) {
  const text = (lines || []).join('');
  let best = null;
  let bestScore = 0;
  for (const rule of BGM_MOOD_RULES) {
    const score = rule.keywords.reduce((s, kw) => s + (text.includes(kw) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = rule.mood;
    }
  }
  return best || '恋愛系（王道の切なさ・共感系）';
}

/**
 * CapCutにそのまま貼り付けられる編集指示テキストを生成する。
 * すべてローカルのテンプレート処理で、外部APIは使用しない。
 *
 * CTAは外部（wordpress_cta等）から取得しない。TikTok用動画のため、
 * 台本自体の末尾（CTAビートの行＝既存のTikTok投稿の導線）をそのまま案内する。
 *
 * @param {{
 *   theme: string,
 *   title: string,
 *   timeline: { totalSeconds: number, beats: Array, durationNote: string|null },
 *   hasImagePrompt: boolean,
 *   bgmMood: string,
 * }} params
 * @returns {string}
 */
export function buildCapCutInstructions({ theme, title, timeline, hasImagePrompt, bgmMood }) {
  const lines = [];
  lines.push('【CapCut編集指示】');
  lines.push('');

  lines.push('■ 動画尺');
  lines.push(`・${timeline.totalSeconds}秒想定`);
  if (timeline.durationNote) {
    lines.push(`※${timeline.durationNote}`);
  }
  lines.push('');

  lines.push('■ 画面サイズ');
  lines.push('・9:16（縦型）');
  lines.push('');

  lines.push('■ 使用画像');
  lines.push(hasImagePrompt
    ? '・文字なし画像プロンプト（① TikTok動画素材）を1枚使用'
    : '・文字なし画像プロンプトが未検出（SNS投稿マスター側で画像生成プロンプト①を生成してください）');
  lines.push('');

  lines.push('■ 画像の動き（ビートごとに変化させる）');
  for (const beat of timeline.beats) {
    lines.push(`・${beat.label}（${formatBeatRange(beat)}）：${beat.camera}`);
  }
  lines.push('');

  lines.push('■ テロップタイミング');
  for (const beat of timeline.beats) {
    if (beat.telops.length === 0) continue;
    lines.push(`【${beat.label}】`);
    for (const t of beat.telops) {
      lines.push(`${formatTelopRange(t)}｜「${t.text}」`);
    }
  }
  lines.push('');

  lines.push('■ BGMの雰囲気');
  lines.push(`・${bgmMood}`);
  lines.push('・全体は小さめの音量。静か→CTA前で少し盛り上げる展開を推奨');
  lines.push('');

  lines.push('■ 効果音を入れる位置');
  lines.push('・冒頭（HOOK）：軽いインパクト音');
  lines.push('・意外性パートの核心ワード：小さな効果音（「実は」「本当は」など）');
  lines.push('・CTA直前：BGMを一段上げる、または短い転換音');
  lines.push('');

  lines.push('■ CTAの位置');
  const ctaBeat = timeline.beats.find((b) => b.key === 'cta');
  if (ctaBeat) {
    lines.push(`・${formatBeatRange(ctaBeat)}（動画終盤）`);
    lines.push('・台本にすでに含まれている既存の導線（下記CTAテロップ）をそのまま使用。新しいCTA文言は追加していません');
    ctaBeat.lines.forEach((l) => lines.push(`  ・${l}`));
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
