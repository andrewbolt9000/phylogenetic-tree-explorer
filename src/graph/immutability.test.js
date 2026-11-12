import test from 'node:test';
import assert from 'node:assert';
import { GraphBuilder } from './PhyloGraph.js';
import { buildPrunedGraph } from './graphOperations.js';

function createTestGraph() {
  const builder = new GraphBuilder('test_hyp', 'root');
  builder.addNode({ id: 'root', type: 'internal', parentId: null, children: ['n1', 'n2'] });
  builder.addNode({ id: 'n1', type: 'internal', parentId: 'root', children: ['t1', 't2'] });
  builder.addNode({ id: 'n2', type: 'internal', parentId: 'root', children: ['t3', 't4'] });
  builder.addNode({ id: 't1', type: 'terminal', parentId: 'n1', children: [], taxonId: 'tax_a' });
  builder.addNode({ id: 't2', type: 'terminal', parentId: 'n1', children: [], taxonId: 'tax_b' });
  builder.addNode({ id: 't3', type: 'terminal', parentId: 'n2', children: [], taxonId: 'tax_c' });
  builder.addNode({ id: 't4', type: 'terminal', parentId: 'n2', children: [], taxonId: 'tax_d' });

  const taxonomy = {
    tax_a: { id: 'tax_a', name: 'Species A', rank: 'species' },
    tax_b: { id: 'tax_b', name: 'Species B', rank: 'species' },
    tax_c: { id: 'tax_c', name: 'Species C', rank: 'species' },
    tax_d: { id: 'tax_d', name: 'Species D', rank: 'species' }
  };

  return builder.build(taxonomy);
}

test('Immutability - getTaxonForTerminal returns defensive copy', () => {
  const graph = createTestGraph();
  const originalTaxon = graph.getTaxonForTerminal('t1');
  const originalName = originalTaxon.name;

  // Attempt mutation
  originalTaxon.name = 'MUTATED_NAME';
  originalTaxon.rank = 'MUTATED_RANK';

  // Verify graph's internal taxon is unchanged
  const taxonAfter = graph.getTaxonForTerminal('t1');
  assert.strictEqual(taxonAfter.name, originalName, 'Taxon name should be unchanged');
  assert.strictEqual(taxonAfter.rank, 'species', 'Taxon rank should be unchanged');
});

test('Immutability - getNode returns defensive copy', () => {
  const graph = createTestGraph();
  const originalNode = graph.getNode('root');
  const originalChildren = [...originalNode.children];

  // Attempt mutations
  originalNode.type = 'MUTATED_TYPE';
  originalNode.parentId = 'MUTATED_PARENT';
  originalNode.children.push('FAKE_CHILD');

  // Verify graph's internal node is unchanged
  const nodeAfter = graph.getNode('root');
  assert.strictEqual(nodeAfter.type, 'internal', 'Node type should be unchanged');
  assert.strictEqual(nodeAfter.parentId, null, 'Node parentId should be unchanged');
  assert.deepStrictEqual(nodeAfter.children, originalChildren, 'Node children should be unchanged');
});

test('Immutability - getNodes returns defensive copies', () => {
  const graph = createTestGraph();
  const nodesMap1 = graph.getNodes();
  const rootNode1 = nodesMap1.get('root');

  // Attempt mutation through Map
  rootNode1.type = 'MUTATED_TYPE';
  rootNode1.children.push('FAKE_CHILD');

  // Verify original is unchanged
  const nodesMap2 = graph.getNodes();
  const rootNode2 = nodesMap2.get('root');
  assert.strictEqual(rootNode2.type, 'internal', 'Node type through getNodes should be unchanged');
  assert.strictEqual(rootNode2.children.length, 2, 'Node children through getNodes should be unchanged');
});

test('Immutability - getChildren returns defensive copy', () => {
  const graph = createTestGraph();
  const children1 = graph.getChildren('root');
  const originalLength = children1.length;

  // Attempt mutation
  children1.push('FAKE_CHILD');
  children1[0] = 'MUTATED_CHILD';

  // Verify graph's internal data is unchanged
  const children2 = graph.getChildren('root');
  assert.strictEqual(children2.length, originalLength, 'Children array length should be unchanged');
  assert.notStrictEqual(children2[0], 'MUTATED_CHILD', 'Children array should not be mutated');
});

test('Immutability - getPathToRoot returns defensive copy', () => {
  const graph = createTestGraph();
  const path1 = graph.getPathToRoot('t1');
  const originalLength = path1.length;

  // Attempt mutation
  path1.push('FAKE_NODE');
  path1[0] = 'MUTATED_NODE';

  // Verify graph's internal data is unchanged
  const path2 = graph.getPathToRoot('t1');
  assert.strictEqual(path2.length, originalLength, 'Path length should be unchanged');
  assert.notStrictEqual(path2[0], 'MUTATED_NODE', 'Path should not be mutated');
});

