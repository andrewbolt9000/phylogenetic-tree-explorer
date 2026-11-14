/**
 * Visualization Adapter - Taxonomic Summary Pass-Through Tests
 *
 * Verifies that taxonomic_summary metadata from graph nodes is properly
 * copied (shallow copy for independence) into visualization nodes.
 */

import test from 'node:test';
import assert from 'node:assert';
import { GraphBuilder } from '../graph/PhyloGraph.js';
import { VisualizationAdapter } from '../visualization/visualizationAdapter.js';

// Helper to create a test graph with taxonomic metadata
function createTestGraphWithTaxonomy() {
  const hypothesis = {
    hypothesisId: 'test_h1',
    rootNodeId: 'ancestor_h1_n0',
    nodes: [
      {
        id: 'ancestor_h1_n0',
        type: 'internal',
        parentId: null,
        children: ['ancestor_h1_n1', 'tax_a'],
        // Root node with taxonomic summary
        taxonomic_summary: {
          name: 'Chordata',
          rank: 'Phylum',
          method: 'deepest_shared_descendant_taxon',
          source: 'GBIF',
          descendant_species_count: 2
        }
      },
      {
        id: 'ancestor_h1_n1',
        type: 'internal',
        parentId: 'ancestor_h1_n0',
        children: ['tax_b', 'tax_c'],
        // Internal node with taxonomic summary
        taxonomic_summary: {
          name: 'Mammalia',
          rank: 'Class',
          method: 'deepest_shared_descendant_taxon',
          source: 'GBIF',
          descendant_species_count: 2
        }
      },
      {
        id: 'tax_a',
        type: 'terminal',
        parentId: 'ancestor_h1_n0',
        taxonId: 'tax_a',
        children: []
        // Terminal node: no taxonomic_summary
      },
      {
        id: 'tax_b',
        type: 'terminal',
        parentId: 'ancestor_h1_n1',
        taxonId: 'tax_b',
        children: []
        // Terminal node: no taxonomic_summary
      },
      {
        id: 'tax_c',
        type: 'terminal',
        parentId: 'ancestor_h1_n1',
        taxonId: 'tax_c',
        children: []
        // Terminal node: no taxonomic_summary
      }
    ]
  };

  const taxonomy = {
    'tax_a': { id: 'tax_a', scientificName: 'Species A', rank: 'species' },
    'tax_b': { id: 'tax_b', scientificName: 'Species B', rank: 'species' },
    'tax_c': { id: 'tax_c', scientificName: 'Species C', rank: 'species' }
  };

  const builder = new GraphBuilder(hypothesis.hypothesisId, hypothesis.rootNodeId);
  for (const node of hypothesis.nodes) {
    builder.addNode(node);
  }
  const graph = builder.build(taxonomy);

  return { graph, taxonomy, hypothesis };
}

