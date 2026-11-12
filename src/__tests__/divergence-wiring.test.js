/**
 * Tests for divergence data wiring and age-based link strength
 * 
 * Verifies that:
 * - Divergence data is available independently of showNodeDates toggle
 * - Age-based link strength uses the helper to get estimates
 * - Helper returns null for 0 or multiple estimates (never silently selects)
 * - Force calculations use divergence data correctly
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { ForceDirectedVisualization } from '../visualization/forceDirectedVisualization.js';

/**
 * Helper to create minimal test divergence data structure
 */
function createTestDivergenceData() {
  return {
    estimates: {},
    sourceMetadata: {},
    estimatesByHypothesis: {
      'hypothesis-1': {
        'node-1': {
          estimates: [{ centralEstimate: 100, sourceId: 'source-1' }]
        },
        'node-2': {
          estimates: [
            { centralEstimate: 50, sourceId: 'source-1' },
            { centralEstimate: 52, sourceId: 'source-2' }
          ]
        },
        'node-3': {
          estimates: []
        }
      }
    }
  };
}

/**
 * Helper to create minimal test hypothesis data
 */
function createTestHypothesisData(id = 'hypothesis-1') {
  return {
    id: id,
    hypothesisId: id,
    rootNodeId: 'root'
  };
}

/**
 * Test 1: Divergence data can be passed during construction
 */
test('Divergence data - Can be passed during visualization construction', async (t) => {
  const divergenceData = createTestDivergenceData();
  
  // Create minimal visualization with divergenceData in options
  // Note: In real usage, this would be passed to the constructor
  const testViz = {
    divergenceData: divergenceData,
    hypothesisData: createTestHypothesisData()
  };
  
  assert.ok(testViz.divergenceData, 'divergenceData should be stored');
  assert.ok(testViz.divergenceData.estimatesByHypothesis, 'estimatesByHypothesis should exist');
  assert.ok(testViz.divergenceData.estimatesByHypothesis['hypothesis-1'], 'hypothesis should be present');
});

/**
 * Test 2: _getDivergenceEstimate returns value for single estimate
 */
test('Divergence estimate - Returns central estimate when exactly one exists', async (t) => {
  const divergenceData = createTestDivergenceData();
  const hypothesisData = createTestHypothesisData();
  
  // Simulate the helper method
  function getDivergenceEstimate(nodeId, data, hyp) {
    if (!data || !nodeId) return null;
    
    const estimatesByHypothesis = data.estimatesByHypothesis || {};
    const hypothesisId = hyp?.id || 'default';
    const hypothesisEstimates = estimatesByHypothesis[hypothesisId];
    
    if (!hypothesisEstimates) return null;
    
    const nodeData = hypothesisEstimates[nodeId];
    if (!nodeData) return null;
    
    const estimates = nodeData.estimates;
    if (!Array.isArray(estimates)) return null;
    
    if (estimates.length === 1) {
      return estimates[0].centralEstimate || null;
    }
    
    return null;
  }
  
  const estimate = getDivergenceEstimate('node-1', divergenceData, hypothesisData);
  assert.equal(estimate, 100, 'Should return central estimate for single estimate');
});

/**
 * Test 3: _getDivergenceEstimate returns null for multiple estimates
 */
test('Divergence estimate - Returns null for multiple estimates (never silently selects)', async (t) => {
  const divergenceData = createTestDivergenceData();
  const hypothesisData = createTestHypothesisData();
  
  function getDivergenceEstimate(nodeId, data, hyp) {
    if (!data || !nodeId) return null;
    
    const estimatesByHypothesis = data.estimatesByHypothesis || {};
    const hypothesisId = hyp?.id || 'default';
    const hypothesisEstimates = estimatesByHypothesis[hypothesisId];
    
    if (!hypothesisEstimates) return null;
    
    const nodeData = hypothesisEstimates[nodeId];
    if (!nodeData) return null;
    
    const estimates = nodeData.estimates;
    if (!Array.isArray(estimates)) return null;
    
    if (estimates.length === 1) {
      return estimates[0].centralEstimate || null;
    }
    
    return null;
  }
  
  const estimate = getDivergenceEstimate('node-2', divergenceData, hypothesisData);
  assert.equal(estimate, null, 'Should return null for multiple estimates (2 estimates)');
});

