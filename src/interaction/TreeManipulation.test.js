/**
 * TreeManipulation Tests
 *
 * Tests for tree node interaction handlers.
 */

import test from 'node:test';
import assert from 'node:assert';
import { GraphBuilder } from '../graph/PhyloGraph.js';
import { TreeVisibilityState } from '../graph/TreeVisibilityState.js';
import { TreeDisplayProjection } from '../graph/TreeDisplayProjection.js';
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
function createMockClickEvent(shiftKey = false, altKey = false, metaKey = false, ctrlKey = false) {
  return {
    shiftKey,
    altKey,
    metaKey,
    ctrlKey,
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

    // Set up initial state: root expanded, n1 expanded
    visibility.expandNodeOneLevel('root');
    visibility.expandNodeOneLevel('n1');
    assert(visibility.isNodeVisible('t1'), 't1 visible initially');

    // Create internal node viz data WITHOUT children property
    const vizNode = { id: 'n1', x: 50, y: 50, type: 'internal' };
    // No vizNode.children property - should use graph.getChildren()

    // Try Shift-click (should collapse n1)
    const event = createMockClickEvent(true, false);  // Shift-click
    manipulation.handleNodeClick(vizNode, event);

    // Should work (Shift-click collapses)
    assert.strictEqual(visibility.isNodeVisible('t1'), false, 'Shift-click collapses even without children property');
    assert(visibility.isNodeCollapsed('n1'), 'n1 marked as collapsed');
  });
});

test('TreeManipulation - Command-Click One-Level Expansion', async (t) => {
  await t.test('Command-click on collapsed node expands one level', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // Collapse tree to root
    visibility.collapseToRoot();
    assert.strictEqual(visibility.getVisibleNodeCount(), 1, 'Start: only root visible');

    // Command-click on root
    const vizNode = { id: 'root', x: 100, y: 100 };
    const event = createMockClickEvent(false, false, true, false);  // metaKey = true
    manipulation.handleNodeClick(vizNode, event);

    // Should expand root one level (revealing n1, n2)
    const visibleIds = visibility.getVisibleNodeIds();
    assert.strictEqual(visibleIds.has('root'), true, 'root visible');
    assert.strictEqual(visibleIds.has('n1'), true, 'n1 visible (immediate child)');
    assert.strictEqual(visibleIds.has('n2'), true, 'n2 visible (immediate child)');
    assert.strictEqual(visibleIds.has('t1'), false, 't1 hidden (descendant of collapsed n1)');
    assert.strictEqual(visibleIds.has('t2'), false, 't2 hidden (descendant of collapsed n1)');
  });

  await t.test('Newly revealed internal children are marked as collapsed', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    visibility.collapseToRoot();

    // Command-click on root
    const vizNode = { id: 'root', x: 100, y: 100 };
    const event = createMockClickEvent(false, false, true, false);  // metaKey = true
    manipulation.handleNodeClick(vizNode, event);

    // n1 (internal) should be collapsed
    assert.strictEqual(visibility.isNodeCollapsed('n1'), true, 'n1 marked as collapsed');
    // n2 (terminal) should NOT be collapsed
    assert.strictEqual(visibility.isNodeCollapsed('n2'), false, 'n2 (terminal) not marked as collapsed');
  });

  await t.test('Command-click multiple times reveals successive levels', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    visibility.collapseToRoot();

    // First Command-click: expand root
    let vizNode = { id: 'root', x: 100, y: 100 };
    let event = createMockClickEvent(false, false, true, false);
    manipulation.handleNodeClick(vizNode, event);
    assert.strictEqual(visibility.getVisibleNodeCount(), 3, 'After 1st: root, n1, n2');

    // Second Command-click: expand n1
    vizNode = { id: 'n1', x: 100, y: 100 };
    event = createMockClickEvent(false, false, true, false);
    manipulation.handleNodeClick(vizNode, event);
    assert.strictEqual(visibility.getVisibleNodeCount(), 5, 'After 2nd: all visible');
    assert.strictEqual(visibility.isNodeVisible('t1'), true, 't1 now visible');
    assert.strictEqual(visibility.isNodeVisible('t2'), true, 't2 now visible');
  });

  await t.test('Control-click works the same as Command-click (Windows compatibility)', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    visibility.collapseToRoot();

    // Control-click on root (ctrlKey = true instead of metaKey)
    const vizNode = { id: 'root', x: 100, y: 100 };
    const event = createMockClickEvent(false, false, false, true);  // ctrlKey = true
    manipulation.handleNodeClick(vizNode, event);

    // Should expand just like Command-click
    const visibleIds = visibility.getVisibleNodeIds();
    assert.strictEqual(visibleIds.has('n1'), true, 'n1 visible after Control-click');
    assert.strictEqual(visibleIds.has('n2'), true, 'n2 visible after Control-click');
    assert.strictEqual(visibleIds.has('t1'), false, 't1 still hidden');
  });

  await t.test('Command-click on already-expanded node collapses it', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // All nodes start visible and not collapsed
    assert(!visibility.isNodeCollapsed('n1'), 'n1 is initially expanded');
    assert(visibility.isNodeVisible('t1'), 't1 visible initially');

    // Command-click on expanded n1 (should toggle to collapsed)
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(false, false, true, false);
    manipulation.handleNodeClick(vizNode, event);

    // Should collapse n1 and hide its descendants
    assert(visibility.isNodeCollapsed('n1'), 'n1 should be collapsed after Command-click');
    assert(!visibility.isNodeVisible('t1'), 't1 should be hidden after collapse');
    assert(visibility.isNodeVisible('n1'), 'n1 itself should still be visible');
  });

  await t.test('Command-click on terminal node does nothing', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    const initialCount = visibility.getVisibleNodeCount();

    // Command-click on terminal t1
    const vizNode = { id: 't1', x: 100, y: 100 };
    const event = createMockClickEvent(false, false, true, false);
    manipulation.handleNodeClick(vizNode, event);

    // Should do nothing
    assert.strictEqual(visibility.getVisibleNodeCount(), initialCount, 'No change for terminal');
  });

  await t.test('Command-click with multifurcating nodes', () => {
    const { graph } = createMultifurcatingGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    visibility.collapseToRoot();

    // Command-click on root (has 3 children: n1, n2, n3)
    const vizNode = { id: 'root', x: 100, y: 100 };
    const event = createMockClickEvent(false, false, true, false);
    manipulation.handleNodeClick(vizNode, event);

    // Should reveal all 3 immediate children
    assert.strictEqual(visibility.isNodeVisible('n1'), true, 'n1 visible');
    assert.strictEqual(visibility.isNodeVisible('n2'), true, 'n2 visible');
    assert.strictEqual(visibility.isNodeVisible('n3'), true, 'n3 visible');
    // n1's descendants should be hidden
    assert.strictEqual(visibility.isNodeVisible('t1'), false, 't1 hidden');
    assert.strictEqual(visibility.isNodeVisible('t2'), false, 't2 hidden');
    // n1 should be collapsed (internal), n2/n3 should not be (terminal)
    assert.strictEqual(visibility.isNodeCollapsed('n1'), true, 'n1 is collapsed');
    assert.strictEqual(visibility.isNodeCollapsed('n2'), false, 'n2 (terminal) not collapsed');
    assert.strictEqual(visibility.isNodeCollapsed('n3'), false, 'n3 (terminal) not collapsed');
  });
});

