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

  // Test 2: Verify Topology Repulsion slider exists
  await t.test('Topology Repulsion slider HTML has correct initial values', () => {
    const htmlPath = path.join(process.cwd(), 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    
    assert.ok(html.includes('id="topology-repulsion-slider"'), 'Topology repulsion slider exists');
    assert.ok(html.includes('topology-repulsion'), 'Topology repulsion slider has correct ID pattern');
    assert.ok(html.includes('min="0"'), 'Topology slider has min=0');
    assert.ok(html.includes('max="100"'), 'Topology slider has max=100');
    assert.ok(html.includes('value="0"'), 'Topology slider defaults to 0 (disabled)');
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

  // Test 4: Verify topology repulsion initialization
  await t.test('HTML initialization code synchronizes topology repulsion with visualization', () => {
    const htmlPath = path.join(process.cwd(), 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    
    assert.ok(html.includes('initialTopologyRepulsion'), 'Initialization reads topology slider');
    assert.ok(html.includes('setTopologyRepulsion'), 'Initialization calls setTopologyRepulsion');
    assert.ok(html.includes('topologyRepulsionSlider'), 'Topology slider event listener exists');
  });

  // Test 5: Verify event listener maps values correctly
  await t.test('Charge slider event listener maps positive UI values to negative D3 values', () => {
    const htmlPath = path.join(process.cwd(), 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    
    // Find the event listener code
    const listenerMatch = html.match(/chargeSlider\.addEventListener\('input'[\s\S]*?viz\.setChargeStrength\(d3Value\);/);
    assert.ok(listenerMatch, 'Charge slider has input event listener');
    
    const listenerCode = listenerMatch[0];
    assert.ok(listenerCode.includes('const uiValue = parseInt'), 'Reads UI value as integer');
    assert.ok(listenerCode.includes('const d3Value = uiValue === 0 ? 0 : -uiValue'), 'Maps positive UI to negative D3');
    assert.ok(listenerCode.includes('charge-value'), 'Updates display value');
  });

  // Test 6: Verify topology repulsion force method exists
  await t.test('ForceDirectedVisualization has setTopologyRepulsion method', () => {
    const vizPath = path.join(process.cwd(), 'src/visualization/forceDirectedVisualization.js');
    const code = fs.readFileSync(vizPath, 'utf8');
    
    assert.ok(code.includes('setTopologyRepulsion(strength, phyloGraph)'), 'setTopologyRepulsion method exists');
    assert.ok(code.includes('this.topologyRepulsionStrength'), 'Stores topology repulsion state');
    assert.ok(code.includes('_computeGraphDistances'), 'Has distance computation method');
    assert.ok(code.includes('_calculateTopoRepulsion'), 'Has repulsion calculation method');
  });

  // Test 7: Verify distance computation exists
  await t.test('ForceDirectedVisualization computes graph distances with BFS', () => {
    const vizPath = path.join(process.cwd(), 'src/visualization/forceDirectedVisualization.js');
    const code = fs.readFileSync(vizPath, 'utf8');
    
    assert.ok(code.includes('_computeGraphDistances'), 'Distance computation method exists');
    assert.ok(code.includes('breadth-first search') || code.includes('BFS'), 'Uses BFS algorithm');
    assert.ok(code.includes('const queue'), 'Uses queue data structure');
  });

  // Test 8: Verify distance-decay formula
  await t.test('Topology repulsion uses inverse-square distance decay', () => {
    const vizPath = path.join(process.cwd(), 'src/visualization/forceDirectedVisualization.js');
    const code = fs.readFileSync(vizPath, 'utf8');
    
    assert.ok(code.includes('_calculateTopoRepulsion'), 'Decay calculation method exists');
    assert.ok(code.includes('graphDistance === 0'), 'Handles zero distance');
    assert.ok(code.includes('scaleFactor === 0'), 'Handles disabled feature (factor=0)');
    assert.ok(code.includes('1 + (graphDistance * graphDistance)'), 'Uses inverse-square decay');
  });

  // Test 9: Verify forces are separate and independent
  await t.test('Charge strength and topology repulsion are independent forces', () => {
    const vizPath = path.join(process.cwd(), 'src/visualization/forceDirectedVisualization.js');
    const code = fs.readFileSync(vizPath, 'utf8');
    
    assert.ok(code.includes('this.currentChargeStrength'), 'Stores charge strength separately');
    assert.ok(code.includes('this.topologyRepulsionStrength'), 'Stores topology strength separately');
    assert.ok(code.includes("this.simulation.force('charge'"), 'Charge is separate D3 force');
    assert.ok(code.includes("this.simulation.force('topoRepulsion'"), 'Topology is separate D3 force');
  });

  // Test 10: Verify topology force can be disabled
  await t.test('Topology repulsion force can be disabled by setting strength to 0', () => {
    const vizPath = path.join(process.cwd(), 'src/visualization/forceDirectedVisualization.js');
    const code = fs.readFileSync(vizPath, 'utf8');
    
    assert.ok(code.includes('if (strength === 0 || !this.simulation)'), 'Checks for zero strength');
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

  // Test 12: Verify topology repulsion initialization doesn't compute distances when disabled
  await t.test('Topology repulsion with strength=0 does not compute graph distances', () => {
    const vizPath = path.join(process.cwd(), 'src/visualization/forceDirectedVisualization.js');
    const code = fs.readFileSync(vizPath, 'utf8');
    
    // Check that the method returns early when strength is 0
    assert.ok(code.includes('if (strength === 0 || !this.simulation)'), 'Early return when strength=0');
    
    // The early return should happen BEFORE _computeGraphDistances is called
    const setTopoMethod = code.substring(
      code.indexOf('setTopologyRepulsion(strength, phyloGraph)'),
      code.indexOf('setTopologyRepulsion(strength, phyloGraph)') + 2000
    );
    
    const earlyReturnIdx = setTopoMethod.indexOf('if (strength === 0 || !this.simulation)');
    const computeDistIdx = setTopoMethod.indexOf('_computeGraphDistances');
    
    assert.ok(earlyReturnIdx > -1, 'Has early return check');
    assert.ok(computeDistIdx > -1, 'Has distance computation');
    // Early return should come first, preventing distance computation when disabled
    assert.ok(earlyReturnIdx < computeDistIdx, 'Early return happens before distance computation');
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

  // Test 2: Verify event listeners are attached
  await t.test('HTML event listeners for offset sliders are defined', () => {
    const htmlPath = path.join(process.cwd(), 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    
    assert.ok(html.includes('silhouette-x-offset-slider'), 'Horizontal offset slider referenced in listeners');
    assert.ok(html.includes('setSilhouetteXOffset'), 'setSilhouetteXOffset method called from listener');
    assert.ok(html.includes('silhouette-y-offset-slider'), 'Vertical offset slider referenced in listeners');
    assert.ok(html.includes('setSilhouetteYOffset'), 'setSilhouetteYOffset method called from listener');
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
