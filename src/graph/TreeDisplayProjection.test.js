/**
 * TreeDisplayProjection tests
 * Verify that the display projection correctly separates biological and display-only links,
 * maintains immutability, and reflects the current visibility state.
 */

import test from 'node:test';
import assert from 'node:assert';
import { GraphBuilder } from './PhyloGraph.js';
import { TreeVisibilityState } from './TreeVisibilityState.js';
import { TreeDisplayProjection } from './TreeDisplayProjection.js';

test('TreeDisplayProjection', async (t) => {
  // Build a small test graph using GraphBuilder
  // Structure: root-[n1, n2], n1-[n1a, n1b], n2-[n2a]
  //
  //       root
  //      /    \
  //     n1    n2
  //    / \    /
  //  n1a n1b n2a
  //

  const hypothesis = {
    hypothesisId: 'test_projection',
    rootNodeId: 'root',
    nodes: [
      { id: 'root', type: 'internal', parentId: null, children: ['n1', 'n2'] },
      { id: 'n1', type: 'internal', parentId: 'root', children: ['n1a', 'n1b'] },
      { id: 'n2', type: 'internal', parentId: 'root', children: ['n2a'] },
      { id: 'n1a', type: 'terminal', parentId: 'n1', taxonId: 'n1a', children: [] },
      { id: 'n1b', type: 'terminal', parentId: 'n1', taxonId: 'n1b', children: [] },
      { id: 'n2a', type: 'terminal', parentId: 'n2', taxonId: 'n2a', children: [] }
    ]
  };

  const taxonomy = {
    'n1a': { id: 'n1a', scientificName: 'Species N1A', rank: 'species' },
    'n1b': { id: 'n1b', scientificName: 'Species N1B', rank: 'species' },
    'n2a': { id: 'n2a', scientificName: 'Species N2A', rank: 'species' }
  };

  const builder = new GraphBuilder(hypothesis.hypothesisId, hypothesis.rootNodeId);
  for (const node of hypothesis.nodes) {
    builder.addNode(node);
  }
  const graph = builder.build(taxonomy);
  const visibilityState = new TreeVisibilityState(graph, 'root');

  await t.test('Initial projection has all nodes visible', () => {
    const projection = new TreeDisplayProjection(graph, visibilityState);
    const visible = projection.getVisibleNodeIds();

    assert.strictEqual(visible.size, 6, 'All 6 nodes should be visible');
    assert(visible.has('root'), 'root should be visible');
    assert(visible.has('n1'), 'n1 should be visible');
    assert(visible.has('n2'), 'n2 should be visible');
    assert(visible.has('n1a'), 'n1a should be visible');
    assert(visible.has('n1b'), 'n1b should be visible');
    assert(visible.has('n2a'), 'n2a should be visible');
  });

  await t.test('Initial projection has correct biological links', () => {
    const projection = new TreeDisplayProjection(graph, visibilityState);
    const links = projection.getBiologicalLinks();

    assert.strictEqual(links.length, 5, 'Should have 5 biological links');

    // Verify all links are present
    const linkSet = new Set(links.map(l => `${l.sourceId}->${l.targetId}`));
    assert(linkSet.has('root->n1'));
    assert(linkSet.has('root->n2'));
    assert(linkSet.has('n1->n1a'));
    assert(linkSet.has('n1->n1b'));
    assert(linkSet.has('n2->n2a'));

    // Verify all links have type 'biological'
    for (const link of links) {
      assert.strictEqual(link.type, 'biological');
    }
  });

  await t.test('Initial projection has empty abbreviated links', () => {
    const projection = new TreeDisplayProjection(graph, visibilityState);
    const abbrevLinks = projection.getAbbreviatedLinks();

    assert.strictEqual(abbrevLinks.length, 0, 'Abbreviated links should be empty in this phase');
  });

  await t.test('Projection after collapsing a node', () => {
    const projection = new TreeDisplayProjection(graph, visibilityState);

    // Collapse n1: hide n1a, n1b
    visibilityState.collapseNode('n1');
    projection.regenerate();

    const visible = projection.getVisibleNodeIds();
    assert.strictEqual(visible.size, 4, '4 nodes should be visible (root, n1, n2, n2a)');
    assert(!visible.has('n1a'), 'n1a should not be visible');
    assert(!visible.has('n1b'), 'n1b should not be visible');

    const links = projection.getBiologicalLinks();
    assert.strictEqual(links.length, 3, 'Should have 3 biological links');

    const linkSet = new Set(links.map(l => `${l.sourceId}->${l.targetId}`));
    assert(linkSet.has('root->n1'));
    assert(linkSet.has('root->n2'));
    assert(linkSet.has('n2->n2a'));
    assert(!linkSet.has('n1->n1a'));
    assert(!linkSet.has('n1->n1b'));
  });

  await t.test('Projection after collapsing entire tree to root', () => {
    const projection = new TreeDisplayProjection(graph, visibilityState);

    // Reset to full tree first
    visibilityState.collapseToRoot();
    projection.regenerate();

    const visible = projection.getVisibleNodeIds();
    assert.strictEqual(visible.size, 1, 'Only root should be visible');
    assert(visible.has('root'));

    const links = projection.getBiologicalLinks();
    assert.strictEqual(links.length, 0, 'No links when only root is visible');
  });

  await t.test('Projection after one-level expansion', () => {
    const projection = new TreeDisplayProjection(graph, visibilityState);

    // Start with root only
    visibilityState.collapseToRoot();
    projection.regenerate();

    // Expand root one level
    visibilityState.expandNodeOneLevel('root');
    projection.regenerate();

    const visible = projection.getVisibleNodeIds();
    assert.strictEqual(visible.size, 3, '3 nodes should be visible (root, n1, n2)');
    assert(visible.has('root'));
    assert(visible.has('n1'));
    assert(visible.has('n2'));
    assert(!visible.has('n1a'));
    assert(!visible.has('n1b'));
    assert(!visible.has('n2a'));

    const links = projection.getBiologicalLinks();
    assert.strictEqual(links.length, 2, 'Should have 2 biological links');

    const linkSet = new Set(links.map(l => `${l.sourceId}->${l.targetId}`));
    assert(linkSet.has('root->n1'));
    assert(linkSet.has('root->n2'));
  });

  await t.test('getProjection returns independent copy', () => {
    const projection = new TreeDisplayProjection(graph, visibilityState);

    // Reset to full tree
    visibilityState.collapseToRoot();
    visibilityState.expandNodeOneLevel('root');
    projection.regenerate();

    const proj1 = projection.getProjection();
    const proj2 = projection.getProjection();

    // Modify proj1 (should not affect proj2 or internal state)
    proj1.visibleNodeIds.add('fake-node');
    proj1.biologicalLinks.push({ sourceId: 'fake', targetId: 'fake', type: 'fake' });

    // Verify proj2 is unaffected
    assert(!proj2.visibleNodeIds.has('fake-node'));
    assert.strictEqual(proj2.biologicalLinks.length, 2);

    // Verify internal projection is unaffected
    const proj3 = projection.getProjection();
    assert(!proj3.visibleNodeIds.has('fake-node'));
    assert.strictEqual(proj3.biologicalLinks.length, 2);
  });

  await t.test('Projection does not mutate visibility state', () => {
    const projection = new TreeDisplayProjection(graph, visibilityState);

    // Get initial visibility
    const initialVisible = visibilityState.getVisibleNodeIds();
    const initialSize = initialVisible.size;

    // Get projection multiple times
    projection.getProjection();
    projection.getProjection();

    // Verify visibility state unchanged
    const finalVisible = visibilityState.getVisibleNodeIds();
    assert.strictEqual(finalVisible.size, initialSize);
  });

  await t.test('Projection does not mutate original graph', () => {
    const projection = new TreeDisplayProjection(graph, visibilityState);

    // Verify graph is frozen before and after projection
    const parentBefore = graph.getParent('n1');
    const childrenBefore = graph.getChildren('root');

    projection.getProjection();
    projection.regenerate();

    const parentAfter = graph.getParent('n1');
    const childrenAfter = graph.getChildren('root');

    assert.strictEqual(parentBefore, parentAfter);
    assert.deepStrictEqual(Array.from(childrenBefore), Array.from(childrenAfter));

    // Verify graph is still frozen
    assert.throws(() => {
      graph.nodes.set('fake', {});
    });
  });

  await t.test('getAllLinks returns combined biological and abbreviated links', () => {
    const projection = new TreeDisplayProjection(graph, visibilityState);
    const allLinks = projection.getAllLinks();

    // In this phase, abbreviated links are empty
    const bioLinks = projection.getBiologicalLinks();
    const abbrevLinks = projection.getAbbreviatedLinks();

    assert.strictEqual(allLinks.length, bioLinks.length + abbrevLinks.length);
    assert.strictEqual(allLinks.length, bioLinks.length);
  });

  await t.test('Projection reflects repeated visibility changes', () => {
    const projection = new TreeDisplayProjection(graph, visibilityState);

    // Collapse root to single node
    visibilityState.collapseToRoot();
    projection.regenerate();
    let visible = projection.getVisibleNodeIds();
    assert.strictEqual(visible.size, 1);

    // Expand one level
    visibilityState.expandNodeOneLevel('root');
    projection.regenerate();
    visible = projection.getVisibleNodeIds();
    assert.strictEqual(visible.size, 3);

    // Collapse n1
    visibilityState.collapseNode('n1');
    projection.regenerate();
    visible = projection.getVisibleNodeIds();
    assert.strictEqual(visible.size, 3);

    // Expand n1 one level (should show n1a, n1b)
    visibilityState.expandNodeOneLevel('n1');
    projection.regenerate();
    visible = projection.getVisibleNodeIds();
    assert.strictEqual(visible.size, 5);
  });

  await t.test('Biological links match getVisibleLinkIds() from visibility state', () => {
    const projection = new TreeDisplayProjection(graph, visibilityState);

    // Reset to full tree
    visibilityState.collapseToRoot();
    visibilityState.expandNodeOneLevel('root');
    projection.regenerate();

    const visibleLinkIds = visibilityState.getVisibleLinkIds();
    const bioLinks = projection.getBiologicalLinks();

    // Convert both to comparable format
    const linkIdSet = new Set(visibleLinkIds.map(l => `${l[0]}->${l[1]}`));
    const bioLinkSet = new Set(bioLinks.map(l => `${l.sourceId}->${l.targetId}`));

    assert.deepStrictEqual(bioLinkSet, linkIdSet);
  });

  await t.test('Multifurcating nodes (many children) work correctly', () => {
    // Create a star graph: root with 5 children
    const multiHypothesis = {
      hypothesisId: 'test_multifurcating',
      rootNodeId: 'root',
      nodes: [
        { id: 'root', type: 'internal', parentId: null, children: ['c1', 'c2', 'c3', 'c4', 'c5'] },
        { id: 'c1', type: 'terminal', parentId: 'root', taxonId: 'c1', children: [] },
        { id: 'c2', type: 'terminal', parentId: 'root', taxonId: 'c2', children: [] },
        { id: 'c3', type: 'terminal', parentId: 'root', taxonId: 'c3', children: [] },
        { id: 'c4', type: 'terminal', parentId: 'root', taxonId: 'c4', children: [] },
        { id: 'c5', type: 'terminal', parentId: 'root', taxonId: 'c5', children: [] }
      ]
    };

    const multiTaxonomy = {
      'c1': { id: 'c1', scientificName: 'Child 1', rank: 'species' },
      'c2': { id: 'c2', scientificName: 'Child 2', rank: 'species' },
      'c3': { id: 'c3', scientificName: 'Child 3', rank: 'species' },
      'c4': { id: 'c4', scientificName: 'Child 4', rank: 'species' },
      'c5': { id: 'c5', scientificName: 'Child 5', rank: 'species' }
    };

    const multiBuilder = new GraphBuilder(multiHypothesis.hypothesisId, multiHypothesis.rootNodeId);
    for (const node of multiHypothesis.nodes) {
      multiBuilder.addNode(node);
    }
    const multiGraph = multiBuilder.build(multiTaxonomy);
    const multiVis = new TreeVisibilityState(multiGraph, 'root');
    const projection = new TreeDisplayProjection(multiGraph, multiVis);

    // Verify all 5 children are connected to root
    const links = projection.getBiologicalLinks();
    assert.strictEqual(links.length, 5);

    // Collapse to root
    multiVis.collapseToRoot();
    projection.regenerate();

    const visible = projection.getVisibleNodeIds();
    assert.strictEqual(visible.size, 1);

    const linksAfterCollapse = projection.getBiologicalLinks();
    assert.strictEqual(linksAfterCollapse.length, 0);
  });

  await t.test('Constructor throws on missing graph', () => {
    assert.throws(() => {
      new TreeDisplayProjection(null, visibilityState);
    }, /requires a PhyloGraph/);
  });

  await t.test('Constructor throws on missing visibility state', () => {
    assert.throws(() => {
      new TreeDisplayProjection(graph, null);
    }, /requires a TreeVisibilityState/);
  });

  await t.test('Link objects have correct structure', () => {
    const projection = new TreeDisplayProjection(graph, visibilityState);

    const bioLinks = projection.getBiologicalLinks();
    for (const link of bioLinks) {
      assert(link.hasOwnProperty('sourceId'));
      assert(link.hasOwnProperty('targetId'));
      assert(link.hasOwnProperty('type'));
      assert.strictEqual(link.type, 'biological');
      assert.strictEqual(typeof link.sourceId, 'string');
      assert.strictEqual(typeof link.targetId, 'string');
    }

    const abbrevLinks = projection.getAbbreviatedLinks();
    for (const link of abbrevLinks) {
      assert(link.hasOwnProperty('sourceId'));
      assert(link.hasOwnProperty('targetId'));
      assert(link.hasOwnProperty('type'));
      assert.strictEqual(link.type, 'abbreviated');
    }
  });

  await t.test('Projection handles edge case: orphaned visible node (should not happen)', () => {
    // Verify the invariant: every visible non-root node has a visible parent
    const projection = new TreeDisplayProjection(graph, visibilityState);

    visibilityState.collapseToRoot();
    visibilityState.expandNodeOneLevel('root');
    projection.regenerate();

    const visible = projection.getVisibleNodeIds();
    const bioLinks = projection.getBiologicalLinks();

    // Build parent map from links
    const parentMap = new Map();
    for (const link of bioLinks) {
      parentMap.set(link.targetId, link.sourceId);
    }

    // Check invariant: every visible non-root node has a visible parent
    for (const nodeId of visible) {
      if (nodeId === 'root') continue;
      assert(parentMap.has(nodeId), `Node ${nodeId} should have a parent link`);
      const parentId = parentMap.get(nodeId);
      assert(visible.has(parentId), `Node ${nodeId}'s parent ${parentId} should be visible`);
    }
  });

  await t.test('Abbreviated links remain empty throughout all operations', () => {
    const projection = new TreeDisplayProjection(graph, visibilityState);

    // Perform various operations and verify abbreviated links stay empty
    const operations = [
      () => visibilityState.collapseNode('n1'),
      () => visibilityState.expandNodeOneLevel('root'),
      () => visibilityState.collapseToRoot(),
      () => visibilityState.expandNodeOneLevel('root'),
      () => visibilityState.collapseNode('n2')
    ];

    for (const op of operations) {
      op();
      projection.regenerate();
      const abbrevLinks = projection.getAbbreviatedLinks();
      assert.strictEqual(abbrevLinks.length, 0, 'Abbreviated links should remain empty');
    }
  });
});

