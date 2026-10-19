# bookmaker

（開発中）

完成した原稿を端末内で組版し、紙面を確認してPNG・PDFへ書き出すWebアプリです。文庫の縦書きを標準に、SNS用の一枚ページや、章・挿絵・奥付を含む本を扱います。サービス名は未決です。

[試用ページを開く](https://phi404.github.io/bookmaker/) · [GitHubリポジトリ](https://github.com/phi404/bookmaker)

開発中の試用版です。GitHub Release・タグはまだ作成していません。原稿と素材は公開版でもブラウザー内で処理・保存します。

## 起動する

Node.js 22.13以上が必要です。開発・CIの推奨版は .node-version に固定しています。

```powershell
npm ci
npm run dev
```

[http://127.0.0.1:5174](http://127.0.0.1:5174) を開いてください。初回はビルドも行います。ファイルを変更した後は `npm run build` とブラウザの再読み込みが必要です。自動監視はありません。

別ポートを使う場合は、起動前に指定します。

```powershell
$env:BOOKMAKER_PORT = '5175'
npm run dev
```

## 原稿を入れて試す

1. 初回に表示される「原稿」へ貼り付けるか、「ファイルを読み込む」でTXT・Markdown・DOCX・作業JSONを選びます。「サンプルを試す」も使えます。
2. 標準のまま紙面を確認します。中央の「見開き」「単ページ」「ページ一覧」で表示を切り替えます。
3. 「本」で用途・判型・余白、「書式」で全体・本文・見出しを調整します。SNS用は「一枚・連続ページ」を選びます。
4. 特定の範囲・章・文字だけ変える場合は、原稿を選択して「範囲」または「文字」から調整します。個別の変更はリセットできます。
5. 右上の「書き出し」からPNG・PDFを保存します。「PNG一括」は全ページまたは指定範囲をZIPで保存します。見開きPNGも選べます。

スマホでは下部の「原稿 / プレビュー / 設定 / 出力」を切り替えます。PCの左右パネルは端で開閉し、境界で幅を変えられます。「原稿を広げる」でも入力幅を確保できます。

原稿の書き方は [SOURCE_FORMAT.md](docs/SOURCE_FORMAT.md)、現在できることと制約は [CAPABILITIES.md](docs/CAPABILITIES.md) にまとめています。

## 作業を残す

原稿・設定はブラウザ内へ自動保存します。素材がある作業はIndexedDB、素材がない作業はLocalStorageを使います。「保存済み」を待ってから閉じてください。左上の作品名から作業JSONを保存できます。作業JSONを書き出すと、本文・スタイル・特殊ページ・素材をまとめて保管できます。

保存領域はブラウザとURLのoriginごとに異なります。`localhost` と `127.0.0.1`、5174と5175は別領域です。別のURLや端末へ移す場合は作業JSONを利用してください。端末の保存領域を消すと自動保存も消えます。

原稿や素材をサーバーへ送信する機能、外部フォント、アカウントはありません。PDFは300dpiのRGB画像PDFです。文字検索・フォント埋め込み・PDF/X・塗り足し込みの印刷用PDFは未対応です。

## 開発・検証する

開発資料の入口は [docs/INDEX.md](docs/INDEX.md)、作業上の規約は [AGENTS.md](AGENTS.md) です。

```powershell
npm run verify:harness
npm run verify
```

前者は文書・検証基盤、後者はアプリ・実出力・目視証拠を含む完了ゲートです。ブラウザとPythonの準備、個別検査の順序は [HARNESS.md](docs/HARNESS.md)、合格条件は [ACCEPTANCE.md](docs/ACCEPTANCE.md)、結果の読み方は [QA.md](docs/QA.md) を参照してください。

フォントと同梱ライブラリの出典・ライセンスは [sources/README.md](sources/README.md) に記録しています。本体のライセンスは未決です。配置の手順と公開範囲は [DEPLOYMENT.md](docs/DEPLOYMENT.md) を参照してください。
