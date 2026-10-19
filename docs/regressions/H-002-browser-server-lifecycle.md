# H-002: WindowsでE2Eのサーバー終了待ちが止まる

- 発見日 / 環境: 2026-10-01、Windows、Node 24.19.0、Playwright 1.63.0。
- 修正前: `npm run test:e2e` は4テストの結果を出した後、最終サマリーと終了コードが返らず停止。2回再現し、実行セッションを中断した。
- 原因の切り分け: npm/shell経由で起動するPlaywright webServerのプロセスツリー終了待ちに留まる。製品側のPDFはダウンロード済み。OS側のプロセス列挙はアクセス拒否のため、具体的なkill失敗原因は未確定。
- 修正: `scripts/browser-test.mjs` がNodeサーバーを子プロセスとして直接所有する。IPCでready/shutdownをやり取りし、Playwright CLI終了時にHTTP接続を閉じる。OSのプロセスツリー列挙や強制終了を前提にしない。
- 再発検知: `npm run test:e2e`、`npm run test:visual`、`npm run verify` の終了コードまで確認する。テスト件数や出力アサーションは維持する。
- 修正後: 検証記録を `docs/QA.md` に残す。
