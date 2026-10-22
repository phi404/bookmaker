# Compholio

原稿を読み込み、本のページを作るツールです。縦書き・横書き、ルビや圏点、目次、自由ページ、画像・PDF素材を扱い、PNG・PDFへ書き出せます。

[ブラウザーで使う](https://phi404.github.io/compholio/) · [使い方](docs/guide.md)

原稿と素材の処理・保存は端末内で行います。作業を別の環境へ持ち出すときは、JSONまたは制作データZIPを保存してください。

## ローカルで使う

Node.js 24を推奨します。

```sh
npm ci
npm run dev
```

ターミナルに表示されるURLを開いてください。

## 開発

```sh
npm run build
npm run serve
npm run verify:harness
```

[構成・検証・配布](docs/development.md)

本文のPDFは画像です。PDF/X・CMYK変換、任意の書体の追加には対応していません。印刷に使う場合は、注文する商品の入稿条件と出力したPDFを確認してください。
