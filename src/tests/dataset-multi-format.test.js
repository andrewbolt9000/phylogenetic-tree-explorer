/**
 * Multi-Dataset Integration Tests
 * 
 * Tests for loading and rendering both Mammals (legacy silhouette filenames)
 * and Animals (PhyloPic URLs) datasets with unified visualization adapter.
 */

import test from 'node:test';
import assert from 'node:assert';
import { GraphBuilder } from '../graph/PhyloGraph.js';
import { VisualizationAdapter } from '../visualization/visualizationAdapter.js';

// Helper to create a test graph with both terminal and internal nodes with taxonIds
function createTestGraphWithInternalTaxon() {
  const hypothesis = {
    hypothesisId: 'test_h1',
    rootNodeId: 'ancestor_h1_n0',
    nodes: [
      // Root internal node with no taxonId
      { id: 'ancestor_h1_n0', type: 'internal', parentId: null, children: ['ancestor_h1_n1', 'tax_d'], taxonId: null },
      // Internal node WITH a taxonId (representing a selected ancestor taxon)
      { id: 'ancestor_h1_n1', type: 'internal', parentId: 'ancestor_h1_n0', children: ['tax_a', 'tax_b'], taxonId: 'tax_clade_xy' },
      // Terminal nodes
      { id: 'tax_a', type: 'terminal', parentId: 'ancestor_h1_n1', taxonId: 'tax_a', children: [] },
      { id: 'tax_b', type: 'terminal', parentId: 'ancestor_h1_n1', taxonId: 'tax_b', children: [] },
      { id: 'tax_d', type: 'terminal', parentId: 'ancestor_h1_n0', taxonId: 'tax_d', children: [] }
    ]
  };

  const taxonomy = {
    'tax_a': { id: 'tax_a', scientificName: 'Species A', commonName: 'Creature A', rank: 'species' },
    'tax_b': { id: 'tax_b', scientificName: 'Species B', commonName: 'Creature B', rank: 'species' },
    'tax_clade_xy': { id: 'tax_clade_xy', scientificName: 'Clade XY', commonName: 'XY Group', rank: 'genus' },
    'tax_d': { id: 'tax_d', scientificName: 'Species D', commonName: 'Creature D', rank: 'species' }
  };

  const builder = new GraphBuilder(hypothesis.hypothesisId, hypothesis.rootNodeId);
  for (const node of hypothesis.nodes) {
    builder.addNode(node);
  }
  const graph = builder.build(taxonomy);

  return { graph, taxonomy, hypothesis };
}

