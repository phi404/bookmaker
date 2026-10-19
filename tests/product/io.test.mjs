import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TextEncoder } from 'node:util';
import * as lib from '../../public/vendor/pdf-lib.js';
import { decodeText } from '../../dist/io/text.js';

test('bundled PDF ES module exposes the actual image-stream API', async () => {
  const document = await lib.PDFDocument.create(), width = 105 * 72 / 25.4, height = 148 * 72 / 25.4;
  const stream = document.context.flateStream(new Uint8Array([0, 0, 0, 255, 255, 255]), { Type: 'XObject', Subtype: 'Image', Width: 2, Height: 1, ColorSpace: 'DeviceRGB', BitsPerComponent: 8 });
  assert.ok(stream.getContentsSize() > 0);
  const page = document.addPage([width, height]), reference = document.context.register(stream);
  const name = page.node.newXObject('BookPage', reference);
  page.pushOperators(lib.pushGraphicsState(), lib.concatTransformationMatrix(width, 0, 0, height, 0, 0), lib.drawObject(name), lib.popGraphicsState());
  const bytes = await document.save(), restored = await lib.PDFDocument.load(bytes);
  assert.equal(restored.getPageCount(), 1);
  assert.equal(restored.getPage(0).getWidth(), width); assert.equal(restored.getPage(0).getHeight(), height);
  assert.equal(restored.getPage(0).node.Resources().lookup(lib.PDFName.of('XObject')).keys().length, 1);
});

test('TXT decodes UTF-8, BOM UTF-16 and Shift_JIS without replacement characters', () => {
  const utf8 = new TextEncoder().encode('日本語\r\n本文');
  assert.deepEqual(decodeText(utf8.buffer), { text: '日本語\r\n本文', encoding: 'UTF-8' });
  const le = new Uint8Array([255, 254, 229, 101, 44, 103, 158, 138]);
  const be = new Uint8Array([254, 255, 101, 229, 103, 44, 138, 158]);
  assert.deepEqual(decodeText(le.buffer), { text: '日本語', encoding: 'UTF-16LE' });
  assert.deepEqual(decodeText(be.buffer), { text: '日本語', encoding: 'UTF-16BE' });
  assert.deepEqual(decodeText(new Uint8Array([147, 250, 150, 123, 140, 234]).buffer), { text: '日本語', encoding: 'Shift_JIS' });
  assert.throws(() => decodeText(new Uint8Array([255, 254, 1]).buffer));
});
