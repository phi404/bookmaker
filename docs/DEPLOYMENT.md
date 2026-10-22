# GitHubへの配置と試用環境

## 対象

公開先は [phi404/bookmaker](https://github.com/phi404/bookmaker)、試用URLは [GitHub Pages](https://phi404.github.io/bookmaker/) を使う。Folaxisの静的な試用環境を配布する。リリース・タグ・npm公開はまだ行わない。名称変更に伴うURLや保存領域の変更は行わない。

配布するサイトは dist/ の静的ファイルだけ。原稿・取り込んだ素材・作業JSON・端末内の保存値はビルドへ入らず、サイト側へアップロードしない。公開ページを取得した後の組版、PDF素材の画像化、書き出しはブラウザー内で行う。ローカル版も維持する。

## ビルドと配置

Nodeの推奨版は .node-version、開発依存は package-lock.json で固定する。npm ci → npm run build で dist/ を生成する。HTML/CSS、同梱フォント、PDF/ZIPライブラリ、Worker、PDF.jsの補助ファイルと各ライセンスを含む。

配置先ディレクトリに依存するURLを書かない。HTML/CSSは相対参照、IOの同梱素材URLは io/resources.ts の import.meta.url を基準に解決する。外部ES Moduleの静的importは同じ配布先を参照し、harness/boundaries.json の明示したレイヤー別カタログで検査する。Unicode改行規則は純粋な組版層で使い、同梱のfflateを分類データの展開だけに再利用する。計算されたimport、未知の依存、純粋層のブラウザー利用は従来どおり拒否する。

Content Security Policyは scripts/static-server.mjs が正本。ビルド時にHTMLのmetaへ挿入し、ローカルサーバーでも同じ方針をヘッダーへ設定する。frame-ancestorsはヘッダー専用で、Pagesのmetaでは提供できない。外部CDN・分析を追加しない。

## ローカルで公開先を再現する

npm run dev はビルドして起動する。npm run serve は生成済みの dist/ だけを配信する。サーバー実装は scripts/static-server.mjs、起動とIPCの終了処理は scripts/serve.mjs に分けた。

PowerShellで BOOKMAKER_BASE_PATH に /bookmaker/、BOOKMAKER_PORT に5175を設定して npm run serve を実行すると、http://127.0.0.1:5175/bookmaker/ を開ける。末尾スラッシュへ正規化し、配置先以外のファイルや書込みHTTP要求を拒否する。

## GitHub Actions

.github/workflows/preview.yml はmainへのpush、mainへのPull Request、手動実行を扱う。harness・型・境界・モデル/組版の検査、3分割した全操作検査を実行する。操作検査は通常のルートとプロジェクト配下URLで同じ本・フォント・Worker・PDF素材・実出力を確認する。

main/手動の検査が通れば dist/ のみをPagesのartifactとして配置する。Pull Requestは検証だけ。Firefox/WebKitの限定した保存・出力経路も別ジョブで実行し、失敗時は配置しない。deployジョブだけがpages:write / id-token:writeを持ち、github-pages環境へ出す。releaseイベント、タグ作成、Release作成、npm publishは設定しない。

Pages設定のBuild and deployment → SourceはGitHub Actionsを選ぶ。[公式のカスタムワークフロー説明](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)に沿う。

CIの自動検査とローカルの完了ゲートを区別する。CIはWindows固定の0画素比較・独立した全PDF解析・人間/AIによる目視承認を実行しない。プロダクト全体の合格は [ACCEPTANCE](ACCEPTANCE.md) に従う npm run verify と同じ指紋の実証拠で判断する。

## Gitと原本

生成済みdist、output、端末の設定、キャッシュ、node_modulesはGitへ入れない。通常のソースはLFへ揃え、原本・固定fixture・同梱配布物は .gitattributes で変換を止めてハッシュを守る。元の共有仕様と設計会話は取得資料として保存し、ユーザーの実作業原稿を同梱する用途へ転用しない。

本体の再利用ライセンスは未決。サードパーティのOFL/MIT/ISC/Apache等の原文は同梱を維持する。リポジトリの公開とライセンス付与は別の判断。

## 保存を移す

GitHub PagesとローカルURLは別の保存領域。必要な本はローカル版から作業JSONを書き出し、公開版で読み込む。サーバーへ送る操作にはならず、読み込みもブラウザー内で行う。初回にはフォント等の静的ファイル取得が必要で、オフライン再起動保証はまだ提供しない。

配置結果、実行コマンド、終了コード、ソース指紋、公開側の読み込み/保存/出力確認はoutput/deploymentへ残す。サイトが開けること、CI成功、全体ゲート成功をそれぞれ確認する。