test('TreeDisplayProjection - Test-Hardening: Deep Intermediate Ancestors', async (t) => {
  // Build a tree with deep intermediate ancestors:
  // root → ancestor → internal1 → internal2 → terminal
  const deepHypothesis = {
    hypothesisId: 'test_deep',
    rootNodeId: 'root',
    nodes: [
      { id: 'root', type: 'internal', parentId: null, children: ['ancestor'] },
      { id: 'ancestor', type: 'internal', parentId: 'root', children: ['internal1'] },
      { id: 'internal1', type: 'internal', parentId: 'ancestor', children: ['internal2'] },
      { id: 'internal2', type: 'internal', parentId: 'internal1', children: ['term1', 'term2'] },
      { id: 'term1', type: 'terminal', parentId: 'internal2', taxonId: 'term1', children: [] },
      { id: 'term2', type: 'terminal', parentId: 'internal2', taxonId: 'term2', children: [] }
    ]
  };

  const deepTaxonomy = {
    'term1': { id: 'term1', scientificName: 'Species Term1', rank: 'species' },
    'term2': { id: 'term2', scientificName: 'Species Term2', rank: 'species' }
  };

  const builder = new GraphBuilder(deepHypothesis.hypothesisId, deepHypothesis.rootNodeId);
  for (const node of deepHypothesis.nodes) {
    builder.addNode(node);
  }
  const graph = builder.build(deepTaxonomy);
  const visibilityState = new TreeVisibilityState(graph, 'root');

  await t.test('After sampling ancestor, intermediates remain hidden', () => {
    const projection = new TreeDisplayProjection(graph, visibilityState, { maxSampledSpecies: 10 });

    // Collapse ancestor (hiding all descendants)
    visibilityState.collapseNode('ancestor');
    assert.strictEqual(visibilityState.isNodeVisible('internal1'), false, 'internal1 hidden after collapse');
    assert.strictEqual(visibilityState.isNodeVisible('internal2'), false, 'internal2 hidden after collapse');

    // Generate sample from ancestor
    projection.generateSample('ancestor');
    const sample = projection.getActiveSample();
    assert.ok(sample, 'Sample created');
    assert.strictEqual(sample.ancestorId, 'ancestor', 'Ancestor is sampling point');

    // Visibility state should have ancestor (root is always visible)
    assert.strictEqual(visibilityState.isNodeVisible('ancestor'), true, 'ancestor visible (collapsed ancestor starts visible)');
    assert.strictEqual(visibilityState.isNodeVisible('internal1'), false, 'internal1 remains hidden');
    assert.strictEqual(visibilityState.isNodeVisible('internal2'), false, 'internal2 remains hidden');

    // Sampled terminals should be in the sample, not yet in visibility state
    // (TreeManipulation adds them after generateSample)
    assert.ok(sample.terminalIds.size > 0, 'At least one terminal sampled');
    for (const terminalId of sample.terminalIds) {
      assert.ok(terminalId === 'term1' || terminalId === 'term2', 'Sampled terminal is term1 or term2');
    }

    // Projection should have abbreviated link from ancestor to sampled terminal
    const abbrevLinks = projection.getAbbreviatedLinks();
    assert.ok(abbrevLinks.length > 0, 'Abbreviated links exist');

    for (const link of abbrevLinks) {
      assert.strictEqual(link.sourceId, 'ancestor', 'Abbreviated link source is ancestor');
      assert.strictEqual(link.type, 'abbreviated', 'Link type is abbreviated');
      assert.ok(sample.terminalIds.has(link.targetId), 'Link target is sampled terminal');
    }
  });

  await t.test('Original graph topology unchanged after sampling', () => {
    const projection = new TreeDisplayProjection(graph, visibilityState, { maxSampledSpecies: 10 });

    // Verify original graph parent-child relationships before sampling
    assert.strictEqual(graph.getParent('internal1'), 'ancestor', 'internal1 parent is ancestor');
    assert.strictEqual(graph.getParent('internal2'), 'internal1', 'internal2 parent is internal1');
    assert.strictEqual(graph.getParent('term1'), 'internal2', 'term1 parent is internal2');

    // Generate sample
    projection.generateSample('ancestor');

    // Verify original graph unchanged
    assert.strictEqual(graph.getParent('internal1'), 'ancestor', 'internal1 parent unchanged');
    assert.strictEqual(graph.getParent('internal2'), 'internal1', 'internal2 parent unchanged');
    assert.strictEqual(graph.getParent('term1'), 'internal2', 'term1 parent unchanged');

    const ancestorChildren = graph.getChildren('ancestor');
    assert.deepStrictEqual(ancestorChildren, ['internal1'], 'ancestor children unchanged');
  });
});

