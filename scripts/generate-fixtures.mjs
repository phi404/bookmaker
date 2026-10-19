import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { absolute, hash } from './lib.mjs';

const paragraph = '雨が上がったあとも、街はしばらく静かだった。窓辺に置いた本を開くと、昨日まで気づかなかった一文が目に入った。言葉は変わっていない。それでも、読む人のいる場所によって、余白の意味は少しずつ変わっていく。';
const basic = Array.from({ length: 12 }, (_, i) => `${i + 1}冊目の本。${paragraph}`).join('\n') + '\n「また、ここから読もう」\n　すでに字下げされた段落も、そのまま受け取る。\n';
const punctuation = ('これは、禁則処理を確認するための文章です。「彼は、窓の外を見た。」（小さな注記も確認する。）'.repeat(6)) + '\n……本当にそうだろうか。\n――彼はそう言って、振り返った。\n';
const mixed = '2026年9月30日。\nChatGPTやHTML、CSS、PDFなどの英数字が文章中に入る。\nABC123と日本語が混在する。\nURL https://example.invalid/path と 3.14 を確認する。\n';
const unicode = 'か\u3099 と が は入力されたまま保持する。\n𠮷と葛\u{E0100}、👩‍💻を欠落させない。\n<script>alert("test")</script> & <img src=x onerror=alert(1)>\n';
const long = '長い原稿でも文字を失わず、順序を保ってページへ流し込む。'.repeat(4000).slice(0, 100000);
const malformed = '# Markdownとしては解釈しない\n｜漢字《よみ\n漢字《かんじ》も自動解釈しない。\n[未知の指定]\n';
const pageBreaks = '前\n[改ページ]\n[改ページ]\n後\n[改ページ]\n';
const heading = '一\n二\n三\n四\n[見出し] 第一章\n本文と見出しを結び付ける。\n';
const ruby = '｜薔薇《ばら》が咲いていた。\n|組版《くみはん》は、見た目以上に面倒である。\nあいうえおかきく｜余白《よはく》を読む。\n';

/** Independent expected body/readings are fixed here, not derived through the production parser. */
export function fixtureFiles() {
  const cases = [
    { id: 'basic', phase: 'slice-1', source: basic, body: basic.replaceAll('\n', ''), readings: '', minPages: 2, checks: ['text-preservation', 'indent', 'visual', 'export'] },
    { id: 'punctuation', phase: 'slice-1', source: punctuation, body: punctuation.replaceAll('\n', ''), readings: '', checks: ['text-preservation', 'kinsoku', 'paired-marks', 'visual'], grid: { maxCharsPerLine: 10 } },
    { id: 'mixed-text', phase: 'slice-1', source: mixed, body: mixed.replaceAll('\n', ''), readings: '', checks: ['text-preservation', 'visual'] },
    { id: 'unicode', phase: 'slice-1', source: unicode, body: unicode.replaceAll('\n', ''), readings: '', checks: ['text-preservation', 'escaping', 'visual'] },
    { id: 'long-chapter', phase: 'slice-1', source: long, body: long, readings: '', minPages: 2, checks: ['text-preservation', 'determinism', 'geometry'] },
    { id: 'empty', phase: 'slice-1', source: '', body: '', readings: '', exactPages: 1, checks: ['text-preservation'] },
    { id: 'malformed-markup', phase: 'slice-1', source: malformed, body: malformed.replaceAll('\n', ''), readings: '', checks: ['text-preservation'] },
    { id: 'page-breaks', phase: 'mvp', source: pageBreaks, body: '前後', readings: '', exactPages: 4, blockKinds: ['paragraph', 'pageBreak', 'pageBreak', 'paragraph', 'pageBreak'], checks: ['text-preservation', 'blank-pages'] },
    { id: 'heading', phase: 'mvp', source: heading, body: '一二三四第一章本文と見出しを結び付ける。', readings: '', blockKinds: ['paragraph', 'paragraph', 'paragraph', 'paragraph', 'heading', 'paragraph'], grid: { maxLinesPerPage: 5 }, checks: ['text-preservation', 'keep-with-next'] },
    { id: 'ruby', phase: 'mvp', source: ruby, body: '薔薇が咲いていた。組版は、見た目以上に面倒である。あいうえおかきく余白を読む。', readings: 'ばらくみはんよはく', grid: { maxCharsPerLine: 10 }, checks: ['text-preservation', 'ruby', 'visual'] },
  ];
  const files = new Map();
  const manifest = { schemaVersion: 1, fixtures: cases.map(({ id, phase, source, body, readings, ...rest }) => {
    const file = `fixtures/${id}.txt`;
    files.set(file, source);
    return { id, phase, file, sourceSha256: hash(source), bodySha256: hash(body), bodyLength: [...body].length, readingsSha256: hash(readings), ...rest };
  }) };
  files.set('fixtures/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
  return files;
}

export async function checkFixtures() {
  for (const [file, expected] of fixtureFiles()) {
    if (await readFile(absolute(file), 'utf8') !== expected) throw new Error(`Fixture drift: ${file}. 原稿・期待値・理由を一緒に更新してください。`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (process.argv.includes('--check')) {
    await checkFixtures(); console.log('固定fixtureと期待値が一致しています。');
  } else {
    await mkdir(absolute('fixtures'), { recursive: true });
    for (const [file, value] of fixtureFiles()) await writeFile(absolute(file), value, 'utf8');
    console.log('10種類のfixtureと独立した期待値を生成しました。');
  }
}
