# Conference Info Automation

## 1. Scope

- 会議情報の自動収集と更新を日次バッチで実行する。
- 対象は `config/conferences.csv` に登録された会議。
- 収集結果は `data/conferences.json` を正本として保存する。

## 2. Goal

- 公式ページ由来の会議メタデータ（締切・開催日など）を自動更新する。
- 曖昧情報は要確認ケースとして GitHub Issue で通知する。

## 3. Architecture (Go)

- `cmd/fetcher/main.go`: バッチのエントリーポイント
- `internal/discover`: 会議候補URL探索（Wiki/CFP集約サイト利用可）
- `internal/official`: 公式URL確定ロジック
- `internal/extract`: 公式ページ本文の取得 + GPT構造化抽出
- `internal/normalize`: 日時正規化（UTC化、AoE処理）
- `internal/diff`: 前回値との比較、要確認判定
- `internal/store`: `data/conferences.json` の読込・更新・保存
- `internal/github`: GitHub Issue 作成

## 4. Processing Flow

1. `config/conferences.csv` を読み込む（`enabled=true` のみ対象）。
2. 候補URLを発見し、会議ごとに公式URLを1件確定する。
3. 公式URL配下（Important Dates/CFP/Submission等）から本文を取得する。
4. GPTに本文を渡してイベント情報をJSON Schemaで抽出する。
5. 抽出結果をUTC正規化し、`data/conferences.json` にマージする。
6. 差分判定を行い、条件一致時は要確認Issueを作成する。
7. CfP公開検知後は再検索方針を更新する（下記「Fetch Policy」参照）。
8. 変更があれば `main` に直接コミットする（GitHub Actions運用）。

## 5. Data Sources Policy

- 候補発見: Wiki/CFP集約サイトの利用可。
- メタデータ確定: 必ず会議公式ページの情報を使う。
- 各イベントは `source_url` を必須保持する。

## 6. Event Model (Minimum)

- `conference_key` (Series key, e.g. `AAAC`)
- `conference_name` (Series name)
- `editions[]`
    - `year` (e.g. `2026`)
    - `official_site`
    - `cfp_published`
    - `venue` (optional)
    - `venue_source_url` (optional)
    - `events[]`
        - `event_type` (e.g. `full_paper_submission_deadline`, `submission_deadline`, `notification`, `camera_ready`, `conference`)
        - `start_at_utc`
        - `end_at_utc` (optional)
        - `source_url`
        - `estimated` (optional, true only when derived from a previous edition)
        - `estimated_from_year` (optional)

## 7. Timezone Rules

- 保存はUTC。
- 表示はUTC固定（ローカル変換は行わない）。
- AoEは `UTC-12` として扱う。
- タイムゾーン不明・日付のみの場合は要確認Issueの対象とする。

## 8. Review-Needed Rules (Issue Trigger)

以下のいずれかで GitHub Issue を作成する。

- 締切日が前回値から7日以上変動
- タイムゾーン不明
- 日付のみで時刻が不明

Issue本文の最小内容:

- 会議キー・会議名
- 該当イベント
- 旧値 / 新値
- 根拠 `source_url`

## 9. UI Contract (MVP)

- MVPはカレンダーではなくリスト表示。
- 既定ソート: 主要締切の `start_at_utc` 降順（上ほど新しい締切）。
- 最低表示項目: 会議名（`conference_key + year`）、日時（UTC）、情報源URL、締切タグ。

## 10. Batch / Deploy

- 実行基盤: GitHub Actions (`schedule`, 1日1回)
- 保存先: リポジトリ内 `data/conferences.json`
- 配信: GitHub Pages（静的表示）
- 失敗時通知: GitHub Issue

## 11. Fetch Policy

- 収集の主目的は `Call for Papers (CfP)` 公開の検知とその内容取得。
- `cfp_published_at` を取得できた会議は原則 `frozen=true` とし、定期再アクセスを停止する。
- 例外: 締切直前1か月は週1回だけ再確認する（締切延長等の追従のため）。
- 強制再取得が必要な場合は `manual_force_refresh=true` で次回実行時に再検索する。
- CfP未公開の会議のみ日次チェックを継続する。
- 未来 edition の公式ページは見つかったが主要締切が未公開の場合、直近の過去 edition を基に推定締切を生成してよい。
- 推定締切は `estimated=true` とし、`estimated_from_year` を保持する。
- 推定締切は UI 上で `?` と `ESTIMATED` タグを付け、公式締切が公開されたら必ず置き換える。

## 12. Model Strategy

- 通常抽出: `gpt-5-mini`
- 難ケース再判定: `gpt-5`
- 同一JSON Schemaを利用し、再現性を確保する。

## 13. Out of Scope (MVP)

- 常時稼働サーバーやRDB運用
- 複雑な管理画面
- 完全自動100%の保証
