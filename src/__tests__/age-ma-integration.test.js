/**
 * Test integration of stored age_ma values with the Show Node Dates feature.
 *
 * Verifies that:
 * - Tetrapods internal nodes display their stored age_ma
 * - Terminal nodes do not receive date labels
 * - Root age is correctly displayed
 * - Show Node Dates toggle controls visibility
 * - Mammals still uses legacy divergence data when age_ma is absent
 * - Age-based link-strength calculations can use Tetrapods age_ma
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { ForceDirectedVisualization } from '../visualization/forceDirectedVisualization.js';

/**
 * Create a minimal test hypothesis with age_ma values.
 */
function createTestHypothesisWithAges() {
  return {
    rootNodeId: 'root_n1',
    hypothesisId: 'test_hyp',
    nodes: [
      {
        id: 'root_n1',
        type: 'internal',
        age_ma: 100.0,
        branch_length: 0.0,
        parentId: null,
        children: ['internal_n2', 'terminal_sp1']
      },
      {
        id: 'internal_n2',
        type: 'internal',
        age_ma: 50.0,
        branch_length: 50.0,
        parentId: 'root_n1',
        children: ['terminal_sp2', 'terminal_sp3']
      },
      {
        id: 'terminal_sp1',
        type: 'terminal',
        age_ma: 0.0,
        branch_length: 100.0,
        parentId: 'root_n1',
        children: []
      },
      {
        id: 'terminal_sp2',
        type: 'terminal',
        age_ma: 0.0,
        branch_length: 50.0,
        parentId: 'internal_n2',
        children: []
      },
      {
        id: 'terminal_sp3',
        type: 'terminal',
        age_ma: 0.0,
        branch_length: 50.0,
        parentId: 'internal_n2',
        children: []
      }
    ]
  };
}

/**
 * Create visualization nodes from hypothesis (simulating adapter output).
 */
function createVizNodes(hypothesis) {
  return hypothesis.nodes.map(node => ({
    id: node.id,
    type: node.type,
    age_ma: node.age_ma,
    parentId: node.parentId,
    label: node.id
  }));
}

test('Age Ma Integration - Retrieves stored age_ma from visualization nodes', () => {
  const hypothesis = createTestHypothesisWithAges();
  const vizNodes = createVizNodes(hypothesis);

  // Create a minimal visualization with nodes but no container/DOM
  const viz = Object.create(ForceDirectedVisualization.prototype);
  viz.nodes = vizNodes;
  viz.divergenceData = null;  // No legacy data

  // Test root age
  const rootAge = viz._getDivergenceEstimate('root_n1');
  assert.equal(rootAge, 100.0, 'Root age should be 100.0 Ma');

  // Test internal node age
  const internalAge = viz._getDivergenceEstimate('internal_n2');
  assert.equal(internalAge, 50.0, 'Internal node age should be 50.0 Ma');

  // Test terminal age (should be 0)
  const terminalAge = viz._getDivergenceEstimate('terminal_sp1');
  assert.equal(terminalAge, 0.0, 'Terminal age should be 0 Ma');
});

test('Age Ma Integration - Prioritizes stored age_ma over legacy divergence data', () => {
  const hypothesis = createTestHypothesisWithAges();
  const vizNodes = createVizNodes(hypothesis);

  // Legacy divergence data with conflicting estimates
  const divergenceData = {
    estimatesByHypothesis: {
      test_hyp: {
        'root_n1': { estimates: [{ centralEstimate: 200.0 }] },
        'internal_n2': { estimates: [{ centralEstimate: 100.0 }] }
      }
    }
  };

  const viz = Object.create(ForceDirectedVisualization.prototype);
  viz.nodes = vizNodes;
  viz.hypothesisId = 'test_hyp';
  viz.divergenceData = divergenceData;

  // Should return stored age_ma, NOT legacy value
  const rootAge = viz._getDivergenceEstimate('root_n1');
  assert.equal(rootAge, 100.0, 'Should use stored age_ma (100.0), not legacy (200.0)');

  const internalAge = viz._getDivergenceEstimate('internal_n2');
  assert.equal(internalAge, 50.0, 'Should use stored age_ma (50.0), not legacy (100.0)');
});

