import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'renai-sns-master:history';

function readHistory() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function writeHistory(list) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    // 容量オーバー等は静かに無視（保存できない旨はUI側で扱う）
  }
}

/**
 * 投稿履歴をlocalStorageで管理するフック
 */
export function usePostHistory() {
  const [history, setHistory] = useState(() => readHistory());

  useEffect(() => {
    writeHistory(history);
  }, [history]);

  const savePost = useCallback((entry) => {
    setHistory((prev) => {
      const next = [
        {
          id: entry.id || `post_${Date.now()}`,
          createdAt: entry.createdAt || new Date().toISOString(),
          theme: entry.theme || '（テーマ未設定）',
          rawText: entry.rawText,
          sections: entry.sections,
        },
        ...prev,
      ];
      return next.slice(0, 200); // 上限200件
    });
  }, []);

  const deletePost = useCallback((id) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return { history, savePost, deletePost, clearHistory };
}
