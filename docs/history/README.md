# 履歴資料の案内

この索引以下とtasks/design/regressionsは、範囲の経緯・探索・不具合の再現を調べるための資料。現行の正本は [INDEX](../INDEX.md)。過去の文中の「現在」「今回」「未実装」を現時点の仕様にしない。

## 完了した実装段階の計画

| 文書 | 当時の仕事 |
| --- | --- |
| [FIRST_SLICE](../tasks/FIRST_SLICE.md) | 原稿→A6縦書き→ページ列→実PNG/PDFの背骨 |
| [PAGE_CONTROLS](../tasks/PAGE_CONTROLS.md) | 一枚/SNS・判型・構造/番号/柱・他形式 |
| [MODEL_FOUNDATION](../tasks/MODEL_FOUNDATION.md) | 正本AST・ID・スタイル・意味的Scope |
| [BOOK_WORKSPACE](../tasks/BOOK_WORKSPACE.md) | 同じ本の複数ビュー・特殊ページ・素材 |
| [MANUSCRIPT_UX](../tasks/MANUSCRIPT_UX.md) | 初回原稿・編集幅・端の開閉・全体/局所の分離 |
| [EXCEPTION_STYLES](../tasks/EXCEPTION_STYLES.md) | 可変文字/版面・縦横一二段・追加判型/画像 |

タスクの計画は当時の有限範囲を保つ。全体構想の全実装を意味せず、新しい作業の恒久指示ではない。現対応は [CAPABILITIES](../CAPABILITIES.md)。

## 設計探索と整理前の記録

| 資料 | 扱い |
| --- | --- |
| [INTERACTION_MODEL](../design/INTERACTION_MODEL.md) / [VIEW_EXPLORATION](../design/VIEW_EXPLORATION.md) | 操作仮説と視覚探索。案は不採用 |
| [設計時BOOK_WORKSPACE](../design/BOOK_WORKSPACE.md) | 修正版の設計根拠。後続UX/例外改修前の詳細。現在はUI / PUBLISHING_MODELへ統合 |
| [VERIFICATION_HISTORY](VERIFICATION_HISTORY.md) | 整理前QAの段階別成功・当時の制約 |
| [DECISION_HISTORY](DECISION_HISTORY.md) | 整理前の決定の詳細。現索引はDECISIONS |

## 日付付きの技術調査

| 資料 | 扱い |
| --- | --- |
| [2026-10-21 組版・編集・出力の再利用](../research/2026-10-21-typesetting-and-output.md) | 標準/既存エンジン/ライブラリの取得時点の比較と、同梱pdf-libの限定実験。候補の本実装・全面適合を示さない。現在の優先順位はROADMAP |

## 回帰記録

| 記録 | 再発を防ぐ対象 |
| --- | --- |
| [H-001](../regressions/H-001-boundary-windows.md) / [H-002](../regressions/H-002-browser-server-lifecycle.md) | Windows依存境界/ブラウザ用サーバーの終了 |
| [P-001](../regressions/P-001-pdf-module.md) / [P-002](../regressions/P-002-draft-reload.md) / [P-003](../regressions/P-003-damaged-draft-message.md) | PDFモジュール、復元、破損の通知 |
| [P-004](../regressions/P-004-decoration-and-heading-overlap.md) / [P-005](../regressions/P-005-zoom-reading-start.md) | 装飾/見出し衝突、拡大時の読み始め |
| [P-006](../regressions/P-006-uniform-position-choices.md) / [P-007](../regressions/P-007-export-name-during-reflow.md) | SNSの位置選択、再組版中の出力名 |
| [P-008](../regressions/P-008-model-reference-and-mark-nesting.md) | モデルの参照と注釈の入れ子 |
| [P-009](../regressions/P-009-book-workspace-boundaries.md) | 特殊ページ/構成/素材/表示の境界 |
| [P-010](../regressions/P-010-manuscript-first-ux.md) | 原稿導入と編集のUX |
| [P-011](../regressions/P-011-exception-styles.md) | 可変書式・版面・文字方向・衝突 |
| [P-012](../regressions/P-012-workbench-keyboard-and-history.md) | GUI改修中の検索終了/フォーカスとスマホの共通履歴 |

| [P-013](../regressions/P-013-visible-format-and-import-readiness.md) | 原稿書式の投影、未知スタイル参照、取り込み/組版の準備状態 |

新しい不具合は [TEMPLATE](../regressions/TEMPLATE.md) に沿う。修正履歴は現行規則を上書きするものではないが、再現条件と検査の理由として維持する。

## 共有原本・取得情報

[PRODUCT_OVERVIEW](../PRODUCT_OVERVIEW.md) は共有Markdownを改変せず保存した原本。[参照チャット](../../sources/conversation.json) は取得できた本文の保存で、全添付を含むエクスポートではない。取得方法・ハッシュ・ライセンスは [sources/README](../../sources/README.md)。

## ロードマップからの実装

[2026-10-21の先行実装](2026-10-21-roadmap-implementation.md)は設定テンプレート、紙面/原稿位置、本文検索、保存競合保護、依頼集約と限定比較の記録。ロードマップ全体の完成を意味しない。

[本の仕上げと表示の修正](2026-10-21-book-finishing.md)はRM-12/13/21と通知・紙色・余白の規則の改修記録。

## 2026-10-22の続く実装

[編集対象と仕上げの実装記録](2026-10-22-context-and-finishing.md) / [同日の一次資料と比較](../research/2026-10-22-context-and-finishing.md)。現対応と未対応、操作確認と人間評価を分けて読む。
