# 印刷所の入稿条件とPDF出力

調査日：2026-10-22。同人小説・同人誌と一般冊子の代表的な入稿先を比較した。市場占有率の順位ではない。商品・印刷方式・入稿経路で条件が変わるため、社名だけで「入稿可能」と判定するプリセットは設けない。

## 公式資料から確認した違い

| 入稿先 | 確認した条件 | 本ツールへの反映・限界 |
| --- | --- | --- |
| [栄光・セルフチェック](https://www.eikou.com/selfcheck/fileup-btn/) | 画像原稿の基準は塗り足し3mm、トンボなし。モノクロ600dpi、カラー350dpiを推奨し、モノクロはグレースケールを指定 | 解像度・色・用紙の初期値の参考にする。画像原稿の基準をPDF全般の受入保証へ広げない |
| [栄光・縦式PDF](https://www.eikou.com/making/tateshiki/) | 原寸の本文PDF、塗り足し3mmを案内。断ち落としがない小説では0mmも扱う | 原稿・文字を拡大せず、用紙の外側だけを追加する |
| [緑陽社・基本](https://www.ryokuyou.co.jp/doujin/manual/basic.html)、[Photoshop](https://www.ryokuyou.co.jp/doujin/manual/photoshop.html) | 端に絵柄があれば各辺3mm。端にかからない小説本文では省略できる。スミ本文はグレースケール／二階調。全頁のノンブルを求める | 0mmを禁止しない。本文向けグレースケールを追加。ページ番号・白紙・奥付は入稿先に合わせて別途確認する |
| [プリントオン](https://www.print-on.jp/doujin/company/kisochishiki/tonbo_nuritashi.html) | 漫画原稿と小説／PDFではトンボの扱いが違い、小説／PDFはトンボなしでも受け付ける。断ち落としは各辺約3mm以上 | トンボを一律に付けない。角・センターも明示選択にする |
| [ねこのしっぽ](https://www.shippo.co.jp/neko/faq_3.shtml) | データは中心を基準に処理するためトンボは基本不要。塗り足しは各辺3mm。ファイル番号とノンブルの整合を重視 | 原寸・単ページの順序を維持し、範囲出力で番号を振り直さない |
| [グラフィック・PDF](https://www.graphic.jp/feature/illustrator_trim_mark)、[冊子](https://www.graphic.jp/data_guide/product/booklet/perfect_bind/printing_area) | PDFはトンボなし・各辺3mmの裁ち落としを案内。重要な文字は仕上がりの内側へ置く。PDFの規格・色は入稿方式の指定も確認する | 汎用PDFの物理寸法だけを合わせても、PDF/Xや色管理の適合証明にはしない |
| [ラクスル・冊子](https://raksul.com/guide/products-faq/booklet/faq-1/)、[塗り足しと文字](https://raksul.com/guide/create-data/knowledge-of-printing/extra-length-from-trim-mask/) | フチなしの冊子は仕上がりより各辺3mm外側まで背景を延ばす。重要な文字は内側へ置く | 白い余白を足すだけで絵柄の塗り足しを完成扱いにしない |

追加で[ポプルスのQ&A](https://popls.co.jp/pop/genkou/q_and_a.html)と[STARBOOKSのテンプレート説明](https://www.starbooks.jp/manual/pdf/how_to_temp01_03.pdf)も検索した。公式検索掲載では、ポプルスはRGBや原寸と異なる場合のトンボ、STARBOOKSは塗り足し込みの原寸ならトンボ不要という説明を確認できた。ただし本文の取得はそれぞれ502・403で完了しなかったため、最新の全条件を確認済みとはせず、社別プリセットの根拠にも使っていない。

## 採用する出力

- 閲覧用は従来の300dpi・RGB・仕上がり寸法。目次リンクとしおりを維持する。
- 印刷・モノクロ本文は600dpi・DeviceGray・各辺3mm・トンボなしを初期値とする。本文の標準文字は黒で描く。二階調や1200dpiではない。
- 印刷・カラーは350dpi・RGB・各辺3mm・トンボなしを初期値とする。本文の標準文字は黒で描く。CMYKへの変換ではない。
- カスタムで塗り足し0〜10mm、トンボなし／角／角とセンター、300／350／600dpi、RGB／グレースケールを選べる。
- 印刷用PDFにはリンク注釈・しおりを付けない。閲覧用と印刷用の目的を分ける。
- 値はBook ModelのprintSettingsに一度だけ保存する。原稿・本文版面や構成順を変更せず、Undo・JSON・制作データZIPからも復元する。

PDFのMediaBoxは用紙、TrimBoxは仕上がり、BleedBoxは塗り足しを含む範囲。トンボは塗り足しの外へ置く。A6・3mmならトンボなしの用紙は111×154mm、角とセンター付きでは125×168mmとなる。トンボは0.25ptの黒線で、色版合わせのレジストレーション色やカラーバーではない。

参照：[Adobeのトンボと裁ち落とし](https://helpx.adobe.com/indesign/using/printers-marks-bleeds.html)、[pdf-libのページボックスAPI](https://pdf-lib.js.org/docs/api/classes/pdfpage)。既存のpdf-libと共通SVGを使い、出力のために別の行分割・ページ分割は作らない。

## 塗り足しと素材

背景色は外側まで塗る。画像や自由要素は実際に紙面外まで続く部分を出力する。本文やページ全体の拡大、端の画素の引き伸ばしによる自動補完はしない。紙端に接していて指定の塗り足しまで届かない要素は、出力前に該当箇所へ戻れるようにする。

素材ページの「端まで広げる」と裁ち落とし幅を使えば、原本にある外側の絵柄を配置できる。すでに切り落とされた画像に外側の絵は復元できない。外部PDFのCropBoxの外を勝手に復活させない。

PDFを画像として印刷する場合、素材原本を同梱PDF.jsで出力に必要な解像度へ描き直す。プレビュー用画像を600dpiに引き伸ばすこととは区別する。PDF内部の写真の解像度まで自動保証するものではない。

素材PDFの文字・図形保持はRGBで使用する。元の色・書体資源を残す処理であり、CMYK化や埋め込み不足の修復ではない。グレースケールとの併用は明示的に拒否する。

## 今回の到達点と残り

汎用の本文PDFに、物理寸法、実際の塗り足し、トンボ、高解像度、グレースケールを接続する。本文文字は画像で、検索可能な文字PDF・PDF/X・ICC色管理・CMYK変換・総インキ量・オーバープリント・面付け・表紙展開は未対応。社別の注文受付・印刷見本・実際の入稿は行わない。

入稿時には注文判型、本文／表紙の分離、綴じ方、ノンブル、白紙、ページ数の単位、奥付、出力の全ページ、色とPDF形式を、その商品・窓口の最新の指定と照らす。個別の利用条件をアプリ側で無断修正しない。

現在の操作と上限は[UI](../UI.md)・[CAPABILITIES](../CAPABILITIES.md)、保存は[PUBLISHING_MODEL](../PUBLISHING_MODEL.md)、処理は[ARCHITECTURE](../ARCHITECTURE.md)へ集約する。この文書は調査と採用根拠の記録である。
