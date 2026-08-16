// useCurrentPost.js
// 「今まさに画面に表示されている投稿」を、ユーザーが明示的に「💾 保存」を押さなくても
// 自動的にlocalStorageへ保持し、アプリを閉じて再度開いても復元できるようにするための
// 読み書きヘルパー。
//
// 【重要】これは既存の「📚 投稿履歴」機能（usePostHistory / renai-sns-master:history）
// とは完全に独立した別のlocalStorageキーを使う。履歴は「ユーザーが保存ボタンを押した
// 投稿の一覧」であり、こちらは「今まさに編集中の1件」を指すため、データの性質が異なる。
// 保存方式を二重化しているわけではなく、目的の異なる2つの永続化を別々のキーで
// 管理している。

const CURRENT_POST_KEY = 'renai-sns-master:current-post';

/**
 * 現在の作業状態をlocalStorageから読み込む。
 * 保存されていない、または壊れている場合はnullを返す。
 * @returns {{ rawInput: string, sections: object, imagePrompts: object, organized: boolean, noteLinkId: string, xLinkId: string, threadsLinkId: string } | null}
 */
export function loadCurrentPost() {
  try {
    const raw = window.localStorage.getItem(CURRENT_POST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch (err) {
    return null;
  }
}

/**
 * 現在の作業状態をlocalStorageへ保存する。
 * @param {{ rawInput: string, sections: object, imagePrompts: object, organized: boolean, noteLinkId: string, xLinkId: string, threadsLinkId: string }} data
 */
export function saveCurrentPost(data) {
  try {
    window.localStorage.setItem(CURRENT_POST_KEY, JSON.stringify(data));
  } catch (err) {
    // 容量オーバー等は静かに無視（既存の他機能と同じ方針）
  }
}

/**
 * 現在の作業状態を完全に消去する（前回の文章を削除した時などに使用）。
 */
export function clearCurrentPost() {
  try {
    window.localStorage.removeItem(CURRENT_POST_KEY);
  } catch (err) {
    // no-op
  }
}