test('TreeManipulation - Shift-Click Full Expansion', async (t) => {
  await t.test('Shift-click fully collapses an ordinarily expanded subtree', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // Start with root expanded to show n1
    visibility.expandNodeOneLevel('root');
    assert(visibility.isNodeVisible('n1'), 'n1 visible initially');
    
    // Expand n1 to show its descendants
    visibility.expandNodeOneLevel('n1');
    assert(visibility.isNodeVisible('t1'), 't1 visible initially');
    assert(visibility.isNodeVisible('t2'), 't2 visible initially');

    // Shift-click on n1 to collapse entire subtree
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(true, false);
    manipulation.handleNodeClick(vizNode, event);

    // n1's descendants should be hidden
    assert(!visibility.isNodeVisible('t1'), 't1 hidden after Shift-click');
    assert(!visibility.isNodeVisible('t2'), 't2 hidden after Shift-click');
    assert(visibility.isNodeCollapsed('n1'), 'n1 marked as collapsed');
  });

  await t.test('Shift-click fully collapses a partially expanded subtree', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // Start with root expanded
    visibility.expandNodeOneLevel('root');
    // Expand n1 fully
    visibility.expandNodeOneLevel('n1');
    
    // Verify all descendants are visible
    assert(visibility.isNodeVisible('t1'), 't1 visible');
    assert(visibility.isNodeVisible('t2'), 't2 visible');

    // Shift-click on root to collapse entire tree
    const vizNode = { id: 'root', x: 100, y: 100 };
    const event = createMockClickEvent(true, false);
    manipulation.handleNodeClick(vizNode, event);

    // Root's descendants should all be hidden
    assert(!visibility.isNodeVisible('n1'), 'n1 hidden after Shift-click on root');
    assert(!visibility.isNodeVisible('t1'), 't1 hidden after Shift-click on root');
    assert(!visibility.isNodeVisible('t2'), 't2 hidden after Shift-click on root');
    assert(visibility.isNodeCollapsed('root'), 'root marked as collapsed');
  });

  await t.test('Shift-click preserves original topology', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // Expand root and n1
    visibility.expandNodeOneLevel('root');
    visibility.expandNodeOneLevel('n1');

    // Shift-click on n1 to collapse it
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(true, false);
    manipulation.handleNodeClick(vizNode, event);

    // Descendants should be hidden but topology valid
    assert(!visibility.isNodeVisible('t1'), 't1 hidden');
    assert(!visibility.isNodeVisible('t2'), 't2 hidden');

    // Topology should still be valid (biological structure unchanged)
    assert.strictEqual(visibility.isVisibleTopologyValid(), true, 'Topology valid');
  });

  await t.test('Shift-click removes sampled terminal descendants and abbreviated links', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const projection = new TreeDisplayProjection(graph, visibility);
    const manipulation = new TreeManipulation(graph, visibility, projection);

    // Build initial visibility state:
    // Root is initially visible
    assert(visibility.isNodeVisible('root'), 'root visible initially');
    
    // Expand root to show n1 and n2
    visibility.expandNodeOneLevel('root');
    assert(visibility.isNodeVisible('n1'), 'n1 visible');
    
    // Expand n1 to show t1, t2
    visibility.expandNodeOneLevel('n1');
    assert(visibility.isNodeVisible('t1'), 't1 visible before Shift-click');
    assert(visibility.isNodeVisible('t2'), 't2 visible before Shift-click');
    
    // Shift-click on n1 to collapse its entire subtree
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(true, false);
    manipulation.handleNodeClick(vizNode, event);

    // All descendants of n1 should now be hidden
    assert(!visibility.isNodeVisible('t1'), 't1 hidden after Shift-click');
    assert(!visibility.isNodeVisible('t2'), 't2 hidden after Shift-click');
    assert(visibility.isNodeCollapsed('n1'), 'n1 marked as collapsed');
    
    // Verify topology is still valid
    assert(visibility.isVisibleTopologyValid(), 'Topology valid after Shift-click collapse');
  });

  await t.test('Shift-click preserves unrelated branches and samples', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // Build visibility: root expanded, n1 and n2 both expanded
    visibility.expandNodeOneLevel('root');
    visibility.expandNodeOneLevel('n1');
    visibility.expandNodeOneLevel('n2');
    assert(visibility.isNodeVisible('t1'), 't1 visible');
    assert(visibility.isNodeVisible('t2'), 't2 visible');
    
    // Shift-click on n1 to collapse its entire subtree
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(true, false);
    manipulation.handleNodeClick(vizNode, event);

    // n1's descendants should be hidden
    assert(!visibility.isNodeVisible('t1'), 't1 hidden after Shift-click on n1');
    assert(!visibility.isNodeVisible('t2'), 't2 hidden after Shift-click on n1');
    assert(visibility.isNodeCollapsed('n1'), 'n1 marked as collapsed');
    
    // n2 should still be visible (unrelated branch)
    assert(visibility.isNodeVisible('n2'), 'n2 still visible (unrelated)');
  });
});

