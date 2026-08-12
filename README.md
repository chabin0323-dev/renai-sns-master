# 💎 恋愛SNS投稿マスター

GEM（Gemini Gems）で生成した「恋愛・SNS投稿」のテキストを貼り付けるだけで、
TikTok / Instagram / X / Threads / note / WordPress / 画像生成プロンプト の各項目へ
自動的に整理・分類し、編集・コピー・保存ができる投稿作業支援アプリです。

## このアプリについて（重要）

- このアプリに **AIによる文章生成機能はありません**。
- Gemini API / OpenAI API / Claude API など、外部AI APIへの通信は一切行いません。
- APIキーの入力・保存・利用機能もありません。
- 文章生成は、あなたが別途利用している **GEM側で行ってください**。GEMで作った完成済みの
  投稿テキストをこのアプリに貼り付けて、整理・編集・コピー・保存するだけのツールです。
- 入力された投稿内容は外部サーバーへ送信されず、すべてブラウザ内（と、保存機能を使った場合は
  ブラウザの `localStorage` 内）だけで処理されます。

## 主な機能

- GEMの出力を貼り付けて「✨ 投稿を整理する」を押すと、自動的に各SNS項目へ分類
- 見出しの書式（【】/■/#など）や改行の多少のゆらぎに対応した柔軟な認識
- 画像生成プロンプトは以下の5種類を個別に認識
  1. TikTok・文字なし
  2. TikTok・文字あり
  3. note・文字なし
  4. note・文字あり
  5. WordPress・アイキャッチ
- 各カードはその場で編集可能（textarea）。編集後の内容がコピー対象になります
- 「📋 全部コピー」で、整理済みの全投稿をSNSごとに区切ってまとめてコピー
- 各SNS・各画像プロンプトを個別にコピーするボタンを完備
- TikTok / Instagram / X / Threads / note のハッシュタグだけを抽出してコピーするボタン
- 「💾 保存」で `localStorage` に投稿履歴として保存。「📚 投稿履歴」から一覧・再表示・削除が可能
- スマートフォン・PC両対応のレスポンシブデザイン
- PWA対応（スマートフォンのホーム画面に追加可能）

## 技術構成

- React 19 + Vite
- 状態管理はReactの標準Hooksのみ（外部の状態管理ライブラリは未使用）
- データ保存は `localStorage` のみ（データベース・外部API不使用）
- PWA対応は `vite-plugin-pwa` を使用

## ファイル構成

```
src/
  main.jsx                     # エントリーポイント
  App.jsx                      # メイン画面・状態管理・各種コピー/保存処理
  App.css                      # ページ全体のレイアウト
  index.css                    # デザイントークン（配色・フォント）とベーススタイル
  components/
    Header.jsx / .css          # ヘッダー（タイトル・説明・履歴ボタン）
    InputPanel.jsx / .css      # GEM出力の貼り付け欄と「投稿を整理する」ボタン
    CopyAllBar.jsx / .css      # 上部の「全部コピー」「保存」バー
    ResultCard.jsx / .css      # 各SNS投稿カード（編集・コピー・ハッシュタグコピー）
    ImagePromptSection.jsx / .css  # 画像生成プロンプト5種類のカード群
    HistoryPanel.jsx / .css    # 投稿履歴パネル（一覧・再表示・削除）
    Toast.jsx / .css           # コピー/保存などの完了通知
  hooks/
    useLocalStorage.js         # 投稿履歴のlocalStorage管理フック
  utils/
    parser.js                  # GEM出力を各セクション・画像プロンプトへ分解するロジック
    clipboard.js                # クリップボードコピー（フォールバック付き）
public/
  icons/                       # PWA用アイコン
```

## ローカルでの起動方法

```bash
npm install
npm run dev
```

表示されたURL（例: http://localhost:5173）をブラウザで開いてください。

## ビルド方法

```bash
npm run build
```

`dist/` フォルダに本番用ファイルが生成されます。ビルド後の内容を確認したい場合は、

```bash
npm run preview
```

## GitHubへのアップロード方法

```bash
git init
git add .
git commit -m "Initial commit: 恋愛SNS投稿マスター"
git branch -M main
git remote add origin <あなたのGitHubリポジトリURL>
git push -u origin main
```

## Vercelへのデプロイ方法

1. [Vercel](https://vercel.com) にログインし、「Add New... → Project」を選択
2. 先ほどGitHubへプッシュしたリポジトリを選択してImport
3. Framework Presetは自動的に **Vite** が検出されます（Build Command: `vite build` / Output Directory: `dist`）
4. **環境変数の設定は不要です**（APIキー等は一切使用しません）
5. 「Deploy」をクリックすれば数十秒でデプロイが完了します

## APIキーについて

このアプリは外部AI APIを使用しないため、**APIキーの設定は一切不要です**。
環境変数（`.env`など）を用意する必要もありません。GitHubやVercelにそのまま
公開しても、APIキーの漏洩リスクはありません。

## 注意事項

- `localStorage` はブラウザ・端末ごとに独立しています。別の端末やブラウザ、
  シークレットモードでは保存した履歴は共有されません。
- ブラウザのキャッシュ・サイトデータを削除すると、保存した投稿履歴も削除されます。
  大事な投稿は、必要に応じて別途コピー&保存しておくことをおすすめします。
