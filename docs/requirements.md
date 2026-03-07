# Requirements (Current Agreement)

## 1. 目的

- 研究室メンバー向けに、会議の投稿締切・開催日を継続収集し、見落としを防ぐ。
- 会議情報収集をバッチ処理で自動化し、Web で一覧確認できるようにする。

## 2. 主な利用者

- 個人研究室
- 研究室メンバー

## 3. 対象範囲（MVP）

- 入力済み会議の情報取得・更新
- 締切中心のリスト表示
- 会議ごとの詳細ページ表示

MVPではカレンダー表示・地図表示は対象外（将来拡張）。

## 4. 入出力と正本

- 会議入力は `config/conferences.csv`（人間管理しやすい CSV）。
- `config/conferences.csv` は `series_index_url`（シリーズ一覧URL）と `current_known_url`（現時点の既知URL）も持つ。
- 正本データは `data/conferences.json`。
- データモデルは `Conference Series -> Editions(年次)` を採用する。
    - 例: `AAAC`（series）の下に `AAAC 2025`, `AAAC 2026`（editions）を持つ。
- 表示順・処理順は `data/conferences.json` の並びを基準とする。
- SQLite は使わず、CSV/JSON で管理する。

## 5. データ取得ポリシー

- 候補発見には Wiki/CFP 集約サイトを使ってよい。
- 会議メタデータの確定は必ず公式ページ情報を使う。
- 各イベントは `source_url` を必須保持する。
- 推測で会議情報を作らない。

## 6. 取得対象イベント

- 投稿関連締切（例: `full_paper_submission_deadline`, `submission_deadline`, `abstract_submission_deadline`）
- 開催日（`conference`）
- そのほか取れるイベント（`notification`, `camera_ready` など）は可能な限り保持する。

一覧表示で使う主要締切の優先順位:

1. `full_paper_submission_deadline`
2. `submission_deadline`
3. `abstract_submission_deadline`

`full_paper` がない会議は上記優先順で代替表示する。

将来 edition の主要締切が未公開の場合:

- 直近の過去 edition の主要締切をベースに、年次だけ平行移動した推定締切を表示してよい。
- 推定締切は `?` と `ESTIMATED` タグで明確に区別する。
- 推定締切は公式締切の代替ではなく、公式締切が公開されたら置き換える。
- 推定の根拠は直近の過去 edition の公式 `source_url` を使う。

## 7. 時刻・タイムゾーン

- 保存は UTC 統一。
- 表示も UTC 固定（ローカル切替は行わない）。
- 表示形式は可読な UTC 文字列（`YYYY-MM-DD HH:mm UTC`）。
- AoE・日付のみ等の曖昧さは `source_url` を根拠に人手確認で扱う。

## 8. UI要件（MVP）

- 一覧はリスト（テーブル）表示。
- 一覧項目は最低限:
    - 会議名（`conference_key + 年` 表示。例: `SIROCCO 2026`）
    - 主要締切（UTC）
    - 情報源リンク
    - 締切タグ（`FULL PAPER` / `SUBMISSION` / `ABSTRACT`）
- 推定締切は `?` と `ESTIMATED` タグ、元にした edition 年の注記を出す。
- 一覧の並び順は主要締切日時の降順（上ほど新しい締切）。
- 会議名クリックで詳細ページへ遷移。
- 詳細ページでは以下を表示:
    - 公式サイト
    - CfP公開有無
    - 参照ソース一覧
    - イベント一覧
    - 過去開催リンク（このアプリ内リンク）
- 戻る操作（Back）が機能すること。

## 9. 自動化・運用

- 日次バッチ（1日1回）で更新。
- 実行基盤は GitHub Actions `schedule`。
- 配信は GitHub Pages（artifact 利用）。
- 更新結果は `main` へ直接コミット運用。
- 失敗時や要確認ケース通知には GitHub Issue を使う。

## 10. 再取得ポリシー

- 主目的は CfP の公開検知と締切取得。
- CfP が公開された会議は原則再アクセス停止。
- 例外として「締切直前1か月」は週1回だけ再確認を行う（延長対応）。

## 11. 抽出方針（LLM活用）

- 固定パーサのみでなく、曖昧部分は GPT による構造化抽出を許容する。
- ただし、出力は検証可能な構造（イベント型・日時・source_url）で保持する。
- 完全自動100%は前提にせず、低信頼データは要確認運用に回す。

## 12. 既知の技術的ハードル

- 公式サイトが 403 / ログイン要求の場合は自動取得が難しい。
- 年次ページが未公開または URL 不定だと新年度切替時に探索コストが高い。
- タイムゾーン未記載・文面曖昧な締切は正規化時に不確実性が残る。
