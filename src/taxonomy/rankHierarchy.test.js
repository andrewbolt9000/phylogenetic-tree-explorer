/**
 * Tests for Rank Hierarchy utility
 * Verifies rank ordering, hierarchy lookups, and edge cases with all 30 OTL ranks
 */

import test from 'node:test';
import assert from 'node:assert';
import {
  isRankHigher,
  getRankLevel,
  isRanked,
  getAllRanks,
  LINNAEAN_HIERARCHY,
  RANK_INDEX
} from './rankHierarchy.js';

test('Rank Hierarchy - LINNAEAN_HIERARCHY contains all 29 ranked OTL ranks', () => {
  assert.strictEqual(LINNAEAN_HIERARCHY.length, 28);
});

test('Rank Hierarchy - LINNAEAN_HIERARCHY includes major ranks', () => {
  const expectedRanks = [
    'domain', 'kingdom', 'phylum', 'class', 'order',
    'family', 'genus', 'species', 'subspecies'
  ];
  for (const rank of expectedRanks) {
    assert(LINNAEAN_HIERARCHY.includes(rank),
      `Expected '${rank}' in hierarchy`);
  }
});

test('Rank Hierarchy - LINNAEAN_HIERARCHY includes mammal-specific ranks', () => {
  const mammalRanks = [
    'infraclass', 'cohort', 'subcohort', 'superorder',
    'suborder', 'infraorder', 'parvorder'
  ];
  for (const rank of mammalRanks) {
    assert(LINNAEAN_HIERARCHY.includes(rank),
      `Expected mammal rank '${rank}' in hierarchy`);
  }
});

test('Rank Hierarchy - LINNAEAN_HIERARCHY includes intermediate ranks', () => {
  const intermediateRanks = [
    'subphylum', 'superclass', 'subclass',
    'superfamily', 'subfamily', 'tribe', 'subtribe',
    'subgenus', 'section', 'subsection',
    'species group', 'species subgroup'
  ];
  for (const rank of intermediateRanks) {
    assert(LINNAEAN_HIERARCHY.includes(rank),
      `Expected intermediate rank '${rank}' in hierarchy`);
  }
});

test('Rank Hierarchy - LINNAEAN_HIERARCHY is ordered correctly', () => {
  const domainIdx = LINNAEAN_HIERARCHY.indexOf('domain');
  const kingdomIdx = LINNAEAN_HIERARCHY.indexOf('kingdom');
  const phylumIdx = LINNAEAN_HIERARCHY.indexOf('phylum');
  const classIdx = LINNAEAN_HIERARCHY.indexOf('class');
  const orderIdx = LINNAEAN_HIERARCHY.indexOf('order');
  const genusIdx = LINNAEAN_HIERARCHY.indexOf('genus');
  const speciesIdx = LINNAEAN_HIERARCHY.indexOf('species');

  assert(domainIdx < kingdomIdx, 'domain should come before kingdom');
  assert(kingdomIdx < phylumIdx, 'kingdom should come before phylum');
  assert(phylumIdx < classIdx, 'phylum should come before class');
  assert(classIdx < orderIdx, 'class should come before order');
  assert(orderIdx < genusIdx, 'order should come before genus');
  assert(genusIdx < speciesIdx, 'genus should come before species');
});

test('Rank Hierarchy - RANK_INDEX has all ranks', () => {
  for (const rank of LINNAEAN_HIERARCHY) {
    assert(rank.toLowerCase() in RANK_INDEX,
      `Expected '${rank}' in RANK_INDEX`);
  }
});

test('Rank Hierarchy - RANK_INDEX is case-insensitive', () => {
  assert.strictEqual(RANK_INDEX['domain'], RANK_INDEX['domain']);
  assert.strictEqual(RANK_INDEX['kingdom'], RANK_INDEX['kingdom']);
  // Verify case-insensitive lookup works in isRanked()
  assert.strictEqual(isRanked('KINGDOM'), isRanked('kingdom'));
});

test('Rank Hierarchy - isRankHigher identifies correct hierarchy', () => {
  assert.strictEqual(isRankHigher('kingdom', 'phylum'), true);
  assert.strictEqual(isRankHigher('phylum', 'class'), true);
  assert.strictEqual(isRankHigher('order', 'family'), true);
  assert.strictEqual(isRankHigher('family', 'genus'), true);
  assert.strictEqual(isRankHigher('genus', 'species'), true);
  assert.strictEqual(isRankHigher('species', 'subspecies'), true);
});

