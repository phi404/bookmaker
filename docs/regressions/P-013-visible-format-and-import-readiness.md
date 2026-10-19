# P-013 原稿に見える書式と取り込みの準備状態

2026-10-13の編集/構成UX改修での再現と修正の記録。現行の契約はUI / SOURCE_FORMAT / PUBLISHING_MODEL。

## 再現

- GUIで中央揃えと前空きを指定しても、旧投影は本文しか書き出さず、原稿で書式を確認/解除できなかった。
- 範囲囲みと改丁が構造として認識されず、範囲2段落が0段落、改丁後の3ページが1ページになった。
- 不明なスタイルIDを原稿から指定すると、復元できない確定モデルを自動保存できた。
- DOCX取り込み直後に、前の空紙面のrevisionが準備済みのまま評価され、新しい原稿のページ数が1と読み取られた。失敗画像には組版中と新原稿、旧1ページが同時に写る。

## 修正前の証拠

`output/editing-refinement/before/red-tests.txt`、`reference-red-test.txt`、`import-race/before.png`、`import-race/error-context.md`。

`node --test tests/product/editing-refinement.test.mjs` は最初4失敗、参照検査の追加時は5成功1失敗。取り込みの重点ブラウザ検査は9成功1失敗。終了コードはいずれも1。閾値・テスト数・時間制限を緩めていない。

## 修正

1. GUIと原稿の局所指定をlocalStyleへ統一し、format/section囲みから同じ属性を投影/復元する。囲み削除時に以前のGUI値を補わない。
2. 本文の同一性と書式の一致を別に検査し、書式変更時もIDを保つ。閉じ忘れ・数値エラーはsourceDraftで保護する。
3. 原稿編集とJSON復元で同じ参照検査を使い、不明な書式IDを確定しない。
4. 取り込み開始時に準備済みを解除し、最後の読み込みだけを適用する。処理中の編集を上書きせず、失敗時は以前の状態へ戻る。

## 回帰

`tests/product/editing-refinement.test.mjs`、`tests/e2e/editing-refinement.spec.mjs`、`page-controls.spec.mjs`のDOCX/Markdown/JSON。前後の文書ID、ルビ、本文、範囲書式、未知参照の保護、改丁の白ページ、同じカタログの見出し書式、Undo/復元、全ページPNGを確かめる。

現在の実行結果と指紋はoutputへ残す。新しいソース指紋へ過去の成功を流用しない。