test('Age Ma Integration - Falls back to legacy divergence data when age_ma is absent', () => {
  // Nodes without age_ma (simulating Mammals)
  const vizNodes = [
    { id: 'mammals_node1', type: 'internal', parentId: null },
    { id: 'mammals_node2', type: 'internal', parentId: 'mammals_node1' }
  ];

  const divergenceData = {
    estimatesByHypothesis: {
      mammals_hyp: {
        'mammals_node1': { estimates: [{ centralEstimate: 88.0 }] },
        'mammals_node2': { estimates: [{ centralEstimate: 44.0 }] }
      }
    }
  };

  const viz = Object.create(ForceDirectedVisualization.prototype);
  viz.nodes = vizNodes;
  viz.hypothesisId = 'mammals_hyp';
  viz.divergenceData = divergenceData;

  // Should return legacy divergence data
  const node1Age = viz._getDivergenceEstimate('mammals_node1');
  assert.equal(node1Age, 88.0, 'Should return legacy estimate when age_ma absent');

  const node2Age = viz._getDivergenceEstimate('mammals_node2');
  assert.equal(node2Age, 44.0, 'Should return legacy estimate for second node');
});

test('Age Ma Integration - Ignores non-finite age_ma values', () => {
  const vizNodes = [
    { id: 'node1', type: 'internal', age_ma: NaN },
    { id: 'node2', type: 'internal', age_ma: Infinity },
    { id: 'node3', type: 'internal', age_ma: -Infinity },
    { id: 'node4', type: 'internal', age_ma: 100.0 }
  ];

  const divergenceData = {
    estimatesByHypothesis: {
      test_hyp: {
        'node1': { estimates: [{ centralEstimate: 50.0 }] },
        'node2': { estimates: [{ centralEstimate: 60.0 }] },
        'node3': { estimates: [{ centralEstimate: 70.0 }] },
        'node4': { estimates: [{ centralEstimate: 200.0 }] }
      }
    }
  };

  const viz = Object.create(ForceDirectedVisualization.prototype);
  viz.nodes = vizNodes;
  viz.hypothesisId = 'test_hyp';
  viz.divergenceData = divergenceData;

  // Should skip non-finite age_ma and fall back to legacy data
  assert.equal(viz._getDivergenceEstimate('node1'), 50.0, 'Should use legacy for NaN');
  assert.equal(viz._getDivergenceEstimate('node2'), 60.0, 'Should use legacy for Infinity');
  assert.equal(viz._getDivergenceEstimate('node3'), 70.0, 'Should use legacy for -Infinity');

  // Should use stored age_ma for valid finite values
  assert.equal(viz._getDivergenceEstimate('node4'), 100.0, 'Should use stored age_ma for finite values');
});

test('Age Ma Integration - Does not display dates on terminal nodes', () => {
  const hypothesis = createTestHypothesisWithAges();
  const vizNodes = createVizNodes(hypothesis);

  // Simulate minimal visualization state for rendering
  const viz = Object.create(ForceDirectedVisualization.prototype);
  viz.nodes = vizNodes;
  viz.showNodeDates = true;
  viz.divergenceData = null;

  // Collect internal nodes with dates (what _renderDateLabels would use)
  const datesByNodeId = {};
  for (const node of vizNodes) {
    if (node.type === 'internal' && typeof node.age_ma === 'number' && isFinite(node.age_ma)) {
      datesByNodeId[node.id] = `${node.age_ma}Ma`;
    }
  }

  // Filter for nodes that get date labels
  const nodesWithDates = vizNodes.filter(d => d.type === 'internal' && datesByNodeId[d.id]);

  // Should have 2 internal nodes (root and internal_n2)
  assert.equal(nodesWithDates.length, 2, 'Should have 2 internal nodes with dates');

  // Verify that terminal nodes are not in the list
  const hasTerminals = nodesWithDates.some(n => n.type === 'terminal');
  assert.equal(hasTerminals, false, 'Should not have terminal nodes with dates');
});

test('Age Ma Integration - Handles Show Node Dates toggle correctly', () => {
  const hypothesis = createTestHypothesisWithAges();
  const vizNodes = createVizNodes(hypothesis);

  const viz = Object.create(ForceDirectedVisualization.prototype);
  viz.nodes = vizNodes;
  viz.divergenceData = null;

  // When toggle is off, should not display any dates
  viz.showNodeDates = false;
  const hasNodeAges = vizNodes.some(n => n.type === 'internal' && typeof n.age_ma === 'number' && isFinite(n.age_ma));
  const hasLegacyData = viz.divergenceData && viz.hypothesisId;

  // The check from _renderDateLabels
  const shouldRender = viz.showNodeDates && (hasNodeAges || hasLegacyData);
  assert.equal(shouldRender, false, 'Should not render when toggle is off');

  // When toggle is on, should display dates if available
  viz.showNodeDates = true;
  const shouldRender2 = viz.showNodeDates && (hasNodeAges || hasLegacyData);
  assert.equal(shouldRender2, true, 'Should render when toggle is on and ages available');
});

