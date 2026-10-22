import { spawnSync } from 'node:child_process';
import { absolute, fingerprint, readJson } from './lib.mjs';
const directory='output/press-2026-10-22';
const manifest=await readJson(directory+'/manifest.json');
if(manifest.sourceFingerprint!==await fingerprint())throw new Error('STALE_EXPORTS: 印刷用PDFを作り直してください。');
for(const file of ['b6-mono','a5-color','compat-firefox','compat-webkit'])if((await readJson(directory+'/'+file+'.json')).sourceFingerprint!==manifest.sourceFingerprint)throw new Error('STALE_EXPORTS: 判型別の印刷PDFを作り直してください。');
const result=spawnSync(process.env.BOOKMAKER_PYTHON??'python',[absolute('scripts/verify-press-pdf.py'),absolute(directory)],{cwd:absolute(''),stdio:'inherit'});
if(result.error)throw result.error;
if(result.status!==0)process.exitCode=result.status??1;