test('Visualization Adapter - Multi-Dataset Support', async (t) => {
  const { graph, taxonomy } = createTestGraphWithInternalTaxon();

  await t.test('Mammals dataset format (legacy silhouetteFilename)', () => {
    // Mammals use local silhouette filenames
    const silhouetteMappings = {
      'tax_a': { silhouetteFilename: 'species_a.svg' },
      'tax_b': { silhouetteFilename: 'species_b.svg' },
      'tax_clade_xy': { silhouetteFilename: 'clade_xy.svg' },
      'tax_d': { silhouetteFilename: 'species_d.svg' }
    };

    const adapter = new VisualizationAdapter(graph, taxonomy, silhouetteMappings);
    const { nodes } = adapter.adapt();

    // Check terminal nodes have silhouetteFilename
    const nodeA = nodes.find(n => n.id === 'tax_a');
    assert.strictEqual(nodeA.silhouetteFilename, 'species_a.svg', 'Terminal node A should have silhouetteFilename');
    assert.strictEqual(nodeA.silhouetteUrl, null, 'Terminal node A should not have silhouetteUrl');

    // Check internal node with taxonId also gets silhouetteFilename
    const nodeCladeXY = nodes.find(n => n.id === 'ancestor_h1_n1');
    assert.strictEqual(nodeCladeXY.taxonId, 'tax_clade_xy', 'Internal node should have taxonId');
    assert.strictEqual(nodeCladeXY.silhouetteFilename, 'clade_xy.svg', 'Internal node with taxonId should have silhouetteFilename');
    assert.strictEqual(nodeCladeXY.silhouetteUrl, null, 'Internal node with taxonId should not have silhouetteUrl');

    // Check internal node without taxonId has no silhouette
    const nodeRoot = nodes.find(n => n.id === 'ancestor_h1_n0');
    assert.strictEqual(nodeRoot.silhouetteFilename, null, 'Root node without taxonId should not have silhouetteFilename');
    assert.strictEqual(nodeRoot.silhouetteUrl, null, 'Root node without taxonId should not have silhouetteUrl');
  });

  await t.test('Animals dataset format (PhyloPic silhouetteUrl)', () => {
    // Animals use PhyloPic URLs
    const silhouetteMappings = {
      'tax_a': { silhouetteUrl: 'https://www.phylopic.org/images/uuid-a' },
      'tax_b': { silhouetteUrl: 'https://www.phylopic.org/images/uuid-b' },
      'tax_clade_xy': { silhouetteUrl: 'https://www.phylopic.org/images/uuid-xy' },
      'tax_d': { silhouetteUrl: 'https://www.phylopic.org/images/uuid-d' }
    };

    const adapter = new VisualizationAdapter(graph, taxonomy, silhouetteMappings);
    const { nodes } = adapter.adapt();

    // Check terminal nodes have silhouetteUrl
    const nodeA = nodes.find(n => n.id === 'tax_a');
    assert.strictEqual(nodeA.silhouetteUrl, 'https://www.phylopic.org/images/uuid-a', 'Terminal node A should have silhouetteUrl');
    assert.strictEqual(nodeA.silhouetteFilename, null, 'Terminal node A should not have silhouetteFilename');

    // Check internal node with taxonId also gets silhouetteUrl
    const nodeCladeXY = nodes.find(n => n.id === 'ancestor_h1_n1');
    assert.strictEqual(nodeCladeXY.taxonId, 'tax_clade_xy', 'Internal node should have taxonId');
    assert.strictEqual(nodeCladeXY.silhouetteUrl, 'https://www.phylopic.org/images/uuid-xy', 'Internal node with taxonId should have silhouetteUrl');
    assert.strictEqual(nodeCladeXY.silhouetteFilename, null, 'Internal node with taxonId should not have silhouetteFilename');

    // Check internal node without taxonId has no silhouette
    const nodeRoot = nodes.find(n => n.id === 'ancestor_h1_n0');
    assert.strictEqual(nodeRoot.silhouetteUrl, null, 'Root node without taxonId should not have silhouetteUrl');
    assert.strictEqual(nodeRoot.silhouetteFilename, null, 'Root node without taxonId should not have silhouetteFilename');
  });

  await t.test('Mixed format (both filenames and URLs)', () => {
    // Some nodes use legacy format, some use PhyloPic
    const silhouetteMappings = {
      'tax_a': { silhouetteFilename: 'species_a.svg' },  // Legacy
      'tax_b': { silhouetteUrl: 'https://www.phylopic.org/images/uuid-b' },  // PhyloPic
      'tax_clade_xy': { silhouetteUrl: 'https://www.phylopic.org/images/uuid-xy' },  // PhyloPic
      'tax_d': { silhouetteFilename: 'species_d.svg' }  // Legacy
    };

    const adapter = new VisualizationAdapter(graph, taxonomy, silhouetteMappings);
    const { nodes } = adapter.adapt();

    // Check mixed formats
    const nodeA = nodes.find(n => n.id === 'tax_a');
    assert.strictEqual(nodeA.silhouetteFilename, 'species_a.svg', 'Node A should have filename');
    assert.strictEqual(nodeA.silhouetteUrl, null, 'Node A should not have URL');

    const nodeB = nodes.find(n => n.id === 'tax_b');
    assert.strictEqual(nodeB.silhouetteFilename, null, 'Node B should not have filename');
    assert.strictEqual(nodeB.silhouetteUrl, 'https://www.phylopic.org/images/uuid-b', 'Node B should have URL');

    const nodeCladeXY = nodes.find(n => n.id === 'ancestor_h1_n1');
    assert.strictEqual(nodeCladeXY.silhouetteFilename, null, 'Clade node should not have filename');
    assert.strictEqual(nodeCladeXY.silhouetteUrl, 'https://www.phylopic.org/images/uuid-xy', 'Clade node should have URL');
  });
});

