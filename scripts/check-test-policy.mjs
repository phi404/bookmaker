import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { readText, walk } from './lib.mjs';

export function blockedTests(source) {
  const file = ts.createSourceFile('tests.mjs', source, ts.ScriptTarget.ESNext, true);
  const errors = [];
  const roots = new Set(['test', 'describe', 'it']);
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression) && roots.has(expression.expression.text) && ['skip', 'todo', 'only'].includes(expression.name.text)) errors.push(`blocked test modifier: ${expression.name.text}`);
      if (ts.isIdentifier(expression) && roots.has(expression.text)) {
        for (const argument of node.arguments) {
          if (ts.isObjectLiteralExpression(argument)) for (const property of argument.properties) if (['skip', 'todo', 'only'].includes(property.name?.getText(file))) errors.push('blocked test option');
          if ((ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)) && ts.isBlock(argument.body) && !argument.body.statements.length) errors.push('empty test body');
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return errors;
}
export async function checkTestPolicy() {
  const files = (await walk('tests')).filter(file => /\.(?:[cm]?js|tsx?)$/u.test(file));
  const errors = [];
  for (const file of files) errors.push(...blockedTests(await readText(file)).map(message => `${file}: ${message}`));
  if (errors.length) throw new Error(errors.join('\n'));
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await checkTestPolicy();
