# P-014 配下URLの静的素材参照

2026-10-13。GitHub Pages配置前の修正履歴。

## 再現

生成済みdistを/bookmaker/だけで配信する独立サーバーをfixtureとし、画面操作検査を先に追加した。修正前は/app.css、/workspace.css、/ui/main.jsが404になった。実際の失敗画面・context・traceをoutput/deployment/before/project-prefixへ保存。

HTML/CSSを修正した後も、新しく書いたモジュール基準のパスを一段深く指定したため、PNG一括で「本文フォントを読み込めません。」となった。失敗画面をbefore/export-prefixへ保存し、配布済みio/*.jsから一段上のfont/vendorへ解決するよう修正した。

## 修正と検査

HTML/CSSの相対参照、io/resourcesの共有URL、静的な同梱ライブラリimportへ整理。明示したIO依存だけを境界検査へ登録し、未知/計算された依存や純粋層の通信は引き続き拒否する。

E2Eはフォント・組版Worker・PDF.js Worker、PDF素材の挿入、PNG ZIP/PDFの実ダウンロード、再読み込み後の保存保持と外部通信なしを確認する。サーバー検査はHEAD/301/405/不正パス/配下だけの配信を検査する。通常の操作・0画素画像比較・全18ページの出力解析も残す。

現行配置契約は[DEPLOYMENT](../DEPLOYMENT.md)、合格条件は[ACCEPTANCE](../ACCEPTANCE.md)。この再現記録を現在の合格結果へ読み替えない。
