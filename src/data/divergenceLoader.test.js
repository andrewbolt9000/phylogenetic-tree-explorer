/**
 * Tests for DivergenceLoader
 */

import test from 'node:test';
import assert from 'node:assert';
import { DivergenceLoader, fsReadyPromise as divergenceFsReady } from './divergenceLoader.js';
import { TaxonomyLoader, fsReadyPromise as taxonomyFsReady } from './taxonomyLoader.js';
import { HypothesisLoader, fsReadyPromise as hypothesisFsReady } from './hypothesisLoader.js';

// Ensure fs is loaded before any sync tests run
await Promise.all([divergenceFsReady, taxonomyFsReady, hypothesisFsReady]);

test('DivergenceLoader - loads valid divergence fixture', () => {
  const loader = new DivergenceLoader('./data/schemas/divergence-estimates.schema.json');
  const result = loader.load('./data/test-fixtures/divergence-fixture.json');

  assert(result.estimates);
  assert(result.sourceMetadata);
  assert(result.estimatesByHypothesis);

  // Check specific estimate
  const key = 'phylo_hypothesis-001:ancestor_h1_n0';
  assert(result.estimates[key]);
  assert.strictEqual(result.estimates[key].estimates[0].centralEstimate, 100.0);
});

test('DivergenceLoader - validates central estimate >= 0', () => {
  const loader = new DivergenceLoader('./data/schemas/divergence-estimates.schema.json');

  const invalidData = {
    divergenceEstimates: {
      'phylo_hypothesis-001': {
        'ancestor_h1_n0': [
          {
            sourceId: 'test_source',
            centralEstimate: -5.0
          }
        ]
      }
    },
    metadata: {}
  };

  assert.throws(() => {
    loader._processDivergences(invalidData, {});
  });
});

test('DivergenceLoader - validates uncertainty bounds', () => {
  const loader = new DivergenceLoader('./data/schemas/divergence-estimates.schema.json');

  // Lower > central
  const invalidData1 = {
    divergenceEstimates: {
      'phylo_hypothesis-001': {
        'ancestor_h1_n0': [
          {
            sourceId: 'test_source',
            centralEstimate: 50.0,
            uncertaintyLower: 60.0,
            uncertaintyUpper: 40.0
          }
        ]
      }
    },
    metadata: {}
  };

  assert.throws(() => {
    loader._processDivergences(invalidData1, {});
  });

  // Upper < central
  const invalidData2 = {
    divergenceEstimates: {
      'phylo_hypothesis-001': {
        'ancestor_h1_n0': [
          {
            sourceId: 'test_source',
            centralEstimate: 50.0,
            uncertaintyLower: 40.0,
            uncertaintyUpper: 45.0
          }
        ]
      }
    },
    metadata: {}
  };

  assert.throws(() => {
    loader._processDivergences(invalidData2, {});
  });
});

test('DivergenceLoader - requires uncertainty type when bounds provided', () => {
  const loader = new DivergenceLoader('./data/schemas/divergence-estimates.schema.json');

  const invalidData = {
    divergenceEstimates: {
      'phylo_hypothesis-001': {
        'ancestor_h1_n0': [
          {
            sourceId: 'test_source',
            centralEstimate: 50.0,
            uncertaintyLower: 40.0,
            uncertaintyUpper: 60.0
          }
        ]
      }
    },
    metadata: {}
  };

  assert.throws(() => {
    loader._processDivergences(invalidData, {});
  });
});

test('DivergenceLoader - supports missing estimates', () => {
  const loader = new DivergenceLoader('./data/schemas/divergence-estimates.schema.json');

  const data = {
    divergenceEstimates: {
      'phylo_hypothesis-001': {
        'ancestor_h1_n0': []
      }
    },
    metadata: {}
  };

  const result = loader._processDivergences(data, {});
  assert(result.estimates['phylo_hypothesis-001:ancestor_h1_n0']);
  assert.strictEqual(result.estimates['phylo_hypothesis-001:ancestor_h1_n0'].estimates.length, 0);
});

test('DivergenceLoader - supports multiple estimates per node', () => {
  const loader = new DivergenceLoader('./data/schemas/divergence-estimates.schema.json');

  const data = {
    divergenceEstimates: {
      'phylo_hypothesis-001': {
        'ancestor_h1_n0': [
          {
            sourceId: 'source1',
            centralEstimate: 50.0,
            statisticType: 'mean'
          },
          {
            sourceId: 'source2',
            centralEstimate: 52.0,
            statisticType: 'median'
          }
        ]
      }
    },
    metadata: {
      source1: { type: 'publication', license: 'CC0' },
      source2: { type: 'publication', license: 'CC0' }
    }
  };

  const result = loader._processDivergences(data, {});
  const estimates = result.estimates['phylo_hypothesis-001:ancestor_h1_n0'].estimates;
  assert.strictEqual(estimates.length, 2);
  assert.strictEqual(estimates[0].centralEstimate, 50.0);
  assert.strictEqual(estimates[1].centralEstimate, 52.0);
});

test('DivergenceLoader - indexes by hypothesis', () => {
  const loader = new DivergenceLoader('./data/schemas/divergence-estimates.schema.json');

  const data = {
    divergenceEstimates: {
      'hyp1': {
        'node1': [{ sourceId: 's1', centralEstimate: 50.0 }],
        'node2': [{ sourceId: 's1', centralEstimate: 45.0 }]
      }
    },
    metadata: { s1: { type: 'publication', license: 'CC0' } }
  };

  const result = loader._processDivergences(data, {});
  assert(result.estimatesByHypothesis.hyp1);
  assert(result.estimatesByHypothesis.hyp1.node1);
  assert(result.estimatesByHypothesis.hyp1.node2);
});

test('DivergenceLoader - validates terminal nodes cannot have divergence estimates', () => {
  const loader = new DivergenceLoader('./data/schemas/divergence-estimates.schema.json');

  const hypotheses = {
    'phylo_hypothesis-001': {
      nodeMap: {
        'tax_a': { type: 'terminal', id: 'tax_a' }
      }
    }
  };

  const data = {
    divergenceEstimates: {
      'phylo_hypothesis-001': {
        'tax_a': [{ sourceId: 's1', centralEstimate: 50.0 }]
      }
    },
    metadata: {}
  };

  assert.throws(() => {
    loader._processDivergences(data, hypotheses);
  });
});