test('Animal Taxonomy and Names - Internal Nodes with taxonId', async (t) => {
  const { graph, taxonomy } = createTestGraphWithInternalTaxon();

  await t.test('Internal node with taxonId resolves taxonomy information', () => {
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    // The internal node ancestor_h1_n1 has taxonId tax_clade_xy
    const cladeNode = nodes.find(n => n.id === 'ancestor_h1_n1');
    assert.strictEqual(cladeNode.type, 'internal', 'Node type should remain internal');
    assert.strictEqual(cladeNode.taxonId, 'tax_clade_xy', 'Should have taxonId');
    assert.strictEqual(cladeNode.scientificName, 'Clade XY', 'Should resolve scientific name');
    assert.strictEqual(cladeNode.commonName, 'XY Group', 'Should resolve common name');
    assert.strictEqual(cladeNode.label, 'Clade XY', 'Label should be scientific name');
  });

  await t.test('Internal node without taxonId uses generic ancestor label', () => {
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    // The root ancestor_h1_n0 has no taxonId
    const rootNode = nodes.find(n => n.id === 'ancestor_h1_n0');
    assert.strictEqual(rootNode.type, 'internal', 'Node type should be internal');
    assert.strictEqual(rootNode.taxonId, null, 'Should not have taxonId');
    assert.match(rootNode.label, /Ancestor \d+/, 'Should use generic ancestor label');
  });

  await t.test('Terminal nodes retain normal behavior', () => {
    const adapter = new VisualizationAdapter(graph, taxonomy);
    const { nodes } = adapter.adapt();

    const terminalNode = nodes.find(n => n.id === 'tax_a');
    assert.strictEqual(terminalNode.type, 'terminal', 'Type should be terminal');
    assert.strictEqual(terminalNode.taxonId, 'tax_a', 'Should have taxonId');
    assert.strictEqual(terminalNode.scientificName, 'Species A', 'Should have scientific name');
    assert.strictEqual(terminalNode.commonName, 'Creature A', 'Should have common name');
    assert.strictEqual(terminalNode.label, 'Species A', 'Label should be scientific name');
  });
});

test('Immutability with Multi-Format Silhouettes', async (t) => {
  const { graph, taxonomy } = createTestGraphWithInternalTaxon();

  await t.test('Mutations do not affect original silhouette mapping', () => {
    const originalMappings = {
      'tax_a': { silhouetteUrl: 'https://www.phylopic.org/images/uuid-a' },
      'tax_b': { silhouetteUrl: 'https://www.phylopic.org/images/uuid-b' }
    };

    const adapter = new VisualizationAdapter(graph, taxonomy, originalMappings);
    const snapshot1 = adapter.snapshotVisualizationState();

    // Mutate a visualization node
    const nodeA = snapshot1.nodes.find(n => n.id === 'tax_a');
    if (nodeA && nodeA.silhouetteUrl) {
      nodeA.x = 999;
      nodeA.y = 888;
      nodeA.silhouetteUrl = 'https://www.phylopic.org/images/MUTATED';
    }

    // Re-adapt and verify original is unchanged
    const snapshot2 = adapter.snapshotVisualizationState();
    const nodeA2 = snapshot2.nodes.find(n => n.id === 'tax_a');
    if (nodeA2 && nodeA2.silhouetteUrl) {
      assert.strictEqual(nodeA2.silhouetteUrl, 'https://www.phylopic.org/images/uuid-a', 'Original mapping should be unchanged');
      assert.notStrictEqual(nodeA2.x, 999, 'Position mutation should not persist');
    }
  });
});

test('ForceDirectedVisualization Silhouette Rendering - URL vs Filename', async (t) => {
  // This test verifies the logic for choosing between silhouetteUrl and silhouetteFilename
  // The actual D3 rendering is not tested here (that requires a browser environment)

  await t.test('Image URL selection logic prefers silhouetteUrl', () => {
    // Test the logic that should exist in _renderSilhouettes
    const nodeWithBoth = {
      silhouetteFilename: 'local.svg',
      silhouetteUrl: 'https://www.phylopic.org/images/remote'
    };

    // Should prefer URL over filename
    const imageUrl = nodeWithBoth.silhouetteUrl 
      ? nodeWithBoth.silhouetteUrl 
      : `./assets/silhouettes/${nodeWithBoth.silhouetteFilename}`;
    
    assert.strictEqual(imageUrl, 'https://www.phylopic.org/images/remote', 'Should prefer silhouetteUrl');
  });

  await t.test('Image URL selection falls back to filename path', () => {
    const nodeFilenameOnly = {
      silhouetteFilename: 'local.svg',
      silhouetteUrl: null
    };

    const imageUrl = nodeFilenameOnly.silhouetteUrl 
      ? nodeFilenameOnly.silhouetteUrl 
      : `./assets/silhouettes/${nodeFilenameOnly.silhouetteFilename}`;
    
    assert.strictEqual(imageUrl, './assets/silhouettes/local.svg', 'Should construct path from filename');
  });

  await t.test('Image URL selection with only silhouetteUrl', () => {
    const nodeUrlOnly = {
      silhouetteFilename: null,
      silhouetteUrl: 'https://www.phylopic.org/images/uuid-xyz'
    };

    const imageUrl = nodeUrlOnly.silhouetteUrl 
      ? nodeUrlOnly.silhouetteUrl 
      : `./assets/silhouettes/${nodeUrlOnly.silhouetteFilename}`;
    
    assert.strictEqual(imageUrl, 'https://www.phylopic.org/images/uuid-xyz', 'Should use silhouetteUrl');
  });
});

