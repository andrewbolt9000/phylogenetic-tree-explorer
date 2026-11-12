import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { TaxonomyLoader, fsReadyPromise as taxonomyFsReady } from './taxonomyLoader.js';
import { HypothesisLoader, fsReadyPromise as hypothesisFsReady } from './hypothesisLoader.js';
import { DivergenceLoader, fsReadyPromise as divergenceFsReady } from './divergenceLoader.js';
import { GraphBuilder } from '../graph/PhyloGraph.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaDir = join(__dirname, '..', '..', 'data', 'schemas');
const mammalDataDir = join(__dirname, '..', '..', 'data', 'mammals');

// Ensure fs is loaded before any sync tests run
await Promise.all([taxonomyFsReady, hypothesisFsReady, divergenceFsReady]);

function loadJSON(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

test('Mammalian Dataset - Taxonomy Loading and Validation', async (t) => {
  await t.test('Load and validate taxonomy', () => {
    const taxonomyData = loadJSON(join(mammalDataDir, 'taxonomy.json'));
    const schemaPath = join(schemaDir, 'taxonomy.schema.json');
    const loader = new TaxonomyLoader(schemaPath);
    const taxonomy = loader.load(join(mammalDataDir, 'taxonomy.json'));
    
    assert.ok(taxonomy, 'Taxonomy loaded successfully');
    assert.strictEqual(typeof taxonomy, 'object', 'Taxonomy is an object');
    assert(Object.keys(taxonomy).length > 0, 'Taxonomy contains taxa');
  });

  await t.test('Taxonomy contains expected mammals', () => {
    const taxonomy = loadJSON(join(mammalDataDir, 'taxonomy.json'));
    const taxonIds = taxonomy.taxonomy.map(t => t.id);
    
    // Check for expected major taxa
    assert(taxonIds.includes('tax_mammalia'), 'Contains Mammalia');
    assert(taxonIds.includes('tax_primates'), 'Contains Primates');
    assert(taxonIds.includes('tax_rodentia'), 'Contains Rodentia');
    assert(taxonIds.includes('tax_carnivora'), 'Contains Carnivora');
    assert(taxonIds.includes('tax_homo_sapiens'), 'Contains Homo sapiens');
    assert(taxonIds.includes('tax_ornithorhynchus_anatinus'), 'Contains Platypus');
  });

  await t.test('Taxonomy hierarchy is valid', () => {
    const taxonomyData = loadJSON(join(mammalDataDir, 'taxonomy.json'));
    
    // Check no cycles
    const visited = new Set();
    const checkCycle = (id, chain = []) => {
      if (chain.includes(id)) return true; // Found cycle
      const taxon = taxonomyData.taxonomy.find(t => t.id === id);
      if (!taxon || taxon.parent === null) return false;
      return checkCycle(taxon.parent, [...chain, id]);
    };
    
    for (const taxon of taxonomyData.taxonomy) {
      assert(!checkCycle(taxon.id), `No cycle from ${taxon.id}`);
    }
  });

  await t.test('Taxonomy has single root', () => {
    const taxonomy = loadJSON(join(mammalDataDir, 'taxonomy.json'));
    const roots = taxonomy.taxonomy.filter(t => t.parent === null);
    assert.strictEqual(roots.length, 1, 'Exactly one root taxon');
  });
});

test('Mammalian Dataset - Hypothesis Loading and Validation', async (t) => {
  await t.test('Load and validate hypothesis', () => {
    const hypothesisData = loadJSON(join(mammalDataDir, 'hypothesis.json'));
    const taxonomyData = loadJSON(join(mammalDataDir, 'taxonomy.json'));
    const schemaPath = join(schemaDir, 'hypothesis.schema.json');
    const taxonomySchemaPath = join(schemaDir, 'taxonomy.schema.json');
    
    const taxonomyLoader = new TaxonomyLoader(taxonomySchemaPath);
    const loadedTaxonomy = taxonomyLoader.load(join(mammalDataDir, 'taxonomy.json'));
    
    const loader = new HypothesisLoader(schemaPath);
    const hypothesis = loader.load(
      join(mammalDataDir, 'hypothesis.json'),
      loadedTaxonomy.taxa
    );
    
    assert.ok(hypothesis, 'Hypothesis loaded successfully');
  });

  await t.test('Hypothesis has correct structure', () => {
    const hypothesis = loadJSON(join(mammalDataDir, 'hypothesis.json'));
    
    assert.ok(hypothesis.hypothesisId, 'Has hypothesis ID');
    assert.ok(hypothesis.rootNodeId, 'Has root node ID');
    assert.ok(Array.isArray(hypothesis.nodes), 'Has nodes array');
    assert(hypothesis.nodes.length > 0, 'Contains nodes');
  });

  await t.test('Hypothesis contains expected taxa', () => {
    const hypothesis = loadJSON(join(mammalDataDir, 'hypothesis.json'));
    const terminalIds = hypothesis.nodes
      .filter(n => n.type === 'terminal')
      .map(n => n.taxonId);
    
    // Check for key terminal taxa
    assert(terminalIds.includes('tax_homo_sapiens'), 'Contains human');
    assert(terminalIds.includes('tax_pan_troglodytes'), 'Contains chimpanzee');
    assert(terminalIds.includes('tax_mus_musculus'), 'Contains mouse');
    assert(terminalIds.includes('tax_ornithorhynchus_anatinus'), 'Contains platypus');
  });

  await t.test('Hypothesis forms a valid tree', () => {
    const hypothesis = loadJSON(join(mammalDataDir, 'hypothesis.json'));
    const nodeIds = new Set(hypothesis.nodes.map(n => n.id));
    
    // Check all parent references exist
    for (const node of hypothesis.nodes) {
      if (node.parentId !== null) {
        assert(nodeIds.has(node.parentId), `Parent ${node.parentId} exists for ${node.id}`);
      }
    }
    
    // Check single root
    const roots = hypothesis.nodes.filter(n => n.parentId === null);
    assert.strictEqual(roots.length, 1, 'Exactly one root');
  });

  await t.test('Terminal nodes reference valid taxa', () => {
    const hypothesis = loadJSON(join(mammalDataDir, 'hypothesis.json'));
    const taxonomy = loadJSON(join(mammalDataDir, 'taxonomy.json'));
    const taxonIds = new Set(taxonomy.taxonomy.map(t => t.id));
    
    const terminals = hypothesis.nodes.filter(n => n.type === 'terminal');
    for (const terminal of terminals) {
      assert(taxonIds.has(terminal.taxonId), `Terminal ${terminal.id} references valid taxon ${terminal.taxonId}`);
    }
  });
});

test('Mammalian Dataset - Divergence Estimates', async (t) => {
  await t.test('Load divergence estimates', () => {
    const divergenceData = loadJSON(join(mammalDataDir, 'divergence-estimates.json'));
    
    assert.ok(divergenceData.divergenceEstimates, 'Has divergenceEstimates');
    assert.ok(divergenceData.divergenceEstimates.phylo_mammals_1, 'Has hypothesis-specific estimates');
    assert.ok(divergenceData.metadata, 'Has metadata');
  });

  await t.test('Divergence estimates have required fields', () => {
    const divergenceData = loadJSON(join(mammalDataDir, 'divergence-estimates.json'));
    const estimates = divergenceData.divergenceEstimates.phylo_mammals_1;
    
    for (const [nodeId, estimateList] of Object.entries(estimates)) {
      for (const est of estimateList) {
        assert.ok(est.centralEstimate, `${nodeId}: Has central estimate`);
        assert.ok(est.unit, `${nodeId}: Has unit`);
        assert.ok(est.source, `${nodeId}: Has source`);
        assert.ok(est.sourceYear, `${nodeId}: Has source year`);
      }
    }
  });

  await t.test('Mammalian root node has ancient divergence time', () => {
    const divergenceData = loadJSON(join(mammalDataDir, 'divergence-estimates.json'));
    const estimates = divergenceData.divergenceEstimates.phylo_mammals_1;
    const rootEstimate = estimates.ancestor_h1_n0?.[0];
    
    assert.ok(rootEstimate, 'Root has divergence estimate');
    assert(rootEstimate.centralEstimate > 300, 'Root estimate is > 300 Ma (mammalian crown group)');
  });

  await t.test('Primate divergence times are reasonable', () => {
    const divergenceData = loadJSON(join(mammalDataDir, 'divergence-estimates.json'));
    const estimates = divergenceData.divergenceEstimates.phylo_mammals_1;
    
    // Human-chimp should be ~6-7 Ma
    const humanChimpEst = estimates.ancestor_h1_n12?.[0];
    assert.ok(humanChimpEst, 'Human-chimp node has estimate');
    assert(humanChimpEst.centralEstimate < 10, 'Human-chimp divergence < 10 Ma');
    assert(humanChimpEst.centralEstimate > 4, 'Human-chimp divergence > 4 Ma');
  });
});

test('Mammalian Dataset - Graph Construction', async (t) => {
  await t.test('Build PhyloGraph from mammalian data', () => {
    const hypothesisData = loadJSON(join(mammalDataDir, 'hypothesis.json'));
    const taxonomyData = loadJSON(join(mammalDataDir, 'taxonomy.json'));
    
    const builder = new GraphBuilder(hypothesisData.hypothesisId, hypothesisData.rootNodeId);
    
    for (const node of hypothesisData.nodes) {
      builder.addNode(node);
    }
    
    const graph = builder.build(taxonomyData.taxonomy);
    assert.ok(graph, 'Graph constructed successfully');
  });

  await t.test('Graph validates successfully', () => {
    const hypothesisData = loadJSON(join(mammalDataDir, 'hypothesis.json'));
    const taxonomyData = loadJSON(join(mammalDataDir, 'taxonomy.json'));
    
    const builder = new GraphBuilder(hypothesisData.hypothesisId, hypothesisData.rootNodeId);
    
    for (const node of hypothesisData.nodes) {
      builder.addNode(node);
    }
    
    const graph = builder.build(taxonomyData.taxonomy);
    const validation = graph.validate();
    
    assert(validation.isValid, 'Graph is valid');
    if (!validation.isValid) {
      console.log('Validation errors:', validation.errors);
    }
  });

  await t.test('Graph supports key operations', () => {
    const hypothesisData = loadJSON(join(mammalDataDir, 'hypothesis.json'));
    const taxonomyData = loadJSON(join(mammalDataDir, 'taxonomy.json'));
    
    const builder = new GraphBuilder(hypothesisData.hypothesisId, hypothesisData.rootNodeId);
    
    for (const node of hypothesisData.nodes) {
      builder.addNode(node);
    }
    
    const graph = builder.build(taxonomyData.taxonomy);
    
    // Test various operations
    const root = graph.getRoot();
    assert.ok(root, 'Can get root');
    
    const terminals = graph.getTerminals();
    assert(terminals.length > 0, 'Has terminal nodes');
    
    const internals = graph.getInternals();
    assert(internals.length > 0, 'Has internal nodes');
    
    const humanNode = hypothesisData.nodes.find(n => n.taxonId === 'tax_homo_sapiens');
    if (humanNode) {
      const path = graph.getPathToRoot(humanNode.id);
      assert(path.length > 0, 'Can compute path to root');
      assert.strictEqual(path[path.length - 1], root, 'Path ends at root');
    }
  });

  await t.test('Graph MRCA computation works', () => {
    const hypothesisData = loadJSON(join(mammalDataDir, 'hypothesis.json'));
    const taxonomyData = loadJSON(join(mammalDataDir, 'taxonomy.json'));
    
    const builder = new GraphBuilder(hypothesisData.hypothesisId, hypothesisData.rootNodeId);
    
    for (const node of hypothesisData.nodes) {
      builder.addNode(node);
    }
    
    const graph = builder.build(taxonomyData.taxonomy);
    
    // Find human and chimpanzee nodes
    const humanNode = hypothesisData.nodes.find(n => n.taxonId === 'tax_homo_sapiens');
    const chimp = hypothesisData.nodes.find(n => n.taxonId === 'tax_pan_troglodytes');
    
    if (humanNode && chimp) {
      const mrca = graph.getMRCA(humanNode.id, chimp.id);
      assert.ok(mrca, 'Can compute MRCA for human and chimp');
      
      // MRCA should be an ancestor of both
      const humanPath = graph.getPathToRoot(humanNode.id);
      const chimpPath = graph.getPathToRoot(chimp.id);
      assert(humanPath.includes(mrca), 'MRCA is on path from human to root');
      assert(chimpPath.includes(mrca), 'MRCA is on path from chimp to root');
    }
  });
});

test('Mammalian Dataset - Size and Coverage', async (t) => {
  await t.test('Dataset has appropriate size', () => {
    const taxonomyData = loadJSON(join(mammalDataDir, 'taxonomy.json'));
    const hypothesisData = loadJSON(join(mammalDataDir, 'hypothesis.json'));
    
    assert(taxonomyData.taxonomy.length >= 30, 'Taxonomy has at least 30 taxa');
    assert(hypothesisData.nodes.length >= 30, 'Hypothesis has at least 30 nodes');
  });

  await t.test('Dataset represents major mammalian groups', () => {
    const hypothesisData = loadJSON(join(mammalDataDir, 'hypothesis.json'));
    const terminalTaxa = hypothesisData.nodes
      .filter(n => n.type === 'terminal')
      .map(n => n.taxonId);
    
    const hasPrimates = terminalTaxa.some(t => t.includes('homo') || t.includes('pan') || t.includes('gorilla') || t.includes('pongo'));
    const hasRodents = terminalTaxa.some(t => t.includes('mus') || t.includes('rattus'));
    const hasCarnivores = terminalTaxa.some(t => t.includes('felis') || t.includes('canis') || t.includes('panthera'));
    const hasCetaceans = terminalTaxa.some(t => t.includes('balaenoptera') || t.includes('tursiops'));
    const hasArtiodactyls = terminalTaxa.some(t => t.includes('cervus') || t.includes('bos'));
    const hasMarsupia = terminalTaxa.some(t => t.includes('macropus') || t.includes('phalanger'));
    const hasMonotremes = terminalTaxa.some(t => t.includes('ornithorhynchus'));
    
    assert(hasPrimates, 'Dataset includes Primates');
    assert(hasRodents, 'Dataset includes Rodentia');
    assert(hasCarnivores, 'Dataset includes Carnivora');
    assert(hasCetaceans, 'Dataset includes Cetacea');
    assert(hasArtiodactyls, 'Dataset includes Artiodactyla');
    assert(hasMarsupia, 'Dataset includes Marsupialia');
    assert(hasMonotremes, 'Dataset includes Monotremata');
  });

  await t.test('Dataset has divergence estimates for major nodes', () => {
    const divergenceData = loadJSON(join(mammalDataDir, 'divergence-estimates.json'));
    const estimates = divergenceData.divergenceEstimates.phylo_mammals_1 || {};
    
    assert(Object.keys(estimates).length > 5, 'Has divergence estimates for multiple nodes');
  });
});
