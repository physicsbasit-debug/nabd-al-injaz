import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import yaml from 'js-yaml';

const readWorkflow = (name) =>
  yaml.load(readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8'));
const verify = readWorkflow('verify.yml');
const release = readWorkflow('deploy-pages.yml');
const dependencies = (job) => (Array.isArray(job.needs) ? job.needs : [job.needs].filter(Boolean));

test('release must wait for the same full verification suite before build and deploy', () => {
  assert.ok(
    Object.hasOwn(verify.on, 'workflow_call'),
    'verification must be callable by the release',
  );
  assert.ok(Object.hasOwn(verify.on, 'pull_request'), 'pull requests must still be verified');
  assert.equal(release.jobs.verify?.uses, './.github/workflows/verify.yml');
  assert.ok(
    dependencies(release.jobs.build).includes('verify'),
    'release build must need verification',
  );
  assert.ok(
    dependencies(release.jobs.deploy).includes('build'),
    'deployment must need the verified build',
  );
  for (const name of ['verify', 'build', 'deploy']) {
    assert.notEqual(release.jobs[name]?.['continue-on-error'], true);
    assert.doesNotMatch(String(release.jobs[name]?.if ?? ''), /always\s*\(/);
  }
  const steps = verify.jobs.verify.steps;
  for (const command of [
    'npm run lint',
    'npm run format:check',
    'npm test',
    'npm run test:unit',
    'npm run build',
    'npm run test:ui-guard',
    'npm run test:e2e',
  ]) {
    const step = steps.find((item) => item.run === command);
    assert.ok(step, `missing required check: ${command}`);
    assert.notEqual(step['continue-on-error'], true);
    assert.ok(!step.if, `required check must not be skipped: ${command}`);
  }
});

test('only a verified main push or explicit main dispatch may initiate a Pages deployment', () => {
  assert.deepEqual(release.on.push.branches, ['main']);
  assert.ok(Object.hasOwn(release.on, 'workflow_dispatch'));
  assert.ok(!Object.hasOwn(release.on, 'pull_request'));
  assert.match(String(release.jobs.build.if), /github\.ref\s*==\s*['"]refs\/heads\/main['"]/);
});

test('deploy refuses a stale commit if main advanced since verification', () => {
  const steps = release.jobs.deploy.steps;
  const checkIndex = steps.findIndex(
    (step) =>
      /git ls-remote/.test(step.run ?? '') &&
      /GITHUB_SHA/.test(step.run ?? '') &&
      /exit 1/.test(step.run ?? ''),
  );
  const deployIndex = steps.findIndex((step) => /^actions\/deploy-pages@/.test(step.uses ?? ''));
  assert.ok(checkIndex >= 0, 'missing current-main commit check');
  assert.ok(deployIndex > checkIndex, 'commit check must precede deployment');
});
