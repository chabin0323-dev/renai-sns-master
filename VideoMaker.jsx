import { useMemo } from 'react';
import {
  splitScriptToLines,
  buildVideoTimeline,
  buildCapCutInstructions,
  formatBeatRange,
} from '../utils/videoPlan.js';
import './VideoMaker.css';

/**
 * 恋愛バズ動画メーカー
 * SNS投稿マスターで生成済みのデータ（テーマ・TikTokタイトル・台本・ハッシュタグ・
 * 文字なし画像プロンプト）をpropsで受け取り、動画構成とCapCut編集指示を
 * ローカルロジックのみで自動生成する。外部APIは一切使用しない。
 *
 * @param {{
 *   data: {
 *     theme: string,
 *     tiktokTitle: string,
 *     tiktokScript: string,
 *     tiktokHashtags: string,
 *     tiktokImagePrompt: string,
 *     cta: string,
 *   },
 *   onBack: () => void,
 *   onCopy: (text: string, label: string) => void,
 * }} props
 */
export default function VideoMaker({ data, onBack, onCopy }) {
  const { theme, tiktokTitle, tiktokScript, tiktokHashtags, tiktokImagePrompt, cta } = data;

  const lines = useMemo(() => splitScriptToLines(tiktokScript), [tiktokScript]);
  const timeline = useMemo(() => buildVideoTimeline(lines), [lines]);
  const capcutText = useMemo(
    () => buildCapCutInstructions({ theme, title: tiktokTitle, timeline, hasImagePrompt: !!tiktokImagePrompt?.trim(), cta }),
    [theme, tiktokTitle, timeline, tiktokImagePrompt, cta]
  );

  const telopLines = lines; // テロップ = 台本を短文分割したもの（すでに1行=1テロップ単位）

  const hasScript = lines.length > 0;

  return (
    <div className="video-maker">
      <button className="video-maker__back" onClick={onBack} type="button">
        ← 投稿マスターに戻る
      </button>

      <header className="video-maker__header">
        <h1 className="video-maker__title">🎬 恋愛バズ動画メーカー</h1>
        <p className="video-maker__desc">
          SNS投稿マスターで生成済みのデータから、CapCut用の動画構成を自動生成します。
        </p>
      </header>

      {!hasScript ? (
        <div className="video-maker__empty">
          <p>
            TikTok台本が見つかりません。先に投稿マスターで「✨ 投稿を整理する」を実行し、
            TikTok台本を生成してから「🎬 この投稿で動画を作る」を押してください。
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

          {/* セクション3：テロップ */}
          <section className="vm-card">
            <div className="vm-card__header-row">
              <h2 className="vm-card__title">💬 テロップ（台本を短文分割）</h2>
              <button
                className="vm-copy-btn"
                onClick={() => onCopy(telopLines.join('\n'), 'テロップ')}
                type="button"
              >
                📋 コピー
              </button>
            </div>
            <ol className="vm-telop-list">
              {telopLines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ol>
          </section>

          {/* セクション4：画像演出 */}
          <section className="vm-card">
            <h2 className="vm-card__title">🖼️ 画像演出</h2>
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
          </section>

          {/* セクション5：CapCut用指示 */}
          <section className="vm-card vm-card--highlight">
            <div className="vm-card__header-row">
              <h2 className="vm-card__title">📋 CapCut用編集指示</h2>
              <button
                className="vm-copy-btn vm-copy-btn--primary"
                onClick={() => onCopy(capcutText, 'CapCut編集指示')}
                type="button"
              >
                📋 全文コピー
              </button>
            </div>
            <pre className="vm-capcut-text">{capcutText}</pre>
          </section>
        </>
      )}
    </div>
  );
}
