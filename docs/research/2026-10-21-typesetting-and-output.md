# 2026-10-21 技術調査：組版・編集・出力の再利用

これは取得時点の調査記録。優先順位と次の作業の正本は [ROADMAP](../ROADMAP.md)、現対応は [CAPABILITIES](../CAPABILITIES.md)。候補の存在、ライブラリ単体の能力、本アプリへの組込み完了を区別する。本文や未公開原稿を外部へ送らず、公開された仕様・公式API・公式リポジトリを調べた。

## 判断

再利用を最初に検討する。PDFの容器、フォント解析・字形形成、Unicode規則、検索用エディター機構、文章診断を一から作らない。製品固有のBook Model、安定ID、継承、Scope、未完draft、構成・保存の往復は維持する。

現行エンジンを無条件に増築することも、既存製品へ無条件に置き換えることも選ばない。まず同じ小さな合成原稿で、現行＋既存部品、Vivliostyle Core、Paged.jsを比較する。縦書き・ルビ・意味的範囲・外部完成ページ・同一紙面からの出力を満たせる案を選ぶ。ライブラリ導入後もBook Modelが正本で、HTML/CSSやエディター状態は投影/生成物とする。

## 参照した標準

| ID | 一次資料 | 借りるもの・限界 |
| --- | --- | --- |
| S-01 | [W3C JLREQ](https://www.w3.org/TR/jlreq/) | 禁則・約物・ルビ・注・見出し・改丁の品質と用語。要件の解説資料であり、アプリの全面準拠を示すものではない |
| S-02 | [Unicode UAX #14](https://www.unicode.org/reports/tr14/) | 改行機会とカスタマイズの区別。字幅計測、最終的な行割り、JLREQ固有の調整をこれだけで解決しない。採用するUnicode版と独立テストデータを固定する |
| S-03 | [CSS Text 3](https://www.w3.org/TR/css-text-3/) | line-break/word-break/overflow-wrap等の意味。2026-08-14版はCandidate Recommendation Draft。書記素分割と改行機会を同一視しない |
| S-04 | [CSS Ruby 1](https://www.w3.org/TR/css-ruby-1/)、[単純ルビ配置規則](https://www.w3.org/TR/simple-ruby/) | 親文字と読みの対応・配置・はみ出しの比較基準。草案の記述を全ブラウザ実装済みとは扱わない |
| S-05 | [WAI-ARIA APG：モーダル](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) | 初期フォーカス、Tabの巡回、Escape、閉じた後の復帰。独自のキーボード操作を増やす前に既存パターンへ合わせる |
| S-06 | [WCAG 2.2：操作対象の大きさ](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | 対象寸法・間隔・例外の検討。単一の寸法チェックをWCAG全体の合格にしない |

## 再利用候補の比較

状態は「調査候補」「同梱済み」「限定実験」の三つ。新しいライブラリはこの作業では導入していない。ライセンス欄は取得時の公式表示の確認であり、組み合わせた配布物の適合判定ではない。導入時に対象バージョン・コミット・配布ファイル・依存物・ライセンス原文・ハッシュを固定する。

| ID / 候補 | 再利用できるもの | 統合で確かめること / 判断 |
| --- | --- | --- |
| L-01 / [Vivliostyle Core](https://github.com/vivliostyle/vivliostyle.js)、[対応CSS](https://docs.vivliostyle.org/ja/reference/supported-css-features/) | HTML/CSSによるページ組版。縦書き、ルビ、柱・番号・脚注等の既存実装を比較できる。公式リポジトリはAGPL-3.0 | 最初のエンジン比較候補。ScopeからCSSへの変換、紙面から安定IDへの対応、外部ページ混在、端末内処理、配布方針を試す。Node/ブラウザの役割と負荷も調べ、PDF出力だけ別エンジンにしない |
| L-02 / [Paged.js](https://github.com/pagedjs/pagedjs)、[利用API](https://pagedjs.org/devdocs/) | ブラウザでのHTML/CSSページ分割と拡張フック。公式表示はMIT | 比較候補。DOMとCSS fragmentationを使うため、現在の純粋Worker層へそのまま差し込めない。縦書き・ルビの品質、字形位置の取得、SVG/PNG/PDFとの共通化を試す。日本語組版への適合を機能名だけで推定しない |
| L-03 / [pdf-lib](https://pdf-lib.js.org/docs/api/classes/pdfdocument)、[PDFPage API](https://pdf-lib.js.org/docs/api/classes/pdfpage) | 同梱済み1.17.1・MIT。ページ埋め込み/コピー、画像、カスタムフォント、ページボックス等のAPIを再利用する | PDF容器の第一候補。今回は合成PDFのページ埋め込み/コピーだけ限定実験した。縦書きの確定GIDとUnicode対応、全文字書体埋め込み、出力プロファイルへの適合は未検証 |
| L-04 / [@pdf-lib/fontkit](https://github.com/Hopding/fontkit)、[fontkit](https://github.com/foliojs/fontkit) | フォント解析、GSUB/GPOS、字幅、字形、サブセット。前者はpdf-lib用forkでMITと記載 | フォントバイナリやサブセット処理を自作しないための候補。両者は同じパッケージではない。CFF/TrueType、縦字形、IVS、合字、埋め込み後の文字抽出を同じfixtureで試す。文字単体のcmap確認だけを欠字判定にしない |
| L-05 / [HarfBuzz](https://harfbuzz.github.io/shaping-and-shape-plans.html)、[harfbuzzjs](https://github.com/harfbuzz/harfbuzzjs) | Unicode列からGID・位置・clusterを得る字形形成。JS/Wasm版の公式リポジトリはMIT | フォント処理の比較候補。縦字形とcluster対応に不足がある場合に評価する。Wasmの同梱、サイズ、Worker、メモリ解放、フォント版の一致を確認。HarfBuzzは本のページ分割やルビ配置を行うエンジンではない |
| L-06 / [PDFKit](https://pdfkit.org/docs/getting_started.html)、[文字API](https://pdfkit.org/docs/text.html) | ブラウザ向けPDF生成、文字/フォント、描画、しおり・リンク等 | pdf-libで必要な字形出力を成立させられない場合の比較先。APIには自動折返し/改ページもあるが、それを使って本を別途ページ分割しない。ブラウザ版依存とライセンス原文は導入試作で固定する |
| L-07 / [CodeMirror 6](https://codemirror.net/docs/ref/)、[システム設計](https://codemirror.net/docs/guide/) | 検索・選択範囲・変更のマッピング・編集トランザクションなどを備えるエディター機構 | 検索/大量原稿/IMEの比較候補。見た目は原稿用の可変幅・折返し・行番号なしを保つ。独立したUndoや正本を増やさないため、既存履歴との接続を先に試す。単純検索だけなら標準APIで足りるかも比較する |
| L-08 / [textlint](https://github.com/textlint/textlint#api) | ブラウザ等向けの@textlint/kernelとプラグイン型のルール。公式表示はMIT | 診断の候補。CLIや辞書全部を既定で読み込まず、選んだルールを遅延処理する。本アプリの限定記法と通常Markdownは異なるため、ASTアダプターか位置を保持した投影が必要。指摘は既存Diagnosticsへ統合し、自動修正を標準にしない |

最新の公式APIの存在は確認したが、候補のパッケージ版をインストールして互換性を試したわけではない。互換性・保守状態・依存の脆弱性・配布サイズは、候補を絞った試作時にあらためて評価する。

## 日本語組版を再発明しない境界

標準から「改行を許す位置」を得る処理と、実フォントでの字形/字幅、行内の約物調整、ルビ、段・ページ分割を分ける。今の禁止文字集合へ場当たり的に文字を足して全体を作り直さない。

エンジン比較は、(1)同じASTから生成、(2)同じフォント、(3)同じ判型・余白・段、(4)原文とルビの対応、(5)長文の初回/局所修正/全体書式変更、(6)同じ確定ページからのプレビューと出力、で行う。期待値はJLREQ等に基づく独立例を用い、他エンジンの出力を無条件の正解にはしない。

比較先が有利なら、モデルから組版へのアダプターを試作する。現行方式を残すなら、既存部品で解けない差と、残す独自処理の範囲を記録する。新しい方式の成立前に現行経路を削除したり、出力だけ別の改ページへ逃がしたりしない。

## PDFと印刷の段階

| 段階 | 再利用するもの | 別途必要な検証 |
| --- | --- | --- |
| 閲覧用の画像PDF | 現在のpdf-libと共通SVG。しおり/内部リンクの追加は文字PDFとは独立に検討できる | 抜粋範囲・最終ページ番号・参照先・キャンセルとrevision |
| 文字/ベクトルPDF | PDF容器、フォント解析・サブセット・字形形成の既存部品 | 共通GlyphRun/確定座標、縦字形、ToUnicode等の文字対応、抽出順、埋め込み、独立rendererとの比較 |
| 外部PDFの保持 | pdf-libのページ/Form XObject取り込み | CropBox/TrimBox/MediaBox、回転、拡大縮小、透明、色空間・ICC/OutputIntent、フォント資源、注釈/動作の扱い。PDF.jsはプレビュー用のまま利用できる |
| 印刷向けプロファイル | 定めた対象条件と既存PDF生成部品、独立した解析・プリフライト | 塗り足し、仕上がり、ページボックス、色、総インキ量、文字・画像、対象印刷条件。プロフィール名やメタデータの追加だけでは成立しない |
| PDF/Xの適合 | 選んだPDF/X版と対象条件を検査できる既存検証器 | 構造チェック、自動fixなしの適合検査、結果の保存、必要な入稿先確認を分ける。自作検査だけを第三者適合確認と呼ばない |

印刷に関する参照：

- S-07：[PDF Association：PDF/Xの技術要件](https://pdfa.org/technical-side-and-requirements-of-pdfx/)、[利用分野と色空間](https://pdfa.org/pdfx-usersindustry-segments/)。PDF/X-4は透明や色管理されたRGB等を扱える。PDF/Xを「すべてCMYK」「RGBだから不可」という単一条件へ還元しない。実際の出力条件と選んだ版を確かめる。
- S-08：[Adobe：PDF/X等の検証](https://helpx.adobe.com/acrobat/using/pdf-x-pdf-a-pdf.html)、[プリフライトプロファイル](https://helpx.adobe.com/acrobat/using/preflight-profiles-acrobat-pro.html)。検証と修正・変換は別に扱い、勝手に直して検査を通さない。Acrobatでの実検査はこの調査では未実施。
- S-09：[veraPDFの検証範囲](https://docs.verapdf.org/validation/)。PDF/A・PDF/UA等の検証であり、PDF/Xの検証器として採用しない。PDF/AとPDF/Xの用途を混同しない。

## 同梱pdf-libで行った限定実験

追加依存なしで、英字テキスト・CMYKの矩形・CropBox/TrimBoxを持つ1ページの合成PDFを作った。embedPdfによるForm XObjectへの取り込みと、copyPagesによるコピーを別々に実行し、pypdfで内容とボックスを解析した。

- 取り込み後にも文字抽出ができ、画像XObjectは0、Formが1、CMYKの描画演算子が残ることを確認した。PDF素材を常に全ページ画像へ変換する必要はない、という限定した根拠になる。
- copyPagesでは今回のCropBox/TrimBoxが残った。一方、embedPdfで配置した新ページのボックスは新ページ側のものになる。ページ埋め込みを呼ぶだけで、仕上がり寸法や切り抜きがプレビューと自動一致するわけではない。
- 日本語、縦字形、書体埋め込み、ICC/OutputIntent、任意の外部PDF、視覚的一致、PDF/X適合、本アプリへの組込みは未検証。CMYK演算子の存在は色再現の合格ではない。

再現スクリプト、生成PDF、独立解析結果、環境・終了コードは output/roadmap-research-2026-10-21/ に置く。これは技術実験であり、アプリの実出力manifestや完了証拠ではない。アプリ本体と配布依存は変更していない。

## Kolophonから得た示唆の扱い

[Kolophon README](https://github.com/0tsu-0w0/book-production-tool/blob/main/README.md)との比較は、仕上げ・注・素材・再利用・PDFの不足を見つける入口になった。機能表は実装/速度/入稿品質を保証しない。Mac・TeX周辺・EPUB書体に記述の食い違いがあること、PDF/Xは独自検査の範囲であることを、比較時に区別した。

この調査ではKolophonのコードや素材を流用していない。今後コードを利用するなら対象箇所・版・ライセンス・テスト・帰属を確認する。性能の数値をこちらの目標や合格基準へそのまま転記しない。

## 次の試作で残す記録

候補の版/ライセンスと由来、ネットワークなしでの実行、バンドル/Worker/メモリ、同一の合成fixtureと失敗例、できたこと/できないこと、独立した出力解析、採用・保留・不採用の理由を記録する。比較で足りない証拠を示し、調査で得た候補を「導入済み」へ書き換えない。
