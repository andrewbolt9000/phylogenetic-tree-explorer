import { GraphBuilder } from './src/graph/PhyloGraph.js';
import { TreeVisibilityState } from './src/graph/TreeVisibilityState.js';

// Create test graph
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

// Create visibility state
const visibility = new TreeVisibilityState(graph);

console.log('=== Initial State ===');
console.log('visibilityState.visibleNodeIds:', Array.from(visibility.visibleNodeIds).sort());
console.log('visibilityState.getVisibleNodeIds():', Array.from(visibility.getVisibleNodeIds()).sort());

// Collapse n1
visibility.collapseNode('n1');

console.log('\n=== After collapseNode("n1") ===');
console.log('visibilityState.visibleNodeIds:', Array.from(visibility.visibleNodeIds).sort());
console.log('visibilityState.getVisibleNodeIds():', Array.from(visibility.getVisibleNodeIds()).sort());
console.log('visibilityState.collapsedNodeIds:', Array.from(visibility.collapsedNodeIds).sort());