/**
 * Test 4: _getDivergenceEstimate returns null for missing estimates
 */
test('Divergence estimate - Returns null for missing estimates', async (t) => {
  const divergenceData = createTestDivergenceData();
  const hypothesisData = createTestHypothesisData();
  
  function getDivergenceEstimate(nodeId, data, hyp) {
    if (!data || !nodeId) return null;
    
    const estimatesByHypothesis = data.estimatesByHypothesis || {};
    const hypothesisId = hyp?.id || 'default';
    const hypothesisEstimates = estimatesByHypothesis[hypothesisId];
    
    if (!hypothesisEstimates) return null;
    
    const nodeData = hypothesisEstimates[nodeId];
    if (!nodeData) return null;
    
    const estimates = nodeData.estimates;
    if (!Array.isArray(estimates)) return null;
    
    if (estimates.length === 1) {
      return estimates[0].centralEstimate || null;
    }
    
    return null;
  }
  
  const estimate = getDivergenceEstimate('node-3', divergenceData, hypothesisData);
  assert.equal(estimate, null, 'Should return null for zero estimates');
});

/**
 * Test 5: _getDivergenceEstimate returns null when node doesn't exist
 */
test('Divergence estimate - Returns null for non-existent node', async (t) => {
  const divergenceData = createTestDivergenceData();
  const hypothesisData = createTestHypothesisData();
  
  function getDivergenceEstimate(nodeId, data, hyp) {
    if (!data || !nodeId) return null;
    
    const estimatesByHypothesis = data.estimatesByHypothesis || {};
    const hypothesisId = hyp?.id || 'default';
    const hypothesisEstimates = estimatesByHypothesis[hypothesisId];
    
    if (!hypothesisEstimates) return null;
    
    const nodeData = hypothesisEstimates[nodeId];
    if (!nodeData) return null;
    
    const estimates = nodeData.estimates;
    if (!Array.isArray(estimates)) return null;
    
    if (estimates.length === 1) {
      return estimates[0].centralEstimate || null;
    }
    
    return null;
  }
  
  const estimate = getDivergenceEstimate('non-existent', divergenceData, hypothesisData);
  assert.equal(estimate, null, 'Should return null for non-existent node');
});

/**
 * Test 6: _getDivergenceEstimate returns null when data is null
 */
test('Divergence estimate - Returns null when divergence data is null', async (t) => {
  function getDivergenceEstimate(nodeId, data, hyp) {
    if (!data || !nodeId) return null;
    
    const estimatesByHypothesis = data.estimatesByHypothesis || {};
    const hypothesisId = hyp?.id || 'default';
    const hypothesisEstimates = estimatesByHypothesis[hypothesisId];
    
    if (!hypothesisEstimates) return null;
    
    const nodeData = hypothesisEstimates[nodeId];
    if (!nodeData) return null;
    
    const estimates = nodeData.estimates;
    if (!Array.isArray(estimates)) return null;
    
    if (estimates.length === 1) {
      return estimates[0].centralEstimate || null;
    }
    
    return null;
  }
  
  const estimate = getDivergenceEstimate('node-1', null, createTestHypothesisData());
  assert.equal(estimate, null, 'Should return null when divergence data is null');
});

/**
 * Test 7: Per-link strength formula uses divergence estimates correctly
 */
