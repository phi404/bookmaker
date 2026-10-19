import { writeFile, mkdir } from 'node:fs/promises';
import { zipSync, strToU8 } from '../public/vendor/fflate.js';
import { absolute } from './lib.mjs';
import { SAMPLE } from '../src/domain/sample.ts';

// Small, authored OPC package. All expected text is visible here; no production parser is used.
const document = `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>第一章　雨のあと</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">　窓辺に</w:t></w:r><w:r><w:ruby><w:rt><w:r><w:t>ばら</w:t></w:r></w:rt><w:rubyBase><w:r><w:t>薔薇</w:t></w:r></w:rubyBase></w:ruby></w:r><w:r><w:t>を置く。</w:t></w:r></w:p><w:p><w:r><w:rPr><w:em w:val="comma"/></w:rPr><w:t>静かな言葉</w:t></w:r><w:r><w:t>が残る――。</w:t></w:r></w:p><w:p><w:r><w:br w:type="page"/></w:r><w:r><w:t>[未知の指定]も原稿に残す。</w:t></w:r></w:p><w:sectPr><w:pgSz w:w="5953" w:h="8391"/></w:sectPr></w:body></w:document>`;
const parts = {
  '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  '_rels/.rels': '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  'word/document.xml': document,
};
await mkdir(absolute('fixtures/imports'), { recursive: true });
await writeFile(absolute('fixtures/imports/semantic.docx'), zipSync(Object.fromEntries(Object.entries(parts).map(([name, text]) => [name, [strToU8(text), { mtime: new Date('2020-01-01T00:00:00Z') }]])), { level: 0 }));
await writeFile(absolute('fixtures/imports/semantic.md'), '# 第一章\n　｜薔薇《ばら》が咲いた。\n\n---\n\n## 第二章\n[圏点]静かな言葉[/圏点]――コーヒー。\n');
console.log('Authored DOCX and Markdown examples written.');
await mkdir(absolute('fixtures/samples'), { recursive: true });
await writeFile(absolute('fixtures/samples/本文サンプル.txt'), SAMPLE.replace('本屋', '｜本屋《ほんや》').replace('「今日は、ずいぶん早いね」', '「今日は、ずいぶん早いね――」').replace('終わった物語が', '[圏点]終わった物語[/圏点]が').replace('\n\n　学校まで', '\n[改ページ]\n[見出し:2] 桜の下\n\n　学校まで'));
