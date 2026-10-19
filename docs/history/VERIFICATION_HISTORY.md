# 整理前の記録 — docs/QA.md

履歴資料。2026-10-04の文書整理直前の内容を保存した。本文の「現在」「今回」、件数、未実装の記述は**その段階の記録**で、現行仕様ではない。元のソース指紋は `ab83d6e2c5fc46da2e28ac10707a4515ca1f409cd3ab0a41aa89861c6c38f785`。

現行の正本は [文書案内](../INDEX.md)。ローカルリンクの基準位置を変更し、生成物の参照を保管場所の記述へ整理した。段階ごとの記録を残す。

---

# 検証記録

取得・検証日：2026-10-01。Windows、Node.js 24.19.0。固定開発依存はTypeScript 6.0.3、ESLint 10.11.0、Playwright 1.63.0。

## ハーネス準備時の記録

- 共有仕様の保存前後のSHA-256が一致。Downloadsの2ファイルも同じ内容。
- 参照チャットの取得範囲6ターンを保存。ツールの戻り値に基づき、欠けた文章は推測で補完しない。
- `npm run verify:harness`：終了コード0。lint、依存境界、空/skip/only/todoの検出、実際の型検査、文書リンク・fixture・要件の整合、自己テスト10件が合格。
- `python tests/harness/export_checker_test.py`：終了コード0。合成ファイルによる6件の自己テストが合格。寸法、DPI、画素、ページ数の違反と未対応の文字PDFを拒否。
- Playwright `test --list`：初回段階の6シナリオを認識。これはE2Eの実行成功ではない。
- `npm run verify`：終了コード1。`PRODUCT_NOT_IMPLEMENTED` により組版アダプター不足で停止。
- `npm run test:exports`：終了コード1。実際のアプリ出力がないことを `EXPORTS_NOT_VERIFIED` で拒否。
- `node scripts/check-manual.mjs`：終了コード1。未確認の目視項目とソース指紋不足を拒否。
- `npm ls --depth=0`：固定依存を確認。現在のフォルダーは初期コミット前のGitリポジトリ。

実行結果のJSONは `output/verification/`。生の出力や合成検査ファイルは配布アプリや完成証拠に含めない。

## 準備時の未実装・未実行

アプリ本体、実際の組版、ブラウザ上の入力・設定・保存復元、実際のPNG/PDF書き出し、画像の基準、iOS/Android実機確認は未達。旧フォルダーのプロトタイプの合格をこのリポジトリへ引き継いでいない。

この記録はハーネスの準備完了を示す。プロダクト完成を示さない。次の実装は [tasks/FIRST_SLICE.md](../tasks/FIRST_SLICE.md) に従う。

## 初回実装の検証 — 2026-10-01

環境: Windows、Node 24.19.0、TypeScript 6.0.3、ESLint 10.11.0、Playwright 1.63.0、Chromium 153.0.8010.12。出力検証は同梱Python 3.12、Pillow 12.3.0、pypdf 6.10.0。PDFの目視はPopplerで全4ページをPNGへ描画して行った。実画面はCodexのアプリ内ブラウザでも確認した。

初回のテストで発見した失敗を修正し、対象の検証を追加・維持した。[PDF形式](../regressions/P-001-pdf-module.md)、[即時再読み込み](../regressions/P-002-draft-reload.md)、[破損保存の通知](../regressions/P-003-damaged-draft-message.md)、[Windowsのサーバー終了](../regressions/H-002-browser-server-lifecycle.md) を参照。既存fixtureの内容や禁則アサーションは変更していない。

現在の検証経路は以下。総合実行の実際の終了コード・所要時間・ソース指紋は `output/verification/product.json` に保存される。**そのstatusがpassで、目視指紋も現在のソースと一致した場合だけslice-1完了と判定する。** 記録を書いたことだけを実行結果にしない。