test('Visualization Adapter - Taxonomic Summary Pass-Through', async (t) => {
  await t.test('Node with taxonomic_summary retains all metadata', () => {
    const { graph, taxonomy } = createTestGraphWithTaxonomy();
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    // Find the root node (ancestor_h1_n0)
    const rootVizNode = nodes.find(n => n.id === 'ancestor_h1_n0');
    assert.ok(rootVizNode, 'Should find root visualization node');
    assert.ok(rootVizNode.taxonomic_summary, 'Root should have taxonomic_summary');

    // Verify all properties are preserved
    assert.strictEqual(rootVizNode.taxonomic_summary.name, 'Chordata', 'Should preserve name');
    assert.strictEqual(rootVizNode.taxonomic_summary.rank, 'Phylum', 'Should preserve rank');
    assert.strictEqual(
      rootVizNode.taxonomic_summary.method,
      'deepest_shared_descendant_taxon',
      'Should preserve method'
    );
    assert.strictEqual(rootVizNode.taxonomic_summary.source, 'GBIF', 'Should preserve source');
    assert.strictEqual(
      rootVizNode.taxonomic_summary.descendant_species_count,
      2,
      'Should preserve descendant_species_count'
    );
  });

  await t.test('Taxonomic summary is a shallow copy (independent object)', () => {
    const { graph, taxonomy } = createTestGraphWithTaxonomy();
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    // Get the internal node with taxonomy
    const internalVizNode = nodes.find(n => n.id === 'ancestor_h1_n1');
    assert.ok(internalVizNode, 'Should find internal visualization node');
    assert.ok(internalVizNode.taxonomic_summary, 'Should have taxonomic_summary');

    // Get the original graph node
    const graphNodesMap = graph.getNodes();
    const graphNode = graphNodesMap.get('ancestor_h1_n1');

    // Verify they are not the same object reference
    assert.notStrictEqual(
      internalVizNode.taxonomic_summary,
      graphNode.taxonomic_summary,
      'Visualization taxonomic_summary should be a different object from graph node'
    );

    // Modify the visualization copy and verify the original is unchanged
    internalVizNode.taxonomic_summary.name = 'Modified';
    assert.strictEqual(
      graphNode.taxonomic_summary.name,
      'Mammalia',
      'Original graph node should be unchanged after modifying visualization copy'
    );

    // Restore for next tests
    internalVizNode.taxonomic_summary.name = 'Mammalia';
  });

  await t.test('Node without taxonomic_summary has undefined taxonomic_summary', () => {
    const { graph, taxonomy } = createTestGraphWithTaxonomy();
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    // Terminal nodes should not have taxonomic_summary
    const terminalVizNode = nodes.find(n => n.id === 'tax_a');
    assert.ok(terminalVizNode, 'Should find terminal visualization node');
    assert.strictEqual(
      terminalVizNode.taxonomic_summary,
      undefined,
      'Terminal node should have undefined taxonomic_summary'
    );
  });

  await t.test('Multiple nodes can have independent taxonomic_summary copies', () => {
    const { graph, taxonomy } = createTestGraphWithTaxonomy();
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    const rootVizNode = nodes.find(n => n.id === 'ancestor_h1_n0');
    const internalVizNode = nodes.find(n => n.id === 'ancestor_h1_n1');

    assert.ok(rootVizNode.taxonomic_summary, 'Root should have taxonomic_summary');
    assert.ok(internalVizNode.taxonomic_summary, 'Internal node should have taxonomic_summary');

    // Verify they are different objects
    assert.notStrictEqual(
      rootVizNode.taxonomic_summary,
      internalVizNode.taxonomic_summary,
      'Different nodes should have different taxonomic_summary objects'
    );

    // Verify the content is different
    assert.notStrictEqual(
      rootVizNode.taxonomic_summary.rank,
      internalVizNode.taxonomic_summary.rank,
      'Different nodes should have different taxonomy ranks'
    );
  });

  await t.test('Visualization nodes retain other properties alongside taxonomic_summary', () => {
    const { graph, taxonomy } = createTestGraphWithTaxonomy();
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    const rootVizNode = nodes.find(n => n.id === 'ancestor_h1_n0');

    // Verify that taxonomic_summary does not interfere with other properties
    assert.ok(rootVizNode.id, 'Should have id');
    assert.strictEqual(rootVizNode.type, 'internal', 'Should have type');
    assert.strictEqual(rootVizNode.parentId, null, 'Should have parentId');
    assert.ok(rootVizNode.label, 'Should have label');
    assert.strictEqual(typeof rootVizNode.x, 'number', 'Should have numeric x');
    assert.strictEqual(typeof rootVizNode.y, 'number', 'Should have numeric y');
    assert.ok(rootVizNode.taxonomic_summary, 'Should have taxonomic_summary');
  });

  await t.test('Mammals dataset nodes (without taxonomic_summary) continue to work', () => {
    // Create a simple graph without any taxonomic_summary fields
    const hypothesis = {
      hypothesisId: 'mammals_h1',
      rootNodeId: 'ancestor_mammals_n0',
      nodes: [
        {
          id: 'ancestor_mammals_n0',
          type: 'internal',
          parentId: null,
          children: ['tax_mammal_a']
        },
        {
          id: 'tax_mammal_a',
          type: 'terminal',
          parentId: 'ancestor_mammals_n0',
          taxonId: 'tax_mammal_a',
          children: []
        }
      ]
    };

    const taxonomy = {
      'tax_mammal_a': { id: 'tax_mammal_a', scientificName: 'Canis lupus', rank: 'species' }
    };

    const builder = new GraphBuilder(hypothesis.hypothesisId, hypothesis.rootNodeId);
    for (const node of hypothesis.nodes) {
      builder.addNode(node);
    }
    const graph = builder.build(taxonomy);

    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    // All nodes should have undefined taxonomic_summary
    for (const node of nodes) {
      assert.strictEqual(
        node.taxonomic_summary,
        undefined,
        `Node ${node.id} should have undefined taxonomic_summary for Mammals dataset`
      );
    }

    // Verify other properties still work
    const rootNode = nodes.find(n => n.type === 'internal');
    assert.ok(rootNode, 'Should have internal node');
    assert.ok(rootNode.label, 'Should have label');
  });

  await t.test('Taxonomic summary with all five standard properties', () => {
    const { graph, taxonomy } = createTestGraphWithTaxonomy();
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    const rootVizNode = nodes.find(n => n.id === 'ancestor_h1_n0');
    const summary = rootVizNode.taxonomic_summary;

    // Verify all five properties exist
    assert.ok(summary.hasOwnProperty('name'), 'Should have name property');
    assert.ok(summary.hasOwnProperty('rank'), 'Should have rank property');
    assert.ok(summary.hasOwnProperty('method'), 'Should have method property');
    assert.ok(summary.hasOwnProperty('source'), 'Should have source property');
    assert.ok(summary.hasOwnProperty('descendant_species_count'), 'Should have descendant_species_count property');

    // Verify property types
    assert.strictEqual(typeof summary.name, 'string', 'name should be string');
    assert.strictEqual(typeof summary.rank, 'string', 'rank should be string');
    assert.strictEqual(typeof summary.method, 'string', 'method should be string');
    assert.strictEqual(typeof summary.source, 'string', 'source should be string');
    assert.strictEqual(typeof summary.descendant_species_count, 'number', 'descendant_species_count should be number');
  });

  await t.test('Adapter.snapshotVisualizationState includes taxonomic_summary', () => {
    const { graph, taxonomy } = createTestGraphWithTaxonomy();
    const adapter = new VisualizationAdapter(graph, taxonomy);
    adapter.adapt();

    const snapshot = adapter.snapshotVisualizationState();

    const snapshotRoot = snapshot.nodes.find(n => n.id === 'ancestor_h1_n0');
    assert.ok(snapshotRoot, 'Snapshot should include root node');
    assert.ok(snapshotRoot.taxonomic_summary, 'Snapshot should preserve taxonomic_summary');
    assert.strictEqual(snapshotRoot.taxonomic_summary.name, 'Chordata', 'Snapshot taxonomic_summary should have correct data');
  });
});
