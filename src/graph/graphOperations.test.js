/**
 * Tests for Graph Operations
 */

import test from 'node:test';
import assert from 'node:assert';
import { GraphBuilder } from './PhyloGraph.js';
import {
  findMRCA,
  getPathBetween,
  getDescendants,
  buildPrunedGraph,
  getTerminalTaxa,
  getInternalNodes,
  getSubtree,
  getLeaves,
  isAncestorOf,
  getTreeDepth,
  getTreeSize,
  validateTree
} from './graphOperations.js';

function createTestGraph() {
  //     root
  //    /    \
  //   n1    n2
  //  /  \   / \
  // t1  t2 t3 t4
  const builder = new GraphBuilder('test_hyp', 'root');
  builder.addNode({ id: 'root', type: 'internal', parentId: null, children: ['n1', 'n2'] });
  builder.addNode({ id: 'n1', type: 'internal', parentId: 'root', children: ['t1', 't2'] });
  builder.addNode({ id: 'n2', type: 'internal', parentId: 'root', children: ['t3', 't4'] });
  builder.addNode({ id: 't1', type: 'terminal', parentId: 'n1', children: [], taxonId: 'tax_a' });
  builder.addNode({ id: 't2', type: 'terminal', parentId: 'n1', children: [], taxonId: 'tax_b' });
  builder.addNode({ id: 't3', type: 'terminal', parentId: 'n2', children: [], taxonId: 'tax_c' });
  builder.addNode({ id: 't4', type: 'terminal', parentId: 'n2', children: [], taxonId: 'tax_d' });
  return builder.build();
}

test('GraphOperations - findMRCA', () => {
  const graph = createTestGraph();
  assert.strictEqual(findMRCA(graph, 't1', 't2'), 'n1');
  assert.strictEqual(findMRCA(graph, 't1', 't3'), 'root');
  assert.strictEqual(findMRCA(graph, 't1', 't1'), 't1');
});

test('GraphOperations - getPathBetween', () => {
  const graph = createTestGraph();
  const path = getPathBetween(graph, 't1', 't2');

  assert.strictEqual(path.mrca, 'n1');
  assert.strictEqual(path.nodes.from, 't1');
  assert.strictEqual(path.nodes.to, 't2');
  assert(path.path.includes('t1'));
  assert(path.path.includes('n1'));
  assert(path.path.includes('t2'));
});

test('GraphOperations - getDescendants', () => {
  const graph = createTestGraph();
  const descendants = getDescendants(graph, 'n1');

  assert.strictEqual(descendants.length, 2);
  assert(descendants.includes('t1'));
  assert(descendants.includes('t2'));

  const rootDescendants = getDescendants(graph, 'root');
  assert.strictEqual(rootDescendants.length, 6); // All non-root nodes
});

test('GraphOperations - buildPrunedGraph', () => {
  const graph = createTestGraph();
  const prunedGraph = buildPrunedGraph(graph, ['t1', 't3']);

  // Should include: t1, n1, root, t3, n2
  assert(prunedGraph.hasNode('t1'));
  assert(prunedGraph.hasNode('t3'));
  assert(prunedGraph.hasNode('n1'));
  assert(prunedGraph.hasNode('n2'));
  assert(prunedGraph.hasNode('root'));
  
  // Should not include: t2, t4 (not bookmarked and not ancestors)
  assert(!prunedGraph.hasNode('t2'));
  assert(!prunedGraph.hasNode('t4'));

  // Original graph should be unchanged
  assert(graph.hasNode('t2'));
});

test('GraphOperations - buildPrunedGraph with single node', () => {
  const graph = createTestGraph();
  const prunedGraph = buildPrunedGraph(graph, ['t1']);

  assert.strictEqual(prunedGraph.getTreeSize ? getTreeSize(prunedGraph) : prunedGraph.getNodes().size, 3); // t1, n1, root
});