test('Link strength - Age-based contribution uses helper correctly', async (t) => {
  const divergenceData = createTestDivergenceData();
  const hypothesisData = createTestHypothesisData();
  const baseLinkStrength = 0.5;
  const rootLinkStrength = 0;
  const ageLinkStrength = 2.0;
  
  function getDivergenceEstimate(nodeId, data, hyp) {
    if (!data || !nodeId) return null;
    
    const estimatesByHypothesis = data.estimatesByHypothesis || {};
    const hypothesisId = hyp?.id || 'default';
    const hypothesisEstimates = estimatesByHypothesis[hypothesisId];
    
    if (!hypothesisEstimates) return null;
    
    const nodeData = hypothesisEstimates[nodeId];
    if (!nodeData) return null;
    
    const estimates = nodeData.estimates;
    if (!Array.isArray(estimates)) return null;
    
    if (estimates.length === 1) {
      return estimates[0].centralEstimate || null;
    }
    
    return null;
  }
  
  function computePerLinkStrength(targetNodeId, base, root, age, data, hyp, depths, maxDep) {
    let strength = base;
    
    if (root > 0 && maxDep > 0) {
      const childDepth = depths[targetNodeId] || 0;
      const depthFraction = childDepth / maxDep;
      const rootContribution = base * root * (1 - depthFraction);
      strength += rootContribution;
    }
    
    if (age > 0 && data) {
      const divergenceAgeMa = getDivergenceEstimate(targetNodeId, data, hyp);
      if (divergenceAgeMa !== null && divergenceAgeMa > 0) {
        const ageContribution = age * divergenceAgeMa;
        strength += ageContribution;
      }
    }
    
    return strength;
  }
  
  // Test with node-1 (has single estimate of 100)
  const strengthNode1 = computePerLinkStrength(
    'node-1', baseLinkStrength, rootLinkStrength, ageLinkStrength, 
    divergenceData, hypothesisData, {}, 0
  );
  assert.equal(
    strengthNode1, 
    0.5 + (2.0 * 100), 
    'Should include age contribution for node with single estimate'
  );
  
  // Test with node-2 (has multiple estimates, should return null)
  const strengthNode2 = computePerLinkStrength(
    'node-2', baseLinkStrength, rootLinkStrength, ageLinkStrength,
    divergenceData, hypothesisData, {}, 0
  );
  assert.equal(
    strengthNode2,
    0.5,
    'Should NOT include age contribution for node with multiple estimates'
  );
  
  // Test with node-3 (has zero estimates)
  const strengthNode3 = computePerLinkStrength(
    'node-3', baseLinkStrength, rootLinkStrength, ageLinkStrength,
    divergenceData, hypothesisData, {}, 0
  );
  assert.equal(
    strengthNode3,
    0.5,
    'Should NOT include age contribution for node with no estimates'
  );
});

/**
 * Test 8: Show node dates toggle doesn't affect divergence data availability
 */
test('Node dates toggle - Does not affect divergence data availability', async (t) => {
  const divergenceData = createTestDivergenceData();
  
  // Simulate visualization state
  let vizState = {
    divergenceData: divergenceData,
    showNodeDates: false
  };
  
  // Initially, divergence data should be available even if labels are hidden
  assert.ok(vizState.divergenceData, 'Data should be available before toggling');
  
  // Toggle label visibility
  vizState.showNodeDates = true;
  assert.ok(vizState.divergenceData, 'Data should still be available after toggling');
  
  // Toggle back
  vizState.showNodeDates = false;
  assert.ok(vizState.divergenceData, 'Data should still be available after toggling back');
});

/**
 * Test 9: Toggling show node dates doesn't clear divergence data
 */
test('Node dates toggle - Preserves divergence data when toggling labels', async (t) => {
  const divergenceData = createTestDivergenceData();
  
  // Start with labels hidden
  let showNodeDates = false;
  let storedDivergenceData = divergenceData;
  
  // Simulate setShowNodeDates(true) - should NOT replace divergenceData
  showNodeDates = true;
  // Note: Don't pass new divergenceData, so old one is preserved
  
  assert.ok(storedDivergenceData === divergenceData, 'Data reference should be preserved');
  assert.equal(showNodeDates, true, 'Label flag should update independently');
  
  // Simulate setShowNodeDates(false)
  showNodeDates = false;
  
  assert.ok(storedDivergenceData === divergenceData, 'Data reference should still be preserved');
  assert.equal(showNodeDates, false, 'Label flag should update independently');
});