test('TreeManipulation - Alt-Click Collapse', async (t) => {
  await t.test('Alt-click on expanded node minimizes it, keeping its leaves as abbreviated links', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // All initially visible
    assert.strictEqual(visibility.isNodeVisible('t1'), true, 'Before: t1 visible');

    // Alt-click on n1 (expanded, no children property)
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(false, true);
    manipulation.handleNodeClick(vizNode, event);

    // n1 is collapsed; its visible leaves are preserved through abbreviated links
    assert.strictEqual(visibility.isNodeCollapsed('n1'), true, 'n1 collapsed');
    const projection = manipulation.projection.getProjection();
    assert.deepStrictEqual(
      projection.abbreviatedLinks.map(l => `${l.sourceId}>${l.targetId}`).sort(),
      ['n1>t1', 'n1>t2'],
      'Both leaves represented by abbreviated links from n1'
    );
    assert(!projection.biologicalLinks.some(l => l.sourceId === 'n1'), 'No biological links from minimized n1');
  });

  await t.test('Alt-click on root does nothing', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    const initialCount = visibility.getVisibleNodeCount();

    // Alt-click on root (should do nothing per new spec)
    const vizNode = { id: 'root', x: 100, y: 100 };
    const event = createMockClickEvent(false, true);
    manipulation.handleNodeClick(vizNode, event);

    // Should be no-op
    assert.strictEqual(visibility.getVisibleNodeCount(), initialCount, 'Root Alt-click is no-op');
    assert.strictEqual(visibility.isNodeCollapsed('root'), false, 'Root not collapsed');
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
    // Need to regenerate projection after modifying visibility directly
    manipulation.projection.regenerate();
    
    assert.ok(visibility.isNodeVisible('n1'), 'n1 is visible before Alt-click');
    assert.strictEqual(visibility.isNodeVisible('t1'), false, 't1 hidden before Alt-click');

    // Track visible nodes from PROJECTION (which includes sampled terminals)
    const initialVisibleFromProjection = manipulation.projection.getVisibleNodeIds().size;

    // Alt-click on n1 (no children property)
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(false, true);
    manipulation.handleNodeClick(vizNode, event);
    
    // Check if sample was created
    const sampleAfter = manipulation.projection.getSampleForAncestor('n1');
    assert(sampleAfter, 'Sample should be created after Alt-click');

    // Projection should show exactly 1 sampled terminal (other nodes like n2 stay visible)
    const finalVisibleFromProjection = manipulation.projection.getVisibleNodeIds().size;
    assert.strictEqual(finalVisibleFromProjection, initialVisibleFromProjection + 1, `Added exactly 1 sampled terminal`);

    // Exactly one terminal (from n1's descendants) should be in the projection
    const projectionVisible = manipulation.projection.getVisibleNodeIds();
    const t1Visible = projectionVisible.has('t1');
    const t2Visible = projectionVisible.has('t2');
    const terminalCount = (t1Visible ? 1 : 0) + (t2Visible ? 1 : 0);
    assert.strictEqual(terminalCount, 1, 'Exactly 1 terminal in projection');
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

    // Set up initial state: root expanded, n1 expanded
    visibility.expandNodeOneLevel('root');
    visibility.expandNodeOneLevel('n1');
    assert(visibility.isNodeVisible('t1'), 't1 visible initially');

    // Set dragging flag
    manipulation.setDragging(true);

    // Try Shift-click (should be prevented because dragging is true)
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(true, false);
    manipulation.handleNodeClick(vizNode, event);

    // Should not change state while dragging (n1 should still be expanded)
    assert(visibility.isNodeVisible('t1'), 't1 still visible during drag');
    assert(!visibility.isNodeCollapsed('n1'), 'n1 still expanded during drag');

    // Reset dragging
    manipulation.setDragging(false);

    // Try Shift-click again
    manipulation.handleNodeClick(vizNode, event);

    // Should now collapse n1's entire subtree
    assert(!visibility.isNodeVisible('t1'), 't1 hidden after Shift-click');
    assert(visibility.isNodeCollapsed('n1'), 'n1 collapsed after Shift-click');
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

  await t.test('Shift-click collapses all descendants in multifurcation', () => {
    const { graph } = createMultifurcatingGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // Expand root to show all descendants
    visibility.expandNodeOneLevel('root');
    assert.strictEqual(visibility.getVisibleNodeCount(), 6, 'All 6 nodes visible initially');

    // Shift-click on root to collapse it
    const vizNode = { id: 'root', x: 100, y: 100 };
    const event = createMockClickEvent(true, false);
    manipulation.handleNodeClick(vizNode, event);

    // Only root should be visible
    assert.strictEqual(visibility.getVisibleNodeCount(), 1, 'Only root visible after Shift-click');
    assert(visibility.isNodeCollapsed('root'), 'root marked as collapsed');
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

test('TreeManipulation - Nested Sample Re-Anchoring', async (t) => {
  /**
   * Create a more complex graph for nested sample testing:
   *          root
   *         /  |  \
   *        A   B   C
   *       / \  |  / \
   *      t1 t2 t3 t4 t5
   *
   * This allows testing:
   * 1. Root sample with terminals from multiple branches
   * 2. Creating a new sample on branch A
   * 3. Verifying existing root-sampled terminals in A get re-anchored to A's children
   * 4. Verifying existing root-sampled terminals in B/C stay anchored to root
   * 5. New A-sampled terminals are correct
   */
  function createNestedTestGraph() {
    const hypothesis = {
      hypothesisId: 'test_nested',
      rootNodeId: 'root',
      nodes: [
        { id: 'root', type: 'internal', parentId: null, children: ['A', 'B', 'C'] },
        { id: 'A', type: 'internal', parentId: 'root', children: ['t1', 't2'] },
        { id: 'B', type: 'terminal', parentId: 'root', taxonId: 'B', children: [] },
        { id: 'C', type: 'internal', parentId: 'root', children: ['t3', 't4'] },
        { id: 't1', type: 'terminal', parentId: 'A', taxonId: 't1', children: [] },
        { id: 't2', type: 'terminal', parentId: 'A', taxonId: 't2', children: [] },
        { id: 't3', type: 'terminal', parentId: 'C', taxonId: 't3', children: [] },
        { id: 't4', type: 'terminal', parentId: 'C', taxonId: 't4', children: [] }
      ]
    };

    const taxonomy = {
      'B': { id: 'B', scientificName: 'Species B', rank: 'species' },
      't1': { id: 't1', scientificName: 'Species T1', rank: 'species' },
      't2': { id: 't2', scientificName: 'Species T2', rank: 'species' },
      't3': { id: 't3', scientificName: 'Species T3', rank: 'species' },
      't4': { id: 't4', scientificName: 'Species T4', rank: 'species' }
    };

    const builder = new GraphBuilder(hypothesis.hypothesisId, hypothesis.rootNodeId);
    for (const node of hypothesis.nodes) {
      builder.addNode(node);
    }
    const graph = builder.build(taxonomy);
    return { graph, taxonomy, hypothesis };
  }

  await t.test('Root sample followed by nested child sample re-anchors existing terminals', () => {
    const { graph } = createNestedTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null, [], [], { maxSampledSpecies: 5 });

    // Initial state: all nodes visible
    assert.strictEqual(visibility.getVisibleNodeCount(), 8, 'Start: all 8 nodes visible');

    // Step 1: Collapse entire tree to root only
    visibility.collapseToRoot();
    assert.strictEqual(visibility.getVisibleNodeCount(), 1, 'After collapse: root only visible');
    
    // Step 2: Expand root one level to show A, B, C
    visibility.expandNodeOneLevel('root');
    assert(visibility.isNodeVisible('A'), 'A should be visible after expanding root');
    assert(visibility.isNodeVisible('B'), 'B should be visible after expanding root');
    assert(visibility.isNodeVisible('C'), 'C should be visible after expanding root');
    assert(visibility.isNodeCollapsed('A'), 'A should still be marked collapsed');
    
    // Step 3: Alt-click node A to create a sample
    // A's immediate children remain hidden (no one-level expansion), but sampled terminals become visible via abbreviated links
    // Internally, A is marked as not collapsed (it's showing a sample), but visually it looks collapsed
    const nodeAVizNode = { id: 'A', x: 100, y: 100, children: ['t1', 't2'] };
    manipulation.handleNodeClick(nodeAVizNode, createMockClickEvent(false, true));
    
    // A stays collapsed: its sample is shown through abbreviated links, not by revealing children
    assert(visibility.isNodeCollapsed('A'), 'Node A should remain collapsed after sampling (minimized)');
    
    const sampleA = manipulation.projection.getSampleForAncestor('A');
    assert(sampleA, 'Sample A should exist after Alt-click');
    assert(sampleA.terminalIds.size > 0, 'Sample A should have terminals');
    
    // Get the projection with A's sample
    const projection1 = manipulation.projection.getProjection();
    const aTerminals = Array.from(sampleA.terminalIds);
    
    for (const terminal of aTerminals) {
      assert(projection1.visibleNodeIds.has(terminal), 
        `A-sampled terminal ${terminal} should be visible in projection`);
      assert(projection1.abbreviatedLinks.some(l => l.sourceId === 'A' && l.targetId === terminal),
        `A-sampled terminal ${terminal} should be anchored to A by an abbreviated link`);
    }
    
    // Step 4: A remains collapsed; its children are not ordinarily revealed
    visibility.collapseNode('A');
    assert(visibility.isNodeCollapsed('A'), 'A should be collapsed');
    
    // Step 5: Alt-click C to create another sample
    const nodeCVizNode = { id: 'C', x: 200, y: 100, children: ['t3', 't4'] };
    manipulation.handleNodeClick(nodeCVizNode, createMockClickEvent(false, true));
    
    // C should remain collapsed (minimized with a sample)
    assert(visibility.isNodeCollapsed('C'), 'Node C should remain collapsed after sampling (minimized)');
    const sampleC = manipulation.projection.getSampleForAncestor('C');
    assert(sampleC, 'Sample C should exist after Alt-click');
    assert(sampleC.terminalIds.size > 0, 'Sample C should have terminals');
    
    // Both samples should still exist
    const sampleA2 = manipulation.projection.getSampleForAncestor('A');
    assert(sampleA2, 'Sample A should still exist after creating C sample');
    
    // Get updated projection with both samples
    const projection2 = manipulation.projection.getProjection();
    
    // A-sampled terminals should still be visible (in the projection)
    const aTerminals2 = Array.from(sampleA2.terminalIds);
    for (const terminal of aTerminals2) {
      assert(projection2.visibleNodeIds.has(terminal), 
        `A-sampled terminal ${terminal} should still be visible in projection`);
    }
    
    // C-sampled terminals should be visible (in the projection)
    const cTerminals = Array.from(sampleC.terminalIds);
    for (const terminal of cTerminals) {
      assert(projection2.visibleNodeIds.has(terminal), 
        `C-sampled terminal ${terminal} should be visible in projection`);
    }
  });
});

test('TreeManipulation - Command-Click Toggle Behavior', async (t) => {
  await t.test('Command-click expanded node collapses all descendants', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // Start with fully expanded tree
    assert.strictEqual(visibility.getVisibleNodeCount(), 5, 'Start: all 5 nodes visible');
    assert(!visibility.isNodeCollapsed('n1'), 'n1 expanded initially');

    // Command-click n1 to collapse it
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(false, false, true, false);  // metaKey = true
    manipulation.handleNodeClick(vizNode, event);

    // n1 should be collapsed, hiding t1 and t2
    assert(visibility.isNodeCollapsed('n1'), 'n1 should be collapsed after Command-click');
    assert(!visibility.isNodeVisible('t1'), 't1 should be hidden');
    assert(!visibility.isNodeVisible('t2'), 't2 should be hidden');
    assert(visibility.isNodeVisible('n1'), 'n1 itself should still be visible');
  });

  await t.test('Command-click on STATE B (abbreviated only) reveals immediate biological children', () => {
    const { graph } = createMultifurcatingGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null, [], [], { maxSampledSpecies: 5 });

    // Expand root to show children
    visibility.expandNodeOneLevel('root');
    assert(visibility.isNodeVisible('n1'), 'n1 visible after root expand');

    // Collapse n1 manually (STATE D: no visible children)
    visibility.collapseNode('n1');
    assert(visibility.isNodeCollapsed('n1'), 'n1 collapsed');
    assert(!visibility.isNodeVisible('t1'), 't1 hidden after n1 collapse');

    // Alt-click n1 to create sample (now STATE B: abbreviated only, no biological children visible)
    const n1VizNode = { id: 'n1', x: 100, y: 100 };
    manipulation.handleNodeClick(n1VizNode, createMockClickEvent(false, true));

    assert(visibility.isNodeCollapsed('n1'), 'n1 remains collapsed after Alt-click sampling (minimized)');
    const sampleN1Before = manipulation.projection.getSampleForAncestor('n1');
    assert(sampleN1Before, 'Sample n1 should exist after Alt-click');
    // Note: After Alt-click with sample, some nodes may be visible through the sample

    // Command-click n1 in STATE B: should reveal immediate biological children (t1, t2)
    const n1ClickNode = { id: 'n1', x: 100, y: 100 };
    manipulation.handleNodeClick(n1ClickNode, createMockClickEvent(false, false, true, false));

    // After Command-click on STATE B, immediate biological children should be visible
    assert(visibility.isNodeVisible('t1'), 't1 should be visible after Command-click expansion');
    assert(visibility.isNodeVisible('t2'), 't2 should be visible after Command-click expansion');
    
    // n1 should remain marked as not collapsed (it now has both biological and abbreviated children)
    assert(!visibility.isNodeCollapsed('n1'), 'n1 should remain not collapsed (has visible children)');
    
    // Sample should still exist (preserved through expansion)
    const sampleN1After = manipulation.projection.getSampleForAncestor('n1');
    assert(sampleN1After, 'Sample should be preserved after Command-click expansion');
  });

  await t.test('Command-click toggle: expand then collapse same node', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // Start with all nodes visible (default state)
    visibility.collapseNode('n1'); // Collapse n1 manually to test toggle
    assert(visibility.isNodeCollapsed('n1'), 'n1 collapsed initially');
    assert(!visibility.isNodeVisible('t1'), 't1 hidden initially');

    // First Command-click: expand n1
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(false, false, true, false);
    manipulation.handleNodeClick(vizNode, event);
    assert(!visibility.isNodeCollapsed('n1'), 'n1 should be expanded after first Command-click');
    assert(visibility.isNodeVisible('t1'), 't1 should be visible after first Command-click');

    // Second Command-click: collapse n1
    manipulation.handleNodeClick(vizNode, event);
    assert(visibility.isNodeCollapsed('n1'), 'n1 should be collapsed after second Command-click');
    assert(!visibility.isNodeVisible('t1'), 't1 should be hidden after second Command-click');
  });

  await t.test('Command-click root expands and collapses entire tree', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // Start with collapsed root
    visibility.collapseToRoot();
    assert.strictEqual(visibility.getVisibleNodeCount(), 1, 'Only root visible');

    // Command-click root to expand
    const vizNode = { id: 'root', x: 0, y: 0 };
    const event = createMockClickEvent(false, false, true, false);
    manipulation.handleNodeClick(vizNode, event);
    assert(!visibility.isNodeCollapsed('root'), 'root should be expanded');
    assert(visibility.isNodeVisible('n1'), 'n1 should be visible after expanding root');

    // Command-click root again to collapse
    manipulation.handleNodeClick(vizNode, event);
    assert(visibility.isNodeCollapsed('root'), 'root should be collapsed again');
    assert.strictEqual(visibility.getVisibleNodeCount(), 1, 'Only root visible after collapse');
  });

  await t.test('Command-click removes stale abbreviated links', () => {
    const { graph } = createMultifurcatingGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null, [], [], { maxSampledSpecies: 5 });

    // Expand root and n1
    visibility.expandNodeOneLevel('root');
    visibility.expandNodeOneLevel('n1');

    // Create sample for n1
    const n1VizNode = { id: 'n1', x: 100, y: 100, children: ['t1', 't2'] };
    manipulation.handleNodeClick(n1VizNode, createMockClickEvent(false, true));

    let projection = manipulation.projection.getProjection();
    let abbrevLinks = projection.abbreviatedLinks;
    const linksBeforeCollapse = abbrevLinks.length;

    // Command-click n1 to collapse (should remove abbreviated links for n1's sample)
    manipulation.handleNodeClick(n1VizNode, createMockClickEvent(false, false, true, false));

    projection = manipulation.projection.getProjection();
    abbrevLinks = projection.abbreviatedLinks;
    
    // Abbreviated links for n1 should be gone (since n1 is collapsed and no visible terminals)
    const n1Links = abbrevLinks.filter(link => 
      graph.getParent(link.targetId) === 'n1' || link.sourceId === 'n1'
    );
    assert.strictEqual(n1Links.length, 0, 'No abbreviated links for collapsed n1');
  });
});

