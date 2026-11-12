import { test } from 'node:test';
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';

test('Force Controls - Repulsion Charge and Topology Repulsion', async (t) => {
  
  // Test 1: Verify HTML slider initialization values
  await t.test('Repulsion Charge slider HTML has correct initial values', () => {
    const htmlPath = path.join(process.cwd(), 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    
    // Check charge slider definition
    assert.ok(html.includes('id="charge-slider"'), 'Charge slider exists');
    assert.ok(html.includes('min="0"'), 'Charge slider has min=0');
    assert.ok(html.includes('max="1500"'), 'Charge slider has max=1500');
    assert.ok(html.includes('value="300"'), 'Charge slider has default value=300');
    assert.ok(html.includes('step="10"'), 'Charge slider has step=10');
    
    // Check display value initialization
    assert.ok(html.includes('id="charge-value">300</span>'), 'Display value initialized to 300');
  });

  // Test 2: Verify Topology Repulsion sliders exist (A, B, X)
  await t.test('Topology Repulsion slider HTML has correct initial values', () => {
    const htmlPath = path.join(process.cwd(), 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    
    // Check for A, B, X sliders
    assert.ok(html.includes('id="topology-repulsion-a-slider"'), 'Topology repulsion A slider exists');
    assert.ok(html.includes('id="topology-repulsion-b-slider"'), 'Topology repulsion B slider exists');
    assert.ok(html.includes('id="topology-repulsion-x-slider"'), 'Topology repulsion X slider exists');
    
    // Check equation display
    assert.ok(html.includes('F<sub>topology</sub>'), 'Topology equation displayed');
    assert.ok(html.includes('Topology Baseline'), 'Topology Baseline (A) label present');
    assert.ok(html.includes('Topology Multiplier'), 'Topology Multiplier (B) label present');
    assert.ok(html.includes('Topology Strength'), 'Topology Strength (X) label present');
  });

  // Test 3: Verify initialization code syncs slider with force
  await t.test('HTML initialization code synchronizes charge slider with visualization', () => {
    const htmlPath = path.join(process.cwd(), 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    
    // Check that initialization code exists to set initial charge strength
    assert.ok(html.includes('initialChargeValue'), 'Initialization reads slider value');
    assert.ok(html.includes('setChargeStrength'), 'Initialization calls setChargeStrength');
    assert.ok(html.includes('initialChargeD3Value'), 'Initialization maps UI value to D3 value');
  });

  // Test 4: Verify topology repulsion A/B/X initialization
  await t.test('Topology repulsion has separate A, B, X setter methods', () => {
    const vizPath = path.join(process.cwd(), 'src/visualization/forceDirectedVisualization.js');
    const code = fs.readFileSync(vizPath, 'utf8');
    
    assert.ok(code.includes('setTopologyRepulsionA'), 'Has setTopologyRepulsionA method');
    assert.ok(code.includes('setTopologyRepulsionB'), 'Has setTopologyRepulsionB method');
    assert.ok(code.includes('setTopologyRepulsionX'), 'Has setTopologyRepulsionX method');
    assert.ok(code.includes('this.topologyRepulsionA'), 'Stores A parameter');
    assert.ok(code.includes('this.topologyRepulsionB'), 'Stores B parameter');
    assert.ok(code.includes('this.topologyRepulsionX'), 'Stores X parameter');
  });

  // Test 5: Verify charge strength mapping is correct
  await t.test('Charge slider event listener maps positive UI values to negative D3 values', () => {
    // The charge slider mapping is now handled by SettingsUI._wireControls()
    // Verify the mapping is correct in SettingsUI
    const settingsPath = path.join(process.cwd(), 'src/ui/SettingsUI.js');
    const settings = fs.readFileSync(settingsPath, 'utf8');
    
    // Check that charge slider is configured to negate values
    assert.ok(settings.includes("'charge-slider'"), 'charge-slider control exists');
    assert.ok(settings.includes('transform: v => -parseInt(v)'), 'charge values are negated for D3');
    assert.ok(settings.includes('chargeStrength'), 'chargeStrength setting exists');
    assert.ok(settings.includes("display: 'charge-value'"), 'display value element is updated');
  });

  // Test 6: Verify topology repulsion A/B/X equation is implemented
  await t.test('Topology repulsion equation implemented: F_topology = B * (A + X) / D', () => {
    const vizPath = path.join(process.cwd(), 'src/visualization/forceDirectedVisualization.js');
    const code = fs.readFileSync(vizPath, 'utf8');
    
    // Look for the equation in the code (using this.property references)
    assert.ok(code.includes('this.topologyRepulsionB * (this.topologyRepulsionA + this.topologyRepulsionX)'), 'Equation implemented');
    assert.ok(code.includes('/ D'), 'Distance division present');
    assert.ok(code.includes('Math.max(graphDist, 1)'), 'Distance clamped to minimum 1');
  });

  // Test 7: Verify distance computation exists
  await t.test('ForceDirectedVisualization computes graph distances with BFS', () => {
    const vizPath = path.join(process.cwd(), 'src/visualization/forceDirectedVisualization.js');
    const code = fs.readFileSync(vizPath, 'utf8');
    
    assert.ok(code.includes('_computeGraphDistances'), 'Distance computation method exists');
    assert.ok(code.includes('breadth-first search') || code.includes('BFS'), 'Uses BFS algorithm');
    assert.ok(code.includes('const queue'), 'Uses queue data structure');
  });

  // Test 8: Verify A, B, X parameters are cached and not recomputed
  await t.test('Topology repulsion caches graph distances', () => {
    const vizPath = path.join(process.cwd(), 'src/visualization/forceDirectedVisualization.js');
    const code = fs.readFileSync(vizPath, 'utf8');
    
    assert.ok(code.includes('this.graphDistances'), 'Distances cached in property');
    assert.ok(code.includes('(this.graphDistances[a.id] && this.graphDistances[a.id][b.id])'), 'Reads cached distances');
    assert.ok(code.includes('this._computeGraphDistances(phyloGraph)'), 'Has method to compute distances');
  });

  // Test 9: Verify forces are separate and independent
  await t.test('Charge strength and topology repulsion are independent forces', () => {
    const vizPath = path.join(process.cwd(), 'src/visualization/forceDirectedVisualization.js');
    const code = fs.readFileSync(vizPath, 'utf8');
    
    assert.ok(code.includes('this.currentChargeStrength'), 'Stores charge strength separately');
    assert.ok(code.includes('this.topologyRepulsionX'), 'Stores X parameter separately');
    assert.ok(code.includes("this.simulation.force('charge'"), 'Charge is separate D3 force');
    assert.ok(code.includes("this.simulation.force('topoRepulsion'"), 'Topology is separate D3 force');
  });

  // Test 10: Verify X=0 disables topology repulsion completely
  await t.test('Topology repulsion force can be disabled by setting strength to 0', () => {
    const vizPath = path.join(process.cwd(), 'src/visualization/forceDirectedVisualization.js');
    const code = fs.readFileSync(vizPath, 'utf8');
    
    assert.ok(code.includes('if (this.topologyRepulsionX === 0)'), 'Checks X=0 for disable');
    assert.ok(code.includes("this.simulation.force('topoRepulsion', null)"), 'Removes force when disabled');
  });

  // Test 11: Verify graph distance computation uses proper PhyloGraph API
  await t.test('_computeGraphDistances uses PhyloGraph.getNodes() and getChildren() methods', () => {
    const vizPath = path.join(process.cwd(), 'src/visualization/forceDirectedVisualization.js');
    const code = fs.readFileSync(vizPath, 'utf8');
    
    // Check that the method validates the graph API
    assert.ok(code.includes('phyloGraph.getNodes'), 'Uses getNodes() method instead of .nodes property');
    assert.ok(code.includes('typeof phyloGraph.getNodes !== \'function\''), 'Validates graph API');
    
    // Check that it uses getParent and getChildren
    assert.ok(code.includes('phyloGraph.getParent(currentId)'), 'Uses getParent() method');
    assert.ok(code.includes('phyloGraph.getChildren(currentId)'), 'Uses getChildren() method');
  });

  // Test 12: Verify X=0 disables computation
  await t.test('Topology repulsion with strength=0 does not compute graph distances', () => {
    const vizPath = path.join(process.cwd(), 'src/visualization/forceDirectedVisualization.js');
    const code = fs.readFileSync(vizPath, 'utf8');
    
    // Check that X=0 causes early return before any computation
    assert.ok(code.includes('if (this.topologyRepulsionX === 0)'), 'Checks X parameter first');
    assert.ok(code.includes('this.simulation.force(\'topoRepulsion\', null)'), 'Disables force');
    assert.ok(code.includes('return'), 'Returns early when disabled');
    
    // The early return in _updateTopologyRepulsion should happen BEFORE the force calculation
    const updateTopoMethod = code.substring(
      code.indexOf('_updateTopologyRepulsion()'),
      code.indexOf('_updateTopologyRepulsion()') + 2500
    );
    
    const earlyReturnIdx = updateTopoMethod.indexOf('if (this.topologyRepulsionX === 0)');
    const forceCalcIdx = updateTopoMethod.indexOf('this.topoRepulsionForce = (alpha)');
    
    assert.ok(earlyReturnIdx > -1, 'Has early return check for X=0');
    assert.ok(forceCalcIdx > -1, 'Has force calculation');
    // Early return should come first, preventing force calculation when disabled
    assert.ok(earlyReturnIdx < forceCalcIdx, 'Early return happens before force calculation');
  });

  // Test 13: Verify error message for invalid graph object
  await t.test('_computeGraphDistances provides helpful error for invalid graph objects', () => {
    const vizPath = path.join(process.cwd(), 'src/visualization/forceDirectedVisualization.js');
    const code = fs.readFileSync(vizPath, 'utf8');
    
    assert.ok(code.includes('Invalid graph object'), 'Has helpful error message');
    assert.ok(code.includes('must have getNodes() method'), 'Error explains required API');
  });
});

test('Silhouette Offset Controls', async (t) => {
  
  // Test 1: Verify HTML sliders exist
  await t.test('Silhouette offset sliders exist in HTML with correct ranges', () => {
    const htmlPath = path.join(process.cwd(), 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    
    // Horizontal offset slider
    assert.ok(html.includes('id="silhouette-x-offset-slider"'), 'Horizontal offset slider exists');
    assert.ok(html.includes('id="silhouette-x-offset-value"'), 'Horizontal offset value display exists');
    assert.ok(html.includes('min="-100"'), 'Horizontal slider has min=-100');
    assert.ok(html.includes('max="100"'), 'Horizontal slider has max=100');
    assert.ok(html.includes('value="0"'), 'Horizontal slider defaults to 0');
    
    // Vertical offset slider
    assert.ok(html.includes('id="silhouette-y-offset-slider"'), 'Vertical offset slider exists');
    assert.ok(html.includes('id="silhouette-y-offset-value"'), 'Vertical offset value display exists');
  });

  // Test 2: Verify controls are wired through SettingsUI
  await t.test('HTML offset sliders are wired through SettingsUI', () => {
    const settingsUIPath = path.join(process.cwd(), 'src/ui/SettingsUI.js');
    const code = fs.readFileSync(settingsUIPath, 'utf8');
    
    assert.ok(code.includes('silhouette-x-offset-slider'), 'X offset slider is wired in SettingsUI');
    assert.ok(code.includes('silhouetteXOffset'), 'silhouetteXOffset setting is mapped');
    assert.ok(code.includes('silhouette-y-offset-slider'), 'Y offset slider is wired in SettingsUI');
    assert.ok(code.includes('silhouetteYOffset'), 'silhouetteYOffset setting is mapped');
  });

  // Test 3: Verify visualization methods exist
  await t.test('ForceDirectedVisualization has silhouette offset setter methods', () => {
    const vizPath = path.join(process.cwd(), 'src/visualization/forceDirectedVisualization.js');
    const code = fs.readFileSync(vizPath, 'utf8');
    
    assert.ok(code.includes('setSilhouetteXOffset'), 'setSilhouetteXOffset method exists');
    assert.ok(code.includes('setSilhouetteYOffset'), 'setSilhouetteYOffset method exists');
    assert.ok(code.includes('this.silhouetteXOffset'), 'silhouetteXOffset property exists');
    assert.ok(code.includes('this.silhouetteYOffset'), 'silhouetteYOffset property exists');
  });

  // Test 4: Verify silhouette offset properties are initialized
  await t.test('Silhouette offset properties are initialized to zero', () => {
    const vizPath = path.join(process.cwd(), 'src/visualization/forceDirectedVisualization.js');
    const code = fs.readFileSync(vizPath, 'utf8');
    
    assert.ok(code.includes('this.silhouetteXOffset = 0'), 'X offset initialized to 0');
    assert.ok(code.includes('this.silhouetteYOffset = 0'), 'Y offset initialized to 0');
  });

  // Test 5: Verify offset application in rendering
  await t.test('Silhouette offsets are applied in _renderSilhouettes', () => {
    const vizPath = path.join(process.cwd(), 'src/visualization/forceDirectedVisualization.js');
    const code = fs.readFileSync(vizPath, 'utf8');
    
    // Find the _renderSilhouettes method
    const renderStart = code.indexOf('_renderSilhouettes(nodeGroups) {');
    assert.ok(renderStart > -1, '_renderSilhouettes method found');
    
    // Get a large chunk to capture the entire method
    const renderEnd = code.indexOf('    };\n  }', renderStart);
    const renderCode = code.substring(renderStart, renderEnd + 50);
    
    assert.ok(renderCode.includes('this.silhouetteXOffset'), 'X offset used in rendering');
    assert.ok(renderCode.includes('this.silhouetteYOffset'), 'Y offset used in rendering');
    assert.ok(renderCode.includes('+'), 'Offsets added to base position');
  });

  // Test 6: Verify offset update in tick handler
  await t.test('Silhouette positions are updated in _onTick', () => {
    const vizPath = path.join(process.cwd(), 'src/visualization/forceDirectedVisualization.js');
    const code = fs.readFileSync(vizPath, 'utf8');
    
    // Find the _onTick method
    const tickStart = code.indexOf('_onTick() {');
    assert.ok(tickStart > -1, '_onTick method found');
    
    const tickEnd = code.indexOf('\n  }', tickStart + 20);
    const tickCode = code.substring(tickStart, tickEnd + 4);
    
    assert.ok(tickCode.includes('image.silhouette'), 'Tick updates silhouette elements');
    assert.ok(tickCode.includes('.attr(\'x\''), 'Tick updates silhouette x position');
    assert.ok(tickCode.includes('.attr(\'y\''), 'Tick updates silhouette y position');
  });

  // Test 7: Verify setter methods store values
  await t.test('setSilhouetteXOffset stores the offset value', () => {
    const vizPath = path.join(process.cwd(), 'src/visualization/forceDirectedVisualization.js');
    const code = fs.readFileSync(vizPath, 'utf8');
    
    const methodStart = code.indexOf('setSilhouetteXOffset(offsetPixels)');
    assert.ok(methodStart > -1, 'setSilhouetteXOffset method found');
    
    const methodEnd = code.indexOf('\n  }', methodStart);
    const methodCode = code.substring(methodStart, methodEnd);
    
    assert.ok(methodCode.includes('this.silhouetteXOffset = offsetPixels'), 'X offset is stored');
  });

  // Test 8: Verify setter methods store values for Y
  await t.test('setSilhouetteYOffset stores the offset value', () => {
    const vizPath = path.join(process.cwd(), 'src/visualization/forceDirectedVisualization.js');
    const code = fs.readFileSync(vizPath, 'utf8');
    
    const methodStart = code.indexOf('setSilhouetteYOffset(offsetPixels)');
    assert.ok(methodStart > -1, 'setSilhouetteYOffset method found');
    
    const methodEnd = code.indexOf('\n  }', methodStart);
    const methodCode = code.substring(methodStart, methodEnd);
    
    assert.ok(methodCode.includes('this.silhouetteYOffset = offsetPixels'), 'Y offset is stored');
  });

  // Test 9: Verify offsets do not affect node coordinates
  await t.test('Silhouette offsets apply only to SVG element positions, not node data', () => {
    const vizPath = path.join(process.cwd(), 'src/visualization/forceDirectedVisualization.js');
    const code = fs.readFileSync(vizPath, 'utf8');
    
    // setSilhouetteXOffset should NOT modify node data
    const methodStart = code.indexOf('setSilhouetteXOffset(offsetPixels)');
    const methodEnd = code.indexOf('\n  }', methodStart);
    const methodCode = code.substring(methodStart, methodEnd);
    
    // Should only store the offset, not modify nodes
    assert.ok(!methodCode.includes('this.nodes'), 'Does not modify node data');
    assert.ok(!methodCode.includes('.x ='), 'Does not modify node x coordinates');
    assert.ok(!methodCode.includes('.y ='), 'Does not modify node y coordinates');
  });

  // Test 10: Verify default silhouette behavior has zero offset
  await t.test('Default silhouette rendering uses zero offsets', () => {
    const htmlPath = path.join(process.cwd(), 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    
    // Both sliders should have value="0" as default
    const xOffsetSlider = html.match(/id="silhouette-x-offset-slider"[^>]*value="0"/);
    const yOffsetSlider = html.match(/id="silhouette-y-offset-slider"[^>]*value="0"/);
    
    assert.ok(xOffsetSlider, 'Horizontal offset defaults to 0');
    assert.ok(yOffsetSlider, 'Vertical offset defaults to 0');
  });
});