| 検証 | 対象・証拠 |
| --- | --- |
| lint / typecheck / boundaries | 実ESLint、tsc --noEmit、層を越える依存と純粋層のDOMアクセス検査 |
| ハーネス | Nodeの自己テスト10件、原本SHA-256、fixtureと要件・リンクの整合 |
| プロダクト | 11件。本文/読みハッシュ、10万字、書記素、基本禁則、字下げ、決定性、設定変更、エスケープ、実PDF API、文字コード |
| E2E | 7件。1440/375/320px、TXT/貼り付け/設定、実PNG/PDF、即時復元、破損保護、長文・古い結果・HTMLを本文として扱うこと |
| 画像回帰 | 固定basic原稿、1440/375px。初回生成を目視後、通常再実行で2件合格、maxDiffPixels=0 |
| 実出力 | basic標準は4ページ、A6 105×148mm、PNG 1240×1748px・300dpi。PDF内の選択頁画像とPNGが画素単位で一致 |
| 出力検査器 | Pythonの合成自己テスト6件。これは実出力の証拠とは別 |

`npm run verify` の前に手動サーバーを停止する。Pythonの実行ファイルを `BOOKMAKER_PYTHON` で指定できる。総合ゲートではE2Eがその時点の実装から出力とmanifestを作り直し、古い指紋の出力を拒否する。生成物をコピーして合格証拠にしていない。

## 目視・実操作

NOEMAが以下を見て確認した。`harness/manual-review.json` にはこの範囲の確認後にソース指紋を記録する。

- デフォルト版面: `output/qa/desktop-default.png`。1280×900、デモ原稿、標準、左3/右2の見開き。明朝の密度、左右の余白、本文と頁番号の分離、中央の薄い影を確認。
- 縦書き: `output/qa/punctuation.png`。punctuation原稿、標準。括弧、句読点、二連リーダー/ダッシュの向きと字間を確認。`output/qa/mobile-320.png` で混植原稿も確認。
- スマホ: `output/qa/mobile-settings.png` と `mobile-output.png`、`mobile-320.png`。375×812のプリセット・寸法表示、320×720の原稿/TXT選択・紙面確認を実操作。画像生成後にプレビューへ戻ること、再読み込み後の原稿・標準設定の復元を確認。
- 出力: `output/exports/page-001.png` と `output/qa/pdf/basic-1.png`～`basic-4.png` をすべて目視。上下反転や欠け、本文と頁番号の重なりは見られない。ページ末から次ページへの流れと偶奇の小口位置を確認。
- ローカル処理: プライバシーレビュー（`output/qa/local-first.md`）。入力・TXT・設定・Chromium出力の外部リクエスト検査と、ソース/サーバーの確認。

アプリ内ブラウザのPNG操作はエラー表示なくプレビューへ戻ったが、ブラウザツールのdownloadイベントは15秒でタイムアウトし、保存先を確認できなかった。**アプリ内ブラウザでのファイル受取は未確認**。Chromium E2EではPNG/PDFのファイルを実際に取得・解析している。この違いを隠して「全ブラウザ対応」と報告しない。

## 残る範囲

初回slice-1時点では、ルビ・見出し・明示改ページの解釈、プロジェクトJSON往復、複数/見開きPNGは次段階だった。下記のMVP拡張で扱う。約物の詰め、ぶら下がり、欧文単語折返し、縦中横、孤立行、欠字診断、文字PDF・PDF/X・塗り足し・完全入稿保証、iOS/Android実機とSafari/Firefoxは引き続き未対応／未検証。

## MVPと用途別のページ設定 — 2026-10-01

対象は [tasks/PAGE_CONTROLS.md](../tasks/PAGE_CONTROLS.md)。自動字下げの無効化はユーザーの明示回答による要件変更で、基本fixtureの本文や禁則を緩めていない。MVP fixtureを有効化した直後は、旧実装が9件で失敗。文書・組版・描画を拡張して、元のMVP fixtureと追加テストを通した。

[P-004 紙面の重なり](../regressions/P-004-decoration-and-heading-overlap.md) と [P-005 拡大の読み始め](../regressions/P-005-zoom-reading-start.md) は、修正前の失敗を確認してから対処した。未知の記法・HTMLは本文として保持し、外部実体やWordの変更履歴は読み込みを拒否する。

