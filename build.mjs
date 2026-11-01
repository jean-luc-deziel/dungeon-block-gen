// Compiles src/*.ts -> js/*.js using the `typescript` package.
// Usage: node build.mjs [path/to/typescript.js]
// Falls back to node_modules/typescript if no path is given.
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const ts = require(process.argv[2] ? path.resolve(process.argv[2]) : 'typescript');

const configPath = ts.findConfigFile('.', ts.sys.fileExists, 'tsconfig.json');
const { config } = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config, ts.sys, path.dirname(configPath));
const program = ts.createProgram(parsed.fileNames, parsed.options);
const result = program.emit();
const diagnostics = ts.getPreEmitDiagnostics(program).concat(result.diagnostics);

for (const d of diagnostics) {
  const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
  if (d.file && d.start !== undefined) {
    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
    console.log(`${d.file.fileName}(${line + 1},${character + 1}): ${msg}`);
  } else {
    console.log(msg);
  }
}
console.log(`TypeScript ${ts.version}: ${diagnostics.length} diagnostic(s)`);
process.exit(diagnostics.length ? 1 : 0);
