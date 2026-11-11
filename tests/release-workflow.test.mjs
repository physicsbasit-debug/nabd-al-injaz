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
    dependencies(release.jobs.verify).includes('preflight'),
    'verification must need the exact-branch preflight',
  );
  assert.ok(
    dependencies(release.jobs.deploy).includes('verify'),
    'deployment must need the full verification job',
  );
  assert.ok(!release.jobs.build, 'release must use the artifact from verification');
  for (const name of ['preflight', 'verify', 'deploy']) {
    assert.notEqual(release.jobs[name]?.['continue-on-error'], true);
    assert.ok(!release.jobs[name]?.if, `${name} must retain the default success condition`);
  }
  assert.notEqual(verify.jobs.verify['continue-on-error'], true);
  assert.ok(
    !verify.jobs.verify.if,
    'called verification must retain the default success condition',
  );
  const steps = verify.jobs.verify.steps;
  for (const command of [
    'npm run lint',
    'npm run format:check',
    'npm test',
    'npm run test:unit',
    'npm run build -- --base=/nabd-al-injaz/',
    'npx playwright install chromium',
    'npm run test:ui-guard',
    'npm run test:e2e',
    'npm run test:production',
  ]) {
    const step = steps.find((item) => item.run === command);
    assert.ok(step, `missing required check: ${command}`);
    assert.notEqual(step['continue-on-error'], true);
    assert.ok(!step.if, `required check must not be skipped: ${command}`);
  }
  const endToEndIndex = steps.findIndex((step) => step.run === 'npm run test:e2e');
  const productionIndex = steps.findIndex((step) => step.run === 'npm run test:production');
  const artifactIndex = steps.findIndex((step) =>
    /^actions\/upload-pages-artifact@/.test(step.uses ?? ''),
  );
  assert.ok(artifactIndex > endToEndIndex, 'Pages artifact must be uploaded after verification');
  assert.ok(artifactIndex > productionIndex, 'Pages artifact must pass the built-site test');
  assert.equal(steps[artifactIndex].with?.path, 'dist');
  assert.ok(!steps[artifactIndex].if, 'Pages artifact must retain the default success condition');
});

test('only a verified main push or explicit main dispatch may initiate a Pages deployment', () => {
  assert.deepEqual(release.on.push.branches, ['main']);
  assert.ok(Object.hasOwn(release.on, 'workflow_dispatch'));
  assert.ok(!Object.hasOwn(release.on, 'pull_request'));
  const guard = release.jobs.preflight.steps.find((step) => /GITHUB_REF/.test(step.run ?? ''));
  assert.ok(guard, 'missing case-sensitive branch guard');
  assert.match(guard.run, /\[\[\s*"\$GITHUB_REF"\s*!=\s*"refs\/heads\/main"\s*\]\]/);
  assert.match(guard.run, /exit 1/);
});

test('verified deployments are queued without another run cancelling them', () => {
  assert.ok(!release.concurrency, 'workflow-level cancellation must not affect main');
  assert.equal(release.jobs.deploy.concurrency?.group, 'github-pages');
  assert.equal(release.jobs.deploy.concurrency?.queue, 'max');
  assert.notEqual(release.jobs.deploy.concurrency?.['cancel-in-progress'], true);
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
