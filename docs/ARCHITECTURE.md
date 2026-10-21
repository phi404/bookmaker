# 処理系と責務の契約

## データフロー

```text
入力ファイル / 原稿編集 / 構成・GUI
              ⇅
Book Model + BookStyle + FontMetrics
              ↓ スタイル・Scopeの解決
Typesetter / Paginator（Worker）
              ↓
RenderedPages + Diagnostics + 構造IDとの対応
              ├─ Preview
              └─ 共通SVG → PNG / PDF
```

正本の意味と参照は [PUBLISHING_MODEL](PUBLISHING_MODEL.md)、記法は [SOURCE_FORMAT](SOURCE_FORMAT.md)、組版規則は [TYPOGRAPHY](TYPOGRAPHY.md)。UIはこの処理を接続し、組版ルールを直接実装しない。

## 技術構成と境界

TypeScriptと静的HTML/CSSを使い、tscでブラウザ用ES Moduleへビルドする。フレームワークはない。純粋な計算をWorkerへ分離し、SVGを共通描画形式にする。同梱の明朝、pdf-lib、fflate、PDF.jsをローカル参照する。採用理由は [D-009](DECISIONS.md)、配布元とライセンスは [出典](../sources/README.md)。

| 層 | 責務 | 依存可能な層 |
| --- | --- | --- |
| `src/domain` | 文書/設定/参照の意味、検証、純粋なモデル操作 | domain |
| `src/typesetting` | スタイル解決、行/段/ページ分割、診断 | domain / typesetting |
| `src/render` | 確定ページからSVG・特殊ページ要素を描画 | domain / render |
| `src/io` | 取り込み、端末保存、素材の画像化、出力容器 | domain / render / io |
| `src/ui` | 入力/選択/履歴/進捗/プレビューの接続 | 上記すべて |
| `src/app` | 起動、Worker、配線 | 上記すべて |

実際の許可は [boundaries.json](../harness/boundaries.json)。純粋層はDOM・通信・ファイルI/Oを使わない。型のimportも境界を守る。静的検査は計算されたimport等を拒否するが、全コードの正しさを保証するものではない。

## モジュールの入口

| 対象 | 主な実装 |
| --- | --- |
| AST・入力投影・検証 | `domain/model`, `source`, `source-format`, `publication`, `project` |
| 本の構成・特殊参照・draft | `domain/book`, `editing` |
| スタイル・範囲・装飾 | `domain/styles`, `scope`, `style`, `decoration` |
| 特殊ページ・テンプレート・配置 | `domain/special`, `templates`, `element-layout`, `image-print`, `media` |
| 版面解決・ページ列 | `typesetting/publication`, `paginator`, `flow` |
| 共通SVG | `render/svg`, `flow`, `elements` |
| 取り込み/素材/保存 | `io/import`, `text`, `assets`, `book-draft` |
| 出力 | `io/raster`, `pdf`, `zip` |
| 画面接続 | `ui/main`, `workspace`, `manuscript`, `inspector`, `typography`, `catalog`, `settings`, `output` |

旧Document型とNode用アダプターは組版の互換経路。新しいBook Model専用テストは正本の経路を直接検査する。旧経路を別のアプリ用正本にしない。

## 組版と描画

スタイルと構造Scopeを組版前に解決する。PageStyleが変わる境界は流し込みを区切る。標準の組版経路に加え、`typesetting/flow` が可変文字・段落空き・縦横一二段・フロー画像を扱い、`render/flow` が生成座標と方向/数字を描画する。

ブラウザは字形・フォント・書字方向、JavaScriptは行/段/ページ境界と文字群を担当する。CSSのcolumnsやfragmentationだけにページ分割を委ねない。本文の座標は規則からの生成物であり、ユーザーの手動補正を正本へ保存しない。

取り込みは開始時から準備済み状態を解除し、最後に開始した読み込みだけを適用する。途中の編集を上書きせず、失敗時は既存モデルと紙面へ戻る。

Workerは入力revisionを受け、現在revisionと一致した結果だけ画面へ適用する。プレビューの拡大・単ページ/見開き/一覧の変更は表示のみ。出力開始時の文書・設定・確定ページを固定し、後の編集が混ざらないようにする。完了時にもrevisionと対象を照合し、古い結果リンクを撤去する。目次は章名だけで分割数を決めてから同じページ列へ合成し、確定番号の埋め込みで再分割しない。

## 保存と互換性

作業JSONはschemaVersion 3。Book Model、元表現キャッシュ、未完draft、スタイル/Scope、特殊ページ/素材、物理Override、表示状態を保持する。未知構造・属性、循環・不明なスタイルは拒否する。検証済みASTとキャッシュが食い違えばASTから投影する。孤立Scopeは保持して診断する。

素材なしの下書きはLocalStorage schemaVersion 3。旧1/2の初回保存前に原値を `bookmaker-draft-backup-before-v3` へ退避する。Publication2からBook v3へ昇格する原値も `bookmaker-draft-backup-before-book-v3` へ退避する。退避や保存が失敗すれば旧値を上書きせず止める。

