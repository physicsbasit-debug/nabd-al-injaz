import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('Arabic RTL document',()=>{assert.match(html,/lang="ar"/);assert.match(html,/dir="rtl"/)});
test('dashboard completion is calculated from task state',()=>{assert.match(app,/tasks\.filter\(t=>t\.done\)\.length/);assert.match(app,/Math\.round\(done\/tasks\.length\*100\)/)});
test('prototype data is explicitly marked',()=>{assert.match(app,/بيانات توضيحية/);assert.match(app,/نموذج تجريبي/)});
