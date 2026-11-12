/**
 * Tests for PhyloGraph and GraphBuilder
 */

import test from 'node:test';
import assert from 'node:assert';
import { PhyloGraph, GraphBuilder } from './PhyloGraph.js';

test('GraphBuilder - constructs valid graph', () => {
  const builder = new GraphBuilder('test_hyp', 'root');
  builder.addNode({ id: 'root', type: 'internal', parentId: null, children: ['child1', 'child2'] });
  builder.addNode({ id: 'child1', type: 'terminal', parentId: 'root', children: [], taxonId: 'tax_a' });
  builder.addNode({ id: 'child2', type: 'terminal', parentId: 'root', children: [], taxonId: 'tax_b' });

  const graph = builder.build();
  assert(graph instanceof PhyloGraph);
});

test('GraphBuilder - validates no duplicate nodes', () => {
  const builder = new GraphBuilder('test_hyp', 'root');
  builder.addNode({ id: 'root', type: 'internal', parentId: null, children: [] });

  assert.throws(() => {
    builder.addNode({ id: 'root', type: 'internal', parentId: null, children: [] });
  });
});

test('GraphBuilder - validates parent exists', () => {
  const builder = new GraphBuilder('test_hyp', 'root');
  builder.addNode({ id: 'root', type: 'internal', parentId: null, children: ['missing'] });
  builder.addNode({ id: 'child', type: 'terminal', parentId: 'nonexistent', children: [] });

  assert.throws(() => {
    builder.validate();
  });
});

test('GraphBuilder - validates all nodes reachable from root', () => {
  const builder = new GraphBuilder('test_hyp', 'root');
  builder.addNode({ id: 'root', type: 'internal', parentId: null, children: ['child1'] });
  builder.addNode({ id: 'child1', type: 'terminal', parentId: 'root', children: [], taxonId: 'tax_a' });
  builder.addNode({ id: 'orphan', type: 'terminal', parentId: null, children: [], taxonId: 'tax_b' });

  assert.throws(() => {
    builder.validate();
  });
});

test('PhyloGraph - prevents modification after construction', () => {
  const builder = new GraphBuilder('test_hyp', 'root');
  builder.addNode({ id: 'root', type: 'internal', parentId: null, children: ['child'] });
  builder.addNode({ id: 'child', type: 'terminal', parentId: 'root', children: [], taxonId: 'tax_a' });
  const graph = builder.build();

  // Graph object itself is frozen, so adding properties should fail
  assert.throws(() => {
    graph.newProperty = 'value';
  }, TypeError);
});

test('PhyloGraph - queries parent correctly', () => {
  const builder = new GraphBuilder('test_hyp', 'root');
  builder.addNode({ id: 'root', type: 'internal', parentId: null, children: ['child'] });
  builder.addNode({ id: 'child', type: 'terminal', parentId: 'root', children: [], taxonId: 'tax_a' });
  const graph = builder.build();

  assert.strictEqual(graph.getParent('child'), 'root');
  assert.strictEqual(graph.getParent('root'), null);
});

test('PhyloGraph - queries children correctly', () => {
  const builder = new GraphBuilder('test_hyp', 'root');
  builder.addNode({ id: 'root', type: 'internal', parentId: null, children: ['child1', 'child2'] });
  builder.addNode({ id: 'child1', type: 'terminal', parentId: 'root', children: [], taxonId: 'tax_a' });
  builder.addNode({ id: 'child2', type: 'terminal', parentId: 'root', children: [], taxonId: 'tax_b' });
  const graph = builder.build();

  const children = graph.getChildren('root');
  assert.strictEqual(children.length, 2);
  assert(children.includes('child1'));
  assert(children.includes('child2'));
});

test('PhyloGraph - path to root includes node itself', () => {
  const builder = new GraphBuilder('test_hyp', 'root');
  builder.addNode({ id: 'root', type: 'internal', parentId: null, children: ['mid'] });
  builder.addNode({ id: 'mid', type: 'internal', parentId: 'root', children: ['leaf'] });
  builder.addNode({ id: 'leaf', type: 'terminal', parentId: 'mid', children: [], taxonId: 'tax_a' });
  const graph = builder.build();

  const path = graph.getPathToRoot('leaf');
  assert.deepStrictEqual(path, ['leaf', 'mid', 'root']);
});

test('PhyloGraph - MRCA of same node is itself', () => {
  const builder = new GraphBuilder('test_hyp', 'root');
  builder.addNode({ id: 'root', type: 'internal', parentId: null, children: ['child'] });
  builder.addNode({ id: 'child', type: 'terminal', parentId: 'root', children: [], taxonId: 'tax_a' });
  const graph = builder.build();

  assert.strictEqual(graph.getMRCA('child', 'child'), 'child');
});