test('TreeDisplayProjection - Test-Hardening: Sample Stability', async (t) => {
  const stableHypothesis = {
    hypothesisId: 'test_stable',
    rootNodeId: 'root',
    nodes: [
      { id: 'root', type: 'internal', parentId: null, children: ['n1'] },
      { id: 'n1', type: 'internal', parentId: 'root', children: ['t1', 't2', 't3'] },
      { id: 't1', type: 'terminal', parentId: 'n1', taxonId: 't1', children: [] },
      { id: 't2', type: 'terminal', parentId: 'n1', taxonId: 't2', children: [] },
      { id: 't3', type: 'terminal', parentId: 'n1', taxonId: 't3', children: [] }
    ]
  };

  const stableTaxonomy = {
    't1': { id: 't1', scientificName: 'Species T1', rank: 'species' },
    't2': { id: 't2', scientificName: 'Species T2', rank: 'species' },
    't3': { id: 't3', scientificName: 'Species T3', rank: 'species' }
  };

  const builder = new GraphBuilder(stableHypothesis.hypothesisId, stableHypothesis.rootNodeId);
  for (const node of stableHypothesis.nodes) {
    builder.addNode(node);
  }
  const graph = builder.build(stableTaxonomy);
  const visibilityState = new TreeVisibilityState(graph, 'root');

  await t.test('Sample remains unchanged across multiple regenerations', () => {
    const projection = new TreeDisplayProjection(graph, visibilityState, { maxSampledSpecies: 2 });

    // Generate initial sample
    visibilityState.collapseNode('n1');
    projection.generateSample('n1');

    const sample1 = projection.getActiveSample();
    const terminals1 = Array.from(sample1.terminalIds).sort();

    // Regenerate multiple times without changing anything
    for (let i = 0; i < 5; i++) {
      projection.regenerate();
    }

    const sample2 = projection.getActiveSample();
    const terminals2 = Array.from(sample2.terminalIds).sort();

    // Sampled terminal IDs must be identical
    assert.deepStrictEqual(terminals1, terminals2, 'Sample terminals unchanged after regenerations');
  });

  await t.test('Sample regenerates when max changed while active', () => {
    const projection = new TreeDisplayProjection(graph, visibilityState, { maxSampledSpecies: 1 });

    visibilityState.collapseNode('n1');
    projection.generateSample('n1');

    const sample1 = projection.getActiveSample();
    assert.strictEqual(sample1.terminalIds.size, 1, 'Initial sample has 1 terminal');

    // Change maximum while sample is active
    projection.setMaxSampledSpecies(2);

    const sample2 = projection.getActiveSample();
    assert.strictEqual(sample2.terminalIds.size, 2, 'Sample regenerated with new max of 2');
    assert.strictEqual(sample2.ancestorId, 'n1', 'Ancestor remains same');
  });
});

