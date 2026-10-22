# 検証結果と証拠の読み方

この文書は証拠の索引と鮮度の読み方を持つ。最新の件数・終了コード・pass/failを手書きで再掲せず、**実行した結果ファイル**を読む。合格条件は [ACCEPTANCE](ACCEPTANCE.md)、操作手順は [HARNESS](HARNESS.md)。

## 最新状態の確認

1. `npm run status` で現在のソース指紋、phase、結果/目視の鮮度を確認する。
2. harness.json（`output/verification/harness.json`） / product.json（`output/verification/product.json`） のstatus、sourceFingerprint、startedAt/finishedAt、工程ごとのcommand/exitCodeを読む。
3. 現在の指紋・phaseと一致するpassだけを現在の合格とする。ファイルがない、古い、途中で失敗した場合はその状態を報告する。
4. 実出力と目視はmanifest / manual-reviewの証拠へ進む。

`npm run status` も最新の実行証拠を表示する入口で、プロダクトを新たに検査したことにはならない。個別検査の成功も全13工程の成功ではない。

## 証拠の所在

| 場所 | 内容 |
| --- | --- |
| `output/verification/` | 最新ゲートの機械可読レポート。再実行で更新される |
| `output/exports/` / `exports-b6/` | A6標準/B6範囲の実ダウンロードとmanifest |
| `output/foundation/` / `book/` / `exceptions/` | 構造・混在・A5例外の実出力、各改修時の報告/画像/目視 |
| `output/editing-refinement/` | 2026-10-13の範囲/書式/構成/自由ページ改修、修正前の失敗、個別の画面差分と基準変更理由、実PNG一括保存、PDF目視、最終報告 |
| `output/ux/` | 原稿中心の改修の変更前後・寸法測定・操作監査 |
| `output/qa/` | 初期/モデル段階の手動画像・PDF描画・ローカル処理レビュー |
| `output/documentation/` | 今回の文書整理、旧版スナップショット、実装不変の比較、検査ログと報告 |
| [manual-review.json](../harness/manual-review.json) | 5目視項目と指紋・証拠・レビュー者・環境 |
| [回帰記録](history/README.md) | 修正前の失敗と原因・検証への接続 |

outputの画像やPDFは生成物で、Gitにすべて含めるものではない。新しいcheckoutに証拠がなければ生成し直す。ファイル名の存在だけで合格としない。要件や文書整合検査の成功と、証拠が揃ったプロダクト合格を分ける。

## 証拠の種類を分ける

モデル/組版テストは文字と構造の不変条件。E2Eは固定Chromiumの操作・保存・ダウンロード。visualは固定環境の画像差分。出力検査は実ファイルの寸法/DPI/全頁対応。目視は読みやすさ・操作・PDFを独立rendererで描画した見え方の確認。

AIによる目視/操作と人間の利用者調査、ブラウザ幅と実機スマホ、アプリ内ブラウザの保存リンクとChromiumの実保存を区別する。画像PDF一致をフォント埋め込みや印刷所の合格へ広げない。

## 履歴

段階ごとの成功や当時の未実装を残した旧QAは [VERIFICATION_HISTORY](history/VERIFICATION_HISTORY.md)。その文中の「現在」「今回」は各段階を指す。現在の機能は [CAPABILITIES](CAPABILITIES.md)、今後の候補は [ROADMAP](ROADMAP.md)。

実行後の報告はoutputに、再利用する契約はdocsに置く。完了したタスクの成功件数を複数の仕様書へ追記して、どれが現在か曖昧にしない。

## 2026-10-21の先行実装の証拠

`output/roadmap-implementation-2026-10-21/` に変更前のファイル/指紋、共通原稿、エンジン/検索の限定比較、保存競合とCRLF位置ずれの修正前失敗、画面確認、最終の検証結果への索引を残す。比較候補は製品依存へ導入していない。限定比較と現在の全体ゲートを混同しない。対象/未達は[実装履歴](history/2026-10-21-roadmap-implementation.md)。

2026-10-21の続く実装の作業記録は `output/roadmap-continuation-2026-10-21/`。前段階の合格を現在の指紋へ流用せず、通常の全体ゲート・画面差分・出力を再実行して判断する。


2026-10-22のリリース前点検はoutput/release-readiness-2026-10-22/。新規作成の保存確認、同梱PDF.js/fflateの更新、axe-coreによる明暗表示の画面検査、Firefox/WebKitの限定した保存・出力検査を含む。実機/読み上げ/人間評価と、字形・高度ルビ・文字/印刷用PDF等の未対応は残る。試用可能と正式リリース可能を分けて判定する。

2026-10-22の続く実装と監査はoutput/remaining-2026-10-22/。編集パネルの変更前後、番号系列・段落分割の再現、制作データの完全性と破損拒否、静的素材PDFの独立描画/構造検査を扱う。全体ゲートと目視はこの変更の指紋で更新する。字形比較の限定結果を文字PDFの実装扱いにしない。


2026-10-22の印刷出力と構成・アイコン改修はoutput/press-2026-10-22/。印刷所の公式条件の比較、変更前後の画面、保存設定・ID衝突・細線の修正前失敗、実際の印刷用PDFと独立解析、表示・全体ゲート・公開の結果を記録する。現在の指紋で確認し、前段階の合格とは区別する。
