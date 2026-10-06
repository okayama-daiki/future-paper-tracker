# 0003 Conference Genres

## Context

学会を研究分野で横断的に絞り込めるようにする。既存の締切一覧の列構成と、締切の期間・種別による絞り込みを維持する。

## Decision Log

- 学会シリーズごとに複数のジャンルを設定する。年や締切種別ごとに分類を重複管理しない。
- 表示名とシリーズへの割り当ては `apps/website/src/genres.ts` で管理する。
- 研究室の分野に合わせ、Computational Geometry、Distributed Computing、Algorithms & Theory、OR / AI の4分類とする。
- ジャンルは表示用の手動分類とする。公式の対象分野を参考に、研究室で探す際に関連する会議を複数ジャンルに所属させる。
- 既存の「フィルタ」にジャンルを追加する。初期状態では全ジャンルにチェックを入れ、複数選択は選んだジャンルのいずれかに一致する学会を表示する。「すべて選択」で全ジャンルにチェックを入れ、「すべて解除」ですべてのチェックを外す。選択なしの場合は学会を表示しない。
- ジャンル数や選択内容の要約は表示しない。種別にも全選択・全解除を用意し、「投稿の締切のみ」のボタンは表示しない。
- ジャンル、締切の期間、締切の種別は同時に適用する。ジャンルを切り替えても既存の条件はリセットしない。
- 分類がまだ登録されていない新しいシリーズは「未分類」に含める。全ジャンル表示からは消えない。
- 締切データとは別に管理し、週次のデータ更新でも分類が維持されるようにする。

分野が名称だけでは明確でないシリーズについては、公式の説明も確認した。

| ジャンル               | 対象                                                       | 例                                |
| ---------------------- | ---------------------------------------------------------- | --------------------------------- |
| Computational Geometry | 計算幾何、幾何アルゴリズム                                 | SoCG、CCCG、JCDCGGG               |
| Distributed Computing  | 分散・並列アルゴリズム、分散計算                           | PODC、DISC、SPAA、SIROCCO、OPODIS |
| Algorithms & Theory    | 組合せアルゴリズム、計算理論、代数的アルゴリズム           | STOC、FOCS、SODA、ISSAC           |
| OR / AI                | 数理最適化、オペレーションズ・リサーチ、制約充足、人工知能 | IPCO、ISMP、CPAIOR、AAAI          |

- ISSAC は数式処理・計算機代数を対象とし、代数的アルゴリズムや計算量も扱うため Algorithms & Theory に含める。[ISSAC 2026](https://www.issac-conference.org/2026/)
- FIT は計算幾何・分散アルゴリズム・計算理論・人工知能などを扱うため、4分類すべてに含める。「情報科学全般」という独立した分類は置かない。[FIT 2026 分野詳細](https://www.ipsj.or.jp/event/fit/fit2026/field_details.html)
- JSIAM は数論アルゴリズムと連続最適化を扱うセッションがあるため Algorithms & Theory と OR / AI に含める。[JSIAM 2026 年会](https://jsiam.org/jsiam_archive/past_meetings/annual2026/)
- [LAシンポジウムの紹介](https://la-symposium.github.io/index.html)
- [最適化の理論とアルゴリズム研究部会](https://orsj.org/raota/)
- [コンピュテーション研究会](https://www.ieice.org/~comp/)

## Consequences

- 分類を変更するときは `SERIES_GENRES` を編集する。ジャンルの追加は `GenreId` と `GENRE_LABELS` にも反映する。
- 新しいジャンルが自動で「フィルタ」に表示され、分類未登録の学会も見つけられる。
- ジャンル・種別の選択は `fpt_filters` Cookie に保存して再表示時に復元する。全解除した状態も保存する。保存期限は1年とする。
- Cookie の保存形式は version 2 とする。旧 version 1 の最適化・人工知能は OR / AI、数式処理は Algorithms & Theory、応用数理は Algorithms & Theory と OR / AI、情報科学全般は全ジャンルに移行する。締切種別の選択と全解除した状態は維持する。
- Cookie が未保存、無効、または利用できない場合は、ジャンルは全選択、種別は Abstract・Full Paper・Submission を初期値とする。Cookie の利用制限があってもページ内のフィルタは利用できる。
- HTTPS では `SameSite=None; Secure; Partitioned` を指定し、埋め込み先ごとの選択を保存する。ブラウザが Cookie を禁止している場合や、埋め込みでの保存に対応していない場合は再表示時の復元はできない。[Partitioned cookies の仕様説明](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies/Partitioned_cookies)
