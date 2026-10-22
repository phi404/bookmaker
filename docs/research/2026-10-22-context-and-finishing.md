# 2026-10-22 編集対象と本の仕上げの調査

現在の仕様は[UI](../UI.md)、[組版](../TYPOGRAPHY.md)、[出力](../ARCHITECTURE.md)。これは取得時点の比較記録で、利用者調査や印刷規格の適合判定ではない。

| 一次資料 | 採用した点・限界 |
| --- | --- |
| [Apple Pagesのサイドバー](https://support.apple.com/en-ca/guide/pages/tan0870f78aa/mac) | 文書全体の設定と文脈に応じた書式の入口を分ける。本アプリでは選択だけで作業画面を奪わず、明示編集と対象ピッカーを使う |
| [Adobe InDesign Properties](https://helpx.adobe.com/indesign/using/properties-panel.html) | 文脈に必要な操作を先に出し、追加操作を後から開く。タブ名の置換だけでは対象/共通書式の重複を解けないため、入口を統合する |
| [CSS Fragmentation 3](https://www.w3.org/TR/css-break-3/#widows-orphans) | orphans/widowsの段・ページ間の最少行数と、収まらないときに処理を進める条件。現在の予約容量へ接続し、CSSへページ割り全体を委譲しない |
| [pdf-lib PDFDocument](https://pdf-lib.js.org/docs/api/classes/pdfdocument)、[PDFPage](https://pdf-lib.js.org/docs/api/classes/pdfpage) | embedPage、資源コピー、Formと同じ配置枠を使う。注釈/フォームは画像と一致しないため保持方式で拒否する |
| [HarfBuzzの字形と描画](https://harfbuzz.github.io/glyphs-and-rendering.html)、[harfbuzzjs](https://github.com/harfbuzz/harfbuzzjs)、[fontkit](https://github.com/foliojs/fontkit) | 文字を確定GID/cluster/位置へ変える処理とPDF容器を分ける。文字をdrawTextするだけでは縦字形やルビの共通化にならない |

## 実画面と判断

変更前の本・共通書式・範囲調整を撮影した。「本/書式」と「選択」を同列にする分類の混在、対象名の反復、揃えの折り畳みによる操作の深さを確認した。本/編集の二つと、現在の対象/共通書式の一つの入口を採用した。画像と操作記録はoutput/remaining-2026-10-22/。

## 既存ライブラリの限定比較

公式npmのharfbuzzjs 1.6.3（MIT）と@pdf-lib/fontkit 1.1.1（MIT）を取得し、配布tgzのSHA-512を照合した。既存Noto Serif JPで句読点・括弧、欧文、IVS、不足する文字を縦横に比較した。縦書きのGID置換と位置が必要なことを確認した。試作はoutput/remaining-2026-10-22/shaping-probe/。製品への同梱・共通字形・本文文字PDFは未完了である。

素材PDF保持は既存pdf-libだけで製品へ接続した。原点がずれたCropBox、4方向の回転、UserUnit、透過Group、元文字とCMYK命令を含む合成PDFをアプリへ読み込み、実出力をpypdf/Popplerで独立検査する。これを任意PDFの完全保持・色再現・PDF/Xへ拡張しない。

## Unicode改行の比較と接続

[UAX #14](https://www.unicode.org/reports/tr14/)は改行候補の規則で、字幅・実際の行選択とは分ける。foliojs/linebreak 1.1.0はUnicode13で、現行候補には[@cto.af/linebreak](https://github.com/cto-af/linebreak) 4.0.3のUnicode17規則を採用した。新しいUnicode18との同一性は主張しない。公式[LineBreakTest 17](https://www.unicode.org/Public/17.0.0/ucd/auxiliary/LineBreakTest.txt)の全ケースを独立期待値とし、NBSP/WJ・単語/URL・書式境界・明示区切りを容量制約と共用する。約物詰め・ぶら下がりは字形/メトリクスと合わせて継続する。