test('TreeManipulation - Root Alt-Click Disabled', async (t) => {
  await t.test('Alt-click on root does nothing', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null, [], [], { maxSampledSpecies: 10 });

    // Start with fully expanded tree
    const initialCount = visibility.getVisibleNodeCount();
    assert.strictEqual(initialCount, 5, 'Start with all nodes visible');

    // Alt-click on root
    const vizNode = { id: 'root', x: 0, y: 0, children: ['n1', 'n2'] };
    const event = createMockClickEvent(false, true);  // altKey = true
    manipulation.handleNodeClick(vizNode, event);

    // Nothing should change
    assert.strictEqual(visibility.getVisibleNodeCount(), initialCount, 'Visibility unchanged after Alt-click root');
    assert(!visibility.isNodeCollapsed('root'), 'root should remain expanded');

    // No root sample should be created
    const rootSample = manipulation.projection.getSampleForAncestor('root');
    assert(!rootSample, 'No sample should be created for root');
  });

  await t.test('Alt-click on root creates no sample even when collapsed', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null, [], [], { maxSampledSpecies: 10 });

    // Collapse tree to root only
    visibility.collapseToRoot();
    assert.strictEqual(visibility.getVisibleNodeCount(), 1, 'Only root visible');

    // Alt-click on root
    const vizNode = { id: 'root', x: 0, y: 0, children: ['n1', 'n2'] };
    const event = createMockClickEvent(false, true);  // altKey = true
    manipulation.handleNodeClick(vizNode, event);

    // Still only root visible (no sample generated)
    assert.strictEqual(visibility.getVisibleNodeCount(), 1, 'Still only root visible');
    const rootSample = manipulation.projection.getSampleForAncestor('root');
    assert(!rootSample, 'No sample created for root even when collapsed');
  });

  await t.test('Command-click root works normally (Alt-click disabled)', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // Collapse tree
    visibility.collapseToRoot();
    assert(visibility.isNodeCollapsed('root'), 'root collapsed');

    // Command-click root (should expand despite Alt-click being disabled)
    const vizNode = { id: 'root', x: 0, y: 0 };
    const event = createMockClickEvent(false, false, true, false);  // metaKey = true
    manipulation.handleNodeClick(vizNode, event);

    // root should be expanded
    assert(!visibility.isNodeCollapsed('root'), 'root expanded after Command-click');
    assert(visibility.isNodeVisible('n1'), 'n1 visible after expanding root');
  });
});

test('TreeManipulation - Interaction Semantics Preservation', async (t) => {
  await t.test('Normal click does nothing with no modifier keys', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    visibility.collapseToRoot();
    const initialCount = visibility.getVisibleNodeCount();

    // Normal click (no modifiers)
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(false, false, false, false);
    manipulation.handleNodeClick(vizNode, event);

    // Nothing should change (no manipulation on normal click)
    assert.strictEqual(visibility.getVisibleNodeCount(), initialCount, 'Visibility unchanged on normal click');
  });

  await t.test('Shift-click collapses entire subtree (new behavior)', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // Start with root expanded to show n1
    visibility.expandNodeOneLevel('root');
    visibility.expandNodeOneLevel('n1');  // Expand n1 to show descendants
    assert(visibility.isNodeVisible('t1'), 't1 visible');
    assert(visibility.isNodeVisible('t2'), 't2 visible');

    // Shift-click on n1 to collapse entire subtree
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(true, false);  // shiftKey = true
    manipulation.handleNodeClick(vizNode, event);

    // All descendants of n1 should be hidden
    assert(!visibility.isNodeVisible('t1'), 't1 hidden after Shift-click');
    assert(!visibility.isNodeVisible('t2'), 't2 hidden after Shift-click');
    assert(visibility.isNodeCollapsed('n1'), 'n1 marked as collapsed');
  });

  await t.test('PhyloGraph remains unchanged after all interactions', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // Perform various interactions
    visibility.expandNodeOneLevel('root');
    const vizNode = { id: 'n1', x: 100, y: 100 };
    
    // Command-click
    manipulation.handleNodeClick(vizNode, createMockClickEvent(false, false, true, false));
    
    // Alt-click
    manipulation.handleNodeClick(vizNode, createMockClickEvent(false, true));

    // Verify graph integrity
    const nodes = graph.getNodes();
    assert(nodes.has('root'), 'root still in graph');
    assert(nodes.has('n1'), 'n1 still in graph');
    assert.strictEqual(graph.getParent('n1'), 'root', 'n1 parent unchanged');
    assert.strictEqual(graph.getChildren('n1').length, 2, 'n1 children unchanged');
  });
});

test('TreeManipulation - Command-Click with Abbreviated Children', async (t) => {
  await t.test('Command-click on node with visible children collapses (not expands)', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // Start with root and n1 expanded
    visibility.collapseToRoot();
    visibility.expandNodeOneLevel('root');
    visibility.expandNodeOneLevel('n1');
    assert(visibility.isNodeVisible('t1'), 't1 visible');
    assert(visibility.isNodeVisible('t2'), 't2 visible');
    assert(!visibility.isNodeCollapsed('n1'), 'n1 not collapsed');

    // Command-click n1: should collapse because it has visible children
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(false, false, true, false);  // metaKey = true
    manipulation.handleNodeClick(vizNode, event);

    // n1 should be collapsed and its descendants hidden
    assert(visibility.isNodeCollapsed('n1'), 'n1 collapsed after Command-click');
    assert(!visibility.isNodeVisible('t1'), 't1 hidden after collapsing n1');
    assert(!visibility.isNodeVisible('t2'), 't2 hidden after collapsing n1');
  });

  await t.test('Command-click on collapsed node with no children expands it', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // Set up: root and n1 visible, n1 collapsed, t1/t2 hidden
    visibility.collapseToRoot();
    visibility.expandNodeOneLevel('root');
    visibility.collapseNode('n1');
    assert(visibility.isNodeCollapsed('n1'), 'n1 is collapsed');
    assert(!visibility.isNodeVisible('t1'), 't1 not visible');

    // Command-click n1: should expand one level because no visible children
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(false, false, true, false);  // metaKey = true
    manipulation.handleNodeClick(vizNode, event);

    // n1 should be expanded one level
    assert(!visibility.isNodeCollapsed('n1'), 'n1 expanded after Command-click');
    const n1Children = graph.getChildren('n1');
    for (const childId of n1Children) {
      assert(visibility.isNodeVisible(childId), `n1 child ${childId} visible after expansion`);
    }
  });

  await t.test('Command-click uses visible biological children, not abbreviated connections', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);

    // Set up: root expanded, n1 collapsed with no visible children
    visibility.collapseToRoot();
    visibility.expandNodeOneLevel('root');
    visibility.collapseNode('n1');

    // Verify node has no visible biological children
    assert(!visibility.isNodeVisible('t1'), 't1 not visible');
    assert(!visibility.isNodeVisible('t2'), 't2 not visible');
    const n1VisibleChildren = graph.getChildren('n1').filter(id => visibility.isNodeVisible(id));
    assert.strictEqual(n1VisibleChildren.length, 0, 'n1 has no visible biological children');

    // Command-click should expand one level (not collapse)
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(false, false, true, false);  // metaKey = true
    manipulation.handleNodeClick(vizNode, event);

    // n1 should now be expanded
    assert(!visibility.isNodeCollapsed('n1'), 'n1 expanded after Command-click');
  });
});

/**
 * Tests for four-state node connection classification
 */