実操作で見つけた [P-006 SNSの位置選択](../regressions/P-006-uniform-position-choices.md)、[P-007 書き出し名の巻き戻り](../regressions/P-007-export-name-during-reflow.md) も修正前の失敗を記録し、同じ操作テストで確認する。B6の実出力には範囲指定の柱と42からの番号を含める。

| 現在の検証経路 | 対象 |
| --- | --- |
| product 24件 | 元fixture全10種、字下げON/OFF、圏点とルビ、連続ダッシュと長音、範囲番号・柱、B6、長いルビ、見出し/補助文字の衝突、左右共通での章開始、JSON |
| E2E 14件 | 1440/375/320px、取り込み、構造挿入、両表示、SNSの共通余白、詳細、範囲番号/柱、再読み込みとJSON、外部接続なし、長文、実出力、プレビュー拡大、編集中の書き出し名 |
| visual 2件 | ruby.txt、PC見開き/スマホ一枚。最初の基準なしの失敗を記録し目視後採用。maxDiffPixels=0 |
| 実出力 | A6全3ページとB6の2～3ページ範囲。300dpi、A6 1240×1748px/B6 1512×2150px、PDFの寸法・ページ数、PNG/ZIP/見開きとPDF内画像の完全な画素一致 |
| PDF目視 | Popplerで通常本文と構造付きの実PDFをPNGへ描画し、番号・柱・ルビ・圏点・ダッシュを確認 |
| 検証器 | Node自己テスト10件、Python自己テスト7件。B6の可変寸法を追加し、誤寸法/DPI/画素/ページ数、未対応の文字PDFを拒否 |

表は検証経路と期待する件数であり、最新の実行結果は `output/verification/product.json`。そのstatusがpassで、手動レビューの指紋も一致したときだけ現在のMVPを完了と判定する。

手動証拠は `output/qa/structure-desktop.png`、`mobile-zoom-mvp.png`、`mobile-sns-mvp.png`、`mobile-output-mvp.png`、`scoped-1440.png`、`scoped-375.png`、`typography.png`、`output/qa/pdf/`、`local-first.md`。実機スマホや他ブラウザの保証へ広げない。標準本文、ルビ等の規格完全準拠、検索可能な文字PDFは別の改善対象。

## 文書構造とスタイルの土台 — 2026-10-03

ユーザーが選択した [tasks/MODEL_FOUNDATION.md](../tasks/MODEL_FOUNDATION.md) の範囲。全ロードマップの完成ではない。環境はWindows、Node 24.19.0、TypeScript 6.0.3、ESLint 10.11.0、Playwright 1.63.0 / Chromium 153.0.8010.12、Codexアプリ内ブラウザ。出力検査はPython 3.12.14 / Pillow 12.3.0 / pypdf 6.10.0、目視はPopplerの120dpi描画。

元の共有仕様 `PRODUCT_OVERVIEW.md` のSHA-256と旧fixture全10種を保持。追加のモデルfixtureは別manifestの6種。視覚基準・禁則期待値・画像比較閾値は変更していない。[P-008](../regressions/P-008-model-reference-and-mark-nesting.md) に、未実装、入れ子ルビ、重複参照、優先順位、未知項目拒否の失敗と修正を記録した。

| 検証 | 今回実行して確認した範囲 |
| --- | --- |
| verify:harness | 終了コード0。実lint / 型検査 / 境界、文書16・従来fixture10・モデルfixture6・要件27の整合、自己テスト10件 |
| product | 36件、終了コード0。旧24件に、AST正本、ID保持/曖昧参照の切断、スタイル継承/循環、Scope優先順位、非破壊解除、入れ子記法、旧JSON移行、不明形式拒否を追加 |
| E2E | 20件、終了コード0。1440/375pxで段落選択→変更→JSON→再読み込み→解除、旧下書きの原文退避、退避失敗時の保護、無効JSONの拒否、章参照と実出力。旧320px・長文・通信検査も保持 |
| visual | 2件、終了コード0。既存PC/スマホ基準と一致、maxDiffPixels=0。基準画像の更新なし |
| 実出力 | A6標準3ページ、B6範囲2ページ、モデルA6 3ページ。寸法・ページ数・300dpi、PNG/ZIP/見開きとPDF内画像の画素一致。検査終了コード0 |
| 目視・操作 | 下記の実画面、通常本文全3頁、B6全2頁、モデル全3頁、組版fixture全3頁のPDFとPNGを確認 |

