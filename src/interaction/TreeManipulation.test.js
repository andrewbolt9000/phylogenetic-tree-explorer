/**
 * TreeManipulation Tests
 *
 * Tests for tree node interaction handlers.
 */

import test from 'node:test';
import assert from 'node:assert';
import { GraphBuilder } from '../graph/PhyloGraph.js';
import { TreeVisibilityState } from '../graph/TreeVisibilityState.js';
import { TreeManipulation } from './TreeManipulation.js';

/**
 * Helper to create a test graph
 * Structure:
 *       root
 *       /  \
 *      n1  n2
 *     / \
 *    t1  t2
 */
function createSimpleTestGraph() {
  const hypothesis = {
    hypothesisId: 'test_h1',
    rootNodeId: 'root',
    nodes: [
      { id: 'root', type: 'internal', parentId: null, children: ['n1', 'n2'] },
      { id: 'n1', type: 'internal', parentId: 'root', children: ['t1', 't2'] },
      { id: 'n2', type: 'terminal', parentId: 'root', taxonId: 'n2', children: [] },
      { id: 't1', type: 'terminal', parentId: 'n1', taxonId: 't1', children: [] },
      { id: 't2', type: 'terminal', parentId: 'n1', taxonId: 't2', children: [] }
    ]
  };

  const taxonomy = {
    'n2': { id: 'n2', scientificName: 'Species N2', rank: 'species' },
    't1': { id: 't1', scientificName: 'Species T1', rank: 'species' },
    't2': { id: 't2', scientificName: 'Species T2', rank: 'species' }
  };

  const builder = new GraphBuilder(hypothesis.hypothesisId, hypothesis.rootNodeId);
  for (const node of hypothesis.nodes) {
    builder.addNode(node);
  }
  const graph = builder.build(taxonomy);

  return { graph, taxonomy, hypothesis };
}

/**
 * Helper to create a multifurcating test graph
 * Structure:
 *       root
 *      / | \
 *     n1 n2 n3
 *    / \
 *   t1  t2
 */
function createMultifurcatingGraph() {
  const hypothesis = {
    hypothesisId: 'test_h2',
    rootNodeId: 'root',
    nodes: [
      { id: 'root', type: 'internal', parentId: null, children: ['n1', 'n2', 'n3'] },
      { id: 'n1', type: 'internal', parentId: 'root', children: ['t1', 't2'] },
      { id: 'n2', type: 'terminal', parentId: 'root', taxonId: 'n2', children: [] },
      { id: 'n3', type: 'terminal', parentId: 'root', taxonId: 'n3', children: [] },
      { id: 't1', type: 'terminal', parentId: 'n1', taxonId: 't1', children: [] },
      { id: 't2', type: 'terminal', parentId: 'n1', taxonId: 't2', children: [] }
    ]
  };

  const taxonomy = {
    'n2': { id: 'n2', scientificName: 'Species N2', rank: 'species' },
    'n3': { id: 'n3', scientificName: 'Species N3', rank: 'species' },
    't1': { id: 't1', scientificName: 'Species T1', rank: 'species' },
    't2': { id: 't2', scientificName: 'Species T2', rank: 'species' }
  };

  const builder = new GraphBuilder(hypothesis.hypothesisId, hypothesis.rootNodeId);
  for (const node of hypothesis.nodes) {
    builder.addNode(node);
  }
  const graph = builder.build(taxonomy);

  return { graph, taxonomy, hypothesis };
}

/**
 * Helper to create mock visualization node data
 */
function createMockVizNode(nodeId, isInternal = true) {
  return {
    id: nodeId,
    x: 100,
    y: 100,
    children: isInternal ? ['child1'] : []  // Mark as internal or terminal
  };
}

/**
 * Helper to create mock click event
 */
function createMockClickEvent(shiftKey = false, altKey = false) {
  return {
    shiftKey,
    altKey,
    preventDefault: () => {},
    stopPropagation: () => {}
  };
}