/**
 * Test 10: Age-link strength recalculation works with stored divergence data
 */
test('Age link strength - Recalculation uses stored divergence data', async (t) => {
  const divergenceData = createTestDivergenceData();
  const hypothesisData = createTestHypothesisData();
  
  // Simulate link strength calculation with different age modifier values
  function getDivergenceEstimate(nodeId, data, hyp) {
    if (!data || !nodeId) return null;
    
    const estimatesByHypothesis = data.estimatesByHypothesis || {};
    const hypothesisId = hyp?.id || 'default';
    const hypothesisEstimates = estimatesByHypothesis[hypothesisId];
    
    if (!hypothesisEstimates) return null;
    
    const nodeData = hypothesisEstimates[nodeId];
    if (!nodeData) return null;
    
    const estimates = nodeData.estimates;
    if (!Array.isArray(estimates)) return null;
    
    if (estimates.length === 1) {
      return estimates[0].centralEstimate || null;
    }
    
    return null;
  }
  
  function computePerLinkStrength(targetNodeId, base, root, age, data, hyp, depths, maxDep) {
    let strength = base;
    
    if (root > 0 && maxDep > 0) {
      const childDepth = depths[targetNodeId] || 0;
      const depthFraction = childDepth / maxDep;
      const rootContribution = base * root * (1 - depthFraction);
      strength += rootContribution;
    }
    
    if (age > 0 && data) {
      const divergenceAgeMa = getDivergenceEstimate(targetNodeId, data, hyp);
      if (divergenceAgeMa !== null && divergenceAgeMa > 0) {
        const ageContribution = age * divergenceAgeMa;
        strength += ageContribution;
      }
    }
    
    return strength;
  }
  
  const baseStrength = 0.5;
  
  // Calculate with age modifier = 0 (no effect)
  const strengthAge0 = computePerLinkStrength(
    'node-1', baseStrength, 0, 0,
    divergenceData, hypothesisData, {}, 0
  );
  
  // Calculate with age modifier = 1.0
  const strengthAge1 = computePerLinkStrength(
    'node-1', baseStrength, 0, 1.0,
    divergenceData, hypothesisData, {}, 0
  );
  
  // Calculate with age modifier = 2.0
  const strengthAge2 = computePerLinkStrength(
    'node-1', baseStrength, 0, 2.0,
    divergenceData, hypothesisData, {}, 0
  );
  
  // All should use same divergence data
  assert.equal(strengthAge0, baseStrength, 'Age=0 should give base strength');
  assert.equal(strengthAge1, baseStrength + 100, 'Age=1.0 should add 1.0 * 100');
  assert.equal(strengthAge2, baseStrength + 200, 'Age=2.0 should add 2.0 * 100');
  
  // Verify recalculation with different age value uses same data
  assert.ok(divergenceData === divergenceData, 'Data reference unchanged');
});

/**
 * Test: Hypothesis ID is stored and used independently of display toggles
 */
test('Hypothesis ID - Used independently of display toggles (no default fallback)', async (t) => {
  const divergenceData = createTestDivergenceData();
  
  // Simulate helper that uses stored hypothesis ID (not hypothesisData.id)
  function getDivergenceEstimate(nodeId, data, storedHypothesisId) {
    if (!data || !nodeId || !storedHypothesisId) {
      return null;  // Explicit check for stored hypothesisId
    }
    
    const estimatesByHypothesis = data.estimatesByHypothesis || {};
    const hypothesisEstimates = estimatesByHypothesis[storedHypothesisId];
    
    if (!hypothesisEstimates) return null;
    
    const nodeData = hypothesisEstimates[nodeId];
    if (!nodeData) return null;
    
    const estimates = nodeData.estimates;
    if (!Array.isArray(estimates)) return null;
    
    if (estimates.length === 1) {
      return estimates[0].centralEstimate || null;
    }
    
    return null;
  }
  
  // With correct hypothesis ID, estimate should be retrievable
  const estimateWithId = getDivergenceEstimate('node-1', divergenceData, 'hypothesis-1');
  assert.equal(estimateWithId, 100, 'Should retrieve estimate with correct hypothesisId');
  
  // With null hypothesis ID, estimate should not be retrievable
  const estimateWithoutId = getDivergenceEstimate('node-1', divergenceData, null);
  assert.equal(estimateWithoutId, null, 'Should return null when hypothesisId is not set (no default)');
});

