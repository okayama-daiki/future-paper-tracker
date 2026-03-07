# Future Paper Tracker

Future Paper Tracker は、アルゴリズム・最適化・理論計算機科学まわりの会議について、投稿締切と開催日程を一覧できるようにするための非公式トラッカーです。

対象利用者:

- 個人研究室
- 研究室メンバー

## 現在の実装

- 締切中心の一覧表示
- 会議ごとの詳細ページ
- 主要締切の優先表示
    - `full_paper_submission_deadline`
    - `submission_deadline`
    - `abstract_submission_deadline`
- 締切切れのグレーアウト
- 検索
- ページネーション
- 過去開催 edition へのアプリ内リンク
- venue 表示
- 将来 edition の推定締切表示
    - `?`
    - `ESTIMATED`

## データ構造

- 入力一覧: [config/conferences.csv](./config/conferences.csv)
- 正本データ: [data/conferences.json](./data/conferences.json)

データモデル:

- `Conference Series`
    - 例: `AAAC`
- `Edition`
    - 例: `AAAC 2026`
- `Event`
    - 例: `full_paper_submission_deadline`, `conference`, `notification`

基本ルール:

- 時刻は UTC 保存
- `source_url` を保持
- 会議メタデータは公式ページを根拠にする
- 表示順は `data/conferences.json` の並びを基準にする

## ローカル開発

前提:

- Bun

実行:

```bash
bun install
bun run dev
```

検証:

```bash
bun run lint
bun run build
```

## デプロイ

静的フロントエンドとして GitHub Pages に配信します。

- workflow: [.github/workflows/pages.yml](./.github/workflows/pages.yml)
- `pull_request`: install / lint / build
- `push` to `main`: verify 後に GitHub Pages へ deploy

GitHub Pages 側では source を `GitHub Actions` に設定する前提です。

## 関連ドキュメント

- 要件整理: [docs/requirements.md](./docs/requirements.md)
- 会議情報自動収集設計: [docs/feature/conference-info-automation.md](./docs/feature/conference-info-automation.md)
- 現状データモデル整理: [docs/design/current-data-model.md](./docs/design/current-data-model.md)
