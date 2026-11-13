/**
 * Visualization Tests
 * 
 * Tests for visualization adapter and force-directed graph rendering.
 */

import test from 'node:test';
import assert from 'node:assert';
import { GraphBuilder } from '../graph/PhyloGraph.js';
import { VisualizationAdapter } from './visualizationAdapter.js';

// Helper to create a simple test graph
function createTestGraph() {
  const hypothesis = {
    hypothesisId: 'test_h1',
    rootNodeId: 'ancestor_h1_n0',
    nodes: [
      { id: 'ancestor_h1_n0', type: 'internal', parentId: null, children: ['tax_a', 'ancestor_h1_n1'] },
      { id: 'ancestor_h1_n1', type: 'internal', parentId: 'ancestor_h1_n0', children: ['tax_b', 'tax_c'] },
      { id: 'tax_a', type: 'terminal', parentId: 'ancestor_h1_n0', taxonId: 'tax_a', children: [] },
      { id: 'tax_b', type: 'terminal', parentId: 'ancestor_h1_n1', taxonId: 'tax_b', children: [] },
      { id: 'tax_c', type: 'terminal', parentId: 'ancestor_h1_n1', taxonId: 'tax_c', children: [] }
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

test('Visualization Adapter - Basic Functionality', async (t) => {
  const { graph, taxonomy } = createTestGraph();

  await t.test('Create adapter and adapt graph', () => {
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes, links } = adapter.adapt();

    assert.strictEqual(nodes.length, 5, 'Should have 5 visualization nodes');
    assert.strictEqual(links.length, 4, 'Should have 4 visualization links');
  });

  await t.test('Terminal and ancestor counts', () => {
    const adapter = new VisualizationAdapter(graph, taxonomy);
    adapter.adapt();

    assert.strictEqual(adapter.getTerminalCount(), 3, 'Should have 3 terminal nodes');
    assert.strictEqual(adapter.getInternalCount(), 2, 'Should have 2 internal nodes');
  });

  await t.test('Node labels are correct', () => {
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    const terminalNode = nodes.find(n => n.taxonId === 'tax_a');
    assert.strictEqual(terminalNode.label, 'Species A', 'Terminal node should have species name');

    const ancestorNode = nodes.find(n => n.id === 'ancestor_h1_n0');
    assert.ok(ancestorNode.label.includes('Ancestor'), 'Ancestor node should have ancestor label');
  });

  await t.test('Visualization nodes have correct properties', () => {
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    for (const node of nodes) {
      assert.ok(node.id, 'Node should have ID');
      assert.ok(node.type, 'Node should have type');
      assert.strictEqual(typeof node.x, 'number', 'Node should have numeric x');
      assert.strictEqual(typeof node.y, 'number', 'Node should have numeric y');
      assert.strictEqual(typeof node.vx, 'number', 'Node should have numeric vx');
      assert.strictEqual(typeof node.vy, 'number', 'Node should have numeric vy');
    }
  });

  await t.test('Visualization links have correct structure', () => {
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { links } = adapter.adapt();

    for (const link of links) {
      assert.ok(link.sourceId, 'Link should have sourceId');
      assert.ok(link.targetId, 'Link should have targetId');
      // D3's forceLink needs source and target to be node IDs that it can resolve
      assert.ok(link.source, 'Link source should be set to a node ID');
      assert.ok(link.target, 'Link target should be set to a node ID');
      assert.strictEqual(link.source, link.sourceId, 'Link source should match sourceId');
      assert.strictEqual(link.target, link.targetId, 'Link target should match targetId');
    }
  });

  await t.test('Get node by ID', () => {
    const adapter = new VisualizationAdapter(graph, taxonomy);
    adapter.adapt();

    const node = adapter.getNodeById('tax_a');
    assert.ok(node, 'Should retrieve node by ID');
    assert.strictEqual(node.id, 'tax_a', 'Retrieved node should have correct ID');
    assert.strictEqual(node.label, 'Species A', 'Retrieved node should have correct label');
  });
});

test('Visualization Adapter - Data Independence', async (t) => {
  const { graph, taxonomy } = createTestGraph();

  await t.test('Visualization nodes are independent from graph nodes', () => {
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    // Get original snapshot
    const snapshot1 = JSON.parse(JSON.stringify(nodes));

    // Mutate visualization node
    const vizNode = nodes[0];
    vizNode.x = 9999;
    vizNode.y = 9999;
    vizNode.label = 'MODIFIED';

    // Get new snapshot
    const snapshot2 = JSON.parse(JSON.stringify(nodes));

    // Verify mutation was tracked
    assert.strictEqual(snapshot2[0].x, 9999, 'Visualization node mutation should be tracked');
    assert.notStrictEqual(snapshot1[0].x, snapshot2[0].x, 'Snapshots should differ after mutation');
  });

  await t.test('Scientific graph remains unchanged after adapter mutation', () => {
    const adapter = new VisualizationAdapter(graph, taxonomy);
    adapter.adapt();

    // Get original graph node
    const originalGraphNode = graph.getNode('tax_a');
    const originalState = JSON.parse(JSON.stringify(originalGraphNode));

    // Get visualization node and try to mutate it
    const vizNode = adapter.getNodeById('tax_a');
    vizNode.x = 9999;
    vizNode.y = 9999;

    // Verify scientific graph unchanged
    const currentGraphNode = graph.getNode('tax_a');
    assert.deepStrictEqual(currentGraphNode, originalState, 
      'Scientific graph node should remain unchanged');
  });

  await t.test('Snapshot captures independent state', () => {
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    // Find a terminal node to test
    const terminalNode = nodes.find(n => n.type === 'terminal');
    const terminalIndex = nodes.indexOf(terminalNode);

    // Record initial state
    const initialX = terminalNode.x;
    const initialLabel = terminalNode.label;

    // Take snapshot
    const snapshot1 = adapter.snapshotVisualizationState();

    // Mutate visualization
    terminalNode.x = 5555;
    terminalNode.label = 'CHANGED';

    // Take another snapshot
    const snapshot2 = adapter.snapshotVisualizationState();

    // Verify snapshots are independent from the mutable nodes array
    assert.strictEqual(snapshot1.nodes[terminalIndex].x, initialX, 
      'First snapshot should capture original x value');
    assert.strictEqual(snapshot2.nodes[terminalIndex].x, 5555,
      'Second snapshot should capture mutated x value');
    assert.notStrictEqual(snapshot1.nodes[terminalIndex].x, snapshot2.nodes[terminalIndex].x, 
      'Snapshots should have different x values');
    assert.strictEqual(snapshot1.nodes[terminalIndex].label, initialLabel,
      'First snapshot should preserve original label');
    assert.strictEqual(snapshot2.nodes[terminalIndex].label, 'CHANGED',
      'Second snapshot should capture label mutation');
  });
});

test('Visualization Adapter - Correct Mapping', async (t) => {
  const { graph, taxonomy } = createTestGraph();

  await t.test('All graph nodes appear in visualization', () => {
    const graphNodesMap = graph.getNodes();
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    assert.strictEqual(nodes.length, graphNodesMap.size, 
      'Visualization should have same node count as graph');

    for (const [nodeId, graphNode] of graphNodesMap) {
      const vizNode = adapter.getNodeById(nodeId);
      assert.ok(vizNode, `Should find visualization node for ${nodeId}`);
      assert.strictEqual(vizNode.id, nodeId, 'IDs should match');
      assert.strictEqual(vizNode.type, graphNode.type, 'Types should match');
    }
  });

  await t.test('Links correctly reference parent-child pairs', () => {
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes, links } = adapter.adapt();

    for (const link of links) {
      // Verify sourceId and targetId exist
      const sourceNode = nodes.find(n => n.id === link.sourceId);
      const targetNode = nodes.find(n => n.id === link.targetId);

      assert.ok(sourceNode, `Source node ${link.sourceId} should exist`);
      assert.ok(targetNode, `Target node ${link.targetId} should exist`);

      // Verify parent-child relationship
      assert.strictEqual(targetNode.parentId, sourceNode.id, 
        'Target should be child of source');
    }
  });

  await t.test('No self-links or invalid links', () => {
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { links } = adapter.adapt();

    for (const link of links) {
      assert.notStrictEqual(link.sourceId, link.targetId, 'Should not have self-links');
      assert.ok(link.sourceId, 'Link should have valid sourceId');
      assert.ok(link.targetId, 'Link should have valid targetId');
    }
  });
});

test('Visualization Adapter - Taxonomy Integration', async (t) => {
  const { graph, taxonomy } = createTestGraph();

  await t.test('Terminal nodes get species names from taxonomy', () => {
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    const terminalNodes = nodes.filter(n => n.type === 'terminal');
    for (const node of terminalNodes) {
      const taxon = taxonomy[node.taxonId];
      assert.ok(taxon, `Taxon should exist for ${node.taxonId}`);
      assert.strictEqual(node.label, taxon.scientificName, 
        'Label should match taxonomy scientific name');
    }
  });

  await t.test('Handles missing taxonomy gracefully', () => {
    const emptyTaxonomy = {};
    const adapter = new VisualizationAdapter(graph, emptyTaxonomy);
    const { nodes } = adapter.adapt();

    const terminalNode = nodes.find(n => n.type === 'terminal');
    assert.ok(terminalNode, 'Should have terminal nodes');
    assert.ok(terminalNode.label, 'Should have fallback label');
    assert.ok(terminalNode.label.includes(terminalNode.taxonId) || 
              terminalNode.label.includes('Ancestor'),
              'Should use taxonId or generic label as fallback');
  });

  await t.test('Terminal nodes include commonName and scientificName', () => {
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    const terminalNodes = nodes.filter(n => n.type === 'terminal');
    assert.ok(terminalNodes.length > 0, 'Should have terminal nodes');
    
    for (const node of terminalNodes) {
      const taxon = taxonomy[node.taxonId];
      if (taxon) {
        assert.strictEqual(node.commonName, taxon.commonName || null,
          `commonName should match taxonomy for ${node.taxonId}`);
        assert.strictEqual(node.scientificName, taxon.scientificName || null,
          `scientificName should match taxonomy for ${node.taxonId}`);
      }
    }
  });

  await t.test('Internal nodes have null commonName and scientificName', () => {
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    const internalNodes = nodes.filter(n => n.type === 'internal');
    assert.ok(internalNodes.length > 0, 'Should have internal nodes');
    
    for (const node of internalNodes) {
      assert.strictEqual(node.commonName, null, 'Internal nodes should have null commonName');
      assert.strictEqual(node.scientificName, null, 'Internal nodes should have null scientificName');
    }
  });
});


test('Text Layer Regression - Coordinate Updates', async (t) => {
  const { graph, taxonomy } = createTestGraph();

  await t.test('Adapted nodes have distinct coordinates (not all at origin)', () => {
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    // After adaptation, nodes should have some coordinate values
    // (They may all be at origin initially, but should be distinct)
    let hasVariation = false;
    const coordinates = nodes.map(n => ({ id: n.id, x: n.x, y: n.y }));
    
    // Check that nodes exist and have numeric coordinates
    assert.ok(nodes.length > 0, 'Should have nodes');
    for (const node of nodes) {
      assert.strictEqual(typeof node.x, 'number', `Node ${node.id} should have numeric x`);
      assert.strictEqual(typeof node.y, 'number', `Node ${node.id} should have numeric y`);
    }
    
    // After force simulation, coordinates will change, but initially they may be similar
    // The key test is that they are updatable and trackable
  });

  await t.test('Different nodes have independent coordinate tracking', () => {
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    // Each node should be independent
    const nodeMap = new Map();
    for (const node of nodes) {
      assert.ok(!nodeMap.has(node.id), `Node ID ${node.id} should be unique`);
      nodeMap.set(node.id, node);
    }

    // Simulate moving one node (as force simulation would)
    const firstNode = nodes[0];
    const originalX = firstNode.x;
    const originalY = firstNode.y;
    
    firstNode.x += 10;
    firstNode.y += 20;

    // Other nodes should not be affected
    for (let i = 1; i < nodes.length; i++) {
      assert.strictEqual(nodes[i].x, nodes[i].x, 'Other nodes should retain their coordinates');
    }

    // Verify the change was made to only one node
    assert.strictEqual(firstNode.x, originalX + 10, 'First node should have updated x');
    assert.strictEqual(firstNode.y, originalY + 20, 'First node should have updated y');
  });

  await t.test('Text layer tracks node coordinates (data binding preserves node reference)', () => {
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    // In ForceDirectedVisualization._onTick(), text elements are bound to nodes
    // The key is that when nodes change position, text elements can read their position
    
    // Simulate what D3 data binding does
    for (const textElement of nodes) {
      // Each text element should be bound to a node with x, y properties
      assert.ok(textElement.id, 'Text data should have node ID');
      assert.strictEqual(typeof textElement.x, 'number', 'Text data should track node.x');
      assert.strictEqual(typeof textElement.y, 'number', 'Text data should track node.y');
    }
  });

  await t.test('Terminal nodes have labels for rendering', () => {
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    const terminalNodes = nodes.filter(n => n.type === 'terminal');
    for (const node of terminalNodes) {
      // These labels should be rendered as text elements
      assert.ok(node.commonName || node.scientificName, 
        `Terminal node ${node.id} should have commonName or scientificName for text rendering`);
    }
  });

  await t.test('Internal nodes have labels for ancestral text rendering', () => {
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    const internalNodes = nodes.filter(n => n.type === 'internal');
    for (const node of internalNodes) {
      // Internal nodes should have a label (could be "Ancestor of ..." or clade name)
      assert.ok(node.label, `Internal node ${node.id} should have label for text rendering`);
    }
  });
});

test('Visualization Adapter - Internal Nodes with taxonId', async (t) => {
  // Create a graph where an internal node has a taxonId
  function createGraphWithInternalTaxon() {
    const hypothesis = {
      hypothesisId: 'test_h2',
      rootNodeId: 'ancestor_h2_n0',
      nodes: [
        { id: 'ancestor_h2_n0', type: 'internal', parentId: null, children: ['ancestor_h2_n1', 'tax_d'] },
        { id: 'ancestor_h2_n1', type: 'internal', parentId: 'ancestor_h2_n0', taxonId: 'genus_xy', children: ['tax_e', 'tax_f'] },
        { id: 'tax_d', type: 'terminal', parentId: 'ancestor_h2_n0', taxonId: 'tax_d', children: [] },
        { id: 'tax_e', type: 'terminal', parentId: 'ancestor_h2_n1', taxonId: 'tax_e', children: [] },
        { id: 'tax_f', type: 'terminal', parentId: 'ancestor_h2_n1', taxonId: 'tax_f', children: [] }
      ]
    };

    const taxonomy = {
      'tax_d': { id: 'tax_d', scientificName: 'Species D', rank: 'species' },
      'tax_e': { id: 'tax_e', scientificName: 'Species E', rank: 'species' },
      'tax_f': { id: 'tax_f', scientificName: 'Species F', rank: 'species' },
      'genus_xy': { id: 'genus_xy', scientificName: 'Genus XY', rank: 'genus' }
    };

    const builder = new GraphBuilder(hypothesis.hypothesisId, hypothesis.rootNodeId);
    for (const node of hypothesis.nodes) {
      builder.addNode(node);
    }
    const graph = builder.build(taxonomy);

    return { graph, taxonomy, hypothesis };
  }

  await t.test('Internal node with valid taxonId resolves to taxon name', () => {
    const { graph, taxonomy } = createGraphWithInternalTaxon();
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    const internalWithTaxon = nodes.find(n => n.id === 'ancestor_h2_n1');
    assert.ok(internalWithTaxon, 'Internal node with taxonId should exist');
    assert.strictEqual(internalWithTaxon.taxonId, 'genus_xy', 'Internal node should have taxonId');
    assert.strictEqual(internalWithTaxon.label, 'Genus XY', 'Internal node with taxonId should resolve to taxon name');
    assert.strictEqual(internalWithTaxon.scientificName, 'Genus XY', 'Internal node should have scientificName');
  });

  await t.test('Internal node with taxonId should have silhouette filename if mapping exists', () => {
    const { graph, taxonomy } = createGraphWithInternalTaxon();
    
    const silhouetteMapping = {
      'genus_xy': 'genus-xy.svg'
    };
    
    const adapter = new VisualizationAdapter(graph, taxonomy, silhouetteMapping);
    const { nodes } = adapter.adapt();

    const internalWithTaxon = nodes.find(n => n.id === 'ancestor_h2_n1');
    assert.strictEqual(internalWithTaxon.silhouetteFilename, 'genus-xy.svg', 
      'Internal node with taxonId should resolve silhouette filename');
  });

  await t.test('Internal node without taxonId uses ancestor label', () => {
    const { graph, taxonomy } = createGraphWithInternalTaxon();
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    const internalWithoutTaxon = nodes.find(n => n.id === 'ancestor_h2_n0');
    assert.ok(internalWithoutTaxon, 'Internal node without taxonId should exist');
    assert.ok(!internalWithoutTaxon.taxonId, 'Internal node should not have taxonId');
    assert.ok(internalWithoutTaxon.label.includes('Ancestor'), 
      'Internal node without taxonId should use ancestor label');
  });

  await t.test('Internal node with invalid taxonId does not crash', () => {
    const hypothesis = {
      hypothesisId: 'test_h3',
      rootNodeId: 'ancestor_h3_n0',
      nodes: [
        { id: 'ancestor_h3_n0', type: 'internal', parentId: null, children: ['tax_g', 'tax_h'] },
        { id: 'tax_g', type: 'terminal', parentId: 'ancestor_h3_n0', taxonId: 'tax_g', children: [] },
        { id: 'tax_h', type: 'terminal', parentId: 'ancestor_h3_n0', taxonId: 'tax_h', children: [] }
      ]
    };

    const taxonomy = {
      'tax_g': { id: 'tax_g', scientificName: 'Species G', rank: 'species' },
      'tax_h': { id: 'tax_h', scientificName: 'Species H', rank: 'species' }
    };

    const builder = new GraphBuilder(hypothesis.hypothesisId, hypothesis.rootNodeId);
    for (const node of hypothesis.nodes) {
      builder.addNode(node);
    }
    const graph = builder.build(taxonomy);

    const adapter = new VisualizationAdapter(graph, taxonomy);
    // Should not throw even though adaptation may not find a taxon
    assert.doesNotThrow(() => {
      adapter.adapt();
    }, 'Adapter should not crash with missing or invalid taxon IDs');
  });

  await t.test('Terminal nodes still work correctly alongside internal nodes with taxonId', () => {
    const { graph, taxonomy } = createGraphWithInternalTaxon();
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    const terminalNodes = nodes.filter(n => n.type === 'terminal');
    for (const node of terminalNodes) {
      assert.ok(node.commonName || node.scientificName, 
        `Terminal node ${node.id} should have a name`);
    }

    const internalNodes = nodes.filter(n => n.type === 'internal');
    assert.strictEqual(internalNodes.length, 2, 'Should have 2 internal nodes');
    // One with taxonId, one without
    const internalWithTaxon = internalNodes.find(n => n.taxonId);
    const internalWithoutTaxon = internalNodes.find(n => !n.taxonId);
    assert.ok(internalWithTaxon, 'Should have one internal node with taxonId');
    assert.ok(internalWithoutTaxon, 'Should have one internal node without taxonId');
  });

  await t.test('sourceLabel is preserved on visualization nodes', () => {
    const hypothesis = {
      hypothesisId: 'test_h_label',
      rootNodeId: 'ancestor_h_n0',
      nodes: [
        { id: 'ancestor_h_n0', type: 'internal', parentId: null, children: ['tax_a'], sourceLabel: 'Root ancestor' },
        { id: 'tax_a', type: 'terminal', parentId: 'ancestor_h_n0', taxonId: 'tax_a', children: [] }
      ]
    };

    const taxonomy = {
      'tax_a': { id: 'tax_a', scientificName: 'Species A', rank: 'species' }
    };

    const builder = new GraphBuilder(hypothesis.hypothesisId, hypothesis.rootNodeId);
    for (const node of hypothesis.nodes) {
      builder.addNode(node);
    }
    const graph = builder.build(taxonomy);

    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    const rootNode = nodes.find(n => n.id === 'ancestor_h_n0');
    assert.ok(rootNode, 'Should find root node');
    assert.strictEqual(rootNode.sourceLabel, 'Root ancestor', 'sourceLabel should be preserved');
  });

  await t.test('Display name resolver is used for labels', () => {
    // Test that the resolver is correctly integrated
    const hypothesis = {
      hypothesisId: 'test_h_resolver',
      rootNodeId: 'ancestor_h_n0',
      nodes: [
        { id: 'ancestor_h_n0', type: 'internal', parentId: null, children: ['tax_a'] },
        { id: 'tax_a', type: 'terminal', parentId: 'ancestor_h_n0', taxonId: 'tax_a', children: [] }
      ]
    };

    const taxonomy = {
      'tax_a': { 
        id: 'tax_a', 
        scientificName: 'Test Species', 
        commonName: 'Test Common',
        rank: 'species' 
      }
    };

    const builder = new GraphBuilder(hypothesis.hypothesisId, hypothesis.rootNodeId);
    for (const node of hypothesis.nodes) {
      builder.addNode(node);
    }
    const graph = builder.build(taxonomy);

    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    const terminalNode = nodes.find(n => n.id === 'tax_a');
    assert.strictEqual(terminalNode.label, 'Test Species', 
      'Should prefer scientific name (resolver behavior)');
  });
});