test('TreeDisplayProjection - Test-Hardening: Ancestor Switching', async (t) => {
  const switchHypothesis = {
    hypothesisId: 'test_switch',
    rootNodeId: 'root',
    nodes: [
      { id: 'root', type: 'internal', parentId: null, children: ['n1', 'n2'] },
      { id: 'n1', type: 'internal', parentId: 'root', children: ['t1', 't2'] },
      { id: 'n2', type: 'internal', parentId: 'root', children: ['t3', 't4'] },
      { id: 't1', type: 'terminal', parentId: 'n1', taxonId: 't1', children: [] },
      { id: 't2', type: 'terminal', parentId: 'n1', taxonId: 't2', children: [] },
      { id: 't3', type: 'terminal', parentId: 'n2', taxonId: 't3', children: [] },
      { id: 't4', type: 'terminal', parentId: 'n2', taxonId: 't4', children: [] }
    ]
  };

  const switchTaxonomy = {
    't1': { id: 't1', scientificName: 'Species T1', rank: 'species' },
    't2': { id: 't2', scientificName: 'Species T2', rank: 'species' },
    't3': { id: 't3', scientificName: 'Species T3', rank: 'species' },
    't4': { id: 't4', scientificName: 'Species T4', rank: 'species' }
  };

  const builder = new GraphBuilder(switchHypothesis.hypothesisId, switchHypothesis.rootNodeId);
  for (const node of switchHypothesis.nodes) {
    builder.addNode(node);
  }
  const graph = builder.build(switchTaxonomy);
  const visibilityState = new TreeVisibilityState(graph, 'root');

  await t.test('Multiple ancestors can have simultaneous samples', () => {
    const projection = new TreeDisplayProjection(graph, visibilityState, { maxSampledSpecies: 1 });

    // Sample from n1
    visibilityState.collapseNode('n1');
    visibilityState.collapseNode('n2');
    projection.generateSample('n1');

    const sample1 = projection.getSampleForAncestor('n1');
    assert(sample1, 'Should have sample for n1');
    assert.strictEqual(sample1.ancestorId, 'n1', 'First sample from n1');
    const terminals1 = Array.from(sample1.terminalIds);
    assert.ok(terminals1[0] === 't1' || terminals1[0] === 't2', 'Sample from n1 terminals');

    // Now sample from n2 (different ancestor) - should NOT replace n1's sample
    projection.generateSample('n2');

    // Both samples should now exist
    const sampleN1 = projection.getSampleForAncestor('n1');
    const sampleN2 = projection.getSampleForAncestor('n2');
    
    assert(sampleN1, 'Sample for n1 should still exist');
    assert(sampleN2, 'Sample for n2 should exist');
    assert.strictEqual(sampleN1.ancestorId, 'n1', 'n1 sample preserved');
    assert.strictEqual(sampleN2.ancestorId, 'n2', 'n2 sample created');
    
    const terminals2 = Array.from(sampleN2.terminalIds);
    assert.ok(terminals2[0] === 't3' || terminals2[0] === 't4', 'Sample from n2 terminals');

    // Samples should be from different branches
    assert.notDeepStrictEqual(terminals1, terminals2, 'Samples from different branches');
    
    // Verify both samples are in the projection
    const allSamples = projection.getAllActiveSamples();
    assert.strictEqual(allSamples.size, 2, 'Should have 2 active samples');
  });

  await t.test('Clearing one sample preserves the other', () => {
    const projection = new TreeDisplayProjection(graph, visibilityState, { maxSampledSpecies: 1 });

    // Setup: two active samples
    visibilityState.collapseNode('n1');
    visibilityState.collapseNode('n2');
    projection.generateSample('n1');
    projection.generateSample('n2');

    // Verify both exist
    let allSamples = projection.getAllActiveSamples();
    assert.strictEqual(allSamples.size, 2, 'Should have 2 active samples');

    // Clear sample for n1 only
    projection.clearSample('n1');

    // Verify n1's sample is gone but n2's remains
    allSamples = projection.getAllActiveSamples();
    assert.strictEqual(allSamples.size, 1, 'Should have 1 active sample after clearing n1');
    
    const remainingSample = projection.getSampleForAncestor('n2');
    assert(remainingSample, 'Sample for n2 should still exist');
    assert.strictEqual(remainingSample.ancestorId, 'n2', 'Remaining sample is from n2');
    
    const clearedSample = projection.getSampleForAncestor('n1');
    assert.strictEqual(clearedSample, null, 'Sample for n1 should be cleared');
  });

  await t.test('Toggling sample on same ancestor', () => {
    const projection = new TreeDisplayProjection(graph, visibilityState, { maxSampledSpecies: 1 });

    visibilityState.collapseNode('n1');
    
    // Generate sample for n1
    projection.generateSample('n1');
    let sample = projection.getSampleForAncestor('n1');
    assert(sample, 'Sample for n1 should exist');

    // Generate sample for n1 again - should clear it (toggle behavior)
    projection.generateSample('n1');
    sample = projection.getSampleForAncestor('n1');
    assert.strictEqual(sample, null, 'Sample should be cleared after second generateSample call');
  });
});