test('Rank Hierarchy - isRankHigher returns false for reverse', () => {
  assert.strictEqual(isRankHigher('phylum', 'kingdom'), false);
  assert.strictEqual(isRankHigher('class', 'phylum'), false);
  assert.strictEqual(isRankHigher('genus', 'family'), false);
  assert.strictEqual(isRankHigher('species', 'genus'), false);
});

test('Rank Hierarchy - isRankHigher handles equal ranks', () => {
  assert.strictEqual(isRankHigher('kingdom', 'kingdom'), false);
  assert.strictEqual(isRankHigher('species', 'species'), false);
});

test('Rank Hierarchy - isRankHigher handles mammal-specific ranks', () => {
  assert.strictEqual(isRankHigher('order', 'infraorder'), true);
  assert.strictEqual(isRankHigher('superorder', 'order'), true);
  assert.strictEqual(isRankHigher('class', 'cohort'), true);
  assert.strictEqual(isRankHigher('parvorder', 'family'), true);
});

test('Rank Hierarchy - isRankHigher handles intermediate ranks', () => {
  assert.strictEqual(isRankHigher('superfamily', 'family'), true);
  assert.strictEqual(isRankHigher('family', 'subfamily'), true);
  assert.strictEqual(isRankHigher('subfamily', 'tribe'), true);
  assert.strictEqual(isRankHigher('tribe', 'subtribe'), true);
});

test('Rank Hierarchy - isRankHigher handles no rank (unranked)', () => {
  assert.strictEqual(isRankHigher('no rank', 'species'), null);
  assert.strictEqual(isRankHigher('kingdom', 'no rank'), null);
  assert.strictEqual(isRankHigher('no rank', 'no rank'), null);
});

test('Rank Hierarchy - isRankHigher returns null for unknown ranks', () => {
  assert.strictEqual(isRankHigher('unknown_rank', 'species'), null);
  assert.strictEqual(isRankHigher('species', 'fabricated'), null);
});

test('Rank Hierarchy - getRankLevel returns correct indices', () => {
  assert.strictEqual(getRankLevel('domain'), 0);
  assert.strictEqual(getRankLevel('kingdom'), 1);
  assert.strictEqual(getRankLevel('phylum'), 2);
  assert.strictEqual(getRankLevel('class'), 5);
  assert.strictEqual(getRankLevel('order'), 11);
  assert.strictEqual(getRankLevel('family'), 16);
  assert.strictEqual(getRankLevel('genus'), 20);
  assert.strictEqual(getRankLevel('species'), 26);
  assert.strictEqual(getRankLevel('subspecies'), 27);
});

test('Rank Hierarchy - getRankLevel returns null for no rank', () => {
  assert.strictEqual(getRankLevel('no rank'), null);
});

test('Rank Hierarchy - getRankLevel returns null for unknown ranks', () => {
  assert.strictEqual(getRankLevel('unknown'), null);
  assert.strictEqual(getRankLevel('fabricated_rank'), null);
});

test('Rank Hierarchy - isRanked returns true for all OTL ranks', () => {
  for (const rank of LINNAEAN_HIERARCHY) {
    assert.strictEqual(isRanked(rank), true,
      `Expected '${rank}' to be ranked`);
  }
});

test('Rank Hierarchy - isRanked returns false for no rank', () => {
  assert.strictEqual(isRanked('no rank'), false);
});

test('Rank Hierarchy - isRanked returns false for unknown ranks', () => {
  assert.strictEqual(isRanked('unknown'), false);
  assert.strictEqual(isRanked('fabricated'), false);
});

test('Rank Hierarchy - getAllRanks returns 28 ranked ranks', () => {
  const ranks = getAllRanks();
  assert(Array.isArray(ranks));
  assert.strictEqual(ranks.length, 28);
  const domainIdx = ranks.indexOf('domain');
  const kingdomIdx = ranks.indexOf('kingdom');
  const speciesIdx = ranks.indexOf('species');
  assert(domainIdx < kingdomIdx);
  assert(kingdomIdx < speciesIdx);
});

test('Rank Hierarchy - getAllRanks returns a copy', () => {
  const ranks1 = getAllRanks();
  const ranks2 = getAllRanks();
  assert.notStrictEqual(ranks1, ranks2);
  assert.deepStrictEqual(ranks1, ranks2);
});

test('Rank Hierarchy - consistency across all APIs', () => {
  for (const rank of LINNAEAN_HIERARCHY) {
    assert.strictEqual(isRanked(rank), true);
    assert(getRankLevel(rank) !== null);
  }
  const unknownRank = 'totally_made_up_rank_xyz';
  assert.strictEqual(isRanked(unknownRank), false);
  assert.strictEqual(getRankLevel(unknownRank), null);
});
