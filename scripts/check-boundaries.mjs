import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { absolute, posix, readJson, walk } from './lib.mjs';

export function inspectBoundaries(files, policy) {
  const canonical = value => {
    const normalized = posix(path.resolve(value));
    return ts.sys.useCaseSensitiveFileNames ? normalized : normalized.toLowerCase();
  };
  const sources = new Map(files.map(file => [canonical(absolute(file.path)), file.source]));
  const options = { noLib: true, noResolve: true, target: ts.ScriptTarget.ESNext, allowJs: true, jsx: ts.JsxEmit.Preserve };
  const host = ts.createCompilerHost(options);
  host.getSourceFile = (name, languageVersion) => sources.has(canonical(name)) ? ts.createSourceFile(canonical(name), sources.get(canonical(name)), languageVersion, true) : undefined;
  const program = ts.createProgram([...sources.keys()], options, host), checker = program.getTypeChecker();
  const errors = [];
  const layerOf = file => posix(path.relative(absolute('src'), file)).split('/')[0];
  function inspectImport(from, specifier) {
    const layer = layerOf(from);
    if (!specifier.startsWith('.')) {
      if (policy.pureLayers.includes(layer) && !(policy.allowedExternalImports[layer] ?? []).includes(specifier)) errors.push(`${posix(path.relative(absolute(''), from))}: pure layer imports ${specifier}`);
      if (specifier.startsWith('@/') || specifier.startsWith('#')) errors.push(`${from}: import alias is not covered; add explicit resolution before using it`);
      return;
    }
    const base = canonical(path.resolve(path.dirname(from), specifier)), withoutJs = base.replace(/\.(?:m?js|jsx)$/u, '');
    const bundledLayer = policy.bundledModules?.[posix(path.relative(absolute('src'), base))];
    if (bundledLayer) {
      if (layer !== bundledLayer) errors.push(`${posix(path.relative(absolute(''), from))}: ${layer} cannot import a bundled ${bundledLayer} module`);
      return;
    }
    const target = [base, `${base}.ts`, `${base}.js`, `${base}.mjs`, `${base}/index.ts`, `${base}/index.js`, `${withoutJs}.ts`, `${withoutJs}.tsx`].find(item => sources.has(item));
    if (!target) { errors.push(`${from}: unresolved local import ${specifier}`); return; }
    if (!(policy.layers[layer] ?? []).includes(layerOf(target))) errors.push(`${posix(path.relative(absolute(''), from))}: ${layer} cannot depend on ${layerOf(target)}`);
  }
  for (const [name] of sources) {
    const file = program.getSourceFile(name), layer = layerOf(name);
    if (!file) { errors.push(`${name}: source could not be parsed; boundary verification is incomplete`); continue; }
    if (!Object.hasOwn(policy.layers, layer)) { errors.push(`${name}: source must belong to a declared layer`); continue; }
    function visit(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) inspectImport(name, node.moduleSpecifier.text);
      if (ts.isImportEqualsDeclaration(node)) errors.push(`${name}: import = is outside the ESM contract`);
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
        const argument = node.arguments[0];
        if (argument && ts.isStringLiteral(argument)) inspectImport(name, argument.text);
        else errors.push(`${name}: computed imports cannot be verified`);
      }
      // Type fields called "document" are data, not browser access.
      if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isTypeNode(node)) return;
      if (policy.pureLayers.includes(layer) && ts.isIdentifier(node) && policy.forbiddenGlobals.includes(node.text)) {
        const parent = node.parent;
        const propertyName = (ts.isPropertyAccessExpression(parent) && parent.name === node) || (ts.isPropertyAssignment(parent) && parent.name === node) || (ts.isPropertyDeclaration(parent) && parent.name === node);
        const symbol = checker.getSymbolAtLocation(node);
        const local = symbol?.declarations?.some(declaration => sources.has(canonical(declaration.getSourceFile().fileName)));
        if (!propertyName && !local) errors.push(`${posix(path.relative(absolute(''), name))}: pure layer uses browser global ${node.text}`);
      }
      ts.forEachChild(node, visit);
    }
    if (file) visit(file);
  }
  return [...new Set(errors)];
}

export async function checkBoundaries() {
  const files = (await walk('src')).filter(file => /\.(?:[cm]?js|tsx?)$/u.test(file));
  const sources = await Promise.all(files.map(async file => ({ path: file, source: await readFile(absolute(file), 'utf8') })));
  const errors = inspectBoundaries(sources, await readJson('harness/boundaries.json'));
  if (errors.length) throw new Error(errors.join('\n'));
  return files.length;
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) console.log(`依存境界を確認しました: ${await checkBoundaries()} files`);
