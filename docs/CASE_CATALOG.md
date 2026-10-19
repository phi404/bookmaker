# 表現ケースの検証台帳

新しい見た目を専用機能へ直結させず、既存のプリミティブと表現方式で扱えるかを確かめる。下表はユーザーの例と合成fixtureで、特定の実書籍を観察済みという記録ではない。

## ケースと概念・証拠

| ID / 出発点 | 表現と使用概念 | 現在の確認・境界 |
| --- | --- | --- |
| C-01 / ユーザー例 | 中央/下揃え：Paragraph alignment | 行内方向のstart/center/end。ページ全体の自由位置とは別 |
| C-02 / ユーザー例 | 横書き奥付：StructuredPage + Page Style | book mixed / style-exceptionsで前後の本文と混在。→ R-32, R-38 |
| C-03 / ユーザー例 | 大きな余白・横書き/二段の章：Page / Section / Scope | 部分余白継承と再組版。固定ページ容量変更は未対応 |
| C-04 / ユーザー例 | 下の柱・左右別章名：RunningElement + Scope/条件 | 章改名/挿入/長文化、章最初の非表示。→ model-running / R-25, R-40 |
| C-05 / ユーザー例 | 章/節/小見出し：Heading + 安定ID | 見た目と意味を分け、目次は現在頁参照から生成。章名折返しと自動多頁、確定番号の一致 |
| C-06 / ユーザー例 | 太字/ルビ/4圏点/方向：Character + Inline | style-exceptions / nested。元文字・読み・局所解除を確認。非ASCII高度処理は未対応 |
| C-07 / ユーザー例 | 特別な字下げ/前後空き：Paragraph + Local | 原稿の空白不変、インデントと内側余白を分離。→ R-24, R-38 |
| C-08 / ユーザー例 | 算用数字/縦中横/漢数字：数字規則 | 自動/局所表示で元数字を保存。小数/年号/URLの厳密な組版は後続 |
| C-09 / ユーザー例 | 扉絵/挿絵：Asset + 構造参照 | フロー/独立/見開き/裁ち落とし想定。回り込み・captionは未対応 |
| C-10 / ユーザー例 | デザイン中扉：template → layout / asset | ID/位置/元テンプレートを保つ。自由配置はそのページだけ |
| C-11 / ユーザー例 | 外部PDF：AssetPage + 初期診断 | ローカル画像化と原本保持。色/埋め込み/入稿検査とは別 |
| C-12 / 合成反例 | 二段・14ptの次段落と前空き：Keep with next | 実メトリクスで必要行を見積もる。→ style-exceptions / P-011 |
| C-13 / 合成反例 | 上余白5mmと端8mmの柱：解決後PageStyle | 表示中の衝突のみ拒否、非表示条件を区別。→ P-011 |
| C-14 / 合成反例 | 日本語/ルビを含む欧文方向指定 | ASCII方向だけを変更し日本語を回転しない。圏点中心も検査。→ P-011 |
| C-15 / 合成反例 | 特殊ページの挿入/移動/削除・直後の改ページ | ID/詳細/本文を保ち、余分な白頁を作らない。→ book-special-break / P-009 |
| C-16 / 合成反例 | 初回原稿/パネル/全体と局所の混同 | UIの選択と編集を分離。→ modern-notation / R-35 / P-010 |

fixtureの原本・ハッシュは [元manifest](../fixtures/manifest.json)、[model manifest](../fixtures/model/manifest.json)、[book manifest](../fixtures/book/manifest.json)。具体的な検査ルートは [requirements](../harness/requirements.json)、回帰の原因は [履歴案内](history/README.md)。

## 新しいケースの記録欄

出発点（ユーザー例/合成反例/実物観察）、書名・版・頁・画像の出典、何を表したいか、既存の文字/段落/版面/章/Scopeでの表現、テンプレート/自由/外部の判断、新プリミティブが必要な理由、fixture/独立期待値、確認した結果、未対応を記録する。

実物が未提供なら頁や観察結果を作らない。目標はケースが増えても概念が際限なく増えないこと。新ケースは [ROADMAP](ROADMAP.md) の有限の作業へ選び、検証前に「対応済み」としない。

## 2026-10-19の操作監査から追加した反例

| 出発点 | 期待する結果 | 再現と検査 |
| --- | --- | --- |
| 32章・長い章名・60mm用紙 | 欠落やヘッダーとの重なりなく目次が続き、本文の確定頁を参照 | book-toc-many / ux-refinement product |
| 右が青、左が赤の見開き | 偶数の右面が青、奇数の左面が赤。左右共通の版面でも対向面をそろえる | book-spread-colors / ux-spread実PNG・PDF・ZIP・見開き |
| 揃え/文字サイズの異なる複数段落 | 混在を表示し、太さの変更で既存の差を潰さない | ux-refinement flow |
| 固定を含む複数要素 | 固定だけ動かず、削除が部分実行されず、Undoで一度に復元 | ux-refinement product / flow |
| PDFを2–3頁挿入して差し替え・再開 | 並びとAsset IDを保持し、参照先を欠く差し替えを拒否 | media / ux-refinement product / flow |
