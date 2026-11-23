import test from 'node:test';
import assert from 'node:assert/strict';
import { translateTextToLibras, parseVlibrasApiResponse } from './vlibrasGloss';

test('translateTextToLibras handles multi-word greetings and preserves gloss order', () => {
  const res = translateTextToLibras('Olá, tudo bem?');
  assert.equal(res.glossSentence, 'OLÁ TUDO-BEM ?');
  assert.equal(res.tokens.length, 2);
  assert.equal(res.tokens[0].sign.id, 'ola');
  assert.equal(res.tokens[1].sign.id, 'tudo-bem');
  assert.equal(res.tokens[0].isFingerspelled, false);
});

test('translateTextToLibras omits Portuguese articles and places temporal markers first', () => {
  const res = translateTextToLibras('Eu quero aprender a Libras hoje');
  assert.equal(res.glossSentence, 'HOJE EU QUERER APRENDER LIBRAS');
  assert.ok(res.notes.some((n) => n.includes('Artigos')));
  assert.ok(res.notes.some((n) => n.includes('temporais')));
});

test('translateTextToLibras falls back to datilologia for proper nouns', () => {
  const res = translateTextToLibras('Olá Ana');
  assert.equal(res.tokens[0].sign.id, 'ola');
  assert.equal(res.tokens[1].isFingerspelled, true);
  assert.equal(res.tokens[1].letter, 'A');
  assert.equal(res.tokens[2].letter, 'N');
  assert.equal(res.tokens[3].letter, 'A');
});

test('translateTextToLibras honors external VLibras gloss when provided', () => {
  const res = translateTextToLibras('Bom dia amigo', 'BOM-DIA AMIGO');
  assert.equal(res.sourceEngine, 'vlibras-api');
  assert.equal(res.tokens[0].sign.id, 'bom-dia');
  assert.equal(res.tokens[1].sign.id, 'amigo');
});

test('parseVlibrasApiResponse extracts string or object gloss payloads', () => {
  assert.equal(parseVlibrasApiResponse('OLÁ TUDO-BEM'), 'OLÁ TUDO-BEM');
  assert.equal(parseVlibrasApiResponse({ gloss: 'EU APRENDER LIBRAS' }), 'EU APRENDER LIBRAS');
  assert.equal(parseVlibrasApiResponse({}), null);
});