test('TreeManipulation - Normal Click (No Manipulation)', async (t) => {
  await t.test('Normal click on collapsed node does not expand', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // Collapse n1
    visibility.collapseNode('n1');
    assert.strictEqual(visibility.isNodeVisible('t1'), false, 'Before: t1 hidden');

    // Create mock viz node without children property (authoritative lookup via graph)
    const vizNode = { id: 'n1', x: 100, y: 100 };

    // Normal click on n1
    const event = createMockClickEvent(false, false);
    manipulation.handleNodeClick(vizNode, event);

    // Should NOT expand n1 (normal click does nothing)
    assert.strictEqual(visibility.isNodeCollapsed('n1'), true, 'n1 still collapsed after normal click');
    assert.strictEqual(visibility.isNodeVisible('t1'), false, 't1 still hidden');
  });

  await t.test('Terminal node click does nothing', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    const initialCount = visibility.getVisibleNodeCount();

    // Click on terminal t1 (no children in graph)
    const vizNode = { id: 't1', x: 100, y: 100 };
    const event = createMockClickEvent(false, false);
    manipulation.handleNodeClick(vizNode, event);

    // Should do nothing
    assert.strictEqual(visibility.getVisibleNodeCount(), initialCount, 'No change for terminal');
  });

  await t.test('Visualization node without children property works with graph lookup', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // Create internal node viz data WITHOUT children property
    const vizNode = { id: 'n1', x: 50, y: 50, type: 'internal' };
    // No vizNode.children property - should use graph.getChildren()

    // Collapse n1 then try to expand with Shift-click
    visibility.collapseNode('n1');
    const event = createMockClickEvent(true, false);  // Shift-click
    manipulation.handleNodeClick(vizNode, event);

    // Should work (Shift-click expands)
    assert.strictEqual(visibility.isNodeVisible('t1'), true, 'Shift-click works without children property');
  });
});

test('TreeManipulation - Shift-Click Full Expansion', async (t) => {
  await t.test('Shift-click expands entire descendant subtree', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // Collapse root to hide all descendants
    visibility.collapseToRoot();
    assert.strictEqual(visibility.getVisibleNodeCount(), 1, 'Before: only root visible');

    // Shift-click on root (no children property)
    const vizNode = { id: 'root', x: 100, y: 100 };
    const event = createMockClickEvent(true, false);
    manipulation.handleNodeClick(vizNode, event);

    // Should expand all descendants
    assert.strictEqual(visibility.isNodeVisible('n1'), true, 'n1 visible');
    assert.strictEqual(visibility.isNodeVisible('n2'), true, 'n2 visible');
    assert.strictEqual(visibility.isNodeVisible('t1'), true, 't1 visible');
    assert.strictEqual(visibility.isNodeVisible('t2'), true, 't2 visible');
    assert.strictEqual(visibility.getVisibleNodeCount(), 5, 'All nodes visible');
  });

  await t.test('Shift-click preserves original topology', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // Collapse n1
    visibility.collapseNode('n1');

    // Shift-click on n1 (no children property)
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(true, false);
    manipulation.handleNodeClick(vizNode, event);

    // All descendants should be visible
    assert.strictEqual(visibility.isNodeVisible('t1'), true, 't1 visible');
    assert.strictEqual(visibility.isNodeVisible('t2'), true, 't2 visible');

    // Topology should be valid
    assert.strictEqual(visibility.isVisibleTopologyValid(), true, 'Topology valid');
  });
});

test('TreeManipulation - Alt-Click Collapse', async (t) => {
  await t.test('Alt-click on expanded node collapses all descendants', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // All initially visible
    assert.strictEqual(visibility.isNodeVisible('t1'), true, 'Before: t1 visible');

    // Alt-click on n1 (expanded, no children property)
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(false, true);
    manipulation.handleNodeClick(vizNode, event);

    // Should collapse n1
    assert.strictEqual(visibility.isNodeCollapsed('n1'), true, 'n1 collapsed');
    assert.strictEqual(visibility.isNodeVisible('t1'), false, 't1 hidden');
    assert.strictEqual(visibility.isNodeVisible('t2'), false, 't2 hidden');
  });

  await t.test('Alt-click on root collapses entire tree', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // Alt-click on root (no children property)
    const vizNode = { id: 'root', x: 100, y: 100 };
    const event = createMockClickEvent(false, true);
    manipulation.handleNodeClick(vizNode, event);

    // Should collapse to root
    assert.strictEqual(visibility.getVisibleNodeCount(), 1, 'Only root visible');
    assert.strictEqual(visibility.isNodeCollapsed('root'), true, 'Root marked collapsed');
  });
});