test('PhyloGraph - MRCA of siblings is parent', () => {
  const builder = new GraphBuilder('test_hyp', 'root');
  builder.addNode({ id: 'root', type: 'internal', parentId: null, children: ['child1', 'child2'] });
  builder.addNode({ id: 'child1', type: 'terminal', parentId: 'root', children: [], taxonId: 'tax_a' });
  builder.addNode({ id: 'child2', type: 'terminal', parentId: 'root', children: [], taxonId: 'tax_b' });
  const graph = builder.build();

  assert.strictEqual(graph.getMRCA('child1', 'child2'), 'root');
});

test('PhyloGraph - MRCA of ancestor-descendant is ancestor', () => {
  const builder = new GraphBuilder('test_hyp', 'root');
  builder.addNode({ id: 'root', type: 'internal', parentId: null, children: ['mid'] });
  builder.addNode({ id: 'mid', type: 'internal', parentId: 'root', children: ['leaf1', 'leaf2'] });
  builder.addNode({ id: 'leaf1', type: 'terminal', parentId: 'mid', children: [], taxonId: 'tax_a' });
  builder.addNode({ id: 'leaf2', type: 'terminal', parentId: 'mid', children: [], taxonId: 'tax_b' });
  const graph = builder.build();

  assert.strictEqual(graph.getMRCA('root', 'leaf1'), 'root');
});

test('PhyloGraph - gets terminals', () => {
  const builder = new GraphBuilder('test_hyp', 'root');
  builder.addNode({ id: 'root', type: 'internal', parentId: null, children: ['child1', 'child2'] });
  builder.addNode({ id: 'child1', type: 'terminal', parentId: 'root', children: [], taxonId: 'tax_a' });
  builder.addNode({ id: 'child2', type: 'terminal', parentId: 'root', children: [], taxonId: 'tax_b' });
  const graph = builder.build();

  const terminals = graph.getTerminals();
  assert.strictEqual(terminals.length, 2);
});

test('PhyloGraph - gets internals', () => {
  const builder = new GraphBuilder('test_hyp', 'root');
  builder.addNode({ id: 'root', type: 'internal', parentId: null, children: ['mid'] });
  builder.addNode({ id: 'mid', type: 'internal', parentId: 'root', children: ['leaf'] });
  builder.addNode({ id: 'leaf', type: 'terminal', parentId: 'mid', children: [], taxonId: 'tax_a' });
  const graph = builder.build();

  const internals = graph.getInternals();
  assert.strictEqual(internals.length, 2);
  assert(internals.includes('root'));
  assert(internals.includes('mid'));
});

test('PhyloGraph - validates tree integrity', () => {
  const builder = new GraphBuilder('test_hyp', 'root');
  builder.addNode({ id: 'root', type: 'internal', parentId: null, children: ['child'] });
  builder.addNode({ id: 'child', type: 'terminal', parentId: 'root', children: [], taxonId: 'tax_a' });
  const graph = builder.build();

  const result = graph.validate();
  assert(result.isValid);
  assert.strictEqual(result.errors.length, 0);
});

test('PhyloGraph - path to root is cached', () => {
  const builder = new GraphBuilder('test_hyp', 'root');
  builder.addNode({ id: 'root', type: 'internal', parentId: null, children: ['child'] });
  builder.addNode({ id: 'child', type: 'terminal', parentId: 'root', children: [], taxonId: 'tax_a' });
  const graph = builder.build();

  const path1 = graph.getPathToRoot('child');
  const path2 = graph.getPathToRoot('child');

  // Should be different array objects but with same content (cached immutable copy)
  assert.deepStrictEqual(path1, path2);
});

test('PhyloGraph - getTaxonForTerminal', () => {
  const builder = new GraphBuilder('test_hyp', 'root');
  builder.addNode({ id: 'root', type: 'internal', parentId: null, children: ['child'] });
  builder.addNode({ id: 'child', type: 'terminal', parentId: 'root', children: [], taxonId: 'tax_a' });
  const graph = builder.build({ tax_a: { id: 'tax_a', scientificName: 'Test Species' } });

  const taxon = graph.getTaxonForTerminal('child');
  assert.strictEqual(taxon.scientificName, 'Test Species');
});

test('PhyloGraph - hasNode checks existence', () => {
  const builder = new GraphBuilder('test_hyp', 'root');
  builder.addNode({ id: 'root', type: 'internal', parentId: null, children: [] });
  const graph = builder.build();

  assert(graph.hasNode('root'));
  assert(!graph.hasNode('nonexistent'));
});

test('GraphBuilder - throws on invalid node', () => {
  const builder = new GraphBuilder('test_hyp', 'root');
  builder.addNode({ id: 'root', type: 'internal', parentId: null, children: ['child'] });

  assert.throws(() => {
    builder.validate();
  });
});
