# 検証基盤の運用

合格の意味は [ACCEPTANCE](ACCEPTANCE.md)、結果の場所と鮮度は [QA](QA.md)。この文書は開発・変更・証拠更新の手順を定義する。

## 準備

Node.js 22.13以上で `npm ci`。Windowsのブラウザ検査はプロジェクト内のキャッシュを使う。

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.cache/browsers'
node node_modules/@playwright/test/cli.js install chromium
```

PDF/PNGの解析はPython 3.11以上、Pillow、pypdfが必要。環境に応じて準備する。

```powershell
python -m pip install -r requirements-qa.txt
# 必要な場合のみ、利用するPython実行ファイルの絶対パスを指定
$env:BOOKMAKER_PYTHON = 'C:\path\to\python.exe'
```

PDFの目視用画像化はPoppler等の独立rendererを使い、実行環境を記録する。Nodeだけのverify:harnessにPython/Popplerを必須にしない。

## 入口と順序

| コマンド | 仕事・依存 |
| --- | --- |
| `npm run status` | phase、現在の指紋、要件、証拠の鮮度を確認 |
| `npm run verify:harness` | 6工程：静的検査/境界/テストポリシー/実tsc/文書・fixture・要件/自己検査 |
| `npm run test:product` | ビルド後に実関数のモデル/組版を検査 |
| `npm run test:e2e` | 操作、保存、外部通信、実ダウンロードを検査しmanifestを生成 |
| `npm run test:visual` | フォント/組版を待ち固定環境の基準と比較 |
| `npm run test:exports` | E2Eが作った現在の実出力を解析。古い指紋は失敗 |
| `npm run verify` | 14工程の完了ゲート。E2Eを3分割で順次実行→visual→exports→目視証拠の順 |

ブラウザ検査は `scripts/browser-test.mjs` がサーバーを直接所有し、IPCで開始/終了を制御する。手動の5174サーバーを止めてからnpm scripts経由で実行する。異なるportの試用サーバーは別。Windowsの経緯は [H-002](regressions/H-002-browser-server-lifecycle.md)。

全体ゲートの操作検査はPlaywrightのshard 1/3・2/3・3/3を順番に実行する。操作/実出力案件の増加で単独工程の180秒プロセス監視に収まらなくなったためで、全テストを実行し、個別テスト/期待値/工程の時間制限は維持する。各分割の終了コードを別に残し、一方でも失敗すれば後続へ進まない。同じ出力先を使うブラウザ検査を同時に実行しない。

## 管理ファイルの責務

| ファイル | 正本として持つもの |
| --- | --- |
| [documents.json](../harness/documents.json) | 文書の目的、現行正本の担当、履歴/原本/テンプレートの区別 |
| [requirements.json](../harness/requirements.json) | 要件ID/phase、fixture、機械/目視ルート、現行仕様文書 |
| [boundaries.json](../harness/boundaries.json) | 層ごとの依存許可、純粋層の禁止API |
| [config.json](../harness/config.json) | phase、PDFプロファイル、dpi、アダプター/アプリ/出力manifest経路 |
| [manual-review.json](../harness/manual-review.json) | 現在の指紋に対するレビュー者/環境/5項目/証拠 |
| [fixtures/manifest.json](../fixtures/manifest.json) | 元fixtureと独立本文期待値 |
| [model manifest](../fixtures/model/manifest.json) / [book manifest](../fixtures/book/manifest.json) | 追加の構造/例外fixtureと原本ハッシュ |

`check-harness` は全管理文書の登録、正本の担当の欠落/重複、履歴を仕様にする要件、ローカルリンクの実在・環境依存/生成物リンクの混入、原本/fixtureハッシュ、検査ルートを確認する。文書本文の全意味や全コードの正しさを保証する検査ではない。

## 実装との接続

モデル/組版の実関数へ `tests/product/adapter.mjs` と型契約を接続する。新経路は専用テストからも直接使う。アダプター内で期待値へ結果を加工しない。UI接続点は `tests/e2e/ui-driver.mjs`。ラベルやDOMの変更に合わせて接続点を変え、期待する本文/範囲/保存/出力を弱めない。

未実装・空アダプター・missing fixture・skip/todo/only・禁止層import・古い目視証拠は自己検査で失敗することを確かめる。Python出力検査器の自己テストは `python tests/harness/export_checker_test.py`。そこで生成する合成PNG/PDFは検査器用で、アプリの完了証拠ではない。

## 指紋と証拠の更新

指紋はsrc、publicのフォント/配布物、tests/基準画像、fixtures、docs、sources、scripts、harnessの仕様/文書登録/設定/境界、依存ロック、両tsconfig、Playwright設定等を含む。dist/outputと手動レビューの結果は含めない。結果を含めると指紋自身の更新循環になる。

コード・テスト・文書を変えたら以前の出力manifestと手動指紋は古くなる。アプリの全体合格を報告するなら現在の指紋で実出力とゲートを作り直す。文書整理のみならverify:harnessの合格と、過去のプロダクト合格を区別して報告する。

見た目を変えない文書/検査だけの変更で目視証拠を再利用する場合も、表示に関わる実装・フォント・配布物・fixture・基準画像のハッシュ一致、新しい指紋の実出力、目視済みPDF描画との画素一致を確認し、再利用の根拠と限界をoutputに記録する。証拠の指紋を書き換えるだけではレビューにならない。

## 視覚と目視

フォントとinput/layout revision一致を待って撮影する。固定OS/ブラウザ/viewportを記録する。基準なしの初回比較を失敗として扱い、妥当な画像を目視して理由と対象を記録してから採用する。通常のverifyへ `--update-snapshots` を入れない。

manual-reviewのunknown/failを、確認せずpassへ変えない。証拠ファイル、誰が何を見たか、操作した環境、未検査を記録する。これは品質レビューで、外部公開の認可とは別。ユーザーのローカル版という選択を変えない。

## 不具合を次の検査へ変える

1. 原稿・書式・構造・画面幅・出力形式を最小化する。
2. 再現fixtureと独立した期待値を追加する。
3. 修正前の失敗を記録する。
4. 修正し、関連回帰を実行する。UIなら目視、出力なら実ファイルも確認する。
5. [回帰テンプレート](regressions/TEMPLATE.md) に原因と証拠を残す。
6. 対応範囲・契約・要件へ影響する場合は正本も更新する。

制御文字・ルビ・Unicodeの削除、閾値緩和、無条件成功、全基準の一括更新で失敗を隠さない。ハーネスは具体的な失敗から強くし、設定や文書の数を増やすために作らない。