素材付きはIndexedDBの単一トランザクションでBook Modelと原本/画像を保存し、成功後にLocalStorageへschemaVersion 4の所在マーカーを書く。書き込みは直列化する。マーカー4と作業JSON3を同じ形式だと解釈しない。壊れた値を空の作業で自動上書きしない。

非同期保存中にタブを閉じた場合の完了は保証しない。「保存済み」と作業JSONを利用する。表示幅・開閉・選択対象はUI状態で、入力途中の復元とは独立して検証する。壊れたパネル設定だけで本文の復元を止めない。

## 取り込みとローカル素材

TXT/Markdown/DOCXは意味を取り込み、元ファイルを変更しない。DOCXは対象XMLだけを展開し、外部関係や実体へ接続しない。Wordの版面再現は別機能で、ここへ混ぜない。

素材は原本と表示用画像を保存する。PDF.jsは同梱Worker・CMap・標準フォント・wasm等を同じoriginで参照し、PDFを端末内で画像化する。SVGも制限した静的内容を検証して画像化する。外部通信・埋め込みスクリプトを経由しない。形式・容量の上限は [CAPABILITIES](CAPABILITIES.md)。

## 出力

プレビューは共通SVGを表示する。PNGは同じSVGへ同梱フォントをdata URLで含め、Canvasへ300dpiで描画しpHYsを付ける。PDFはCanvasのRGB画像を可逆圧縮し、選択判型のMediaBoxへ置く。ZIPは圧縮済みPNGを無圧縮で包む。

Canvasを1ページごとに解放し、圧縮画像の累計上限とキャンセルを持つ。書き出し後に保存/開くリンクを残す。見開きの仮想対向面は表示用で、PDFに余分なページを加えない。明示改ページの白ページは実ページとして出力する。

文字/ベクトルPDFへ進む場合も確定した同じページ境界を使う。字形選択・埋め込み・実PDF描画・文字対応の検査を追加し、`pdfProfile` と出力検査器を更新する。現在のラスタPDF一致を文字PDFや印刷用出力の証明へ流用しない。

## 静的配布と開発サーバー

ブラウザー資源は配布先ディレクトリ基準で解決し、IOの補助資源URLをresourcesへ集約する。同梱ES Moduleは境界カタログに明示したIO専用依存。Nodeの配信処理はscripts/static-server、起動はscripts/serve、開発のビルド接続はscripts/devへ分離する。詳細は[DEPLOYMENT](DEPLOYMENT.md)。

## 原稿位置と検索

原稿位置は既存のインラインパーサーから生成する。元記法のUTF-16範囲、ブロック内の表示文字範囲、ルビの読みを分け、Book Modelに生成座標やオフセットを保存しない。FlowLineの描画単位がブロック内の範囲を持ち、UIが最新のID/原稿から元位置へ解決する。原稿の改行とtextareaで表示される改行も対応づける。未完draftや古い原稿の位置を現行紙面へ適用しない。

本文の検索は標準文字列APIによるリテラル一致。原稿全体/明示選択範囲を検索し、置換後を既存の原稿編集経路へ一度だけ渡す。別の文書やUndoスタックを作らない。検索候補の比較と採用理由は[先行実装記録](history/2026-10-21-roadmap-implementation.md)。

## 端末保存の排他と確定

自動保存の読み取りと書き込みは、同じオリジンのWeb Locksで直列化する。復元時/保存成功時の保存値を基点として、次の保存前に現在の値と比較する。別タブの新しい値があれば上書きせず、そのタブの入力を保持して自動保存を停止する。開いただけの復元では不要な保存を書かない。競合後も作業JSONへ持ち出せる。

素材付きの作業は、IndexedDBに新しいスナップショットを完全に書いてからLocalStorageの参照先を一回で切り替える。参照更新の容量不足・中断では以前の確定値を保つ。前の確定スナップショットを残し、後の成功時に古い/未確定のものだけを整理する。旧保存の復元経路は維持する。Web Locksを使えない環境では安全を黙って弱めず、自動保存の停止と作業JSONの保存を案内する。

## 組版依頼の集約

160msの待機に加え、Workerへ送信済みの一件と最新の保留一件だけを保持する。処理中の変更は保留を差し替え、応答時に最新を送る。古いrevisionの結果を表示/出力に使わず、最新の原稿との一致を完成条件にする。解析/字形キャッシュはまだ導入していない。依頼集約の検査と、実原稿の速度/メモリ評価は別に扱う。

変更直後の再読み込みでは、排他待ちの非同期処理が終了する保証はない。素材なしの未保存作業は、各タブの一意な復旧キーへ同期的に記録してから保存を依頼する。復旧記録は基点と順序を持ち、同じ保存系列だけを通常保存へ引き継ぐ。別タブの新しい保存がある場合は復旧した入力を開いて自動保存を停止する。以前の保存を復旧値で黙って上書きしない。素材原本を含む未保存状態をこの小さい復旧記録で保証せず、「保存済み」になるまで待つ/作業JSONを使う。容量不足で停止した作業や破損状態から復旧記録を無断作成しない。