総合判定は今回のソース指紋で実行した `npm run verify` の `output/verification/product.json` を使う。表の個別成功や目視記録だけでは総合完了としない。最終のコマンド・終了コード・指紋・未達事項は `output/verification/model-foundation-report.md` にまとめる。

### 今回の手動証拠

- `output/qa/model-default-desktop.png`: 1280×720、標準A6、左3/右2の見開き。本文の密度、余白、番号と紙面の分離。
- `output/qa/model-inspector-desktop.png`: 本文を押してInspectorを表示。中央揃えスタイルに個別の字下げ2字・太字を加え、変更2件と紙面への反映を確認。
- `output/qa/model-mobile-preview.png` / `model-inspector-mobile.png`: 375×812、一枚表示・縦ナビゲーション、設定の画面切り替え。解除で変更0件となり、名前付きスタイルと本文を保持。原稿のカーソルから「段落書式」でルビを含む段落を選択。
- `output/qa/model-ruby-mobile.png` / `model-output-mobile.png`: ルビと強調の表示、PNG生成後の保存/開くリンク。再読み込みで原稿、Markdown読み方、一枚表示を復元。アプリ内ブラウザのファイル受取は引き続き未確認。実ファイルはChromium E2Eで取得・解析。
- `output/qa/pdf/model-a6-1.png`～`model-a6-3.png`、`model-b6-1.png`～`model-b6-2.png`、`model-foundation-1.png`～`model-foundation-3.png`、`model-typography-1.png`～`model-typography-3.png`: 全ページを目視。旧通常本文、SNS柱と42/43、改名に追従した下部の章名、中央揃え、強調、ルビ、圏点、ダッシュと長音の区別。本文/柱/番号の重なりや欠けを認めない。
- ローカル処理のレビュー（`output/qa/local-first.md`）: 正本AST・新下書き・移行退避を含めて確認。

### この段階の限界

スタイルは太さ、段落の字下げ・揃え・Keep with nextの有限集合。個々の文字選択を行うリッチエディタ、名前付きPage/Section Styleの編集、Scope/Running Element全項目のGUI、特殊ページ・画像・目次・プリフライトは未実装。意味的範囲と一般化Running ElementはJSON/APIから実際の組版・描画に接続した。

Markdownは対応部分だけでCommonMark全体ではない。重複内容を含む曖昧な複合編集ではIDを推測で継承せず、残した範囲設定を孤立参照として診断する。太字は同梱Regularフォントのブラウザ合成。PDFは画像PDFのままで、文字検索・文字フォント埋め込み・PDF/Xを保証しない。iOS/Android実機、Safari/Firefox、組版規格完全準拠も未検証／未対応。

## 修正版Book Workspace — 2026-10-03

対象は [tasks/BOOK_WORKSPACE.md](../tasks/BOOK_WORKSPACE.md)。Book Model v3を唯一の正本とし、構成・ソース・素材、選択対象別Inspector、3表示、特殊ページの往復を接続する。以下は本段階の検証経路。完了は現在の指紋での `output/verification/product.json` がpassの場合だけとする。実行コマンド・終了コード・限界は `output/book/implementation-report.md` に記録する。

| 検証経路 | 対象 |
| --- | --- |
| verify:harness | 文書18・元fixture10・モデルfixture6・Book fixture5・要件34の整合、実lint/tsc/境界/ポリシー、Node自己テスト10件 |
| product 48件 | 元36件と正本/特殊参照/未完draft/順序/改ページ/自由変換/疎なページ集合/意味的範囲/共通描画/未知形式拒否/枠溢れ/複製名上限 |
| E2E 27件 | 旧20件を維持。1440/375pxでGUI・ソース・JSON・再読込・Undo、独立ペイン、章開始と柱、一覧の疎な選択、スマホ連続選択、SVG/PDF/PNG/JPEG、IndexedDB復元、自由ページのドラッグ、破損したパネル設定からの本文復元 |
| visual 3件・6画像 | 既存紙面2画像＋修正版ワークスペース4画像。maxDiffPixels=0。更新理由・参照と実装の対比較・手動評価は `output/book/design-qa.md` |
| 実出力4案件 | A6標準全3頁、B6範囲2頁、モデルA6全3頁、本文/奥付/SVG/外部PDF/自由ページの全5頁。PNG/ZIP/見開き/PDF画像の寸法・300dpi・ページ数・画素一致。Python自己テスト7件 |
| 手動 | デフォルト見開き、縦書きとルビ/圏点/ダッシュ、375px一覧/設定/PNG生成/復元、Poppler描画の全頁、ローカル処理のレビュー |

