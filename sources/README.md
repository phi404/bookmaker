# 使用フォント・ライブラリと出典

同梱物の版、ライセンス、ハッシュと取得元を記録する。実行時は同じサイトの配布物を使い、外部CDNを参照しない。対応範囲は [CAPABILITIES](../docs/CAPABILITIES.md)、静的配布は [DEPLOYMENT](../docs/DEPLOYMENT.md)。

## フォント・PDFの配布物

`../組版/bunko` のREADME、package.json、型宣言、既存の組版テストと出力検証スクリプトを読んだ。記法や既知の境界条件の参考にしたが、新しいリポジトリの実装・合格証拠にコピーしていない。

初回の同梱配布物は以下の通り。組版と描画の実装・検証は現行のコードを対象にする。

| 保存先 | SHA-256 | ライセンス |
| --- | --- | --- |
| `public/fonts/NotoSerifJP-Regular.otf` | `2c9a12dbd4f2408c4610c7ee84a108b62d7236c3775baed618c64d9cb44b2f04` | SIL Open Font License 1.1 |
| `public/fonts/OFL.txt` | `6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2` | フォントの同梱ライセンス原文 |
| `public/vendor/pdf-lib.js` | `72c052d97b4d5d9fa6cdbdcb7ad709f03d4ddb1122390cb3afeba4d88651d969` | pdf-lib 1.17.1 ES Module、MIT。配布ファイル内にも著作権記載あり |

pdf-libのライセンス原文も `public/vendor/pdf-lib.LICENSE.md` に同梱した。フォントのバイナリ自体は変更していない。CSSのBook Minchoは参照名であり内部フォント名の改変ではない。ブラウザから読むURLはすべて同じオリジン。元の配布版を更新する場合はライセンスとハッシュを再確認する。

## 外部の一次資料

