# H-001：Windowsで依存境界を読み飛ばしていた検査器

- 発見日：2026-10-01
- 環境：Windows、Node.js 24.19.0、TypeScript 6.0.3
- 関連：R-02、R-10

境界検査器の初回実行は違反を報告しなかった。一方、typesetting → uiの禁止依存と、window/fetch/node:fsの混入を与える自己テストは失敗した。単に検査器がエラーを返さないことを合格証拠にすると、この見落としが残る。

原因はWindowsパスとTypeScriptが使うパス表現の違い。CompilerHostがソースを取得できず、構文木がない状態を読み飛ばしていた。

`npm run verify:harness` の修正前結果は自己テスト9件中7件合格・2件失敗、終了コード1。修正後は9件合格となり、その後の追加を含む最終スイートでは10件合格。

修正はパスの区切り・大文字小文字を正規化し、ソースを取得できない場合も検証未完了として失敗させること。禁止依存とブラウザAPIの自己テストを残し、コメント・文字列・型のフィールド名・ローカル変数には誤検出しないことも確認した。

回帰確認：`tests/harness/integrity.test.mjs` の `forbidden layer import...`、`pure typesetter...`、`comments, string content...`。静的検査は万能ではないが、ソースを読めなかったことを「問題なし」にしない。
