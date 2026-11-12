import { test } from 'node:test';
import assert from 'assert/strict';
import { VisualizationAdapter } from '../visualization/visualizationAdapter.js';
import { GraphBuilder } from '../graph/PhyloGraph.js';

// Simple test fixture
const testHypothesis = {
  hypothesisId: 'test_h1',
  rootNodeId: 'ancestor_test_n0',
  nodes: [
    { id: 'ancestor_test_n0', type: 'internal', parentId: null, children: ['tax_human', 'ancestor_test_n1'] },
    { id: 'ancestor_test_n1', type: 'internal', parentId: 'ancestor_test_n0', children: ['tax_chimp', 'tax_bonobo'] },
    { id: 'tax_human', type: 'terminal', parentId: 'ancestor_test_n0', taxonId: 'tax_human' },
    { id: 'tax_chimp', type: 'terminal', parentId: 'ancestor_test_n1', taxonId: 'tax_chimp' },
    { id: 'tax_bonobo', type: 'terminal', parentId: 'ancestor_test_n1', taxonId: 'tax_bonobo' }
  ]
};

const testTaxonomy = {
  tax_human: { scientificName: 'Homo sapiens', commonName: 'Human' },
  tax_chimp: { scientificName: 'Pan troglodytes', commonName: 'Chimpanzee' },
  tax_bonobo: { scientificName: 'Pan paniscus', commonName: 'Bonobo' }
};

test('Stage 2: Terminal species label rendering', async (t) => {
  await t.test('Visualization nodes have commonName and scientificName', () => {
    const graphBuilder = new GraphBuilder('test_h1', 'ancestor_test_n0');
    for (const node of testHypothesis.nodes) {
      graphBuilder.addNode(node);
    }
    const graph = graphBuilder.build(testTaxonomy);
    const adapter = new VisualizationAdapter(graph, testTaxonomy);
    const { nodes } = adapter.adapt();

    // Check terminal species have both names
    const humanNode = nodes.find(n => n.taxonId === 'tax_human');
    assert.ok(humanNode, 'Human node should exist');
    assert.strictEqual(humanNode.commonName, 'Human', 'Human should have commonName');
    assert.strictEqual(humanNode.scientificName, 'Homo sapiens', 'Human should have scientificName');

    const chimpNode = nodes.find(n => n.taxonId === 'tax_chimp');
    assert.ok(chimpNode, 'Chimp node should exist');
    assert.strictEqual(chimpNode.commonName, 'Chimpanzee', 'Chimp should have commonName');
    assert.strictEqual(chimpNode.scientificName, 'Pan troglodytes', 'Chimp should have scientificName');

    // Check internal nodes don't have names
    const ancestorNode = nodes.find(n => n.id === 'ancestor_test_n0');
    assert.ok(ancestorNode, 'Ancestor node should exist');
    assert.strictEqual(ancestorNode.commonName, null, 'Ancestor should not have commonName');
    assert.strictEqual(ancestorNode.scientificName, null, 'Ancestor should not have scientificName');
  });

  await t.test('All terminal nodes have commonName and scientificName in mammal dataset', () => {
    const graphBuilder = new GraphBuilder('test_h1', 'ancestor_test_n0');
    for (const node of testHypothesis.nodes) {
      graphBuilder.addNode(node);
    }
    const graph = graphBuilder.build(testTaxonomy);
    const adapter = new VisualizationAdapter(graph, testTaxonomy);
    const { nodes } = adapter.adapt();

    const terminalNodes = nodes.filter(n => n.type === 'terminal');
    assert.ok(terminalNodes.length > 0, 'Should have terminal nodes');

    for (const node of terminalNodes) {
      assert.ok(node.commonName !== undefined, `Terminal node ${node.id} should have commonName field`);
      assert.ok(node.scientificName !== undefined, `Terminal node ${node.id} should have scientificName field`);
    }
  });
});