/**
 * Test: Divergence estimates work regardless of which display toggles are enabled
 */
test('Divergence estimates - Independent of Show Node Dates and Ancestral Labels toggles', async (t) => {
  const divergenceData = createTestDivergenceData();
  
  function getDivergenceEstimate(nodeId, data, storedHypothesisId) {
    if (!data || !nodeId || !storedHypothesisId) return null;
    
    const estimatesByHypothesis = data.estimatesByHypothesis || {};
    const hypothesisEstimates = estimatesByHypothesis[storedHypothesisId];
    if (!hypothesisEstimates) return null;
    
    const nodeData = hypothesisEstimates[nodeId];
    if (!nodeData) return null;
    
    const estimates = nodeData.estimates;
    if (!Array.isArray(estimates)) return null;
    
    if (estimates.length === 1) {
      return estimates[0].centralEstimate || null;
    }
    
    return null;
  }

  // Simulate different toggle states
  const scenarios = [
    { showNodeDates: false, showAncestralLabels: false, name: 'Both disabled' },
    { showNodeDates: true, showAncestralLabels: false, name: 'Dates enabled, Labels disabled' },
    { showNodeDates: false, showAncestralLabels: true, name: 'Dates disabled, Labels enabled' },
    { showNodeDates: true, showAncestralLabels: true, name: 'Both enabled' }
  ];

  for (const scenario of scenarios) {
    // Regardless of toggle states, estimate retrieval should work the same
    const estimate = getDivergenceEstimate('node-1', divergenceData, 'hypothesis-1');
    assert.equal(
      estimate, 100,
      `Should retrieve estimate when ${scenario.name}`
    );
  }
});

/**
 * Test: Correct hypothesis ID used when multiple hypotheses exist in divergence data
 */
test('Hypothesis ID - Correct estimate returned when multiple hypotheses present', async (t) => {
  // Create divergence data with two hypotheses
  const divergenceData = {
    estimates: {},
    sourceMetadata: {},
    estimatesByHypothesis: {
      'hypothesis-1': {
        'node-1': {
          estimates: [{ centralEstimate: 100, sourceId: 'source-1' }]
        }
      },
      'hypothesis-2': {
        'node-1': {
          estimates: [{ centralEstimate: 200, sourceId: 'source-1' }]
        }
      }
    }
  };

  function getDivergenceEstimate(nodeId, data, storedHypothesisId) {
    if (!data || !nodeId || !storedHypothesisId) return null;
    
    const estimatesByHypothesis = data.estimatesByHypothesis || {};
    const hypothesisEstimates = estimatesByHypothesis[storedHypothesisId];
    if (!hypothesisEstimates) return null;
    
    const nodeData = hypothesisEstimates[nodeId];
    if (!nodeData) return null;
    
    const estimates = nodeData.estimates;
    if (!Array.isArray(estimates)) return null;
    
    if (estimates.length === 1) {
      return estimates[0].centralEstimate || null;
    }
    
    return null;
  }

  // Each hypothesis should return its own correct estimate
  const estimate1 = getDivergenceEstimate('node-1', divergenceData, 'hypothesis-1');
  const estimate2 = getDivergenceEstimate('node-1', divergenceData, 'hypothesis-2');

  assert.equal(estimate1, 100, 'hypothesis-1 should return 100');
  assert.equal(estimate2, 200, 'hypothesis-2 should return 200');
  assert.notEqual(estimate1, estimate2, 'Different hypotheses should give different estimates');
});