test('Immutability - GraphBuilder data does not leak into finalized graph', () => {
  const builder = new GraphBuilder('test_hyp', 'root');
  builder.addNode({ id: 'root', type: 'internal', parentId: null, children: ['child'] });
  builder.addNode({ id: 'child', type: 'terminal', parentId: 'root', children: [], taxonId: 'tax_a' });

  const taxonomy = { tax_a: { id: 'tax_a', name: 'Original' } };
  const graph = builder.build(taxonomy);

  // Mutate original taxonomy and builder data
  taxonomy.tax_a.name = 'MUTATED';
  const builderNode = builder.nodeMap['root'];
  if (builderNode) builderNode.type = 'MUTATED_TYPE';

  // Verify graph's data is unchanged
  const graphNode = graph.getNode('root');
  assert.strictEqual(graphNode.type, 'internal', 'Node type should not be affected by builder mutation');

  const taxon = graph.getTaxonForTerminal('child');
  assert.strictEqual(taxon.name, 'Original', 'Taxon name should not be affected by taxonomy mutation');
});

test('Immutability - pruned graph has independent taxonomy', () => {
  const original = createTestGraph();
  const pruned = buildPrunedGraph(original, ['t1', 't2']);

  // Mutate through original graph
  const originalTaxon = original.getTaxonForTerminal('t1');
  originalTaxon.name = 'MUTATED_IN_ORIGINAL';

  // Verify pruned graph is unchanged
  const prunedTaxon = pruned.getTaxonForTerminal('t1');
  assert.strictEqual(prunedTaxon.name, 'Species A', 'Pruned graph taxonomy should be independent');
});

test('Immutability - pruned graph mutations do not affect original', () => {
  const original = createTestGraph();
  const pruned = buildPrunedGraph(original, ['t1', 't2']);

  // Mutate through pruned graph
  const prunedTaxon = pruned.getTaxonForTerminal('t1');
  prunedTaxon.name = 'MUTATED_IN_PRUNED';

  // Verify original graph is unchanged
  const originalTaxon = original.getTaxonForTerminal('t1');
  assert.strictEqual(originalTaxon.name, 'Species A', 'Original graph taxonomy should be unaffected by pruned mutations');
});

test('Immutability - pruned graph has independent node data', () => {
  const original = createTestGraph();
  const pruned = buildPrunedGraph(original, ['t1', 't2']);

  // Mutate through original graph
  const originalNode = original.getNode('n1');
  originalNode.type = 'MUTATED_TYPE';
  originalNode.children.push('FAKE_CHILD');

  // Verify pruned graph is unchanged
  const prunedNode = pruned.getNode('n1');
  assert.strictEqual(prunedNode.type, 'internal', 'Pruned graph node type should be independent');
  assert.strictEqual(prunedNode.children.length, 2, 'Pruned graph node children should be independent');
});

test('Immutability - Object.freeze applied to finalized graph', () => {
  const graph = createTestGraph();

  // Verify the graph object is frozen
  assert.throws(() => {
    graph.newProperty = 'value';
  }, TypeError, 'Should not be able to add properties to frozen graph');
});

test('Immutability - first-level nested data is independent', () => {
  const builder = new GraphBuilder('test_hyp', 'root');
  builder.addNode({
    id: 'root',
    type: 'internal',
    parentId: null,
    children: ['child'],
    metadata: { extra: { nested: 'value' } }
  });
  builder.addNode({ id: 'child', type: 'terminal', parentId: 'root', children: [], taxonId: 'tax_a' });

  const graph = builder.build();

  // Get node and verify metadata is copied at first level
  const node = graph.getNode('root');
  assert.strictEqual(node.metadata.extra.nested, 'value', 'Metadata should exist');

  // Verify that the metadata object itself is a copy (first level)
  node.metadata.extra = { nested: 'MUTATED' };

  // Get node again and verify metadata.extra is unchanged (because we copied it)
  const nodeAfter = graph.getNode('root');
  assert.strictEqual(nodeAfter.metadata.extra.nested, 'value', 'Metadata.extra should be independent from first-level copy');
});

test('Immutability - node array modifications do not persist', () => {
  const graph = createTestGraph();

  // Get node with children array
  const node1 = graph.getNode('root');
  node1.children.length = 0; // Clear the array
  node1.children.push('FAKE_CHILD');

  // Get node again and verify children are unchanged
  const node2 = graph.getNode('root');
  assert.strictEqual(node2.children.length, 2, 'Children array should not be modified');
  assert.notStrictEqual(node2.children[0], 'FAKE_CHILD', 'Children should not contain fake entries');
});
