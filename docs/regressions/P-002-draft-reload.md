# P-002: 最後の編集直後に再読み込みすると変更が残らない

- 関連要件: 作業保護、端末内保存。
- 発見日 / 環境: 2026-10-01、Chromium 153、375×812。
- 修正前: `node scripts/browser-test.mjs --grep 'immediate reload'`、終了コード1。原稿を貼り付け、文字サイズを変え、直ちに再読み込みするとデモ原稿へ戻った。
- 原因: 500msの自動保存待ちがページ遷移で失われた。
- 修正: 待機中の保存をpagehideとvisibilitychange(hidden)で同期的に確定する。壊れた保存データの保護と容量不足時の通知は維持する。
- 検出: `@flow draft survives an immediate reload after the last setting change` を保存待ちなしで継続実行する。
- 修正後の検証: `docs/QA.md`。OSによる強制終了やストレージ消去からの復旧保証はしない。
