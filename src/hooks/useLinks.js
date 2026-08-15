import { useCallback, useEffect, useState } from 'react';

// 投稿履歴（renai-sns-master:history）とは別のキーで管理する。
// 「共通リンク」は投稿ごとのデータではなく、アプリ全体で使い回す設定情報のため、
// 履歴の保存方式を二重化するのではなく、独立したシンプルなlocalStorageキーを使う。
const LINKS_STORAGE_KEY = 'renai-sns-master:links';
const LINK_COUNT = 5;

function defaultLinks() {
  return Array.from({ length: LINK_COUNT }, (_, i) => ({
    id: i + 1,
    name: '',
    url: '',
  }));
}

function readLinks() {
  try {
    const raw = window.localStorage.getItem(LINKS_STORAGE_KEY);
    if (!raw) return defaultLinks();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length !== LINK_COUNT) return defaultLinks();
    return parsed.map((l, i) => ({
      id: l.id || i + 1,
      name: l.name || '',
      url: l.url || '',
    }));
  } catch (err) {
    return defaultLinks();
  }
}

function writeLinks(links) {
  try {
    window.localStorage.setItem(LINKS_STORAGE_KEY, JSON.stringify(links));
  } catch (err) {
    // 容量オーバー等は静かに無視
  }
}

/**
 * 共通リンク5個をlocalStorageで管理するフック。
 * note / X / Threads すべてから共通で参照する（プラットフォームごとの二重登録は不要）。
 */
export function useLinks() {
  const [links, setLinks] = useState(() => readLinks());

  useEffect(() => {
    writeLinks(links);
  }, [links]);

  const updateLink = useCallback((id, field, value) => {
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, [field]: value } : l)));
  }, []);

  const getLinkById = useCallback(
    (id) => links.find((l) => l.id === id) || null,
    [links]
  );

  return { links, updateLink, getLinkById };
}