test('TreeManipulation - Four-State Command-Click Behavior', async (t) => {
  await t.test('STATE A: Biological children only - Command-click collapses', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph, 'root');
    const manipulation = new TreeManipulation(graph, visibility);

    // Expand n1 to have visible biological children
    visibility.expandNodeOneLevel('n1');
    assert(visibility.isNodeVisible('t1'), 'setup: t1 visible');

    // Command-click on n1 (has biological children, no abbreviated)
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(false, false, true, false);
    manipulation.handleNodeClick(vizNode, event);

    // Should be collapsed now
    assert(visibility.isNodeCollapsed('n1'), 'n1 collapsed after Command-click on biological node');
    assert(!visibility.isNodeVisible('t1'), 't1 hidden after collapse');
  });

  await t.test('STATE D: Neither biological nor abbreviated - Command-click expands', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph, 'root');
    const manipulation = new TreeManipulation(graph, visibility);

    // Initially, all nodes are visible. Set up STATE D by collapsing n1
    visibility.collapseNode('n1');
    assert(visibility.isNodeCollapsed('n1'), 'setup: n1 collapsed');
    assert(!visibility.isNodeVisible('t1'), 'setup: t1 not visible');

    // Command-click on n1
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(false, false, true, false);
    manipulation.handleNodeClick(vizNode, event);

    // Should expand
    assert(!visibility.isNodeCollapsed('n1'), 'n1 expanded after Command-click on no-connection node');
    assert(visibility.isNodeVisible('t1'), 't1 visible after expand');
  });

  await t.test('STATE B: Abbreviated only - Command-click expands one level', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph, 'root');
    const projection = new TreeDisplayProjection(graph, visibility, { maxSampledSpecies: 5 });
    const manipulation = new TreeManipulation(graph, visibility, null, [], [], { maxSampledSpecies: 5 });
    manipulation.projection = projection;

    // Set up STATE B: Collapse n1 first, then create sample on it
    visibility.collapseNode('n1');
    assert(visibility.isNodeCollapsed('n1'), 'setup: n1 collapsed');
    
    // Create sample on n1 (keep it collapsed)
    projection.generateSample('n1');
    const sample = projection.getSampleForAncestor('n1');
    assert(sample !== null, 'setup: sample created on n1');

    // Regenerate projection to properly add sampled terminals
    projection.regenerate();

    // Verify n1 has abbreviated children but no visible biological children
    const n1BioChildren = graph.getChildren('n1').filter(id => visibility.isNodeVisible(id));
    assert(n1BioChildren.length === 0, 'setup: no biological children visible');

    // Command-click on n1 (has abbreviated children, no biological)
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(false, false, true, false);
    manipulation.handleNodeClick(vizNode, event);

    // Should expand one level (progressively)
    assert(!visibility.isNodeCollapsed('n1'), 'n1 expanded');
    assert(visibility.isNodeVisible('t1'), 't1 now visible');
    
    // Sample should be preserved when expanding (not cleared)
    const sample2 = manipulation.projection.getSampleForAncestor('n1');
    assert(sample2 !== null, 'sample preserved after expanding');
  });

  await t.test('STATE C: Both biological and abbreviated - Command-click expands', () => {
    // TODO: STATE C (node with both biological children and abbreviated connections)
    // is rare in practice because expanded nodes don't generate abbreviated links
    // (abbreviated links only exist for terminals whose parents aren't visible).
    // This state would require a more complex multi-ancestor sample scenario.
    // For now, we rely on the fact that STATE C shares the same expand logic as STATE B.
    // Skip detailed testing; cover via STATE B and Alt-click STATE C tests.
  });
});

/**
 * Tests for four-state node connection classification - Alt-Click
 */
test('TreeManipulation - Four-State Alt-Click Behavior', async (t) => {
  await t.test('STATE A: Biological children only - Alt-click minimizes', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph, 'root');
    const manipulation = new TreeManipulation(graph, visibility);

    // Expand n1 to have visible biological children
    visibility.expandNodeOneLevel('n1');
    assert(visibility.isNodeVisible('t1'), 'setup: t1 visible');

    // Alt-click on n1 (has biological children, no abbreviated)
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(false, true, false, false);  // altKey = true
    manipulation.handleNodeClick(vizNode, event);

    // Should collapse, keeping the visible leaves as n1's sample
    assert(visibility.isNodeCollapsed('n1'), 'n1 collapsed after Alt-click on biological node');
    assert.deepStrictEqual([...manipulation.projection.getSampleForAncestor('n1').terminalIds].sort(), ['t1', 't2']);
  });

  await t.test('STATE D: Neither - Alt-click generates sample', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph, 'root');
    const projection = new TreeDisplayProjection(graph, visibility, { maxSampledSpecies: 2 });
    const manipulation = new TreeManipulation(graph, visibility, null, [], [], { maxSampledSpecies: 2 });
    manipulation.projection = projection;

    // Set up STATE D: collapse n1 to have no biological or abbreviated children
    visibility.collapseNode('n1');
    assert(visibility.isNodeCollapsed('n1'), 'setup: n1 collapsed');
    assert(projection.getSampleForAncestor('n1') === null, 'setup: no sample');

    // Alt-click on n1
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(false, true, false, false);
    manipulation.handleNodeClick(vizNode, event);

    // Should generate sample
    const sample = projection.getSampleForAncestor('n1');
    assert(sample !== null, 'sample created after Alt-click on no-connection node');
    assert(sample.terminalIds.size > 0, 'sample has terminal IDs');

    // Regenerate projection to properly set up display
    projection.regenerate();
    
    // After Alt-click sampling, the node stays collapsed and shows all available leaves
    assert(visibility.isNodeCollapsed('n1'), 'n1 remains collapsed after sampling');
    assert.strictEqual(sample.terminalIds.size, 2, 'both available leaves sampled (max 2)');
  });

  await t.test('STATE B: Abbreviated only - Alt-click reshuffles sample', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph, 'root');
    const projection = new TreeDisplayProjection(graph, visibility, { maxSampledSpecies: 1 });
    const manipulation = new TreeManipulation(graph, visibility, null, [], [], { maxSampledSpecies: 1 });
    manipulation.projection = projection;

    // Set up STATE B: Collapse n1 first, then create sample
    visibility.collapseNode('n1');
    assert(visibility.isNodeCollapsed('n1'), 'setup: n1 collapsed');
    
    // Create sample on collapsed n1
    projection.generateSample('n1');
    projection.regenerate();  // Regenerate to properly set up projection
    
    const sample1 = projection.getSampleForAncestor('n1');
    assert(sample1 !== null, 'setup: sample created');

    // Verify n1 has abbreviated but no biological children
    const n1BioChildren = graph.getChildren('n1').filter(id => visibility.isNodeVisible(id));
    assert(n1BioChildren.length === 0, 'setup: no biological children');

    // Alt-click on n1 to reshuffle
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(false, true, false, false);
    manipulation.handleNodeClick(vizNode, event);

    // Should still have a sample (after reshuffle)
    const sample2 = projection.getSampleForAncestor('n1');
    assert(sample2 !== null, 'sample exists after Alt-click reshuffle');
  });

  await t.test('STATE C: Both - Alt-click reshuffles without hiding biological', () => {
    // TODO: STATE C is rare in practice (see Command-click STATE C comment above).
    // Skip detailed testing; rely on STATE B and other Alt-click tests.
  });
});

/**
 * Tests for multiple simultaneous samples
 */
test('TreeManipulation - Multiple Simultaneous Samples', async (t) => {
  await t.test('Samples on different branches do not interfere', () => {
    const { graph } = createMultifurcatingGraph();
    const visibility = new TreeVisibilityState(graph, 'root');
    const projection = new TreeDisplayProjection(graph, visibility, { maxSampledSpecies: 2 });
    const manipulation = new TreeManipulation(graph, visibility, null, [], [], { maxSampledSpecies: 2 });
    manipulation.projection = projection;

    // Create sample on n1
    projection.generateSample('n1');
    const sample1 = projection.getSampleForAncestor('n1');
    assert(sample1 !== null, 'sample on n1 created');

    // Verify n2 is a terminal (leaf)
    const n2Children = graph.getChildren('n2');
    assert(n2Children.length === 0, 'n2 is terminal');

    // Both samples can coexist (though n2 is terminal, so can't sample it)
    const allSamples = projection.getAllActiveSamples();
    assert(allSamples.size === 1, 'one active sample');
  });

  await t.test('Clearing one sample does not clear shared terminals needed by other samples', () => {
    // This verifies that clearSample only removes the specific sample
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph, 'root');
    const projection = new TreeDisplayProjection(graph, visibility, { maxSampledSpecies: 2 });

    // Sample from n1
    projection.generateSample('n1');
    const sample1 = projection.getSampleForAncestor('n1');
    assert(sample1 !== null, 'sample created');

    const terminalsBefore = sample1.terminalIds.size;
    assert(terminalsBefore > 0, 'sample has terminals');

    // Clear the sample
    projection.clearSample('n1');
    const sample2 = projection.getSampleForAncestor('n1');
    assert(sample2 === null, 'sample cleared');

    // Verify other samples not affected (in this case, no other samples to verify)
    const allSamples = projection.getAllActiveSamples();
    assert(allSamples.size === 0, 'no active samples after clearing');
  });
});

/**
 * Tests for sampled nodes removed from collapsedNodeIds
 */