問題は [P-009](../regressions/P-009-book-workspace-boundaries.md) に失敗→修正の証拠を記録した。基準画像なしの初回比較は失敗。A6一覧の逆転した縦横比、小さすぎる補助文字、スマホ通知の重なりを直し、参照画像と実画面を同時に並べて確認してから対象の基準だけ更新した。更新後は通常の比較を実行する。

手動確認では別のlocalhostオリジンでサンプル原稿を使用し、既存ユーザーの原稿を置換していない。375×812で奥付の書名/作者/日付を編集、一覧p.1とp.3を選択して設定へ移動、単ページ縦ナビ、連続ダッシュ、PNG生成完了の保存/開くリンク、再読込した原稿と奥付を確認。画像証拠は `output/book/01-source-spread.png`、`02-colophon-inspector.png`、`03-gallery-scope.png`、`mobile-inspector.png`、`mobile-gallery.png`、`mobile-page-scope.png`、`pdf-1.png`～`pdf-5.png`。一覧とスマホの保存画像はChromiumの操作テストから取得し、IABの実操作とは区別する。

特殊ページは有限テンプレート、自由ページは文字/画像/線/矩形の基本編集。目次は1ページで、自由変換すると現在の参照を固定する。物理ページ指定は本文容量を変えない番号/柱の非表示と紙色だけ。画像PDF、解像度の概算警告、外部PDFの端末内ラスタ化は完全入稿対応ではない。全Scope/スタイルカタログのGUI、段組/横書き本文、素材の一括管理、プリフライト、リッチ文字選択、実機と他エンジンの確認は後続。IndexedDBの書込み完了前に端末を閉じた場合の保存完了は保証しない。保存表示を待ち、作業JSONも保管できる。

## 原稿から始めるUX — 現在

対象は [tasks/MANUSCRIPT_UX.md](../tasks/MANUSCRIPT_UX.md)。Product52・E2E31・visual4シナリオ9画像、従来の実出力4案件と手動5項目を維持する。過去の完了結果とは別の指紋で判定する。

変更前の画像は `output/ux/before/01-entry-1440.png`、`01-entry-1024.png`、`01-entry-375.png`、`03-paper-selection.png`。変更後は同じ入力/幅で `output/ux/after/` へ撮影し、寸法をJSONにも記録する。監査は `output/ux/audit.md`、視覚基準の更新と実行結果は `output/ux/implementation-report.md`。不具合の失敗→修正は [P-010](../regressions/P-010-manuscript-first-ux.md)。

原稿表示、折返し、全体設定と選択対象の分離、幅拡張、パネル端の操作を実画面で確認する。IABの操作、固定Chromiumのダウンロード、Poppler/PDF画像の目視は別の証拠として扱う。Markdownは限定対応、PDFはラスタ。iOS/Android実機・Safari/Firefoxは未確認。

## 例外書式と別判型 — 現在

[EXCEPTION_STYLES.md](../tasks/EXCEPTION_STYLES.md)、R-36～R-41。文書20、元fixture10、モデル6、Book7、要件41。Product63、E2E35、visual5シナリオ11画像、実出力5案件/計18頁を対象とする。検証前の想定件数であり、合格は現指紋のゲート結果から判定する。

失敗→修正は [P-011](../regressions/P-011-exception-styles.md)。現在の実行ログ、視覚基準の個別比較、IAB確認、出力目視と未達は `output/exceptions/` に記録する。旧UXのpassを現在へ流用しない。
