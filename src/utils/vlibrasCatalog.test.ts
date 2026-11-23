import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDynamicVlibrasStudyModule,
  formatVlibrasEntry,
  parseVlibrasTrie,
  pickDailyVlibrasEntry,
  queryVlibrasCatalog,
  type VlibrasTrieNode,
} from './vlibrasCatalog';

const SAMPLE_TRIE: { root: VlibrasTrieNode } = {
  root: {
    children: {
      O: {
        children: {
          L: {
            children: {
              Á: { end: true },
            },
          },
        },
      },
      C: {
        children: {
          L: {
            children: {
              A: {
                children: {
                  R: {
                    children: {
                      O: {
                        end: true,
                        children: {
                          '&': {
                            children: {
                              A: {
                                children: {
                                  F: {
                                    children: {
                                      I: { end: true },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      E: {
        children: {
          S: {
            children: {
              C: {
                children: {
                  O: {
                    children: {
                      L: {
                        children: {
                          A: { end: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

test('parseVlibrasTrie extracts all leaf glosses cleanly', () => {
  const words = parseVlibrasTrie(SAMPLE_TRIE);
  assert.deepEqual(words.sort(), ['CLARO', 'CLARO&AFI', 'ESCOLA', 'OLÁ']);
});

test('formatVlibrasEntry formats simple, compound, contextual, and inflected glosses', () => {
  const simple = formatVlibrasEntry('OLÁ');
  assert.equal(simple.hasCuratedGuide, true);
  assert.equal(simple.word, 'Olá');
  assert.equal(simple.initialLetter, 'O');

  const contextual = formatVlibrasEntry('CLARO&AFIRMAÇÃO');
  assert.equal(contextual.kind, 'contextual');
  assert.equal(contextual.word, 'Claro');
  assert.equal(contextual.senseTag, 'Afirmação');
  assert.equal(contextual.level, 'avancado');

  const compound = formatVlibrasEntry('MEIO_DIA');
  assert.equal(compound.kind, 'compound');
  assert.equal(compound.word, 'Meio dia');
  assert.equal(compound.level, 'intermediario');

  const advancedCompound = formatVlibrasEntry('CLAREAMENTO_DENTAL');
  assert.equal(advancedCompound.kind, 'compound');
  assert.equal(advancedCompound.level, 'avancado');

  const inflected = formatVlibrasEntry('1S_AJUDAR_2S');
  assert.equal(inflected.kind, 'inflected');
  assert.equal(inflected.initialLetter, '0-9');
  assert.equal(inflected.senseTag, 'Verbo direcional');
});

test('queryVlibrasCatalog searches accent-insensitively and paginates results', () => {
  const entries = [
    'OLÁ',
    'ESCOLA',
    'HOSPITAL',
    'CLARO&AFIRMAÇÃO',
    'CLAREAMENTO_DENTAL',
    'SAÚDE',
  ].map(formatVlibrasEntry);

  const searchRes = queryVlibrasCatalog(entries, { q: 'saude' });
  assert.equal(searchRes.filteredCount, 1);
  assert.equal(searchRes.items[0].gloss, 'SAÚDE');

  const pageRes = queryVlibrasCatalog(entries, { page: 2, limit: 2 });
  assert.equal(pageRes.totalPages, 3);
  assert.equal(pageRes.items.length, 2);
});

test('pickDailyVlibrasEntry and buildDynamicVlibrasStudyModule build deterministic sessions', () => {
  const entries = [
    'ESCOLA',
    'HOSPITAL',
    'MÚSICA',
    'CARRO',
    'INTERNET',
    'PROFESSOR',
    'SAÚDE',
    'TRABALHAR',
  ].map(formatVlibrasEntry);

  const dailyA = pickDailyVlibrasEntry(entries, '2026-11-19');
  const dailyB = pickDailyVlibrasEntry(entries, '2026-11-19');
  assert.equal(dailyA.gloss, dailyB.gloss);

  const built = buildDynamicVlibrasStudyModule(entries, {
    level: 'iniciante',
    seed: 'test-seed',
    count: 4,
  });
  assert.equal(built.signs.length, 4);
  assert.equal(built.module.quizzes.length, 4);
  for (const quiz of built.module.quizzes) {
    assert.equal(quiz.options.length, 4);
    assert.ok(quiz.options.includes(quiz.correctAnswer));
  }
});
