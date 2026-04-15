# auto-fetch

学会情報（締切・開催日・Call for Papers）を自動取得して `conferences.json` を更新する CLI ツール。

## 概要

`config/conferences.csv` に登録された学会シリーズを定期的にチェックし、以下を自動で行う。

1. **Estimated 生成** — 過去の開催パターンから次回開催日・締切を推定
2. **Web 検索・クロール** — tiny-serp で公式情報を検索し HTML を取得
3. **LLM 抽出** — 取得したページから構造化データを抽出
4. **マージ** — 既存データを冪等に更新（確定済みデータのダウングレードは行わない）
5. **PR 作成** — 変更を Git ブランチにコミットし、confidence スコアに応じて自動マージまたは PR を作成

## セットアップ

```sh
# リポジトリルートで依存インストール
vp install

# 環境変数を設定（.env ファイルまたはシェル）
export TINY_SERP_API_URL=http://your-tiny-serp-endpoint
export LLM_PROVIDER=ollama          # ollama | anthropic | openai
export LLM_MODEL=llama3.2           # 使用するモデル名
export LLM_BASE_URL=http://localhost:11434  # Ollama の場合（省略可）
export LLM_API_KEY=                 # Anthropic / OpenAI の場合
export AUTO_MERGE_THRESHOLD=1.0     # 自動マージ閾値（省略時 1.0 = 全件 PR）
export GITHUB_TOKEN=                # PR 作成に必要（GitHub Actions では自動設定）
```

## 実行

リポジトリルートから実行する。

```sh
# 全シリーズを処理（実際に PR を作成する）
vp run auto-fetch

# dry-run: ファイル書き込み・PR 作成なしで変更内容だけ確認
vp run auto-fetch -- --dry-run

# 特定シリーズのみ処理
vp run auto-fetch -- --series PODC

# 検索・クロール・LLM をスキップ（推定生成のみ）
vp run auto-fetch -- --dry-run --skip-search

# dry-run + 特定シリーズ（動作確認に便利）
vp run auto-fetch -- --dry-run --series PODC
```

`tools/auto-fetch` ディレクトリから直接実行することもできる。

```sh
cd tools/auto-fetch
vp exec tsx src/cli.ts --dry-run --series PODC
```

## LLM プロバイダー

| `LLM_PROVIDER` | 必要な環境変数                                                                      | 備考                                           |
| -------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------- |
| `ollama`       | `LLM_MODEL`（省略時 `llama3.2`）、`LLM_BASE_URL`（省略時 `http://localhost:11434`） | ローカル LLM。Ollama の OpenAI 互換 API を使用 |
| `anthropic`    | `LLM_API_KEY`、`LLM_MODEL`（省略時 `claude-haiku-4-5-20251001`）                    | Anthropic Claude API                           |
| `openai`       | `LLM_API_KEY`、`LLM_MODEL`（省略時 `gpt-4o-mini`）、`LLM_BASE_URL`（省略可）        | OpenAI API                                     |
| 未設定         | —                                                                                   | LLM 抽出をスキップ（推定生成のみ動作）         |

### Ollama を使う場合

[Ollama](https://ollama.com) をインストールしてモデルを pull しておく。

```sh
ollama pull llama3.2
```

## CLI オプション

```
Usage: auto-fetch [options]

Options:
  --dry-run           変更を計算するが、ファイル書き込み・PR 作成は行わない
  --series <id>       指定したシリーズのみ処理する（例: PODC、STOC）
  --skip-search       検索・クロール・LLM をスキップし、推定生成のみ実行
  --threshold <n>     AUTO_MERGE_THRESHOLD を上書き（0.0–1.0）
  --data-file <path>  conferences.json のパスを指定
  --csv-file <path>   conferences.csv のパスを指定
  -h, --help          ヘルプを表示
```

## Confidence スコアと PR / 自動マージ

AI の抽出結果には 0.0〜1.0 の confidence スコアが付く。

| スコア                    | 動作                        |
| ------------------------- | --------------------------- |
| `>= AUTO_MERGE_THRESHOLD` | main に自動マージ           |
| `< AUTO_MERGE_THRESHOLD`  | PR を作成して人間がレビュー |

初期設定では `AUTO_MERGE_THRESHOLD=1.0`（すべて PR 経由）。AI の精度が確認できたら閾値を下げることで段階的に自動化できる。

## 学会データのライフサイクル

各学会シリーズは以下の状態を遷移する。状態は `conferences.json` 内の Milestone の `is_estimated` フラグから導出され、JSON に明示的なカラムとしては持たない。

```
未登録 → estimated（推定済み）→ partial（一部確定）→ confirmed（確定）→ archived（完了）
```

| 状態      | auto-fetch の動作                                                                                        |
| --------- | -------------------------------------------------------------------------------------------------------- |
| 未登録    | 過去パターンから estimated Conference + Milestone を生成。過去データなしの場合は公式サイトを直接クロール |
| estimated | 公式情報を検索・クロールし、確定情報に更新                                                               |
| partial   | 未確定の Milestone のみ検索・更新                                                                        |
| confirmed | 何もしない                                                                                               |
| archived  | 何もしない                                                                                               |