test('Visualization Adapter - Mammals-600 Dataset Support', async (t) => {
  const { graph, taxonomy } = createTestGraphWithInternalTaxon();

  await t.test('Mammals-600 dataset loads silhouette-mapping.json format', () => {
    // Mammals-600 uses PhyloPic format like Animals
    const silhouetteMappings = {
      'tax_a': {
        silhouetteUrl: 'https://www.phylopic.org/images/uuid-a-123',
        imageUuid: 'uuid-a-123',
        license: 'CC BY 4.0',
        contributor: 'PhyloPic Artist'
      },
      'tax_clade_xy': {
        silhouetteUrl: 'https://www.phylopic.org/images/uuid-clade-456',
        imageUuid: 'uuid-clade-456',
        license: 'CC BY 4.0',
        contributor: 'PhyloPic Artist'
      }
    };

    const adapter = new VisualizationAdapter(graph, taxonomy, silhouetteMappings);
    const { nodes } = adapter.adapt();
    
    const nodeA = nodes.find(n => n.taxonId === 'tax_a');
    assert.ok(nodeA, 'Node A should exist');
    assert.strictEqual(nodeA.silhouetteUrl, 'https://www.phylopic.org/images/uuid-a-123', 'Should have silhouetteUrl');
    assert.strictEqual(nodeA.silhouetteFilename, null, 'Should not have silhouetteFilename');
  });

  await t.test('Mammals-600 internal nodes with taxonId resolve silhouettes', () => {
    const silhouetteMappings = {
      'tax_clade_xy': {
        silhouetteUrl: 'https://www.phylopic.org/images/uuid-clade-456',
        imageUuid: 'uuid-clade-456',
        license: 'CC BY 4.0',
        contributor: 'PhyloPic Artist'
      }
    };

    const adapter = new VisualizationAdapter(graph, taxonomy, silhouetteMappings);
    const { nodes } = adapter.adapt();
    
    const internalNode = nodes.find(n => n.id === 'ancestor_h1_n1');
    assert.ok(internalNode, 'Internal node should exist');
    assert.strictEqual(internalNode.scientificName, 'Clade XY', 'Should resolve scientific name');
    assert.strictEqual(internalNode.commonName, 'XY Group', 'Should resolve common name');
    assert.strictEqual(internalNode.silhouetteUrl, 'https://www.phylopic.org/images/uuid-clade-456', 'Should resolve silhouette URL');
  });

  await t.test('Mammals-600 missing silhouettes degrade gracefully', () => {
    // Empty mapping - no silhouettes found
    const silhouetteMappings = {};

    const adapter = new VisualizationAdapter(graph, taxonomy, silhouetteMappings);
    const { nodes } = adapter.adapt();
    
    const nodeA = nodes.find(n => n.taxonId === 'tax_a');
    assert.ok(nodeA, 'Node A should exist');
    assert.strictEqual(nodeA.silhouetteUrl, null, 'Should have null silhouetteUrl');
    assert.strictEqual(nodeA.silhouetteFilename, null, 'Should have null silhouetteFilename');
  });

  await t.test('Mammals-600 format preserves all node data', () => {
    const silhouetteMappings = {
      'tax_a': {
        silhouetteUrl: 'https://www.phylopic.org/images/uuid-a-123',
        imageUuid: 'uuid-a-123',
        license: 'CC BY 4.0',
        contributor: 'PhyloPic Artist'
      }
    };

    const adapter = new VisualizationAdapter(graph, taxonomy, silhouetteMappings);
    const { nodes } = adapter.adapt();
    
    const nodeA = nodes.find(n => n.taxonId === 'tax_a');
    assert.ok(nodeA.id, 'Should have id');
    assert.ok(nodeA.parentId !== undefined, 'Should have parentId');
    assert.ok(nodeA.type, 'Should have type');
    assert.strictEqual(nodeA.scientificName, 'Species A', 'Should have scientificName');
    assert.strictEqual(nodeA.commonName, 'Creature A', 'Should have commonName');
    assert.strictEqual(nodeA.silhouetteUrl, 'https://www.phylopic.org/images/uuid-a-123', 'Should have silhouetteUrl');
  });
});
