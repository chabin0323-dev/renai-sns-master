import { useMemo } from 'react';
import {
  splitScriptToLines,
  buildVideoTimeline,
  buildCapCutInstructions,
  formatBeatRange,
  formatTelopRange,
  flattenTelops,
  suggestBgmMood,
  CAMERA_MOVE_OPTIONS,
} from '../utils/videoPlan.js';
import './VideoMaker.css';

/**
 * 恋愛バズ動画メーカー
 * SNS投稿マスターで生成済みのデータ（テーマ・TikTokタイトル・台本・ハッシュタグ・
 * 文字なし画像プロンプト）をpropsで受け取り、動画構成とCapCut編集指示を
 * ローカルロジックのみで自動生成する。外部APIは一切使用しない。
 * テーマ・台本の再入力はさせない（すべて既存の投稿データをそのまま利用する）。
 *
 * @param {{
 *   data: {
 *     theme: string,
 *     tiktokTitle: string,
 *     tiktokScript: string,
 *     tiktokHashtags: string,
 *     tiktokImagePrompt: string,
 *   },
 *   onBack: () => void,
 *   onCopy: (text: string, label: string) => void,
 * }} props
 */
export default function VideoMaker({ data, onBack, onCopy }) {
  const { theme, tiktokTitle, tiktokScript, tiktokHashtags, tiktokImagePrompt } = data;

  const lines = useMemo(() => splitScriptToLines(tiktokScript), [tiktokScript]);
  const timeline = useMemo(() => buildVideoTimeline(lines), [lines]);
  const bgmMood = useMemo(() => suggestBgmMood(lines), [lines]);
  const allTelops = useMemo(() => flattenTelops(timeline), [timeline]);
  const capcutText = useMemo(
    () => buildCapCutInstructions({
      theme,
      title: tiktokTitle,
      timeline,
      hasImagePrompt: !!tiktokImagePrompt?.trim(),
      bgmMood,
    }),
    [theme, tiktokTitle, timeline, tiktokImagePrompt, bgmMood]
  );

  const hasScript = lines.length > 0;

  return (
    <div className="video-maker">
      <button className="video-maker__back" onClick={onBack} type="button">
        ← SNS投稿マスターに戻る
      </button>

      <header className="video-maker__header">
        <h1 className="video-maker__title">🎬 恋愛バズ動画メーカー</h1>
        <p className="video-maker__desc">
          SNS投稿マスターで生成済みのテーマ・TikTok台本・画像プロンプトから、CapCut用の動画構成を自動生成します。
        </p>
      </header>

      {!hasScript ? (
        <div className="video-maker__empty">
          <p>
            TikTok台本が見つかりません。先に投稿マスターで「✨ 投稿を整理する」を実行し、
            TikTok台本を生成してから「🎬 この投稿でバズ動画を作る」を押してください。
          </p>
        </div>
      ) : (
        <>
          {/* セクション1：基本情報 */}
          <section className="vm-card">
            <h2 className="vm-card__title">📌 基本情報</h2>
            <div className="vm-field-row">
              <span className="vm-field-row__label">テーマ</span>
              <span className="vm-field-row__value">{theme || '（テーマ未検出）'}</span>
            </div>
            <div className="vm-field-row">
              <span className="vm-field-row__label">TikTokタイトル</span>
              <span className="vm-field-row__value">{tiktokTitle || '（タイトル未検出）'}</span>
            </div>
            {tiktokHashtags && (
              <div className="vm-field-row">
                <span className="vm-field-row__label">ハッシュタグ</span>
                <span className="vm-field-row__value">{tiktokHashtags}</span>
              </div>
            )}
          </section>

          {/* セクション2：動画構成タイムライン */}
          <section className="vm-card">
            <h2 className="vm-card__title">🎞️ 動画構成（想定{timeline.totalSeconds}秒）</h2>
            {timeline.durationNote && (
              <p className="vm-note vm-note--info">ℹ️ {timeline.durationNote}</p>
            )}
            <div className="vm-timeline">
              {timeline.beats.map((beat) => (
                <div className="vm-beat" key={beat.key}>
                  <div className="vm-beat__head">
                    <span className="vm-beat__range">{formatBeatRange(beat)}</span>
                    <span className="vm-beat__label">{beat.label}</span>
                  </div>
                  <p className="vm-beat__camera">📷 {beat.camera}</p>
                  {beat.lines.length > 0 && (
                    <ul className="vm-beat__lines">
                      {beat.lines.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* セクション3：テロップ（秒単位タイミング付き） */}
          <section className="vm-card">
            <div className="vm-card__header-row">
              <h2 className="vm-card__title">💬 テロップ（開始〜終了秒つき）</h2>
              <button
                className="vm-copy-btn"
                onClick={() => onCopy(
                  allTelops.map((t) => `${formatTelopRange(t)}\n「${t.text}」`).join('\n\n'),
                  'テロップ'
                )}
                type="button"
              >
                📋 コピー
              </button>
            </div>
            <ol className="vm-telop-list">
              {allTelops.map((t, i) => (
                <li key={i} className="vm-telop-item">
                  <span className="vm-telop-item__time">{formatTelopRange(t)}</span>
                  <span className="vm-telop-item__text">「{t.text}」</span>
                </li>
              ))}
            </ol>
          </section>

          {/* セクション4：画像演出 */}
          <section className="vm-card">
            <h2 className="vm-card__title">🖼️ 画像演出（1枚の画像を動画らしく見せる）</h2>
            {tiktokImagePrompt ? (
              <>
                <p className="vm-note">
                  文字なし画像プロンプト（① TikTok動画素材・9:16）と連動した動きの提案です。
                </p>
                <div className="vm-image-prompt">{tiktokImagePrompt}</div>
              </>
            ) : (
              <p className="vm-note vm-note--warn">
                文字なし画像プロンプトが見つかりません。投稿マスター側で画像生成プロンプト①を生成してください。
              </p>
            )}
            <div className="vm-camera-legend">
              {timeline.beats.map((beat) => (
                <span className="vm-camera-legend__item" key={beat.key}>
                  {beat.label}：{beat.camera}
                </span>
              ))}
            </div>
            <p className="vm-note vm-note--muted">
              使用可能な演出：{CAMERA_MOVE_OPTIONS.join(' / ')}
            </p>
          </section>

          {/* セクション5：BGM・効果音 */}
          <section className="vm-card">
            <h2 className="vm-card__title">🎵 BGM・効果音の方向性</h2>
            <div className="vm-field-row">
              <span className="vm-field-row__label">BGMムード</span>
              <span className="vm-field-row__value">{bgmMood}</span>
            </div>
            <p className="vm-note">全体は小さめの音量。静か→CTA前で少し盛り上げる展開を推奨します。</p>
            <ul className="vm-se-list">
              <li>冒頭（HOOK）：軽いインパクト音</li>
              <li>意外性パートの核心ワード：小さな効果音</li>
              <li>CTA直前：BGMを一段上げる、または短い転換音</li>
            </ul>
          </section>

          {/* セクション6：CapCut用指示 */}
          <section className="vm-card vm-card--highlight">
            <div className="vm-card__header-row">
              <h2 className="vm-card__title">📋 CapCut編集指示</h2>
              <button
                className="vm-copy-btn vm-copy-btn--primary"
                onClick={() => onCopy(capcutText, 'CapCut編集指示')}
                type="button"
              >
                📋 CapCut編集指示をコピー
              </button>
            </div>
            <pre className="vm-capcut-text">{capcutText}</pre>
          </section>
        </>
      )}
    </div>
  );
}
