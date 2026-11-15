/**
 * TreeVisibilityState Tests
 *
 * Tests for the tree collapse/expansion visibility-state engine.
 */

import test from 'node:test';
import assert from 'node:assert';
import { GraphBuilder } from './PhyloGraph.js';
import { TreeVisibilityState } from './TreeVisibilityState.js';

/**
 * Helper to create a simple test graph
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

test('TreeVisibilityState - Initial State', async (t) => {
  await t.test('Initial state: all nodes visible', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    const visibleIds = visibility.getVisibleNodeIds();
    assert.strictEqual(visibleIds.size, 5, 'All 5 nodes should be visible initially');
    assert.ok(visibleIds.has('root'), 'root should be visible');
    assert.ok(visibleIds.has('n1'), 'n1 should be visible');
    assert.ok(visibleIds.has('n2'), 'n2 should be visible');
    assert.ok(visibleIds.has('t1'), 't1 should be visible');
    assert.ok(visibleIds.has('t2'), 't2 should be visible');
  });

  await t.test('Initial state: all nodes are not collapsed', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    assert.strictEqual(visibility.isNodeCollapsed('root'), false, 'root should not be collapsed');
    assert.strictEqual(visibility.isNodeCollapsed('n1'), false, 'n1 should not be collapsed');
    assert.strictEqual(visibility.isNodeCollapsed('n2'), false, 'n2 should not be collapsed');
  });

  await t.test('Initial state: visible links match all original edges', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    const visibleLinks = visibility.getVisibleLinkIds();
    assert.strictEqual(visibleLinks.length, 4, 'Should have 4 visible links (all original edges)');

    // Check that all original edges are present
    const linkSet = new Set(visibleLinks.map(([src, tgt]) => `${src}-${tgt}`));
    assert.ok(linkSet.has('root-n1'), 'root-n1 should be visible');
    assert.ok(linkSet.has('root-n2'), 'root-n2 should be visible');
    assert.ok(linkSet.has('n1-t1'), 'n1-t1 should be visible');
    assert.ok(linkSet.has('n1-t2'), 'n1-t2 should be visible');
  });
});

test('TreeVisibilityState - Collapse and Expand', async (t) => {
  await t.test('Collapse an internal node hides all descendants but retains the node', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    // Collapse n1
    visibility.collapseNode('n1');

    const visibleIds = visibility.getVisibleNodeIds();
    assert.ok(visibleIds.has('n1'), 'n1 should still be visible after collapsing');
    assert.strictEqual(visibleIds.has('t1'), false, 't1 should be hidden');
    assert.strictEqual(visibleIds.has('t2'), false, 't2 should be hidden');
    assert.ok(visibleIds.has('root'), 'root should still be visible');
    assert.ok(visibleIds.has('n2'), 'n2 should still be visible');

    assert.strictEqual(visibleIds.size, 3, 'Should have 3 visible nodes (root, n1, n2)');
  });

  await t.test('Collapsed node is marked as collapsed', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    visibility.collapseNode('n1');

    assert.strictEqual(visibility.isNodeCollapsed('n1'), true, 'n1 should be collapsed');
    assert.strictEqual(visibility.isNodeCollapsed('root'), false, 'root should not be collapsed');
  });

  await t.test('Expand one level reveals immediate children only', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    // Collapse n1 (hiding t1, t2)
    visibility.collapseNode('n1');
    assert.strictEqual(visibility.getVisibleNodeIds().size, 3, 'Collapsed state should have 3 visible');

    // Expand n1 one level
    visibility.expandNodeOneLevel('n1');

    const visibleIds = visibility.getVisibleNodeIds();
    assert.strictEqual(visibleIds.has('n1'), true, 'n1 should be visible');
    assert.strictEqual(visibleIds.has('t1'), true, 't1 should be visible (immediate child)');
    assert.strictEqual(visibleIds.has('t2'), true, 't2 should be visible (immediate child)');
    assert.strictEqual(visibleIds.size, 5, 'Should have all 5 nodes visible after expanding');
  });

  await t.test('Newly revealed internal children are marked as collapsed', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    // Collapse root (hiding everything except root)
    visibility.collapseToRoot();
    assert.strictEqual(visibility.getVisibleNodeIds().size, 1, 'Only root visible after collapseToRoot');

    // Expand root one level (reveals n1, n2)
    visibility.expandNodeOneLevel('root');

    const visibleIds = visibility.getVisibleNodeIds();
    assert.strictEqual(visibleIds.has('root'), true, 'root should be visible');
    assert.strictEqual(visibleIds.has('n1'), true, 'n1 should be visible');
    assert.strictEqual(visibleIds.has('n2'), true, 'n2 should be visible (terminal)');
    assert.strictEqual(visibleIds.has('t1'), false, 't1 should be hidden (descendant of collapsed n1)');
    assert.strictEqual(visibleIds.has('t2'), false, 't2 should be hidden (descendant of collapsed n1)');

    // n1 should be marked as collapsed (internal node)
    assert.strictEqual(visibility.isNodeCollapsed('n1'), true, 'n1 should be marked as collapsed');
    // n2 should not be marked as collapsed (terminal node)
    assert.strictEqual(visibility.isNodeCollapsed('n2'), false, 'n2 (terminal) should not be marked as collapsed');
    // root should be marked as expanded
    assert.strictEqual(visibility.isNodeCollapsed('root'), false, 'root should be marked as expanded');
  });

  await t.test('Command-click reveals one level, then next command-click reveals next level', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    // Start with only root visible
    visibility.collapseToRoot();
    assert.strictEqual(visibility.getVisibleNodeIds().size, 1, 'Only root visible');

    // First command-click on root: reveals n1, n2
    visibility.expandNodeOneLevel('root');
    let visibleIds = visibility.getVisibleNodeIds();
    assert.strictEqual(visibleIds.size, 3, 'After first expand: root, n1, n2');
    assert.strictEqual(visibility.isNodeCollapsed('n1'), true, 'n1 is collapsed after reveal');

    // Second command-click on n1: reveals t1, t2
    visibility.expandNodeOneLevel('n1');
    visibleIds = visibility.getVisibleNodeIds();
    assert.strictEqual(visibleIds.size, 5, 'After second expand: all nodes visible');
    assert.strictEqual(visibleIds.has('t1'), true, 't1 now visible');
    assert.strictEqual(visibleIds.has('t2'), true, 't2 now visible');
    assert.strictEqual(visibility.isNodeCollapsed('n1'), false, 'n1 is now expanded');
  });

  await t.test('Expand non-collapsed node is a no-op', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    // All nodes start visible
    const initialCount = visibility.getVisibleNodeIds().size;

    // Try to expand an already-visible node
    visibility.expandNodeOneLevel('n1');

    assert.strictEqual(visibility.getVisibleNodeIds().size, initialCount, 'Expanding non-collapsed node should not change state');
  });

  await t.test('Collapsing already-collapsed node is a no-op', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    visibility.collapseNode('n1');
    const stateAfterFirstCollapse = visibility.snapshotVisibilityState();

    visibility.collapseNode('n1');
    const stateAfterSecondCollapse = visibility.snapshotVisibilityState();

    assert.deepStrictEqual(stateAfterFirstCollapse.visibleNodeIds, stateAfterSecondCollapse.visibleNodeIds);
    assert.deepStrictEqual(stateAfterFirstCollapse.collapsedNodeIds, stateAfterSecondCollapse.collapsedNodeIds);
  });
});

test('TreeVisibilityState - Collapse and Expand Root', async (t) => {
  await t.test('Collapse root leaves only root visible', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    visibility.collapseNode('root');

    const visibleIds = visibility.getVisibleNodeIds();
    assert.strictEqual(visibleIds.size, 1, 'Only root should be visible');
    assert.ok(visibleIds.has('root'), 'root should be visible');
  });

  await t.test('Expand root one level reveals its immediate children', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    visibility.collapseNode('root');
    assert.strictEqual(visibility.getVisibleNodeIds().size, 1, 'Collapsed state');

    visibility.expandNodeOneLevel('root');

    const visibleIds = visibility.getVisibleNodeIds();
    assert.ok(visibleIds.has('root'), 'root should be visible');
    assert.ok(visibleIds.has('n1'), 'n1 (immediate child) should be visible');
    assert.ok(visibleIds.has('n2'), 'n2 (immediate child) should be visible');
    assert.strictEqual(visibleIds.has('t1'), false, 't1 (not immediate child) should not be visible');
    assert.strictEqual(visibleIds.has('t2'), false, 't2 (not immediate child) should not be visible');
    assert.strictEqual(visibleIds.size, 3, 'Should have 3 visible nodes (root and 2 children)');
  });

  await t.test('collapseToRoot hides all non-root nodes', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    visibility.collapseToRoot();

    const visibleIds = visibility.getVisibleNodeIds();
    assert.strictEqual(visibleIds.size, 1, 'Only 1 node should be visible');
    assert.ok(visibleIds.has('root'), 'root should be visible');
  });

  await t.test('expandRootOneLevel after collapseToRoot reveals immediate children', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    visibility.collapseToRoot();
    visibility.expandRootOneLevel();

    const visibleIds = visibility.getVisibleNodeIds();
    assert.ok(visibleIds.has('root'), 'root should be visible');
    assert.ok(visibleIds.has('n1'), 'n1 should be visible');
    assert.ok(visibleIds.has('n2'), 'n2 should be visible');
    assert.strictEqual(visibleIds.has('t1'), false, 't1 should not be visible');
    assert.strictEqual(visibleIds.has('t2'), false, 't2 should not be visible');
    assert.strictEqual(visibleIds.size, 3, 'Should have 3 visible nodes');
  });
});

test('TreeVisibilityState - Visible Links', async (t) => {
  await t.test('Visible links only connect visible nodes with direct parent-child relationship', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    visibility.collapseNode('n1');

    const visibleLinks = visibility.getVisibleLinkIds();
    // Expected: root-n1, root-n2 (n1-t1 and n1-t2 should be hidden)
    assert.strictEqual(visibleLinks.length, 2, 'Should have 2 visible links after collapsing n1');

    const linkSet = new Set(visibleLinks.map(([src, tgt]) => `${src}-${tgt}`));
    assert.ok(linkSet.has('root-n1'), 'root-n1 should be visible');
    assert.ok(linkSet.has('root-n2'), 'root-n2 should be visible');
    assert.strictEqual(linkSet.has('n1-t1'), false, 'n1-t1 should not be visible');
    assert.strictEqual(linkSet.has('n1-t2'), false, 'n1-t2 should not be visible');
  });

  await t.test('Collapsed node retains connection to visible parent', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    visibility.collapseNode('n1');

    const visibleLinks = visibility.getVisibleLinkIds();
    const linkSet = new Set(visibleLinks.map(([src, tgt]) => `${src}-${tgt}`));

    // n1 is collapsed but still visible; it should have a link to its parent (root)
    assert.ok(linkSet.has('root-n1'), 'Collapsed n1 should retain link to its parent (root)');
  });

  await t.test('No invented links between non-adjacent nodes', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    visibility.collapseNode('n1');

    const visibleLinks = visibility.getVisibleLinkIds();
    const linkSet = new Set(visibleLinks.map(([src, tgt]) => `${src}-${tgt}`));

    // root should not connect directly to t1 or t2
    assert.strictEqual(linkSet.has('root-t1'), false, 'No invented link from root to t1');
    assert.strictEqual(linkSet.has('root-t2'), false, 'No invented link from root to t2');
  });
});

test('TreeVisibilityState - Multifurcations', async (t) => {
  await t.test('Multifurcating root with 3 children', () => {
    const { graph } = createMultifurcatingGraph();
    const visibility = new TreeVisibilityState(graph);

    const children = visibility.getVisibleChildren('root');
    assert.strictEqual(children.length, 3, 'Root should have 3 visible children');
    assert.ok(children.includes('n1'), 'n1 should be a child');
    assert.ok(children.includes('n2'), 'n2 should be a child');
    assert.ok(children.includes('n3'), 'n3 should be a child');
  });

  await t.test('Collapse one child of multifurcating node leaves other children visible', () => {
    const { graph } = createMultifurcatingGraph();
    const visibility = new TreeVisibilityState(graph);

    visibility.collapseNode('n1');

    const children = visibility.getVisibleChildren('root');
    assert.strictEqual(children.length, 3, 'Root should have 3 visible children after collapse (n1 stays visible)');
    assert.strictEqual(children.includes('n1'), true, 'n1 should still be visible (but collapsed)');
    assert.strictEqual(children.includes('n2'), true, 'n2 should be visible');
    assert.strictEqual(children.includes('n3'), true, 'n3 should be visible');
  });

  await t.test('Visible links for multifurcating node after partial collapse', () => {
    const { graph } = createMultifurcatingGraph();
    const visibility = new TreeVisibilityState(graph);

    visibility.collapseNode('n1');

    const visibleLinks = visibility.getVisibleLinkIds();
    const linkSet = new Set(visibleLinks.map(([src, tgt]) => `${src}-${tgt}`));

    // Expected: root-n1, root-n2, root-n3 (n1-t1 and n1-t2 hidden)
    assert.strictEqual(visibleLinks.length, 3, 'Should have 3 visible links');
    assert.ok(linkSet.has('root-n1'), 'root-n1 should be visible');
    assert.ok(linkSet.has('root-n2'), 'root-n2 should be visible');
    assert.ok(linkSet.has('root-n3'), 'root-n3 should be visible');
  });
});

test('TreeVisibilityState - Multiple Operations', async (t) => {
  await t.test('Sequence of collapse/expand operations', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    // Initial: all 5 visible
    assert.strictEqual(visibility.getVisibleNodeIds().size, 5);

    // Collapse n1: root, n1, n2 visible
    visibility.collapseNode('n1');
    assert.strictEqual(visibility.getVisibleNodeIds().size, 3);

    // Expand n1: all 5 visible again
    visibility.expandNodeOneLevel('n1');
    assert.strictEqual(visibility.getVisibleNodeIds().size, 5);

    // Collapse root: only root visible
    visibility.collapseNode('root');
    assert.strictEqual(visibility.getVisibleNodeIds().size, 1);

    // Expand root: root, n1, n2 visible
    visibility.expandNodeOneLevel('root');
    assert.strictEqual(visibility.getVisibleNodeIds().size, 3);
  });

  await t.test('resetToAllVisible restores all nodes', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    visibility.collapseToRoot();
    assert.strictEqual(visibility.getVisibleNodeIds().size, 1, 'Collapsed to root');

    visibility.resetToAllVisible();

    const visibleIds = visibility.getVisibleNodeIds();
    assert.strictEqual(visibleIds.size, 5, 'All nodes should be visible after reset');
    assert.strictEqual(visibility.collapsedNodeIds.size, 0, 'No nodes should be collapsed after reset');
  });
});

test('TreeVisibilityState - Descendants', async (t) => {
  await t.test('getVisibleDescendants returns all visible descendants recursively', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    const descendants = visibility.getVisibleDescendants('n1');
    assert.strictEqual(descendants.length, 2, 'n1 should have 2 visible descendants');
    assert.ok(descendants.includes('t1'), 't1 should be a descendant');
    assert.ok(descendants.includes('t2'), 't2 should be a descendant');
  });

  await t.test('getVisibleDescendants returns empty when node is collapsed', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    visibility.collapseNode('n1');

    const descendants = visibility.getVisibleDescendants('n1');
    assert.strictEqual(descendants.length, 0, 'Collapsed node should have no visible descendants');
  });
});

test('TreeVisibilityState - Graph Immutability', async (t) => {
  await t.test('Original graph remains unchanged after visibility operations', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    // Perform visibility operations
    visibility.collapseNode('n1');
    visibility.expandNodeOneLevel('n1');
    visibility.collapseToRoot();

    // Verify graph is unchanged
    const graphNodes = graph.getNodes();
    assert.strictEqual(graphNodes.size, 5, 'Graph should still have 5 nodes');
    assert.strictEqual(graph.getChildren('n1').length, 2, 'n1 should still have 2 children in graph');
    assert.strictEqual(graph.getChildren('root').length, 2, 'root should still have 2 children in graph');
  });

  await t.test('Graph metadata (age_ma, taxonomic_summary) are preserved', () => {
    const hypothesis = {
      hypothesisId: 'test_h3',
      rootNodeId: 'root',
      nodes: [
        {
          id: 'root',
          type: 'internal',
          parentId: null,
          children: ['n1'],
          age_ma: 100.5,
          taxonomic_summary: { name: 'TestClade', rank: 'clade' }
        },
        { id: 'n1', type: 'terminal', parentId: 'root', taxonId: 'n1', children: [], age_ma: 0 }
      ]
    };

    const taxonomy = {
      'n1': { id: 'n1', scientificName: 'Species N1', rank: 'species' }
    };

    const builder = new GraphBuilder(hypothesis.hypothesisId, hypothesis.rootNodeId);
    for (const node of hypothesis.nodes) {
      builder.addNode(node);
    }
    const graph = builder.build(taxonomy);

    const visibility = new TreeVisibilityState(graph);
    visibility.collapseNode('root');

    // Verify metadata is unchanged in graph
    const rootNode = graph.getNodes().get('root');
    assert.strictEqual(rootNode.age_ma, 100.5, 'age_ma should be preserved');
    assert.strictEqual(rootNode.taxonomic_summary.name, 'TestClade', 'taxonomic_summary should be preserved');
  });
});

test('TreeVisibilityState - Error Handling', async (t) => {
  await t.test('Operations on non-existent node throw error', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    assert.throws(
      () => visibility.collapseNode('nonexistent'),
      /Node not found/,
      'collapseNode should throw for non-existent node'
    );

    assert.throws(
      () => visibility.expandNodeOneLevel('nonexistent'),
      /Node not found/,
      'expandNodeOneLevel should throw for non-existent node'
    );
  });
});

test('TreeVisibilityState - Hardened Expansion (Hidden Nodes)', async (t) => {
  await t.test('Attempting to expand a hidden descendant does not reveal any nodes', () => {
    const { graph } = createSimpleTestGraph();
    // Structure: root -> n1 -> [t1, t2], root -> n2
    const visibility = new TreeVisibilityState(graph);

    // Collapse n1, hiding its descendants t1 and t2
    visibility.collapseNode('n1');
    assert.strictEqual(visibility.isNodeVisible('t1'), false, 'Before: t1 should be hidden');
    assert.strictEqual(visibility.isNodeVisible('t2'), false, 'Before: t2 should be hidden');

    // Try to expand t1 (which is hidden)
    visibility.expandNodeOneLevel('t1');

    // Nothing should change - no nodes revealed
    assert.strictEqual(visibility.isNodeVisible('t1'), false, 'After expand hidden t1: t1 still hidden');
    assert.strictEqual(visibility.isNodeVisible('t2'), false, 'After expand hidden t1: t2 still hidden');
    assert.strictEqual(visibility.getVisibleNodeCount(), 3, 'Node count unchanged: root, n1, n2');
  });

  await t.test('Expanding a visible parent preserves collapsed child subtrees', () => {
    const { graph } = createMultifurcatingGraph();
    // Structure: root -> [n1, n2, n3], n1 -> [t1, t2]
    const visibility = new TreeVisibilityState(graph);

    // Start with all visible
    assert.strictEqual(visibility.isNodeVisible('n1'), true, 'Initial: n1 visible');
    assert.strictEqual(visibility.isNodeVisible('t1'), true, 'Initial: t1 visible');

    // Collapse n1
    visibility.collapseNode('n1');
    assert.strictEqual(visibility.isNodeCollapsed('n1'), true, 'n1 is collapsed');
    assert.strictEqual(visibility.isNodeVisible('t1'), false, 't1 hidden by n1 collapse');

    // Collapse root
    visibility.collapseNode('root');
    assert.strictEqual(visibility.isNodeCollapsed('root'), true, 'root is collapsed');
    assert.strictEqual(visibility.isNodeVisible('n1'), false, 'n1 hidden by root collapse');
    assert.strictEqual(visibility.isNodeVisible('t1'), false, 't1 still hidden');

    // Collapse to root (explicitly)
    visibility.collapseToRoot();
    assert.strictEqual(visibility.getVisibleNodeCount(), 1, 'Only root visible');
    assert.strictEqual(visibility.isNodeCollapsed('root'), true, 'root marked collapsed');
    assert.strictEqual(visibility.isNodeCollapsed('n1'), true, 'n1 marked collapsed after collapseToRoot');

    // Expand root one level
    visibility.expandRootOneLevel();
    assert.strictEqual(visibility.isNodeVisible('n1'), true, 'n1 visible after root expand');
    assert.strictEqual(visibility.isNodeVisible('t1'), false, 't1 remains hidden (n1 still collapsed)');
    assert.strictEqual(visibility.isNodeCollapsed('n1'), true, 'n1 retains its collapsed state');
    assert.strictEqual(visibility.getVisibleNodeCount(), 4, 'root + 3 children visible');

    // Now manually expand n1
    visibility.expandNodeOneLevel('n1');
    assert.strictEqual(visibility.isNodeVisible('t1'), true, 't1 now visible after n1 expand');
  });
});

test('TreeVisibilityState - Hardened Collapse-to-Root', async (t) => {
  await t.test('Root is marked collapsed after collapseToRoot()', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    visibility.collapseToRoot();

    assert.strictEqual(visibility.isNodeVisible('root'), true, 'root is visible');
    assert.strictEqual(visibility.isNodeCollapsed('root'), true, 'root is marked collapsed');
  });

  await t.test('Terminal nodes are not marked collapsed after collapseToRoot()', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    visibility.collapseToRoot();

    // t1, t2, and n2 are all terminal (no children)
    assert.strictEqual(visibility.isNodeCollapsed('t1'), false, 't1 (terminal) not collapsed');
    assert.strictEqual(visibility.isNodeCollapsed('t2'), false, 't2 (terminal) not collapsed');
    assert.strictEqual(visibility.isNodeCollapsed('n2'), false, 'n2 (terminal) not collapsed');
  });

  await t.test('Internal hidden nodes with children are marked collapsed after collapseToRoot()', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    visibility.collapseToRoot();

    // n1 is internal (has children t1, t2) and hidden
    assert.strictEqual(visibility.isNodeVisible('n1'), false, 'n1 should be hidden');
    assert.strictEqual(visibility.isNodeCollapsed('n1'), true, 'n1 (internal) marked collapsed');
  });

  await t.test('Expanding root after collapseToRoot() reveals children with correct collapse state', () => {
    const { graph } = createMultifurcatingGraph();
    const visibility = new TreeVisibilityState(graph);

    visibility.collapseToRoot();
    assert.strictEqual(visibility.getVisibleNodeCount(), 1, 'Only root visible');

    visibility.expandRootOneLevel();
    assert.strictEqual(visibility.getVisibleNodeCount(), 4, 'root + 3 children visible');
    assert.strictEqual(visibility.isNodeVisible('n1'), true, 'n1 visible');
    assert.strictEqual(visibility.isNodeVisible('n2'), true, 'n2 visible');
    assert.strictEqual(visibility.isNodeVisible('n3'), true, 'n3 visible');

    // n1 is internal and should be collapsed, so t1 and t2 should not be visible
    assert.strictEqual(visibility.isNodeCollapsed('n1'), true, 'n1 retains collapsed state');
    assert.strictEqual(visibility.isNodeVisible('t1'), false, 't1 not visible (n1 still collapsed)');
    assert.strictEqual(visibility.isNodeVisible('t2'), false, 't2 not visible (n1 still collapsed)');
  });
});

test('TreeVisibilityState - Valid Topology Maintenance', async (t) => {
  await t.test('Every visible non-root node has a visible parent', () => {
    const { graph } = createSimpleTestGraph();
    const visibility = new TreeVisibilityState(graph);

    assert.strictEqual(visibility.isVisibleTopologyValid(), true, 'Initial state valid');

    // Collapse n1
    visibility.collapseNode('n1');
    assert.strictEqual(visibility.isVisibleTopologyValid(), true, 'After collapse n1: valid');

    // Expand n1
    visibility.expandNodeOneLevel('n1');
    assert.strictEqual(visibility.isVisibleTopologyValid(), true, 'After expand n1: valid');

    // Collapse to root
    visibility.collapseToRoot();
    assert.strictEqual(visibility.isVisibleTopologyValid(), true, 'After collapseToRoot: valid');

    // Expand root
    visibility.expandRootOneLevel();
    assert.strictEqual(visibility.isVisibleTopologyValid(), true, 'After expandRootOneLevel: valid');

    // Reset
    visibility.resetToAllVisible();
    assert.strictEqual(visibility.isVisibleTopologyValid(), true, 'After resetToAllVisible: valid');
  });

  await t.test('Complex sequence of operations maintains valid topology', () => {
    const { graph } = createMultifurcatingGraph();
    const visibility = new TreeVisibilityState(graph);

    // Collapse n1
    visibility.collapseNode('n1');
    assert.strictEqual(visibility.isVisibleTopologyValid(), true, 'After collapse n1');

    // Collapse root
    visibility.collapseNode('root');
    assert.strictEqual(visibility.isVisibleTopologyValid(), true, 'After collapse root');

    // Expand root
    visibility.expandNodeOneLevel('root');
    assert.strictEqual(visibility.isVisibleTopologyValid(), true, 'After expand root');

    // Try to expand hidden n1 (should be no-op)
    visibility.expandNodeOneLevel('n1');
    assert.strictEqual(visibility.isVisibleTopologyValid(), true, 'After attempted expand hidden n1');

    // Expand n1 properly (it's visible now since root expanded)
    visibility.collapseNode('n1'); // First collapse it
    visibility.expandNodeOneLevel('n1'); // Then expand it
    assert.strictEqual(visibility.isVisibleTopologyValid(), true, 'After proper expand n1');
  });
});