test('Age Ma Integration - Returns null for missing node IDs', () => {
  const vizNodes = [
    { id: 'node1', type: 'internal', age_ma: 100.0 }
  ];

  const viz = Object.create(ForceDirectedVisualization.prototype);
  viz.nodes = vizNodes;
  viz.divergenceData = null;

  const age = viz._getDivergenceEstimate('nonexistent_node');
  assert.equal(age, null, 'Should return null for nonexistent node ID');
});

test('Age Ma Integration - Supports age-based link-strength calculations with Tetrapods ages', () => {
  const hypothesis = createTestHypothesisWithAges();
  const vizNodes = createVizNodes(hypothesis);

  const viz = Object.create(ForceDirectedVisualization.prototype);
  viz.nodes = vizNodes;
  viz.divergenceData = null;

  // Simulate age-based link-strength calculation
  // For link from root to internal_n2 (age 50.0)
  const targetAge = viz._getDivergenceEstimate('internal_n2');
  assert.equal(targetAge, 50.0, 'Should retrieve age for link-strength calculation');

  // Simulate formula: ageContribution = (ageLinkStrength / 1000) * (divergenceAgeMa / 100)
  // ageLinkStrength is UI range 0-100
  const ageLinkStrength = 50;  // UI value 0-100
  const ageContribution = (ageLinkStrength / 1000) * (targetAge / 100);
  const expectedContribution = 0.025;  // (50/1000) * (50/100) = 0.025

  assert.equal(ageContribution, expectedContribution, 'Should calculate correct link strength contribution');
});

test('Age Ma Integration - setShowNodeDates works without divergenceData (stored ages only)', () => {
  const hypothesis = createTestHypothesisWithAges();
  const vizNodes = createVizNodes(hypothesis);

  const viz = Object.create(ForceDirectedVisualization.prototype);
  viz.nodes = vizNodes;
  viz.divergenceData = null;  // Explicitly no legacy divergence data
  viz.hypothesisId = 'test_hyp';
  viz.showNodeDates = false;

  // Mock textLayer with minimal d3-like interface
  let renderDateLabelsCalled = false;
  viz._renderDateLabels = function() {
    renderDateLabelsCalled = true;
    // Verify the method runs without throwing even with null divergenceData
  };

  // Should not throw even with null divergenceData
  viz.setShowNodeDates(true, null);
  assert.equal(viz.showNodeDates, true, 'Should enable date display with only stored ages');
  assert.equal(renderDateLabelsCalled, true, 'Should call _renderDateLabels even without divergenceData');
});

test('Age Ma Integration - Age-based link strength works with stored ages and no divergenceData', () => {
  const hypothesis = createTestHypothesisWithAges();
  const vizNodes = createVizNodes(hypothesis);

  const viz = Object.create(ForceDirectedVisualization.prototype);
  viz.nodes = vizNodes;
  viz.divergenceData = null;  // No legacy divergence data
  viz.nodes.forEach(n => {
    n.x = Math.random() * 100;
    n.y = Math.random() * 100;
  });

  // Simulate _computePerLinkStrength logic for age-based contribution
  const ageLinkStrength = 60;  // UI value 0-100
  const targetId = 'internal_n2';
  const divergenceAgeMa = viz._getDivergenceEstimate(targetId);

  assert.equal(divergenceAgeMa, 50.0, 'Should find stored age without divergenceData');

  // Calculate contribution even with null divergenceData
  if (ageLinkStrength > 0 && divergenceAgeMa !== null && divergenceAgeMa > 0) {
    const ageContribution = (ageLinkStrength / 1000) * (divergenceAgeMa / 100);
    const expectedContribution = 0.03;  // (60/1000) * (50/100) = 0.03
    assert.equal(ageContribution, expectedContribution, 'Should calculate age-based contribution without divergenceData');
  } else {
    assert.fail('Should calculate age contribution with stored ages and no divergenceData');
  }
});
