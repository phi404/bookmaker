# P-010 原稿入力・設定範囲のUX回帰

2026-10-03、ユーザーの実操作の指摘から再現。修正前の1440/1024pxでは「ソース」、等幅13px、行番号、横スクロール。375pxの初回はプレビューで原稿が隠れた。紙面の本文を選ぶと全体設定が消えた。画像は `output/ux/before/`。

`node scripts/browser-test.mjs --grep "@flow manuscript first|@flow body settings remain"`（BOOKMAKER_UX_CAPTURE=before）は4件すべて失敗、終了1。初回の原稿タブラベル/スマホ表示と、本文全体設定の維持を独立した観察期待値にした。

`node --test tests/product/manuscript-ux.test.mjs` は2件失敗、終了1。英語改ページdirectiveが段落になること、ASTからの記法移行関数がないことを確認。`fixtures/book/modern-notation.md` はルビ/圏点/太字/文字の星/右開始を含む。

原稿を初期表示、16px折返し・通常フォントへ変更し、行番号を削除。パネル端の開閉、幅を広げて戻す操作、本文全体/明示的な選択箇所を分離。記法の生成はASTから行い、元のIDと書式を保持する。テストの旧UI接続点を新しい操作へ変更し、本文/ID/出力の期待値は維持する。既存DOCXの取り込み期待値は同じ意味のMarkdown記法へ更新し、原fixtureは改変しない。

修正中に作品情報の移動先を誤って初期化が止まった。4フローがready待ちで失敗し、DOMを修正した。その後の4フローは終了0、プロダクト50件も終了0。途中の成功を総合完了とはしない。最終結果・画像差分・現行の指紋は `output/ux/implementation-report.md` と `output/verification/product.json` に記録する。

既存の多形式E2EでURLのコロンが不要に逃がされる回帰3件を検出。先にProductの普通のURL/行頭構文の保護を失敗させてから、inline/paragraphの文脈に応じたエスケープへ修正した。`---`やコードフェンスを含むTXTを文字のまま移行できること、同じ圏点の本文/ルビを単一スパンへ投影できることも確認する。元のE2EのURL文字列期待値は変更せず、関係する7フローは終了0。