test('TreeManipulation - Alt-Click Random Sampling', async (t) => {
  await t.test('Alt-click on collapsed node shows random sample', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);
    manipulation.setMaxSampledSpecies(10);

    // Collapse n1
    visibility.collapseNode('n1');
    assert.strictEqual(visibility.isNodeVisible('t1'), false, 'Before: t1 hidden');

    // Alt-click on n1 (collapsed, no children property)
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(false, true);
    manipulation.handleNodeClick(vizNode, event);

    // Should show at least one sampled terminal
    assert.strictEqual(visibility.isNodeVisible('n1'), true, 'n1 visible (sampling node)');
    // At least one of t1 or t2 should be visible
    const t1Visible = visibility.isNodeVisible('t1');
    const t2Visible = visibility.isNodeVisible('t2');
    assert.ok(t1Visible || t2Visible, 'At least one terminal visible from sample');
  });

  await t.test('Random sample respects maximum size', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);
    manipulation.setMaxSampledSpecies(1);  // Max 1 species

    // Collapse n1 (has 2 terminals: t1, t2)
    visibility.collapseNode('n1');
    assert.ok(visibility.isNodeVisible('n1'), 'n1 is visible before Alt-click');
    assert.strictEqual(visibility.isNodeVisible('t1'), false, 't1 hidden before Alt-click');
    const initialCount = visibility.getVisibleNodeCount();

    // Alt-click on n1 (no children property)
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(false, true);
    manipulation.handleNodeClick(vizNode, event);

    // Should add exactly 1 sampled terminal (other nodes like n2 stay visible)
    const finalCount = visibility.getVisibleNodeCount();
    assert.strictEqual(finalCount, initialCount + 1, `Added exactly 1 sampled terminal`);

    // Exactly one terminal (from n1's descendants) should be visible
    const t1Visible = visibility.isNodeVisible('t1');
    const t2Visible = visibility.isNodeVisible('t2');
    const terminalCount = (t1Visible ? 1 : 0) + (t2Visible ? 1 : 0);
    assert.strictEqual(terminalCount, 1, 'Exactly 1 terminal visible');
  });

  await t.test('Sampling shows path from terminal to parent', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // Collapse n1 (but leave root expanded, so n1 is still visible)
    visibility.collapseNode('n1');
    assert.ok(visibility.isNodeVisible('root'), 'root visible');
    assert.ok(visibility.isNodeVisible('n1'), 'n1 visible');
    assert.strictEqual(visibility.isNodeVisible('t1'), false, 't1 hidden');

    // Alt-click on n1 (no children property)
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(false, true);
    manipulation.handleNodeClick(vizNode, event);

    // Should show root, n1, and sampled terminal
    assert.strictEqual(visibility.isNodeVisible('root'), true, 'Root still visible');
    assert.strictEqual(visibility.isNodeVisible('n1'), true, 'n1 visible');
    // At least one terminal should be visible
    const hasTerminal = visibility.isNodeVisible('t1') || visibility.isNodeVisible('t2');
    assert.ok(hasTerminal, 'At least one terminal visible');

    // Topology should be valid (path shown)
    assert.strictEqual(visibility.isVisibleTopologyValid(), true, 'Path topology valid');
  });
});

test('TreeManipulation - Interaction State', async (t) => {
  await t.test('setDragging prevents click handling', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // Set dragging flag
    manipulation.setDragging(true);

    // Collapse n1
    visibility.collapseNode('n1');
    const initialState = visibility.isNodeCollapsed('n1');

    // Try Shift-click (should be prevented because dragging is true)
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(true, false);
    manipulation.handleNodeClick(vizNode, event);

    // Should not change state while dragging
    assert.strictEqual(visibility.isNodeCollapsed('n1'), initialState, 'State unchanged during drag');

    // Reset dragging
    manipulation.setDragging(false);

    // Try Shift-click again
    manipulation.handleNodeClick(vizNode, event);

    // Should now expand entire subtree
    assert.strictEqual(visibility.isNodeCollapsed('n1'), false, 'n1 expanded after drag ends');
  });

  await t.test('Terminal nodes never trigger manipulation', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    const initialCount = visibility.getVisibleNodeCount();

    // Try Shift-click on terminal
    const terminalNode = { id: 't1', x: 100, y: 100 };
    const event = createMockClickEvent(true, false);
    manipulation.handleNodeClick(terminalNode, event);

    // Should have no effect
    assert.strictEqual(visibility.getVisibleNodeCount(), initialCount, 'No change for terminal node');
  });
});

