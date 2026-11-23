import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyHandLandmarks,
  generateCanonicalLandmarks,
  SignStabilizer,
  appendCaptionToken,
  pruneExpiredCaptions,
} from './librasClassifier';

test('classifyHandLandmarks accurately classifies canonical Libras poses', () => {
  const ola = generateCanonicalLandmarks('ola', 0.25);
  assert.equal(classifyHandLandmarks(ola.landmarks, ola.history)?.signId, 'ola');

  const tudoBem = generateCanonicalLandmarks('tudo-bem');
  assert.equal(classifyHandLandmarks(tudoBem.landmarks, tudoBem.history)?.signId, 'tudo-bem');

  const amor = generateCanonicalLandmarks('amor');
  assert.equal(classifyHandLandmarks(amor.landmarks, amor.history)?.signId, 'amor');

  const obrigado = generateCanonicalLandmarks('obrigado');
  assert.equal(classifyHandLandmarks(obrigado.landmarks, obrigado.history)?.signId, 'obrigado');

  const letterL = generateCanonicalLandmarks('L');
  assert.equal(classifyHandLandmarks(letterL.landmarks, letterL.history)?.signId, 'alpha-l');

  const letterV = generateCanonicalLandmarks('V');
  assert.equal(classifyHandLandmarks(letterV.landmarks, letterV.history)?.signId, 'alpha-v');
});

test('SignStabilizer requires consensus frames and respects cooldown', () => {
  const stabilizer = new SignStabilizer(5, 1500);
  const ola = generateCanonicalLandmarks('ola', 0.25);
  const candidate = classifyHandLandmarks(ola.landmarks, ola.history);
  assert.ok(candidate);

  // First 2 frames should not emit yet (threshold is ceil(5 * 0.6) = 3)
  assert.equal(stabilizer.push(candidate, 1000), null);
  assert.equal(stabilizer.push(candidate, 1100), null);
  // 3rd frame hits consensus
  const emitted = stabilizer.push(candidate, 1200);
  assert.equal(emitted?.signId, 'ola');
  // Within cooldown should not re-emit
  assert.equal(stabilizer.push(candidate, 1500), null);
  // After cooldown should emit again
  assert.equal(stabilizer.push(candidate, 3000)?.signId, 'ola');
});

test('appendCaptionToken and pruneExpiredCaptions manage readable persistence', () => {
  let captions = appendCaptionToken([], 'Olá', 1000);
  captions = appendCaptionToken(captions, 'Olá', 1500); // consecutive hold refreshes timestamp without duplicating
  assert.equal(captions.length, 1);
  assert.equal(captions[0].timestamp, 1500);

  captions = appendCaptionToken(captions, 'Tudo bem', 3000);
  assert.equal(captions.length, 2);

  // At t=10000 with 8000ms retention, 'Olá' (1500) expires, 'Tudo bem' (3000) remains
  const pruned = pruneExpiredCaptions(captions, 8000, false, 10000);
  assert.equal(pruned.length, 1);
  assert.equal(pruned[0].text, 'Tudo bem');

  // With keepHistory = true, nothing expires
  const kept = pruneExpiredCaptions(captions, 8000, true, 50000);
  assert.equal(kept.length, 2);
});