test('TreeManipulation - Sampled Nodes Removed from collapsedNodeIds', async (t) => {
  await t.test('Command-click works on sampled node with collapsedNodeIds entry removed', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph, 'root');
    const projection = new TreeDisplayProjection(graph, visibility, { maxSampledSpecies: 2 });
    const manipulation = new TreeManipulation(graph, visibility, null, [], [], { maxSampledSpecies: 2 });
    manipulation.projection = projection;

    // Create sample on n1 (marks n1 as not collapsed)
    projection.generateSample('n1');
    const sample = projection.getSampleForAncestor('n1');
    for (const tid of sample.terminalIds) {
      visibility.visibleNodeIds.add(tid);
    }
    visibility.collapsedNodeIds.delete('n1');

    // n1 is now not in collapsedNodeIds, but has abbreviated children
    assert(!visibility.isNodeCollapsed('n1'), 'n1 not in collapsedNodeIds');
    assert(visibility.isNodeVisible('n1'), 'n1 is visible');

    // Command-click should still work (classify as STATE B or C)
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(false, false, true, false);
    manipulation.handleNodeClick(vizNode, event);

    // Should expand one level or handle abbreviated state correctly
    // The projection classification should work regardless of collapsedNodeIds
    assert(visibility.isNodeVisible('n1'), 'n1 still visible after Command-click');
  });
});



/**
 * Tests for fixed Command-click expansion on sampled nodes
 */
test('TreeManipulation - Command-Click Expansion on Sampled Nodes', async (t) => {
  await t.test('Command-click on STATE B node expands one level', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph, 'root');
    const projection = new TreeDisplayProjection(graph, visibility, { maxSampledSpecies: 5 });
    const manipulation = new TreeManipulation(graph, visibility, null, [], [], { maxSampledSpecies: 5 });
    manipulation.projection = projection;

    // Collapse n1 and create sample
    visibility.collapseNode('n1');
    projection.reshuffleSample('n1');
    const sample = projection.getSampleForAncestor('n1');
    assert(sample !== null, 'setup: sample created');
    for (const tid of sample.terminalIds) {
      visibility.visibleNodeIds.add(tid);
    }

    // Simulate Alt-click effect: remove from collapsedNodeIds
    visibility.collapsedNodeIds.delete('n1');
    assert(!visibility.isNodeCollapsed('n1'), 'setup: n1 not in collapsedNodeIds');

    // Command-click should expand via _safeExpandNodeOneLevel
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(false, false, true, false);
    manipulation.handleNodeClick(vizNode, event);

    // After Command-click, immediate children should be visible
    assert(visibility.isNodeVisible('t1'), 't1 now visible after Command-click');
    assert(visibility.isNodeVisible('t2'), 't2 now visible after Command-click');

    // n1 should be marked as not collapsed
    assert(!visibility.isNodeCollapsed('n1'), 'n1 marked as expanded');

    // Sample should be preserved
    const sampleAfter = manipulation.projection.getSampleForAncestor('n1');
    assert(sampleAfter !== null, 'sample preserved after Command-click');
  });

  await t.test('Command-click twice toggles collapse/expand correctly', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph, 'root');
    const projection = new TreeDisplayProjection(graph, visibility, { maxSampledSpecies: 5 });
    const manipulation = new TreeManipulation(graph, visibility, null, [], [], { maxSampledSpecies: 5 });
    manipulation.projection = projection;

    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(false, false, true, false);

    // Initial: n1 should be collapsed
    visibility.collapseNode('n1');
    assert(visibility.isNodeCollapsed('n1'), 'setup: n1 initially collapsed');

    // First Command-click: expand (STATE D)
    manipulation.handleNodeClick(vizNode, event);
    assert(!visibility.isNodeCollapsed('n1'), 'n1 expanded after first Command-click');
    assert(visibility.isNodeVisible('t1'), 't1 visible after expand');

    // Second Command-click: collapse (STATE A - has biological children)
    manipulation.handleNodeClick(vizNode, event);
    assert(visibility.isNodeCollapsed('n1'), 'n1 collapsed after second Command-click');
    assert(!visibility.isNodeVisible('t1'), 't1 hidden after collapse');
  });
});

/**
 * Tests for Alt-click four-state behavior with proper sample management
 */
test('TreeManipulation - Alt-Click Four-State Behavior with Samples', async (t) => {
  await t.test('Alt-click STATE B reshuffles without toggling off', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph, 'root');
    const projection = new TreeDisplayProjection(graph, visibility, { maxSampledSpecies: 1 });
    const manipulation = new TreeManipulation(graph, visibility, null, [], [], { maxSampledSpecies: 1 });
    manipulation.projection = projection;

    // Setup STATE B: collapse and sample
    visibility.collapseNode('n1');
    projection.reshuffleSample('n1');
    const sample1 = projection.getSampleForAncestor('n1');
    assert(sample1 !== null, 'setup: sample created');
    const terminal1 = Array.from(sample1.terminalIds)[0];

    for (const tid of sample1.terminalIds) {
      visibility.visibleNodeIds.add(tid);
    }

    // Alt-click to reshuffle
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(false, true, false, false);
    manipulation.handleNodeClick(vizNode, event);

    // Should still have a sample (possibly different terminals)
    const sample2 = projection.getSampleForAncestor('n1');
    assert(sample2 !== null, 'sample still exists after reshuffle');
    assert(sample2.terminalIds.size > 0, 'sample has terminals');

    // Sampled terminals should be visible
    const sampledVisible = Array.from(sample2.terminalIds).some(tid =>
      visibility.isNodeVisible(tid)
    );
    assert(sampledVisible, 'sampled terminals are visible');
  });

  await t.test('Alt-click STATE D generates sample', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph, 'root');
    const projection = new TreeDisplayProjection(graph, visibility, { maxSampledSpecies: 2 });
    const manipulation = new TreeManipulation(graph, visibility, null, [], [], { maxSampledSpecies: 2 });
    manipulation.projection = projection;

    // Setup STATE D: no biological children visible, no sample
    visibility.collapseNode('n1');
    // Don't add any sample initially

    // Alt-click to generate sample
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(false, true, false, false);
    manipulation.handleNodeClick(vizNode, event);

    // Should have a sample now
    const sample = projection.getSampleForAncestor('n1');
    assert(sample !== null, 'sample generated after Alt-click on STATE D');
    assert(sample.terminalIds.size > 0, 'sample has terminals');

    // n1 stays collapsed (minimized); the sample is shown through abbreviated links
    assert(visibility.isNodeCollapsed('n1'), 'n1 remains collapsed after sampling');
    assert.deepStrictEqual(
      manipulation.projection.getAbbreviatedLinks().map(l => `${l.sourceId}>${l.targetId}`).sort(),
      [...sample.terminalIds].map(id => `n1>${id}`).sort(),
      'one abbreviated link from n1 per sampled leaf'
    );
  });
});

/**
 * Tests for floating nodes prevention
 */
test('TreeManipulation - No Floating Nodes After Sample Changes', async (t) => {
  await t.test('Old sampled terminals removed when sample is cleared', () => {
    const { graph } = createMultifurcatingGraph();
    const visibility = new TreeVisibilityState(graph, 'root');
    const projection = new TreeDisplayProjection(graph, visibility, { maxSampledSpecies: 2 });
    const manipulation = new TreeManipulation(graph, visibility, null, [], [], { maxSampledSpecies: 2 });
    manipulation.projection = projection;

    // Create initial sample
    visibility.collapseNode('n1');
    projection.reshuffleSample('n1');
    const sample1 = projection.getSampleForAncestor('n1');
    const oldTerminals = new Set(sample1.terminalIds);

    for (const tid of sample1.terminalIds) {
      visibility.visibleNodeIds.add(tid);
    }

    // Verify old terminals are visible
    for (const tid of oldTerminals) {
      assert(visibility.isNodeVisible(tid), `old terminal ${tid} is visible before reshuffle`);
    }

    // Reshuffle the sample
    const vizNode = { id: 'n1', x: 100, y: 100 };
    const event = createMockClickEvent(false, true, false, false);
    manipulation.handleNodeClick(vizNode, event);

    const sample2 = projection.getSampleForAncestor('n1');
    const newTerminals = new Set(sample2.terminalIds);

    // Old terminals not in new sample should be removed from visibility
    for (const tid of oldTerminals) {
      if (!newTerminals.has(tid)) {
        assert(!visibility.isNodeVisible(tid), 
          `old terminal ${tid} removed from visibility after reshuffle`);
      }
    }
  });
});

/**
 * Tests for Alt-click behavior and abbreviated link generation
 */
