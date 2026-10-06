# 学会の追加候補

確認日：2026-10-06。公式サイトの対象分野を参考に、研究室の4分類から追加候補を整理した。今回は IWOCA・LATIN・IJCAI・ICAPS・CP を登録し、全51シリーズとなった。登録日程と推定の根拠は[追加記録](data/2026-10-06-added-conferences.md)を参照。

## 今回登録したシリーズ

| シリーズ | ジャンル                      | 登録内容                                                 |
| -------- | ----------------------------- | -------------------------------------------------------- |
| IWOCA    | Algorithms & Theory           | 2026・2027年の公式日程・締切                             |
| LATIN    | Algorithms & Theory           | 2026年の公式日程・締切、隔年開催に合わせた2028年の次回枠 |
| IJCAI    | OR / AI                       | 2027年の京都での本会議・公開締切                         |
| ICAPS    | OR / AI                       | 2027年の公式日程・締切                                   |
| CP       | Algorithms & Theory / OR / AI | 2026年の公式情報、2027年の公開開催日と推定締切           |

## 未登録の優先候補

| 会議   | 分類案                                       | 追加する理由・公式情報                                                                                                           |
| ------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| GD     | Computational Geometry / Algorithms & Theory | グラフ描画の幾何的表現と組合せ・アルゴリズム的側面を扱う。[GD 2026 CFP](https://graphdrawing.github.io/gd2026/pages/cfp/)        |
| COCOON | Algorithms & Theory                          | 計算と組合せを扱う会議。既存 TODO にも挙がっている。[COCOON 2026 CFP](https://event.ntu.edu.sg/cocoon2026/pages/call-for-papers) |
| WADS   | Algorithms & Theory / Computational Geometry | アルゴリズムとデータ構造が中心。計算幾何も対象で、登録済みの SWAT と交互に開催する。[WADS 公式](https://www.wads.org/)           |
| STACS  | Algorithms & Theory                          | アルゴリズム、計算量、理論計算機科学を補う。[STACS 公式](https://stacs.irif.fr/)                                                 |
| MFCS   | Algorithms & Theory                          | 理論計算機科学の各分野を扱う。[MFCS 2026](https://mfcs2026.irif.fr/)                                                             |
| SSS    | Distributed Computing / Algorithms & Theory  | 自己安定化、耐故障性、局所性など、分散アルゴリズムとの関連が強い。[SSS 2026](https://sss2026.conf.lip6.fr/)                      |
| ICDCN  | Distributed Computing                        | 分散計算とネットワークを扱う。[ICDCN 2027](https://cs3-lab.github.io/icdcn/index.html)                                           |
| ISCO   | OR / AI / Algorithms & Theory                | 組合せ最適化、整数計画、グラフ・ネットワークアルゴリズムなどを扱う。[ISCO 2026](https://isco2026.com.tr/)                        |

## 対象範囲に応じて追加する候補

| 会議                                  | 分類案                                       | 位置づけ・公式情報                                                                                                                                                                                                                                                              |
| ------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| EuroCG                                | Computational Geometry / Algorithms & Theory | 計算幾何の年次ワークショップ。ワークショップも追跡対象に含める場合の有力候補。[EuroCG 公式](https://www.eurocg.org/)                                                                                                                                                            |
| IPDPS                                 | Distributed Computing / Algorithms & Theory  | 並列・分散処理のアルゴリズムに加えて、HPC のシステムや実装も扱う。[IPDPS 2027 CFP](https://www.ipdps.org/ipdps2027/2027-call-for-papers.html)                                                                                                                                   |
| ICDCS                                 | Distributed Computing                        | 分散コンピューティングシステムまで範囲を広げる場合の候補。[ICDCS 2027](https://icdcs2027.icdcs.org/)                                                                                                                                                                            |
| SIAM Conference on Optimization（OP） | OR / AI                                      | 連続最適化などを含めた最適化全般を補う。SIOPT は雑誌名なので、会議の識別には OP を使う。[OP26](https://www.siam.org/conferences-events/past-event-archive/op26/)・[SIAM Optimization](https://www.siam.org/get-involved/connect-with-a-community/activity-groups/optimization/) |

## データ登録時に確認すること

- 次回開催の公式ページと CFP を確認し、Abstract・Full Paper などを区別して登録する。
- 過去の開催回しか確認できないシリーズは、過去の日程を次回の確定日として転用しない。推定する場合は既存の推定ルールに従う。
- 年次会議・隔年会議・3年ごとの会議を区別する。IWOCA は年次、LATIN は隔年、WADS は SWAT と交互、SIAM OP は3年ごとの会議。
- IWOCA 2027 は公式トップページの具体的な公開日程を採用した。CFP に残る TBA の記載を含め、今後の更新でも公式ページを再確認する。[トップページ](https://kam.mff.cuni.cz/conferences/iwoca27/)・[CFP](https://kam.mff.cuni.cz/conferences/iwoca27/cfp.html)
- 種別・時刻・タイムゾーンを公式 CFP で確認する。IPDPS 2027 の Full Paper 締切は2026-10-08 AoE だが、必須の Abstract 登録は2026-10-01に終了しているため、Full Paper の日付だけで新規投稿できると判断しない。[IPDPS 2027 CFP](https://www.ipdps.org/ipdps2027/2027-call-for-papers.html)
- `config/conferences.csv`、`config/conference-sources.json`、`data/conferences.json` と表示側の `SERIES_GENRES` に反映し、既存のデータ検証とフィルタのチェックを行う。