test('TreeDisplayProjection - Test-Hardening: Branch Fairness', async (t) => {
  // Unbalanced tree: one huge branch, several small branches
  // root → ancestor → [large_branch, small1, small2]
  // large_branch → [t1, t2, t3, t4, t5] (5 terminals)
  // small1 → [s1] (1 terminal)
  // small2 → [s2] (1 terminal)
  const fairHypothesis = {
    hypothesisId: 'test_fair',
    rootNodeId: 'root',
    nodes: [
      { id: 'root', type: 'internal', parentId: null, children: ['ancestor'] },
      { id: 'ancestor', type: 'internal', parentId: 'root', children: ['large', 'small1', 'small2'] },
      { id: 'large', type: 'internal', parentId: 'ancestor', children: ['t1', 't2', 't3', 't4', 't5'] },
      { id: 'small1', type: 'internal', parentId: 'ancestor', children: ['s1'] },
      { id: 'small2', type: 'internal', parentId: 'ancestor', children: ['s2'] },
      { id: 't1', type: 'terminal', parentId: 'large', taxonId: 't1', children: [] },
      { id: 't2', type: 'terminal', parentId: 'large', taxonId: 't2', children: [] },
      { id: 't3', type: 'terminal', parentId: 'large', taxonId: 't3', children: [] },
      { id: 't4', type: 'terminal', parentId: 'large', taxonId: 't4', children: [] },
      { id: 't5', type: 'terminal', parentId: 'large', taxonId: 't5', children: [] },
      { id: 's1', type: 'terminal', parentId: 'small1', taxonId: 's1', children: [] },
      { id: 's2', type: 'terminal', parentId: 'small2', taxonId: 's2', children: [] }
    ]
  };

  const fairTaxonomy = {
    't1': { id: 't1', scientificName: 'Large1', rank: 'species' },
    't2': { id: 't2', scientificName: 'Large2', rank: 'species' },
    't3': { id: 't3', scientificName: 'Large3', rank: 'species' },
    't4': { id: 't4', scientificName: 'Large4', rank: 'species' },
    't5': { id: 't5', scientificName: 'Large5', rank: 'species' },
    's1': { id: 's1', scientificName: 'Small1', rank: 'species' },
    's2': { id: 's2', scientificName: 'Small2', rank: 'species' }
  };

  const builder = new GraphBuilder(fairHypothesis.hypothesisId, fairHypothesis.rootNodeId);
  for (const node of fairHypothesis.nodes) {
    builder.addNode(node);
  }
  const graph = builder.build(fairTaxonomy);
  const visibilityState = new TreeVisibilityState(graph, 'root');

  await t.test('Sampling distributes across branches before concentrating', () => {
    // Test with max=5 to get multiple representatives
    const projection = new TreeDisplayProjection(graph, visibilityState, { maxSampledSpecies: 5 });

    visibilityState.collapseNode('ancestor');
    projection.generateSample('ancestor');

    const sample = projection.getActiveSample();
    const sampled = Array.from(sample.terminalIds);

    assert.strictEqual(sampled.length, 5, 'Exactly 5 samples taken');

    // Count samples from each branch
    const largeCount = sampled.filter(id => id.startsWith('t')).length;
    const smallCount = sampled.filter(id => id.startsWith('s')).length;

    // Large branch should NOT get all 5
    // Should be something like 3 from large, 1 from small1, 1 from small2
    assert.ok(largeCount < 5, 'Large branch does not monopolize all samples');
    assert.ok(smallCount > 0, 'Small branches represented');
  });
});