test('GraphOperations - buildPrunedGraph preserves root', () => {
  const graph = createTestGraph();
  const prunedGraph = buildPrunedGraph(graph, ['t1']);

  assert.strictEqual(prunedGraph.getRoot(), graph.getRoot());
});

test('GraphOperations - getTerminalTaxa', () => {
  const graph = createTestGraph();
  const terminals = getTerminalTaxa(graph);

  assert.strictEqual(terminals.length, 4);
  assert(terminals.some(t => t.id === 't1'));
  assert(terminals.some(t => t.id === 't4'));
});

test('GraphOperations - getInternalNodes', () => {
  const graph = createTestGraph();
  const internals = getInternalNodes(graph);

  assert.strictEqual(internals.length, 3);
  assert(internals.some(n => n.id === 'root'));
  assert(internals.some(n => n.id === 'n1'));
});

test('GraphOperations - getSubtree', () => {
  const graph = createTestGraph();
  const subtree = getSubtree(graph, 'n1');

  assert(subtree.hasNode('n1'));
  assert(subtree.hasNode('t1'));
  assert(subtree.hasNode('t2'));
  assert(!subtree.hasNode('n2'));
  assert(!subtree.hasNode('t3'));
});

test('GraphOperations - getLeaves', () => {
  const graph = createTestGraph();
  const leaves = getLeaves(graph, 'n1');

  assert.strictEqual(leaves.length, 2);
  assert(leaves.includes('t1'));
  assert(leaves.includes('t2'));

  const rootLeaves = getLeaves(graph, 'root');
  assert.strictEqual(rootLeaves.length, 4);
});

test('GraphOperations - isAncestorOf', () => {
  const graph = createTestGraph();

  assert(isAncestorOf(graph, 'root', 't1'));
  assert(isAncestorOf(graph, 'n1', 't1'));
  assert(!isAncestorOf(graph, 't1', 'root'));
  assert(!isAncestorOf(graph, 'n2', 't1'));
  assert(!isAncestorOf(graph, 'nonexistent', 't1'));
});

test('GraphOperations - getTreeDepth', () => {
  const graph = createTestGraph();
  const depth = getTreeDepth(graph);

  assert.strictEqual(depth, 2); // root -> n1 -> t1
});

test('GraphOperations - getTreeSize', () => {
  const graph = createTestGraph();
  const size = getTreeSize(graph);

  assert.strictEqual(size, 7); // root, n1, n2, t1, t2, t3, t4
});

test('GraphOperations - validateTree', () => {
  const graph = createTestGraph();
  const result = validateTree(graph);

  assert(result.isValid);
  assert.strictEqual(result.errors.length, 0);
});

test('GraphOperations - buildPrunedGraph throws with empty nodes', () => {
  const graph = createTestGraph();

  assert.throws(() => {
    buildPrunedGraph(graph, []);
  });
});

test('GraphOperations - buildPrunedGraph throws with nonexistent node', () => {
  const graph = createTestGraph();

  assert.throws(() => {
    buildPrunedGraph(graph, ['nonexistent']);
  });
});

test('GraphOperations - getPathBetween complex', () => {
  const graph = createTestGraph();
  const path = getPathBetween(graph, 't1', 't4');

  // Path: t1 -> n1 -> root -> n2 -> t4
  assert.strictEqual(path.mrca, 'root');
  assert(path.path.includes('t1'));
  assert(path.path.includes('root'));
  assert(path.path.includes('t4'));
});

test('GraphOperations - pruned graph preserves taxonomy', () => {
  const builder = new GraphBuilder('test_hyp', 'root');
  builder.addNode({ id: 'root', type: 'internal', parentId: null, children: ['child'] });
  builder.addNode({ id: 'child', type: 'terminal', parentId: 'root', children: [], taxonId: 'tax_a' });
  const graph = builder.build({ tax_a: { id: 'tax_a', scientificName: 'Test' } });

  const prunedGraph = buildPrunedGraph(graph, ['child']);

  const taxon = prunedGraph.getTaxonForTerminal('child');
  assert.strictEqual(taxon.scientificName, 'Test');
});
