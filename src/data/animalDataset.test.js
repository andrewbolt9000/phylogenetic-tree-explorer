import test from 'node:test';
import assert from 'node:assert';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { TaxonomyLoader, fsReadyPromise as taxonomyFsReady } from './taxonomyLoader.js';
import { HypothesisLoader, fsReadyPromise as hypothesisFsReady } from './hypothesisLoader.js';
import { GraphBuilder } from '../graph/PhyloGraph.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', '..', 'data', 'animals');
const schemaDir = join(__dirname, '..', '..', 'data', 'schemas');

await Promise.all([taxonomyFsReady, hypothesisFsReady]);

test('Animal Dataset - Integration', () => {
  const taxonomyLoader = new TaxonomyLoader(join(schemaDir, 'taxonomy.schema.json'));
  const taxonomy = taxonomyLoader.load(join(dataDir, 'taxonomy.json'));

  assert.ok(taxonomy);
  assert.ok(Object.keys(taxonomy.taxa).length > 500);

  const hypothesisLoader = new HypothesisLoader(join(schemaDir, 'hypothesis.schema.json'));
  const hypothesis = hypothesisLoader.load(
    join(dataDir, 'hypothesis.json'),
    taxonomy.taxa
  );

  assert.ok(hypothesis);

  const selectedNodes = hypothesis.nodes.filter(node => node.taxonId);
  const terminals = hypothesis.nodes.filter(node => node.type === 'terminal');
  const internalTaxa = hypothesis.nodes.filter(
    node => node.type === 'internal' && node.taxonId
  );

  assert.strictEqual(selectedNodes.length, 593);
  assert.strictEqual(terminals.length, 591);
  assert.strictEqual(internalTaxa.length, 2);

  const builder = new GraphBuilder(hypothesis.hypothesisId, hypothesis.rootNodeId);
  for (const node of hypothesis.nodes) builder.addNode(node);

  const graph = builder.build(Object.values(taxonomy.taxa));
  assert.ok(graph);

  const validation = graph.validate();
  assert(
    validation.isValid,
    `Graph validation failed: ${JSON.stringify(validation.errors)}`
  );

  assert.ok(graph.getRoot());
  assert.strictEqual(graph.getTerminals().length, 591);
  assert.strictEqual(graph.getInternals().length, hypothesis.nodes.length - 591);
});