test('TreeDisplayProjection - Test-Hardening: Immutability', async (t) => {
  const immutableHypothesis = {
    hypothesisId: 'test_immutable',
    rootNodeId: 'root',
    nodes: [
      { id: 'root', type: 'internal', parentId: null, children: ['n1'] },
      { id: 'n1', type: 'internal', parentId: 'root', children: ['t1', 't2'], branchLength: 1.5, age_ma: [10, 20] },
      { id: 't1', type: 'terminal', parentId: 'n1', taxonId: 't1', branchLength: 2.0, children: [] },
      { id: 't2', type: 'terminal', parentId: 'n1', taxonId: 't2', branchLength: 2.0, children: [] }
    ]
  };

  const immutableTaxonomy = {
    't1': { id: 't1', scientificName: 'Species T1', rank: 'species' },
    't2': { id: 't2', scientificName: 'Species T2', rank: 'species' }
  };

  const builder = new GraphBuilder(immutableHypothesis.hypothesisId, immutableHypothesis.rootNodeId);
  for (const node of immutableHypothesis.nodes) {
    builder.addNode(node);
  }
  const graph = builder.build(immutableTaxonomy);
  const visibilityState = new TreeVisibilityState(graph, 'root');

  await t.test('Sampling and all operations preserve original graph structure', () => {
    // Capture original state
    const originalN1 = graph.getNode('n1');
    const originalN1Children = graph.getChildren('n1');
    const originalN1Parent = graph.getParent('n1');
    const originalT1Parent = graph.getParent('t1');

    const projection = new TreeDisplayProjection(graph, visibilityState, { maxSampledSpecies: 1 });

    // Perform multiple operations
    visibilityState.collapseNode('n1');
    projection.generateSample('n1');
    projection.regenerate();
    projection.setMaxSampledSpecies(2);
    projection.clearSample();
    projection.generateSample('n1');
    visibilityState.expandNodeOneLevel('n1');

    // Verify original graph unchanged
    const afterN1 = graph.getNode('n1');
    const afterN1Children = graph.getChildren('n1');
    const afterN1Parent = graph.getParent('n1');
    const afterT1Parent = graph.getParent('t1');

    assert.deepStrictEqual(afterN1, originalN1, 'Node n1 unchanged');
    assert.deepStrictEqual(afterN1Children, originalN1Children, 'n1 children unchanged');
    assert.strictEqual(afterN1Parent, originalN1Parent, 'n1 parent unchanged');
    assert.strictEqual(afterT1Parent, originalT1Parent, 't1 parent unchanged');
  });
});
