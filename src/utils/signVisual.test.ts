import test from 'node:test';
import assert from 'node:assert/strict';
import { formatVlibrasEntry } from './vlibrasCatalog';
import { getSignVisualSpec } from './signVisual';

test('getSignVisualSpec preserves curated hand pose and motion metadata', () => {
  const item = formatVlibrasEntry('OLÁ');
  const spec = getSignVisualSpec(item);
  assert.equal(spec.motionType, 'wave-lateral');
  assert.equal(spec.motionLabel, 'Movimento lateral');
  assert.equal(spec.fingers.length, 5);
  assert.equal(spec.accentHex, '#1D4ED8');
});

test('getSignVisualSpec deterministically builds visual metadata for catalog entries', () => {
  const itemA = formatVlibrasEntry('ESCOLA');
  const itemB = formatVlibrasEntry('ESCOLA');
  const compound = formatVlibrasEntry('BOM_DIA_TESTE');

  const specA = getSignVisualSpec(itemA);
  const specB = getSignVisualSpec(itemB);
  const specCompound = getSignVisualSpec(compound);

  assert.deepEqual(specA, specB);
  assert.equal(specA.fingers.length, 5);
  assert.equal(specCompound.twoHands, true);
});
