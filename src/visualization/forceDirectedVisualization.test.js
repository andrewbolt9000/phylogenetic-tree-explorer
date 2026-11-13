import test from 'node:test';
import assert from 'node:assert/strict';
import { ForceDirectedVisualization } from './forceDirectedVisualization.js';

function createTestVisualization(children, nodes) {
  const viz = Object.create(ForceDirectedVisualization.prototype);

  viz.phyloGraph = {
    getChildren(nodeId) {
      return children[nodeId] || [];
    }
  };

  viz.nodes = nodes;
  return viz;
}

test('Ancestral labels use resolved display labels for one descendant', () => {
  const viz = createTestVisualization(
    { ancestor: ['species-1'] },
    [{
      id: 'species-1',
      type: 'terminal',
      label: 'Panthera leo',
      commonName: 'Lion'
    }]
  );

  assert.equal(
    viz._generateAncestralLabel('ancestor', null),
    'Ancestor of Panthera leo'
  );
});

test('Ancestral labels use resolved display labels for two descendants', () => {
  const viz = createTestVisualization(
    { ancestor: ['species-1', 'species-2'] },
    [
      { id: 'species-1', type: 'terminal', label: 'Canis lupus', commonName: 'Wolf' },
      { id: 'species-2', type: 'terminal', label: 'Felis catus', commonName: 'Cat' }
    ]
  );

  assert.equal(
    viz._generateAncestralLabel('ancestor', null),
    'Common ancestor of Canis lupus and Felis catus'
  );
});

test('Ancestral labels sort and display four descendants by resolved label', () => {
  const viz = createTestVisualization(
    { ancestor: ['d', 'b', 'a', 'c'] },
    [
      { id: 'a', type: 'terminal', label: 'Aardvark', commonName: 'Zebra' },
      { id: 'b', type: 'terminal', label: 'Bear', commonName: 'Antelope' },
      { id: 'c', type: 'terminal', label: 'Cougar', commonName: 'Lion' },
      { id: 'd', type: 'terminal', label: 'Dolphin', commonName: 'Cat' }
    ]
  );

  assert.equal(
    viz._generateAncestralLabel('ancestor', null),
    'Common ancestor of Aardvark, Bear, Cougar, and 1 other'
  );
});

test('Ancestral labels preserve an available formal clade name', () => {
  const viz = createTestVisualization({}, []);

  assert.equal(
    viz._generateAncestralLabel('ancestor', { cladeName: 'Mammalia' }),
    'Mammalia'
  );
});

test('Ancestral labels return null when there are no terminal descendants', () => {
  const viz = createTestVisualization(
    { ancestor: ['internal-1'] },
    [{ id: 'internal-1', type: 'internal', label: 'Internal node' }]
  );

  assert.equal(viz._generateAncestralLabel('ancestor', null), null);
});