test('TreeManipulation - Collapse Entire Tree', async (t) => {
  await t.test('collapseEntireTree() collapses to root', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // All initially visible
    assert.strictEqual(visibility.getVisibleNodeCount(), 5, 'Before: all visible');

    // Collapse entire tree
    manipulation.collapseEntireTree();

    // Should show only root
    assert.strictEqual(visibility.getVisibleNodeCount(), 1, 'After: only root visible');
    assert.strictEqual(visibility.isNodeVisible('root'), true, 'Root still visible');
    assert.strictEqual(visibility.isNodeCollapsed('root'), true, 'Root marked collapsed');
  });
});

test('TreeManipulation - Settings', async (t) => {
  await t.test('setMaxSampledSpecies clamps to valid range', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // Set to value below minimum
    manipulation.setMaxSampledSpecies(0);
    assert.strictEqual(manipulation.options.maxSampledSpecies, 1, 'Clamped to minimum 1');

    // Set to reasonable value
    manipulation.setMaxSampledSpecies(15);
    assert.strictEqual(manipulation.options.maxSampledSpecies, 15, 'Normal value accepted');

    // Set to value above maximum
    manipulation.setMaxSampledSpecies(100);
    assert.strictEqual(manipulation.options.maxSampledSpecies, 50, 'Clamped to maximum 50');
  });
});

test('TreeManipulation - Multifurcation Support', async (t) => {
  await t.test('Normal click does nothing with multifurcating nodes', () => {
    const { graph } = createMultifurcatingGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // Collapse root
    visibility.collapseNode('root');
    assert.strictEqual(visibility.getVisibleNodeCount(), 1, 'Root only');
    const initialCount = visibility.getVisibleNodeCount();

    // Normal click (no children property)
    const vizNode = { id: 'root', x: 100, y: 100 };
    const event = createMockClickEvent(false, false);
    manipulation.handleNodeClick(vizNode, event);

    // Should NOT expand (normal click does nothing)
    assert.strictEqual(visibility.getVisibleNodeCount(), initialCount, 'No change on normal click');
    assert.strictEqual(visibility.isNodeVisible('n1'), false, 'n1 still hidden');
  });

  await t.test('Shift-click expands all descendants in multifurcation', () => {
    const { graph } = createMultifurcatingGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // Collapse root
    visibility.collapseNode('root');

    // Shift-click on root (no children property)
    const vizNode = { id: 'root', x: 100, y: 100 };
    const event = createMockClickEvent(true, false);
    manipulation.handleNodeClick(vizNode, event);

    // All nodes should be visible
    assert.strictEqual(visibility.getVisibleNodeCount(), 6, 'All 6 nodes visible');
  });
});

test('TreeManipulation - Topology Validity', async (t) => {
  await t.test('All operations maintain valid topology', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    const vizNode = { id: 'n1', x: 100, y: 100 };

    // Shift-click (expand entire subtree)
    manipulation.handleNodeClick(vizNode, createMockClickEvent(true, false));
    assert.strictEqual(visibility.isVisibleTopologyValid(), true, 'Topology valid after Shift-click');

    // Collapse
    visibility.collapseNode('n1');

    // Alt-click (sampling)
    manipulation.handleNodeClick(vizNode, createMockClickEvent(false, true));
    assert.strictEqual(visibility.isVisibleTopologyValid(), true, 'Topology valid after sampling');

    // Collapse entire tree
    manipulation.collapseEntireTree();
    assert.strictEqual(visibility.isVisibleTopologyValid(), true, 'Topology valid after collapse all');
  });
});
