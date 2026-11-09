import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const manager = readFileSync(new URL('../src/TaskManager.tsx', import.meta.url), 'utf8');
const model = readFileSync(new URL('../src/task-model.ts', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('Arabic RTL document', () => {
  assert.match(html, /lang="ar"/);
  assert.match(html, /dir="rtl"/);
});

test('dashboard and task manager share the same task state', () => {
  assert.match(app, /useState<Task\[\]>\(readTasks\)/);
  assert.match(app, /<TaskManager\s+tasks=\{tasks\}\s+setTasks=\{setTasks\}/);
  assert.match(app, /<ExecutiveDashboard\s+tasks=\{tasks\}/);
  assert.match(app, /tasks\.filter\(\(?t\)?\s*=>\s*t\.done\)/);
});

test('real task editor and local persistence are implemented', () => {
  assert.match(manager, /function saveEdit/);
  assert.match(manager, /حفظ التعديل/);
  assert.match(app, /localStorage\.setItem/);
  assert.match(model, /localStorage\.getItem/);
  assert.match(manager, /export \{ readTasks, STORAGE_KEY \}/);
});
