/**
 * Tests for TaxonomyLoader and HypothesisLoader
 */

import test from 'node:test';
import assert from 'node:assert';
import { TaxonomyLoader, fsReadyPromise as taxonomyFsReady } from './taxonomyLoader.js';
import { HypothesisLoader, fsReadyPromise as hypothesisFsReady } from './hypothesisLoader.js';

// Ensure fs is loaded before any sync tests run
await Promise.all([taxonomyFsReady, hypothesisFsReady]);

test('TaxonomyLoader - loads valid taxonomy fixture', () => {
  const loader = new TaxonomyLoader('./data/schemas/taxonomy.schema.json');
  const result = loader.load('./data/test-fixtures/taxonomy-fixture.json');

  assert(result.taxa);
  assert(result.metadata);
  assert(result.taxa['tax_exa_homo_sapiens']);
  assert.strictEqual(result.taxa['tax_exa_homo_sapiens'].scientificName, 'Homo sapiens');
});

test('TaxonomyLoader - detects duplicate IDs', () => {
  const loader = new TaxonomyLoader('./data/schemas/taxonomy.schema.json');

  // Create invalid taxonomy with duplicates
  const tmpData = {
    taxonomy: [
      { id: 'tax_a', scientificName: 'A', rank: 'species', parent: null, extinct: false },
      { id: 'tax_a', scientificName: 'A2', rank: 'species', parent: null, extinct: false }
    ],
    metadata: { source: 'test', license: 'CC0', accessDate: '2024-11-01' }
  };

  assert.throws(() => {
    loader._processTaxonomy(tmpData);
  });
});

test('TaxonomyLoader - detects invalid parent references', () => {
  const loader = new TaxonomyLoader('./data/schemas/taxonomy.schema.json');

  const tmpData = {
    taxonomy: [
      { id: 'tax_a', scientificName: 'A', rank: 'species', parent: 'tax_nonexistent', extinct: false }
    ],
    metadata: { source: 'test', license: 'CC0', accessDate: '2024-11-01' }
  };

  assert.throws(() => {
    loader._processTaxonomy(tmpData);
  });
});

test('TaxonomyLoader - detects cycles', () => {
  const loader = new TaxonomyLoader('./data/schemas/taxonomy.schema.json');

  const tmpData = {
    taxonomy: [
      { id: 'tax_a', scientificName: 'A', rank: 'genus', parent: 'tax_b', extinct: false },
      { id: 'tax_b', scientificName: 'B', rank: 'family', parent: 'tax_a', extinct: false }
    ],
    metadata: { source: 'test', license: 'CC0', accessDate: '2024-11-01' }
  };

  assert.throws(() => {
    loader._processTaxonomy(tmpData);
  });
});

test('HypothesisLoader - loads valid hypothesis fixture', () => {
  const hypLoader = new HypothesisLoader('./data/schemas/hypothesis.schema.json');
  const taxLoader = new TaxonomyLoader('./data/schemas/taxonomy.schema.json');

  const tax = taxLoader.load('./data/test-fixtures/taxonomy-fixture.json');
  const result = hypLoader.load('./data/test-fixtures/hypothesis-fixture.json', tax.taxa);

  assert.strictEqual(result.hypothesisId, 'phylo_hypothesis-001');
  assert.strictEqual(result.rootNodeId, 'ancestor_h1_n0');
  assert(result.nodeMap['ancestor_h1_n0']);
});

test('HypothesisLoader - validates terminal nodes reference taxa', () => {
  const hypLoader = new HypothesisLoader('./data/schemas/hypothesis.schema.json');

  const invalidHypothesis = {
    hypothesisId: 'test_hyp',
    hypothesisName: 'Test',
    source: 'test',
    rootNodeId: 'ancestor_h1_n0',
    terminalIdPrefix: 'tax_',
    internalIdPrefix: 'ancestor_h1_',
    nodes: [
      {
        id: 'ancestor_h1_n0',
        type: 'internal',
        parentId: null,
        children: ['tax_nonexistent']
      },
      {
        id: 'tax_nonexistent',
        type: 'terminal',
        parentId: 'ancestor_h1_n0',
        children: [],
        taxonId: 'tax_nonexistent'
      }
    ]
  };

  const taxa = { 'tax_real': {} };

  assert.throws(() => {
    hypLoader._processHypothesis(invalidHypothesis, taxa);
  });
});

test('HypothesisLoader - validates internal nodes have at least 2 children', () => {
  const hypLoader = new HypothesisLoader('./data/schemas/hypothesis.schema.json');

  const invalidHypothesis = {
    hypothesisId: 'test_hyp',
    hypothesisName: 'Test',
    source: 'test',
    rootNodeId: 'ancestor_h1_n0',
    terminalIdPrefix: 'tax_',
    internalIdPrefix: 'ancestor_h1_',
    nodes: [
      {
        id: 'ancestor_h1_n0',
        type: 'internal',
        parentId: null,
        children: ['tax_a']
      },
      {
        id: 'tax_a',
        type: 'terminal',
        parentId: 'ancestor_h1_n0',
        children: [],
        taxonId: 'tax_a'
      }
    ]
  };

  assert.throws(() => {
    hypLoader._processHypothesis(invalidHypothesis, {});
  });
});

test('HypothesisLoader - detects cycles', () => {
  const hypLoader = new HypothesisLoader('./data/schemas/hypothesis.schema.json');

  const cyclicHypothesis = {
    hypothesisId: 'test_hyp',
    hypothesisName: 'Test',
    source: 'test',
    rootNodeId: 'ancestor_h1_n0',
    terminalIdPrefix: 'tax_',
    internalIdPrefix: 'ancestor_h1_',
    nodes: [
      {
        id: 'ancestor_h1_n0',
        type: 'internal',
        parentId: 'ancestor_h1_n1',
        children: ['ancestor_h1_n1']
      },
      {
        id: 'ancestor_h1_n1',
        type: 'internal',
        parentId: 'ancestor_h1_n0',
        children: ['tax_a']
      },
      {
        id: 'tax_a',
        type: 'terminal',
        parentId: 'ancestor_h1_n1',
        children: [],
        taxonId: 'tax_a'
      }
    ]
  };

  assert.throws(() => {
    hypLoader._processHypothesis(cyclicHypothesis, {});
  });
});

test('HypothesisLoader - validates terminal prefix convention', () => {
  const hypLoader = new HypothesisLoader('./data/schemas/hypothesis.schema.json');

  const wrongPrefixHypothesis = {
    hypothesisId: 'test_hyp',
    hypothesisName: 'Test',
    source: 'test',
    rootNodeId: 'ancestor_h1_n0',
    terminalIdPrefix: 'tax_',
    internalIdPrefix: 'ancestor_h1_',
    nodes: [
      {
        id: 'ancestor_h1_n0',
        type: 'internal',
        parentId: null,
        children: ['wrong_prefix_a', 'wrong_prefix_b']
      },
      {
        id: 'wrong_prefix_a',
        type: 'terminal',
        parentId: 'ancestor_h1_n0',
        children: [],
        taxonId: 'tax_a'
      },
      {
        id: 'wrong_prefix_b',
        type: 'terminal',
        parentId: 'ancestor_h1_n0',
        children: [],
        taxonId: 'tax_b'
      }
    ]
  };

  assert.throws(() => {
    hypLoader._processHypothesis(wrongPrefixHypothesis, {});
  });
});