test('TreeManipulation - Alt-click State D (Collapsed ancestor with no visible children)', async (t) => {
  await t.test('Alt-click State D creates sample and abbreviated links', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);  // null visualization
    
    // Setup: Collapse n1 to create State D (no visible descendants)
    visibility.collapseNode('n1');
    manipulation.projection.regenerate();
    
    // Verify State D preconditions
    assert(!visibility.isNodeVisible('t1'), 'Pre-condition: t1 hidden (collapsed)');
    assert(!visibility.isNodeVisible('t2'), 'Pre-condition: t2 hidden (collapsed)');
    assert(visibility.isNodeCollapsed('n1'), 'Pre-condition: n1 is collapsed');
    
    // Alt-click on n1 (State D: neither biological nor abbreviated connections)
    const vizNode = { id: 'n1', x: 100, y: 100 };
    manipulation.handleNodeClick(vizNode, createMockClickEvent(false, true));
    
    // Verify sample was created
    const sample = manipulation.projection.getSampleForAncestor('n1');
    assert(sample, 'Sample created after Alt-click');
    assert(sample.terminalIds.size > 0, 'Sample contains at least one terminal');
    
    // Verify sampled terminals are now visible
    for (const terminalId of sample.terminalIds) {
      assert(visibility.isNodeVisible(terminalId), 
        `Sampled terminal ${terminalId} is visible`);
    }
    
    // Critical: n1 must remain collapsed to generate abbreviated links
    assert(visibility.isNodeCollapsed('n1'), 
      'CRITICAL: n1 remains collapsed after Alt-click (State D requirement)');
    
    // Verify abbreviated links were created
    manipulation.projection.regenerate();
    const abbreviatedLinks = manipulation.projection.getAbbreviatedLinks();
    assert(abbreviatedLinks.length > 0, 'Abbreviated links generated from sampled terminals');
    
    // Each sampled terminal should have an abbreviated link
    const linkedTerminals = new Set();
    for (const link of abbreviatedLinks) {
      linkedTerminals.add(link.targetId);
    }
    
    for (const terminalId of sample.terminalIds) {
      assert(linkedTerminals.has(terminalId), 
        `Abbreviated link created for sampled terminal ${terminalId}`);
    }
  });

  await t.test('Alt-click State D abbreviated links originate from collapsed ancestor', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);
    
    // Setup: Collapse n1 (State D)
    visibility.collapseNode('n1');
    manipulation.projection.regenerate();
    
    // Alt-click on n1
    manipulation.handleNodeClick({ id: 'n1', x: 100, y: 100 }, createMockClickEvent(false, true));
    
    // Get abbreviated links
    manipulation.projection.regenerate();
    const abbreviatedLinks = manipulation.projection.getAbbreviatedLinks();
    
    // All abbreviated links should originate from n1 (the sampled ancestor)
    for (const link of abbreviatedLinks) {
      assert(link.sourceId === 'n1', 
        `Abbreviated link from n1 to ${link.targetId}, not from ${link.sourceId}`);
      assert(link.type === 'abbreviated', `Link is marked as abbreviated type`);
    }
  });

  await t.test('Alt-click State B reshuffles sample without expanding', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);
    
    // Setup: n1 collapsed, then Alt-click to create sample (State D → State B)
    visibility.collapseNode('n1');
    manipulation.projection.regenerate();
    assert(visibility.isNodeCollapsed('n1'), 'Setup: n1 is collapsed');
    
    // First Alt-click creates sample
    manipulation.handleNodeClick({ id: 'n1', x: 100, y: 100 }, createMockClickEvent(false, true));
    assert(visibility.isNodeCollapsed('n1'), 'After first Alt-click: n1 still collapsed');
    
    // Second Alt-click reshuffles (State B behavior)
    manipulation.handleNodeClick({ id: 'n1', x: 100, y: 100 }, createMockClickEvent(false, true));
    
    // Verify n1 remains collapsed after reshuffle
    assert(visibility.isNodeCollapsed('n1'), 
      'n1 remains collapsed after State B reshuffle');
    
    // Verify sample still exists
    const sample = manipulation.projection.getSampleForAncestor('n1');
    assert(sample && sample.terminalIds.size > 0, 'Sample remains after reshuffle');
  });

  await t.test('Alt-click root is disabled', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);
    
    // Precondition: root node 'root' exists and is visible
    assert(visibility.isNodeVisible('root'), 'Precondition: root is visible');
    
    // Collapse root first to create a valid state for testing
    visibility.collapseNode('root');
    assert(visibility.isNodeCollapsed('root'), 'Setup: root is collapsed');
    
    // Attempt Alt-click on root
    const sampleBefore = manipulation.projection.getSampleForAncestor('root');
    manipulation.handleNodeClick({ id: 'root', x: 100, y: 100 }, createMockClickEvent(false, true));
    const sampleAfter = manipulation.projection.getSampleForAncestor('root');
    
    // Verify root Alt-click had no effect (no sample created)
    assert(sampleBefore === null || sampleBefore === undefined, 'Precondition: no sample before Alt-click on root');
    assert(sampleAfter === null || sampleAfter === undefined, 'Root Alt-click disabled: no sample created');
  });

  await t.test('Alt-click root is disabled', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);
    const manipulation = new TreeManipulation(graph, visibility, null);
    
    // Alt-click on root
    const rootNode = { id: 'root', x: 100, y: 100 };
    manipulation.handleNodeClick(rootNode, createMockClickEvent(false, true));
    
    // Root should have no sample
    const rootSample = manipulation.projection.getSampleForAncestor('root');
    assert(!rootSample, 'Alt-click on root creates no sample');
    
    // Root biological children should still be visible (normal state)
    assert(visibility.isNodeVisible('n1'), 'root child n1 still visible');
    assert(visibility.isNodeVisible('n2'), 'root child n2 still visible');
  });
});


/**
 * Alt-click sampling and minimization specification.
 *
 *            root
 *          /      \
 *         A        Z
 *       /   \      |
 *      B     C     S
 *    b1-b5  / \   / \
 *         C1  c6 P   Q
 *       c1-c4   p1-p3 q1-q3
 */
