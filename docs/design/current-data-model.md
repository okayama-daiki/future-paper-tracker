# Current Data Model

この文書は、`data/conferences.json` の現状の構造と、設計上すでに見えている混線を整理するためのメモです。

これは「最終設計」ではなく、現時点の実装を説明するためのドキュメントです。  
次の PR で、series / edition / recurring meeting の整理を見直す前提です。

## 1. 現在の基本構造

現在の型定義は次の 3 層です。

- `ConferenceSeriesRecord`
- `EditionRecord`
- `EventRecord`

対応する型:

- [src/types/conferences.ts](/Users/daikiokayama/workspace/future-paper-tracker/src/types/conferences.ts)

概念上の責務:

- `Series`
  - 例: `AAAC`
  - 年次をまたいで続く会議シリーズ
- `Edition`
  - 例: `AAAC 2026`
  - ある年の開催単位
- `Event`
  - 例: `full_paper_submission_deadline`, `conference`, `notification`
  - 締切や会期などの時点情報

## 2. 現在の JSON フォーマット

トップレベル:

- `generated_at`
- `mode`
- `conferences`
- `pending_conference_keys`

各 `conferences[]`:

- `conference_key`
  - UI と運用で使うキー
- `conference_name`
  - 現在は「series name」として使っている
- `series_official_url`
  - 現在は「series の代表 URL」という意図
- `editions[]`

各 `editions[]`:

- `year`
- `official_site`
  - その edition の公式ページ
- `cfp_published`
- `venue`
  - edition 単位の開催地・会場
- `venue_source_url`
- `events[]`

各 `events[]`:

- `event_type`
- `start_at_utc`
- `end_at_utc`
- `source_url`
- `estimated`
- `estimated_from_year`

## 3. 現在の解釈ルール

- 時刻は UTC 保存
- イベントごとに `source_url` を保持
- 一覧に出す主要締切は以下の優先順で選ぶ
  1. `full_paper_submission_deadline`
  2. `submission_deadline`
  3. `abstract_submission_deadline`
- 未来 edition に公式締切がない場合は、直近 edition から推定締切を作る
- 表示順・処理順は `data/conferences.json` の並びをそのまま使う

## 4. 現状で混線している点

### 4.1 `conference_key` が strict な series key ではない

現在は `conference_key` を canonical な series key として使いたい一方で、実データでは subseries を独立 series のように持っています。

例:

- `ORSJ-spring`
- `ORSJ-autumn`
- `LA-summer`
- `LA-winter`

これは実装上は便利ですが、厳密には

- ORSJ
  - spring edition
  - autumn edition

のような構造とも解釈できます。

つまり、現在の `conference_key` は「厳密なシリーズ識別子」ではなく、**一覧表示・運用上の単位キー** と見る方が実態に近いです。

### 4.2 `series_official_url` が strict な series URL ではないものがある

理想的には `series_official_url` は「そのシリーズ全体を表す安定した URL」であるべきです。  
しかし現状は、series index が見つからないケースで edition ページに近い URL を置いているものがあります。

例:

- `SODA`
- `ACDA`
- `SWAT`
- `COSS`

したがって現状の `series_official_url` は、**厳密な series landing page ではなく、best-effort の代表 URL** と解釈する必要があります。

### 4.3 annual edition モデルにうまく乗らない対象がある

以下は「毎年 1 回の conference edition」より、「継続的な研究会・複数回開催」に近いです。

- `SIGAL`
- `COMP`

この 2 つは今の `Series -> Edition(year) -> Event` で完全には表現しにくいです。

具体的な問題:

- 年内に複数回の開催がありうる
- venue を edition に 1 つだけ置くと不正確になる
- `conference` event が単一の年次会議を指さない場合がある

現状では、これらも同じ JSON 構造に入れていますが、**モデルとしては無理がある** ことを前提に扱います。

### 4.4 `conference_name` は実質的に series name

現在の `conference_name` は、名前からは edition 名にも見えますが、実際には series / subseries の表示名として使っています。

したがって意味としては、将来的には次のように整理した方が自然です。

- `series_name`
- `edition_display_name`

ただし、現時点ではまだ分けていません。

## 5. 現状の暫定運用

次の PR で設計を見直すまで、以下の前提で扱います。

- `conference_key`
  - strict canonical key ではなく、UI と更新運用の単位キー
- `conference_name`
  - series または subseries の表示名
- `series_official_url`
  - strict なシリーズ index ではなく、代表 URL のことがある
- `official_site`
  - 各 edition のページ
- `venue`
  - edition 単位で表現できる場合のみ保持
- `SIGAL`, `COMP`
  - 現モデルに仮置きしている対象

## 6. 次の PR で見直す論点

- `series` と `subseries` を分けるか
- `conference_key` を canonical key と display key に分割するか
- `series_official_url` と `series_index_url` を JSON 上でも明示的に分けるか
- `SIGAL`, `COMP` のような recurring meeting を別モデルにするか
- `venue` を edition 単位だけでなく event 単位にも持たせるか
- `conference_name` を `series_name` に改名するか

## 7. 現時点で壊してはいけない前提

再設計前でも、次は維持する必要があります。

- `source_url` は event 単位で必須
- UTC 保存
- `data/conferences.json` の並び順に意味がある
- 公式ページ優先
- 推定締切は `estimated` / `estimated_from_year` で明示する
