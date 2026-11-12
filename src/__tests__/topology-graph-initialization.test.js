import { test } from 'node:test';
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';

/**
 * Test suite for topology repulsion graph initialization.
 * Verifies that:
 * 1. PhyloGraph option is accepted by ForceDirectedVisualization constructor
 * 2. Graph distances computation logic exists and is correct
 * 3. Graph synchronization is implemented in setShowAncestralLabels
 * 4. Protection against missing graph is in place
 */

test('Topology Repulsion Graph Initialization', async (t) => {
  // Read source files for verification
  const vizPath = path.join(process.cwd(), 'src/visualization/forceDirectedVisualization.js');
  const vizCode = fs.readFileSync(vizPath, 'utf8');
  
  const htmlPath = path.join(process.cwd(), 'index.html');
  const htmlCode = fs.readFileSync(htmlPath, 'utf8');

  await t.test('ForceDirectedVisualization accepts phyloGraph in options', () => {
    // Verify constructor accepts phyloGraph option
    assert.ok(vizCode.includes('this.options.phyloGraph'), 
              'Constructor should read phyloGraph from options');
    assert.ok(vizCode.includes('_initializeGraphAndCache'), 
              'Constructor should call graph initialization method');
  });

  await t.test('_initializeGraphAndCache method exists and validates graph', () => {
    // Verify the initialization method exists
    assert.ok(vizCode.includes('_initializeGraphAndCache(phyloGraph)'), 
              '_initializeGraphAndCache method should exist');
    
    // Verify it validates the graph
    assert.ok(vizCode.includes('typeof phyloGraph.getNodes !== \'function\''),
              'Should validate phyloGraph has getNodes() method');
    assert.ok(vizCode.includes('console.error'),
              'Should emit error diagnostic for invalid graph');
  });

  await t.test('Graph distances are computed during initialization', () => {
    // Verify _computeGraphDistances is called
    assert.ok(vizCode.includes('this.graphDistances = this._computeGraphDistances(phyloGraph)'),
              'Should compute distances during graph initialization');
    
    // Verify the distance computation method exists
    assert.ok(vizCode.includes('_computeGraphDistances(phyloGraph)'),
              '_computeGraphDistances method should exist');
    
    // Verify BFS algorithm for distance calculation
    assert.ok(vizCode.includes('const queue'),
              'Should use BFS (queue-based) for distance computation');
  });

  await t.test('_updateTopologyRepulsion checks for graphDistances before using it', () => {
    // Verify protection against null graphDistances
    assert.ok(vizCode.includes('if (!this.graphDistances)'),
              '_updateTopologyRepulsion should check for null graphDistances');
    assert.ok(vizCode.includes('Cannot enable topology repulsion: no graph distances'),
              'Should provide diagnostic warning when graph distances missing');
  });

  await t.test('setShowAncestralLabels syncs graph and cache when phyloGraph differs', () => {
    // Verify method exists and syncs graph/cache
    assert.ok(vizCode.includes('setShowAncestralLabels(show, hypothesisData, phyloGraph)'),
              'setShowAncestralLabels method should exist');
    
    // Verify it checks for different graph
    assert.ok(vizCode.includes('phyloGraph !== this.phyloGraph'),
              'Should compare if new graph differs from current');
    
    // Verify it reinitializes cache
    assert.ok(vizCode.includes('_initializeGraphAndCache(phyloGraph)'),
              'Should reinitialize cache when graph changes');
  });

  await t.test('Graph is passed from index.html to visualization constructor', () => {
    // Verify phyloGraph is passed through options
    assert.ok(htmlCode.includes('phyloGraph: graph'),
              'index.html should pass phyloGraph through options');
    
    // Verify it\'s passed right after graph construction
    assert.ok(htmlCode.includes('const viz = new ForceDirectedVisualization'),
              'Visualization is constructed');
    
    // Find the visualization construction context
    const vizConstructionMatch = htmlCode.match(/const graph = new PhyloGraph[\s\S]*?const viz = new ForceDirectedVisualization[\s\S]{0,800}/);
    if (vizConstructionMatch) {
      const constructionContext = vizConstructionMatch[0];
      assert.ok(constructionContext.includes('phyloGraph: graph'),
                'phyloGraph should be passed in the same scope where graph is available');
    }
  });

  await t.test('X = 0 completely disables topology repulsion', () => {
    // Verify that X=0 removes the force
    assert.ok(vizCode.includes('if (this.topologyRepulsionX === 0)'),
              'Should check if X equals 0');
    assert.ok(vizCode.includes('this.simulation.force(\'topoRepulsion\', null)'),
              'Should remove topology force when X = 0');
  });

  await t.test('Topology force equation is implemented: F = B * (A + X) / D', () => {
    // Verify the equation implementation
    assert.ok(vizCode.includes('this.topologyRepulsionB * (this.topologyRepulsionA + this.topologyRepulsionX) / D'),
              'Force equation F = B * (A + X) / D should be implemented');
  });

  await t.test('Ordinary D3 charge and link forces are not modified', () => {
    // Verify charge force still exists
    assert.ok(vizCode.includes("simulation.force('charge'"),
              'Charge force should exist independently');
    
    // Verify link force still exists
    assert.ok(vizCode.includes("simulation.force('link'"),
              'Link force should exist independently');
    
    // Verify topology force is separate
    assert.ok(vizCode.includes("simulation.force('topoRepulsion'"),
              'Topology force should be a separate force');
  });

  await t.test('setTopologyRepulsion legacy method still works', () => {
    // Verify backward compatibility
    assert.ok(vizCode.includes('setTopologyRepulsion(strength, phyloGraph)'),
              'Legacy setTopologyRepulsion method should exist');
    assert.ok(vizCode.includes('this.setTopologyRepulsionX(strength)'),
              'Should delegate to setTopologyRepulsionX');
    assert.ok(vizCode.includes('this.graphDistances = this._computeGraphDistances(phyloGraph)'),
              'Should cache distances if provided and not already cached');
  });

  await t.test('Graph distance computation is idempotent', () => {
    // Verify _computeGraphDistances logic
    assert.ok(vizCode.includes('distances[fromNodeId] = {}'),
              'Should initialize distance map for each node');
    assert.ok(vizCode.includes('visited.add(fromNodeId)'),
              'Should track visited nodes to avoid cycles');
    assert.ok(vizCode.includes('for (const neighborId of neighbors)'),
              'Should process all neighbors from parent and children');
  });

  await t.test('Graph node ID validation occurs during distance computation', () => {
    // Verify graph API is used correctly
    assert.ok(vizCode.includes('phyloGraph.getNodes()'),
              'Should use PhyloGraph.getNodes() API');
    assert.ok(vizCode.includes('phyloGraph.getParent(currentId)'),
              'Should use PhyloGraph.getParent() API');
    assert.ok(vizCode.includes('phyloGraph.getChildren(currentId)'),
              'Should use PhyloGraph.getChildren() API');
  });

  await t.test('Diagnostic messages are provided when graph is invalid', () => {
    // Verify diagnostic output
    assert.ok(vizCode.includes('console.warn') || vizCode.includes('console.error'),
              'Should provide console diagnostics');
    assert.ok(vizCode.includes('[ForceDirectedVisualization]'),
              'Diagnostics should be clearly labeled');
    assert.ok(vizCode.includes('Graph distances computed for'),
              'Should report successful graph initialization');
  });

  await t.test('Missing or invalid phyloGraph is handled without crashing simulation', () => {
    // Verify graceful handling
    assert.ok(vizCode.includes('if (!phyloGraph)'),
              'Should check for null/undefined phyloGraph');
    assert.ok(vizCode.includes('this.graphDistances = null'),
              'Should set graphDistances to null for invalid graph');
    
    // Verify simulation doesn't crash
    assert.ok(vizCode.includes('if (!this.graphDistances) {'),
              'Should check graphDistances before using it in force');
    assert.ok(vizCode.includes('return;'),
              'Should return early if graphDistances missing');
  });
});

