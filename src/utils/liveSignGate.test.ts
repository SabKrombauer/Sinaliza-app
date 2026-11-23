import test from 'node:test';
import assert from 'node:assert/strict';
import { LiveSignGate } from './liveSignGate';

test('permite troca de EU TE AMO para OI com duas leituras', () => {
  const gate = new LiveSignGate(2, 0.72);
  assert.equal(gate.push('eu te amo', 0.95, 1000), null);
  assert.equal(gate.push('eu te amo', 0.95, 1100), 'EU TE AMO');
  assert.equal(gate.push('oi', 0.85, 1200), null);
  assert.equal(gate.push('oi', 0.85, 1300), 'OI');
});

test('nao repete a mesma palavra se a pessoa segura a pose', () => {
  const gate = new LiveSignGate(2, 0.72);
  gate.push('oi', 0.9, 1000);
  assert.equal(gate.push('oi', 0.9, 1200), 'OI');
  assert.equal(gate.push('oi', 0.9, 2600), null);
  gate.push(null, 0, 2700);
  gate.push(null, 0, 2800);
  gate.push('oi', 0.9, 2900);
  assert.equal(gate.push('oi', 0.9, 3000), 'OI');
});

test('previsoes com confianca baixa nao viram texto', () => {
  const gate = new LiveSignGate(2, 0.72);
  assert.equal(gate.push('oi', 0.4), null);
  assert.equal(gate.push('oi', 0.4), null);
});
