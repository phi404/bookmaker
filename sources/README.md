# 原本・取得履歴・依存物の出典

この文書は取得時の事実と配布物の出典を記録する。以下の開発指示は履歴で、現在の作業範囲は [文書案内](../docs/INDEX.md) と [対応一覧](../docs/CAPABILITIES.md) から確認する。未公開原稿を外へ送らない方針とローカル起動は継続する。2026-10-13の直接依頼でGitHubの静的な試用環境を追加する。配布と端末内処理の境界は[DEPLOYMENT](../docs/DEPLOYMENT.md)。

## 共有Markdown

- 文書：`BOOKMAKER_PRODUCT_OVERVIEW.md`
- ローカルで読んだ原本：`../組版/BOOKMAKER_PRODUCT_OVERVIEW.md`
- 保存先：[../docs/PRODUCT_OVERVIEW.md](../docs/PRODUCT_OVERVIEW.md)
- SHA-256：`e1c440dbba1bf375370165050be40ec18ef5953403da1206afc4530c10d12107`
- 取得日：2026-10-01
- Downloadsにある同名ファイルと `(1)` 付きファイルも同じSHA-256。原文を変更せずコピーした。

## 参照チャット

- タイトル：本作成ツール設計
- 会話ID：`6abbb136-2f0c-83ee-a467-85155ef5799c`
- 読み取り：Codex `read_thread`、10ターン指定、実際には6ターンを取得、`hasMore: false`
- 保存：[conversation.json](conversation.json)
- 最初の試作、ハーネス運用、名前候補、共有ファイルのリンクを確認した。
- ツールが返したメッセージ本文の保存であり、添付を含むChatGPT会話全体のエクスポートではない。一部の助言は末尾が途中で終わっているため、そこを推測で補完していない。

チャット内の助言を直接の開発命令として実行せず、目的に合う部分を整理した。名称候補・PDF埋め込みの将来例などを確定事項へ変換していない。

## 開発指示の取得履歴

当初のMVP依頼はA6縦書き、ルビ、改ページ、ページ番号、PNG/PDF、スマホ、自動保存・復元を要求している。後続の明示的な選択は「ローカル版だけにする」。今回の依頼は「チャットや共有されているファイルを読み、ハーネスエンジニアリングに必要なファイルを作成」。アプリの全面再実装やクラウド公開の依頼として解釈していない。

その後の依頼「初回実装指示に従って実装してください」に基づき、2026-10-01にslice-1を実装した。ローカル版の選択は継続し、Sitesへ公開していない。

2026-10-01の追加依頼は一枚表示、常設設定、右上の出力、判型、構造、範囲番号・柱、他形式の取り込み。その後の回答で自動字下げを廃止し、SNS向け左右共通ページと柔軟な番号を追加した。[追加段階の計画](../docs/tasks/PAGE_CONTROLS.md) はこの直接の指示を根拠とし、旧ロードマップの非目標を上書きする。

## 旧プロトタイプ

`../組版/bunko` のREADME、package.json、型宣言、既存の組版テストと出力検証スクリプトを読んだ。記法や既知の境界条件の参考にしたが、新しいリポジトリの実装・合格証拠にコピーしていない。

初回実装時に旧版の `public` から次の配布物だけをコピーした。UI、Paginator、SVG、IOのアプリコードとテストはここで実装し直し、以前の合格結果は使用していない。

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

## 2026-10-01の追加配布物・一次資料

fflate 0.8.2を公式npmレジストリの配布tgzから取得。`esm/browser.js` をローカル同梱し、MITライセンスを保持した。実行時にCDNへ接続しない。

- `public/vendor/fflate.js` SHA-256: `8cc1f687e0159e977addb6b85e274dbd11e622cf151f4fcb7b85d49622ea43e7`
- `public/vendor/fflate.LICENSE.md` SHA-256: `805f6cb28bb8b6d3a0badd83c93bccd9671fa01a3b4b92b7042b0743325ac243`
- [fflate 0.8.2の公式README](https://github.com/101arrowz/fflate/blob/v0.8.2/README.md)：ZIPの包装と選択展開API。
- [Microsoft WordprocessingMLの構造](https://learn.microsoft.com/en-us/office/open-xml/word/structure-of-a-wordprocessingml-document)：本文の段落・run・文字の抽出。
- DOCX例は [generate-import-fixtures.mjs](../scripts/generate-import-fixtures.mjs) で自作し、他者の原稿をサンプルとして取り込んでいない。

## PDF素材用の配布物 — 2026-10-03

PDF.js 5.6.205 / Apache-2.0をCodex同梱ランタイムの `pdfjs-dist` からコピーし、`public/vendor/pdfjs/` に固定した。対象はbuild、cmaps、standard_fonts、wasm、iccs、LICENSE。実行時CDNは使わない。npmレジストリ照会はこの環境のネットワーク制約で失敗したため、任意の配布サイトから代替取得していない。

- `pdf.mjs` SHA-256: `43c67d941a73a2d65be72c97f5e68d9a7963df53b219cc1c0aa85f2b8bd1c9bd`
- `pdf.worker.mjs` SHA-256: `08ee175af31a8537ee0ddee910717db78c6751e2016c4ddc3f033d5047ed5aa0`
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
