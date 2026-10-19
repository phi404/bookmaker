# 文書案内と正本の分担

文書は機能名ではなく、**何の判断に使うか**で分ける。現行仕様、将来の候補、過去の経緯、実行証拠を同じ文書へ追記し続けない。コードがあること、検証したこと、採用した設計であることも区別する。

## 現行の正本

| 判断したいこと | 正本 | 持たせないもの |
| --- | --- | --- |
| 起動・試用・作業保存 | [README](../README.md) | 全機能の説明、開発履歴 |
| 開発者が守る手順 | [AGENTS](../AGENTS.md) | 完了済みタスクを永久に「現在」とする指示 |
| 文書の配置と優先関係 | この文書 | 個々の機能仕様 |
| 誰の何を解決するか | [PRODUCT](PRODUCT.md) | 実装済み一覧、ロードマップ |
| 判断が割れたときの原則 | [PRINCIPLES](PRINCIPLES.md) | UI部品の位置や技術の細部 |
| 現在できること・上限・制約 | [CAPABILITIES](CAPABILITIES.md) | 将来案、過去の成功件数 |
| 今後の進め方・未決事項 | [ROADMAP](ROADMAP.md) | 未実装項目の対応済み表記 |
| 責務分離・処理・保存・出力 | [ARCHITECTURE](ARCHITECTURE.md) | データの意味の再定義 |
| Book Model・継承・Scopeの意味 | [PUBLISHING_MODEL](PUBLISHING_MODEL.md) | ボタン配置、将来の型を対応済みとする宣言 |
| 組版の不変条件・規則・割り切り | [TYPOGRAPHY](TYPOGRAPHY.md) | 入力記法の重複定義 |
| 入力記法と交換形式 | [SOURCE_FORMAT](SOURCE_FORMAT.md) | 自由ページの座標や奥付詳細の記法化 |
| 操作モデルと表示契約 | [UI](UI.md) | 全設定の詳細、探索案の採用扱い |
| 何を満たしたら合格か | [ACCEPTANCE](ACCEPTANCE.md) | 実行結果の手書き転記 |
| どう検査し、証拠を更新するか | [HARNESS](HARNESS.md) | アプリを動かさない合格宣言 |
| 結果の場所・鮮度・限界 | [QA](QA.md) | 過去と現在の結果の混在 |
| 静的配布・GitHub試用環境・ローカル再現 | [DEPLOYMENT](DEPLOYMENT.md) | リリース済みの扱い、原稿のクラウド処理 |
| なぜ選択を採用・変更したか | [DECISIONS](DECISIONS.md) | 全仕様の再掲 |
| 表現ケースを概念に還元できるか | [CASE_CATALOG](CASE_CATALOG.md) | 未提供の実書籍を観察済みとする記録 |
| 原本・依存物・技術資料の出典 | [sources/README](../sources/README.md) | 参照チャットの助言を人間の直接指示に昇格 |
| 過去の範囲・探索・検証を探す | [history/README](history/README.md) | 現行仕様の上書き |

責務の機械可読な登録は [harness/documents.json](../harness/documents.json)。新しい文書を作る前に、既存の目的で収まらない理由を確認する。現行の目的には正本を一つだけ割り当てる。

## 目的別の読み順

- **実装開始**：PRODUCT → PRINCIPLES → CAPABILITIES → 関連する契約 → ACCEPTANCE / 要件対応 → HARNESS。将来案を扱う場合はROADMAPとDECISIONSも読む。
- **UI改修**：UI → PUBLISHING_MODEL → 関連するCAPABILITIES / SOURCE_FORMAT。操作の変更がモデル・保存・出力を壊さないか確認する。
- **組版・出力改修**：TYPOGRAPHY → ARCHITECTURE → PUBLISHING_MODEL → CASE_CATALOG。新しい反例を独立したfixtureへ追加する。
- **文書・ハーネス改修**：この文書 → ACCEPTANCE → HARNESS → QA → documents / requirements / boundariesの登録。
- **以前の理由を調べる**：DECISIONS → history/README → 対象タスク・回帰記録・出典。

## 仕様と証拠の優先関係

現在のユーザーの明示指示を優先する。目的と原則を保ち、必要なら現行仕様と要件・テストを一緒に変更する。参照チャット、共有原本、過去の探索は出典資料で、現行仕様を自動的に上書きしない。

実装と仕様が食い違えば、どちらかを黙って正解にせず、不具合・未実装・仕様変更のいずれかとして記録する。検証済みと言うには現在のソース指紋と実行証拠が必要。仕様書に「対応」とあることだけでは合格にならない。

## 更新の約束

機能と制約はCAPABILITIES、データの意味はPUBLISHING_MODEL、入力はSOURCE_FORMAT、操作はUI、処理はARCHITECTURE、組版はTYPOGRAPHYへ一度だけ定義する。他の文書には必要な説明とリンクを置く。

要件追加・変更は [requirements.json](../harness/requirements.json) の `specification` から現行の正本へ接続し、既存のfixture・検査ルートを落とさない。実行した件数・終了コード・環境・指紋はoutputへ保存し、各仕様書へ毎回コピーしない。

完了したタスクや不採用の探索案は履歴と明示する。原本 [PRODUCT_OVERVIEW](PRODUCT_OVERVIEW.md) と [参照チャット](../sources/conversation.json) は保存資料で、派生仕様の更新で改変しない。

仕様間のリンクはcheckout内で解決するものにする。outputの実行証拠は保管場所のパスとして記述し、生成前の文書整合検査にファイルの実在を要求しない。証拠そのものの実在と鮮度は出力・目視・完了ゲートが確認する。特定PCの絶対パスを資料のリンクへ埋め込まない。