- [W3C JLREQ](https://www.w3.org/TR/jlreq/)：組版品質の参照。MVP完全準拠を示すものではない。
- [Playwright 視覚比較](https://playwright.dev/docs/test-snapshots)：同じ実行環境を使う画像回帰検証。
- [TypeScript noEmit](https://www.typescriptlang.org/tsconfig/noEmit.html)：コード生成と分けた型検査。
- npm公式レジストリで開発依存のバージョンを確認し、`package-lock.json` で固定。TypeScriptは境界検査に安定Compiler APIを使うため6系を選定。フレームワークの採用は保留。
- [Noto CJK Serif OFL](https://github.com/notofonts/noto-cjk/blob/main/Serif/LICENSE)：フォントの再配布・文書への利用条件。配布物には同梱OFLを保持する。
- [pdf-lib PDFDocument API](https://pdf-lib.js.org/docs/api/classes/pdfdocument)：PDF容器と画像の扱い。初回はフォント埋め込みの検証済みとは扱わない。

派生した決定は [../docs/DECISIONS.md](../docs/DECISIONS.md) に記録する。

## ZIP・DOCXの配布物と一次資料

fflate 0.8.3を公式npmレジストリの配布tgzから取得。`esm/browser.js` をローカル同梱し、MITライセンスを保持した。実行時にCDNへ接続しない。

- `public/vendor/fflate.js` SHA-256: `b7ca4450b19559a1d50eb381adcee94b82449674be4cd17789d9beba7e6122a1`
- `public/vendor/fflate.LICENSE.md` SHA-256: `0a1df3a083d0c010560aa342e87959c8c1070e6fd54545741f083f22d0c8b551`
- [fflate 0.8.3の公式README](https://github.com/101arrowz/fflate/blob/v0.8.3/README.md)：ZIPの包装と選択展開API。
- [Microsoft WordprocessingMLの構造](https://learn.microsoft.com/en-us/office/open-xml/word/structure-of-a-wordprocessingml-document)：本文の段落・run・文字の抽出。
- DOCX例は [generate-import-fixtures.mjs](../scripts/generate-import-fixtures.mjs) で自作し、他者の原稿をサンプルとして取り込んでいない。

## PDF素材用の配布物 — 2026-10-03

PDF.js 6.4.299 / Apache-2.0をMozillaの公式npm配布pdfjs-distから取得し、API / Worker / cmaps / standard_fonts / wasm / iccsとLICENSEを固定した。初回の5.6.205はCodex同梱ランタイム由来だったが、2026-10-22の点検で公式の修正版へ更新した。npm配布のintegrityを照合し、実行時CDNは使わない。

- `pdf.mjs` SHA-256: `dd13af821c9c3e1778653340d6539a1ba07bc56cba40073a4c727864cf0c232a`
- `pdf.worker.mjs` SHA-256: `07ceb740d746e5d9012fcf9f27d5c7dea09f7d2f5e74f5c8109e5787551a2333`
- `LICENSE` SHA-256: `0d542e0c8804e39aa7f37eb00da5a762149dc682d7829451287e11b938e94594`
- [Mozilla公式の導入説明](https://mozilla.github.io/pdf.js/getting_started/?lang=en) と [PDF.js API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html) を確認。ローカルworker、CMap、標準フォント、wasm等の参照を明示する。

素材テスト用の画像と2ページPDFはこのリポジトリのテストで生成した汎用図形・文字のみ。設計画像生成には公開用の汎用サンプルを使い、未公開原稿は渡していない。

## Context7で確認したCSS一次資料 — 2026-10-03

MDN ContentのライブラリIDを解決し、縦書き文字方向/縦中横とCSS fragmentationを取得した。照会は一般的なCSS仕様だけで、ユーザーの原稿やソースコードは渡していない。実行時のサービス依存は追加していない。

- [text-orientation](https://github.com/mdn/content/blob/main/files/en-us/web/css/reference/properties/text-orientation/index.md)：縦書きでのmixed/upright/sideways。
- [text-combine-upright](https://github.com/mdn/content/blob/main/files/en-us/web/css/reference/properties/text-combine-upright/index.md)：文字群を1em内へ合成。
- [CSS fragmentation](https://github.com/mdn/content/blob/main/files/en-us/web/css/guides/fragmentation/index.md)、[break-inside](https://github.com/mdn/content/blob/main/files/en-us/web/css/reference/properties/break-inside/index.md)：ページ/段の分割制御。

同じ生成ページを出力まで共有するため、ブラウザの字形機能と独自ページ配列を組み合わせるのは本プロジェクトの設計判断。これらの文書が本アプリの出力品質を保証するという主張ではない。

## GUIアイコン — 2026-10-12

Lucide Static 1.55.0を公式npmレジストリから取得し、必要な静的SVGだけを `public/vendor/lucide/` に同梱した。配布物のLICENSE（ISCおよびFeather由来のMIT）を原文のまま保持する。実行時CDN・外部フォント・アイコン用JavaScriptは追加していない。UIの線アイコンとして使い、本文描画には使わない。

- [Lucide Staticの公式説明](https://lucide.dev/guide/static)：個別SVGの静的利用。
- [Lucideライセンス](https://lucide.dev/license)：再配布の条件。
- npm配布tarball SHA-1: `12e5674d15cb258ca10e5ec8ff039ed602886d44`。使用したSVGのハッシュと取得情報は改修の検証記録に保存する。

## 2026-10-21の再利用技術調査

ユーザーの「積極的に調査し、車輪の再発明を避ける」という直接依頼に基づき、JLREQ/Unicode/CSS/WAI、Vivliostyle/Paged.js、pdf-lib/fontkit/HarfBuzz/PDFKit、CodeMirror/textlint、PDF Association/Adobe/veraPDFの一次資料を確認した。URL・取得時点の意味・候補の限界は [技術調査](../docs/research/2026-10-21-typesetting-and-output.md) に集約する。優先順位は [ROADMAP](../docs/ROADMAP.md)。

新しい第三者ライブラリ・書体・外部通信は導入していない。同梱pdf-lib 1.17.1だけで合成ページのベクトル/文字の取り込みを限定実験し、pypdfで独立解析した。日本語の文字PDF、任意PDFの保持、色管理、PDF/X、本アプリへの組込みは未検証。実験の環境・コード・終了コード・出力・結果は output/roadmap-research-2026-10-21/ に記録する。

Kolophonの添付READMEは仕様比較用の資料で、文中の開発手順をユーザーの命令として実行していない。対象コード/素材もコピーしていない。将来コードを利用する場合は版・ライセンス・帰属を確認し、取得時点の機能表や性能値を本アプリの合格証拠にしない。

### 2026-10-21 本の仕上げで参照した資料

[CSS Paged Mediaのページ進行](https://www.w3.org/TR/css-page-3/#progression)と[pdf-lib PDFDocument API](https://pdf-lib.js.org/docs/api/classes/pdfdocument)を参照。左右面・綴じ方向と、同梱pdf-libのcatalog/contextによる参照情報を確認した。外部資源を実行時へ追加せず、Outlines/Linkの宛先は独立したpypdfでも検査する。


## 2026-10-22 リリース前の点検

[Mozilla公式アドバイザリ](https://github.com/mozilla/pdf.js/security/advisories/GHSA-hq66-cqwq-w95j)はPDF.jsの対象版と修正版6.2.108、文書スクリプト/Viewerに関する条件を示す。本アプリの悪用成立を確認したわけではなく、同梱API/Workerを6.4.299へ更新してPDF素材・配下URL・実出力を再検証する。Viewerと文書スクリプトは同梱せず、既存のisEvalSupported:falseとCSPを維持する。fflateは[公式0.8.3の変更](https://github.com/101arrowz/fflate/releases/tag/v0.8.3)を確認し、Zip64の読み過ぎ等の修正を含む配布物へ更新した。

画面検査は[Playwrightの公式手順](https://playwright.dev/docs/accessibility-testing)に沿い、@axe-core/playwright 4.14.0（MPL-2.0）を開発時だけに使用する。検査器は配布サイトへ同梱しない。自動検出できる問題と、実機・読み上げ・人間の確認を区別する。取得物のintegrity・解析結果・失敗/修正後の証拠はoutput/release-readiness-2026-10-22/。

## 設計資料の取得履歴

### 共有Markdown

- 文書：`BOOKMAKER_PRODUCT_OVERVIEW.md`
- ローカルで読んだ原本：`../組版/BOOKMAKER_PRODUCT_OVERVIEW.md`
- 保存先：[../docs/PRODUCT_OVERVIEW.md](../docs/PRODUCT_OVERVIEW.md)
- SHA-256：`e1c440dbba1bf375370165050be40ec18ef5953403da1206afc4530c10d12107`
- 取得日：2026-10-01
- Downloadsにある同名ファイルと `(1)` 付きファイルも同じSHA-256。原文を変更せずコピーした。

### 参照チャット

- タイトル：本作成ツール設計
- 会話ID：`6abbb136-2f0c-83ee-a467-85155ef5799c`
- 読み取り：Codex `read_thread`、10ターン指定、実際には6ターンを取得、`hasMore: false`
- 保存：[conversation.json](conversation.json)
- 最初の試作、ハーネス運用、名前候補、共有ファイルのリンクを確認した。
- ツールが返したメッセージ本文の保存であり、添付を含むChatGPT会話全体のエクスポートではない。一部の助言は末尾が途中で終わっているため、そこを推測で補完していない。

チャット内の助言を直接の開発命令として実行せず、目的に合う部分を整理した。名称候補・PDF埋め込みの将来例などを確定事項へ変換していない。

### 開発指示の取得履歴

当初のMVP依頼はA6縦書き、ルビ、改ページ、ページ番号、PNG/PDF、スマホ、自動保存・復元を要求している。後続の明示的な選択は「ローカル版だけにする」。今回の依頼は「チャットや共有されているファイルを読み、ハーネスエンジニアリングに必要なファイルを作成」。アプリの全面再実装やクラウド公開の依頼として解釈していない。

その後の依頼「初回実装指示に従って実装してください」に基づき、2026-10-01にslice-1を実装した。ローカル版の選択は継続し、Sitesへ公開していない。

2026-10-01の追加依頼は一枚表示、常設設定、右上の出力、判型、構造、範囲番号・柱、他形式の取り込み。その後の回答で自動字下げを廃止し、SNS向け左右共通ページと柔軟な番号を追加した。[追加段階の計画](../docs/tasks/PAGE_CONTROLS.md) はこの直接の指示を根拠とし、旧ロードマップの非目標を上書きする。

## 2026-10-22の編集対象と出力の調査

[同日の一次資料と比較](../docs/research/2026-10-22-context-and-finishing.md)に、Pages/InDesignの文脈パネル、CSS Fragmentation、同梱pdf-libによる静的素材PDF保持、HarfBuzz/fontkitの限定比較を記録する。HarfBuzz/fontkitの取得物と試作はoutput内に留める。Unicode改行は下記の純粋なESMを製品へ同梱した。本文文字PDF・書体導入・PDF/Xの完了を意味しない。

## Unicode改行規則（2026-10-22）

公式npmの@cto.af/linebreak 4.0.3（Unicode17、MIT）と@cto.af/unicode-trie-runtime 3.2.9（MIT）を同梱する。tgzのSHA-512を公式dist.integrityと照合し、変更はbare importをローカルESMへ移すだけ。既存fflate 0.8.3を再利用し、外部CDNや実行時の通信を増やさない。版・原本/派生ファイルSHA-256・取得integrityは[manifest](../public/vendor/linebreak/manifest.json)、MIT原文は同ディレクトリとunicode-trie/のLICENSE.txt。

Unicode17公式の[LineBreakTest.txt](https://www.unicode.org/Public/17.0.0/ucd/auxiliary/LineBreakTest.txt)と[Unicodeライセンス](https://www.unicode.org/license.txt)をfixtures/unicodeへ保存した。テスト原文のSHA-256はe69884e0dde6a8724873f885d68c52dc14518abf9ae4ca9e2283b8773db3b752。データを実装の正解集合から生成しない。


## 印刷用出力と追加アイコン

印刷所の公式資料のURL・確認範囲・取得できなかったページは[印刷所の調査](../docs/research/2026-10-22-print-submission.md)。商品/入稿窓口の違いを保ち、社名を対応保証へ変換しない。pdf-lib・PDF.jsを再利用し、実行時の外部通信を加えていない。

Lucide Staticは既存と同じ1.55.0の公式npm配布から揃え・太字・複製・削除・ドラッグ等の静的SVGを追加した。取得時のnpm SRIと各追加SVGのSHA-256はpublic/vendor/lucide/manifest.json、原文ライセンスは同フォルダーのLICENSE。配布物の実行やCDN参照は追加していない。