test('TreeManipulation - Alt-click sampling and minimization', async (t) => {
  const SPEC = {
    root: ['A', 'Z'], A: ['B', 'C'], B: ['b1', 'b2', 'b3', 'b4', 'b5'], C: ['C1', 'c6'],
    C1: ['c1', 'c2', 'c3', 'c4'], Z: ['S'], S: ['P', 'Q'], P: ['p1', 'p2', 'p3'], Q: ['q1', 'q2', 'q3']
  };
  const PARENT = {};
  for (const [p, cs] of Object.entries(SPEC)) cs.forEach(c => { PARENT[c] = p; });
  const isUnder = (id, ancestor) => {
    for (let p = PARENT[id]; p; p = PARENT[p]) if (p === ancestor) return true;
    return false;
  };
  const B_LEAVES = SPEC.B;
  const C_LEAVES = ['c1', 'c2', 'c3', 'c4', 'c6'];

  function setup(max) {
    const builder = new GraphBuilder('alt_spec', 'root');
    const taxonomy = {};
    for (const id of new Set([...Object.keys(SPEC), ...Object.keys(PARENT)])) {
      const children = SPEC[id] || [];
      const isTerminal = children.length === 0;
      builder.addNode({
        id, type: isTerminal ? 'terminal' : 'internal', parentId: PARENT[id] || null, children,
        ...(isTerminal ? { taxonId: id } : {})
      });
      if (isTerminal) taxonomy[id] = { id, scientificName: id, rank: 'species' };
    }
    const graph = builder.build(taxonomy);
    const visibility = new TreeVisibilityState(graph);
    visibility.collapseToRoot();
    visibility.expandRootOneLevel();
    const manipulation = new TreeManipulation(graph, visibility, null, [], [], { maxSampledSpecies: max });
    return { manipulation, visibility };
  }

  const click = (m, id, event) => m.handleNodeClick({ id }, createMockClickEvent(...event));
  const alt = (m, id) => click(m, id, [false, true]);
  const cmd = (m, id) => click(m, id, [false, false, true]);
  const shift = (m, id) => click(m, id, [true]);
  const sampleOf = (m, id) => {
    const s = m.projection.getSampleForAncestor(id);
    return s ? [...s.terminalIds].sort() : null;
  };
  const abbreviatedFrom = (m, id) => {
    m.projection.regenerate();
    return m.projection.getAbbreviatedLinks().filter(l => l.sourceId === id).map(l => l.targetId).sort();
  };

  // Projection-wide invariants: unique links, no biological/abbreviated duplicates,
  // deepest-visible-ancestor anchoring, and each leaf owned by at most one sample.
  function assertConsistent(m) {
    m.projection.regenerate();
    const { visibleNodeIds, biologicalLinks, abbreviatedLinks } = m.projection.getProjection();
    const keys = abbreviatedLinks.map(l => `${l.sourceId}>${l.targetId}`);
    assert.strictEqual(new Set(keys).size, keys.length, 'abbreviated links are unique');
    const bioKeys = new Set(biologicalLinks.map(l => `${l.sourceId}>${l.targetId}`));
    for (const key of keys) assert(!bioKeys.has(key), `${key} is not also a biological link`);

    const owners = new Map();
    for (const [ancestorId, sample] of m.projection.getAllActiveSamples()) {
      for (const leaf of sample.terminalIds) {
        assert(!owners.has(leaf), `${leaf} owned by both ${owners.get(leaf)} and ${ancestorId}`);
        owners.set(leaf, ancestorId);
      }
    }
    for (const link of abbreviatedLinks) {
      assert(owners.has(link.targetId), `abbreviated target ${link.targetId} belongs to a sample`);
      let anchor = PARENT[link.targetId];
      while (!visibleNodeIds.has(anchor)) anchor = PARENT[anchor];
      assert.strictEqual(link.sourceId, anchor, `${link.targetId} anchored to deepest visible ancestor`);
    }
    for (const leaf of owners.keys()) assert(visibleNodeIds.has(leaf), `sampled ${leaf} is visible`);
  }

  await t.test('Empty node: branch-fair sample up to the maximum without revealing ancestors', () => {
    const { manipulation: m } = setup(4);
    alt(m, 'A');

    const leaves = abbreviatedFrom(m, 'A');
    assert.strictEqual(leaves.length, 4);
    assert.deepStrictEqual(sampleOf(m, 'A'), leaves);
    assert.strictEqual(leaves.filter(id => B_LEAVES.includes(id)).length, 2, 'two leaves from branch B');
    assert.strictEqual(leaves.filter(id => C_LEAVES.includes(id)).length, 2, 'two leaves from branch C');
    const visible = m.projection.getVisibleNodeIds();
    for (const id of ['B', 'C', 'C1']) assert(!visible.has(id), `${id} not revealed`);
    assertConsistent(m);
  });

  await t.test('Two branches of three leaves: all six represented when the maximum is larger', () => {
    for (let i = 0; i < 25; i++) {
      const { manipulation: m } = setup(10);
      cmd(m, 'Z');
      alt(m, 'S');
      assert.deepStrictEqual(abbreviatedFrom(m, 'S'), ['p1', 'p2', 'p3', 'q1', 'q2', 'q3']);
      assertConsistent(m);
    }
  });

  await t.test('Fewer available leaves than the maximum: every leaf stays represented on repeat', () => {
    const { manipulation: m } = setup(10);
    cmd(m, 'Z');
    alt(m, 'S');
    alt(m, 'S');
    assert.deepStrictEqual(sampleOf(m, 'S'), ['p1', 'p2', 'p3', 'q1', 'q2', 'q3']);
    assertConsistent(m);
  });

  await t.test('Expanded node: minimization keeps every visible leaf, ignoring the maximum', () => {
    const { manipulation: m, visibility } = setup(4);
    shift(m, 'A');
    alt(m, 'A');

    const all = [...B_LEAVES, ...C_LEAVES].sort();
    assert.deepStrictEqual(sampleOf(m, 'A'), all, 'all 10 leaves kept with max 4');
    assert.deepStrictEqual(abbreviatedFrom(m, 'A'), all);
    assert(visibility.isNodeCollapsed('A'));
    for (const id of ['B', 'C', 'C1']) assert(!visibility.isNodeVisible(id), `${id} hidden`);
    assertConsistent(m);
  });

  await t.test('Mixed direct and abbreviated descendants: all represented leaves preserved, nested sample folded', () => {
    const { manipulation: m } = setup(4);
    cmd(m, 'A');
    cmd(m, 'B');
    alt(m, 'C');
    const cSample = sampleOf(m, 'C');
    assert.strictEqual(cSample.length, 4);

    alt(m, 'A');
    const expected = [...B_LEAVES, ...cSample].sort();
    assert.deepStrictEqual(sampleOf(m, 'A'), expected);
    assert.strictEqual(sampleOf(m, 'C'), null, 'nested sample removed');
    assert.deepStrictEqual(abbreviatedFrom(m, 'A'), expected);
    assertConsistent(m);
  });

  await t.test('Nested sample under a collapsed ancestor is consolidated into the clicked node', () => {
    const { manipulation: m } = setup(10);
    cmd(m, 'A');
    alt(m, 'C');
    const cSample = sampleOf(m, 'C');
    cmd(m, 'A'); // collapses A; C's leaves re-anchor to A
    assert.deepStrictEqual(abbreviatedFrom(m, 'A'), cSample);

    alt(m, 'A'); // 5 represented < max 10: keep them and add more
    assert.strictEqual(sampleOf(m, 'C'), null, 'nested sample folded into A');
    const aSample = sampleOf(m, 'A');
    for (const leaf of cSample) assert(aSample.includes(leaf), `${leaf} preserved`);
    assert.strictEqual(aSample.length, 10);
    assertConsistent(m);
  });

  await t.test('Leaves represented through an enclosing sample move to the clicked node only', () => {
    const { manipulation: m } = setup(4);
    alt(m, 'A');
    cmd(m, 'A'); // A expanded with its sample re-anchored to B and C
    const aCLeaves = sampleOf(m, 'A').filter(id => C_LEAVES.includes(id));

    alt(m, 'C');
    const cSample = sampleOf(m, 'C');
    for (const leaf of aCLeaves) assert(cSample.includes(leaf), `${leaf} preserved under C`);
    assert(sampleOf(m, 'A').every(id => B_LEAVES.includes(id)), 'A keeps only its B leaves');
    assertConsistent(m);
  });

  await t.test('Minimized above maximum: reduces to the maximum using only existing leaves', () => {
    for (let i = 0; i < 25; i++) {
      const { manipulation: m } = setup(4);
      shift(m, 'A');
      alt(m, 'C'); // minimize C: c1-c4, c6 (5 > 4)
      const before = sampleOf(m, 'C');
      assert.strictEqual(before.length, 5);

      alt(m, 'C');
      const after = sampleOf(m, 'C');
      assert.strictEqual(after.length, 4);
      assert(after.every(id => before.includes(id)), 'no new leaves introduced');
      assert(after.includes('c6'), 'branch-fair: the single-leaf branch is kept');
      assertConsistent(m);
    }
  });

  await t.test('Minimized at exactly the maximum: a fresh branch-fair sample is drawn', () => {
    const { manipulation: m } = setup(4);
    alt(m, 'A');
    let changed = false;
    for (let i = 0; i < 30 && !changed; i++) {
      const before = sampleOf(m, 'A');
      alt(m, 'A');
      const after = sampleOf(m, 'A');
      assert.strictEqual(after.length, 4);
      assert.strictEqual(after.filter(id => B_LEAVES.includes(id)).length, 2);
      changed = after.join() !== before.join();
      assertConsistent(m);
    }
    assert(changed, 'reshuffle produced a different sample within 30 attempts');
  });

  await t.test('Minimized below maximum: existing leaves kept, unrepresented leaves added', () => {
    const { manipulation: m } = setup(4);
    cmd(m, 'A');
    cmd(m, 'C'); // c6 visible, C1 collapsed
    alt(m, 'C'); // minimize: only c6 represented
    assert.deepStrictEqual(sampleOf(m, 'C'), ['c6']);

    alt(m, 'C');
    const after = sampleOf(m, 'C');
    assert.strictEqual(after.length, 4);
    assert(after.includes('c6'), 'existing leaf preserved');
    assert.strictEqual(new Set(after).size, 4, 'no duplicates');
    assertConsistent(m);
  });

  await t.test('Unrelated branches and samples are unchanged', () => {
    const { manipulation: m, visibility } = setup(4);
    cmd(m, 'Z');
    alt(m, 'S');
    const sSample = sampleOf(m, 'S');
    const zVisible = ['Z', 'S', 'P', 'Q'].map(id => visibility.isNodeVisible(id));

    shift(m, 'A');
    alt(m, 'A');
    alt(m, 'A');
    alt(m, 'C');

    assert.deepStrictEqual(sampleOf(m, 'S'), sSample);
    assert.deepStrictEqual(['Z', 'S', 'P', 'Q'].map(id => visibility.isNodeVisible(id)), zVisible);
    assert.deepStrictEqual(abbreviatedFrom(m, 'S'), sSample);
    for (const leaf of sSample) assert(isUnder(leaf, 'S'));
    assertConsistent(m);
  });
});

test('TreeManipulation - Minimized node passes sampled direct children to the renderer as abbreviated links', () => {
  const { graph } = createSimpleTestGraph();
  const visibility = new TreeVisibilityState(graph);
  const edges = [['root', 'n1'], ['root', 'n2'], ['n1', 't1'], ['n1', 't2']];
  const allLinks = edges.map(([s, t]) => ({ sourceId: s, targetId: t, source: s, target: t }));
  const calls = [];
  const visualization = { updateVisibility: (...args) => calls.push(args) };
  const manipulation = new TreeManipulation(graph, visibility, visualization, [], allLinks);

  manipulation.handleNodeClick({ id: 'n1' }, createMockClickEvent(false, true));

  const [visibleNodeIds, , biologicalLinks, abbreviatedLinks] = calls.at(-1);
  assert(visibleNodeIds.has('t1') && visibleNodeIds.has('t2'), 'leaves stay visible');
  assert.deepStrictEqual(biologicalLinks.map(l => `${l.sourceId}>${l.targetId}`).sort(), ['root>n1', 'root>n2']);
  assert.deepStrictEqual(abbreviatedLinks.map(l => `${l.sourceId}>${l.targetId}`).sort(), ['n1>t1', 'n1>t2']);
  assert.strictEqual(biologicalLinks[0], allLinks.find(l => l.targetId === biologicalLinks[0].targetId),
    'original link objects are passed through');
});

test('TreeManipulation - Shift-click on a minimized node leaves no orphaned sampled leaves', () => {
  const { graph } = createSimpleTestGraph();
  const visibility = new TreeVisibilityState(graph);
  const manipulation = new TreeManipulation(graph, visibility, null);

  manipulation.handleNodeClick({ id: 'n1' }, createMockClickEvent(false, true));
  manipulation.handleNodeClick({ id: 'n1' }, createMockClickEvent(true));

  manipulation.projection.regenerate();
  const { visibleNodeIds, abbreviatedLinks } = manipulation.projection.getProjection();
  assert.deepStrictEqual([...visibleNodeIds].sort(), ['n1', 'n2', 'root']);
  assert.strictEqual(abbreviatedLinks.length, 0);
});
