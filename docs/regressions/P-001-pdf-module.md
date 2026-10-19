# P-001: PDFライブラリの読み込み形式

- 関連要件: PNG/PDFの実出力、ローカルファースト。
- 発見日 / 環境: 2026-10-01、Windows、Node 24.19.0、Chromium 153。
- 再現: `fixtures/basic.txt`、標準、1440×1000。PNGの後にPDFを書き出す。
- 修正前: `npm run test:e2e` の `@flow actual PNG/PDF exports and page count` が失敗。画面に「PDFライブラリを読み込めません。」が出て、PDFのダウンロードが発生しなかった。
- 原因: コピーしたpdf-lib 1.17.1はES Module版だった。通常のscriptとグローバルPDFLibを期待した読込処理と形式が一致していなかった。
- 修正: 配布ファイルをES Moduleとして動的importする。型定義は利用するAPIの境界に限定し、実ファイルのAPIをNodeテストでも確認する。
- 検出: 既存の実PNG/PDF E2Eを維持する。`tests/product/io.test.mjs` で同梱モジュールの画像XObject・A6 PDFを検証する。
- 修正後の結果と視覚確認: `docs/QA.md` に記録する。
