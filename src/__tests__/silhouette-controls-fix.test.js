import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

test('Silhouette Controls Fix', async (t) => {
  
  await t.test('HTML has all silhouette controls', () => {
    const indexContent = fs.readFileSync('./index.html', 'utf-8');
    
    // Check size control
    assert.match(indexContent, /id="silhouette-size-slider"/,
      'should have silhouette-size-slider control');
    
    // Check horizontal offset control
    assert.match(indexContent, /id="silhouette-x-offset-slider"/,
      'should have silhouette-x-offset-slider control');
    
    // Check vertical offset control
    assert.match(indexContent, /id="silhouette-y-offset-slider"/,
      'should have silhouette-y-offset-slider control');
    
    // Check NEW grayscale control
    assert.match(indexContent, /id="silhouette-grayscale-slider"/,
      'should have silhouette-grayscale-slider control');
    
    // Check NEW opacity control
    assert.match(indexContent, /id="silhouette-opacity-slider"/,
      'should have silhouette-opacity-slider control');
  });

  await t.test('grayscale slider has correct range and defaults', () => {
    const indexContent = fs.readFileSync('./index.html', 'utf-8');
    
    // Extract the grayscale slider attributes
    const sliderMatch = indexContent.match(
      /<input[^>]*id="silhouette-grayscale-slider"[^>]*>/s
    );
    
    assert.ok(sliderMatch, 'grayscale slider should exist');
    assert.match(sliderMatch[0], /min="0"/, 'grayscale min should be 0');
    assert.match(sliderMatch[0], /max="100"/, 'grayscale max should be 100');
    assert.match(sliderMatch[0], /value="50"/, 'grayscale default should be 50 (gray)');
    assert.match(sliderMatch[0], /step="5"/, 'grayscale step should be 5');
  });

  await t.test('opacity slider has correct range and defaults', () => {
    const indexContent = fs.readFileSync('./index.html', 'utf-8');
    
    // Extract the opacity slider attributes
    const sliderMatch = indexContent.match(
      /<input[^>]*id="silhouette-opacity-slider"[^>]*>/s
    );
    
    assert.ok(sliderMatch, 'opacity slider should exist');
    assert.match(sliderMatch[0], /min="0"/, 'opacity min should be 0');
    assert.match(sliderMatch[0], /max="100"/, 'opacity max should be 100');
    assert.match(sliderMatch[0], /value="100"/, 'opacity default should be 100');
    assert.match(sliderMatch[0], /step="5"/, 'opacity step should be 5');
  });

  await t.test('HTML has event listeners for grayscale and opacity controls', () => {
    const indexContent = fs.readFileSync('./index.html', 'utf-8');
    
    // Check grayscale listener
    assert.match(indexContent, /silhouette-grayscale-slider.*addEventListener/s,
      'should have event listener for grayscale slider');
    
    assert.match(indexContent, /setSilhouetteGrayscale/,
      'event listener should call setSilhouetteGrayscale');
    
    // Check opacity listener
    assert.match(indexContent, /silhouette-opacity-slider.*addEventListener/s,
      'should have event listener for opacity slider');
    
    assert.match(indexContent, /setSilhouetteOpacity/,
      'event listener should call setSilhouetteOpacity');
  });

  await t.test('ForceDirectedVisualization has silhouette property initialization', () => {
    const vizContent = fs.readFileSync('./src/visualization/forceDirectedVisualization.js', 'utf-8');
    
    // Check that silhouetteOpacity is initialized
    assert.match(vizContent, /this\.silhouetteOpacity\s*=\s*1\.0/,
      'should initialize silhouetteOpacity to 1.0');
    
    // Check that silhouetteGrayscale is initialized
    assert.match(vizContent, /this\.silhouetteGrayscale\s*=\s*50/,
      'should initialize silhouetteGrayscale to 50');
  });

  await t.test('ForceDirectedVisualization has setter methods', () => {
    const vizContent = fs.readFileSync('./src/visualization/forceDirectedVisualization.js', 'utf-8');
    
    // Check setSilhouetteOpacity
    assert.match(vizContent, /setSilhouetteOpacity\s*\(\s*opacity\s*\)/,
      'should have setSilhouetteOpacity method');
    
    // Check setSilhouetteGrayscale
    assert.match(vizContent, /setSilhouetteGrayscale\s*\(\s*grayscale\s*\)/,
      'should have setSilhouetteGrayscale method');
  });

  await t.test('_getSilhouetteGrayscaleFilter helper exists', () => {
    const vizContent = fs.readFileSync('./src/visualization/forceDirectedVisualization.js', 'utf-8');
    
    // Check the helper function exists
    assert.match(vizContent, /_getSilhouetteGrayscaleFilter\s*\(\s*grayscalePercent\s*\)/,
      'should have _getSilhouetteGrayscaleFilter helper');
    
    // Check it returns different filters based on value
    assert.match(vizContent, /grayscalePercent === 50/,
      'should handle 50% case');
    
    assert.match(vizContent, /grayscalePercent < 50/,
      'should handle < 50% case (darker)');
    
    assert.match(vizContent, /grayscale\(100%\)/,
      'should use grayscale(100%) filter');
    
    assert.match(vizContent, /brightness\(/,
      'should use brightness() filter');
  });

  await t.test('_onTick updates silhouette-group transforms', () => {
    const vizContent = fs.readFileSync('./src/visualization/forceDirectedVisualization.js', 'utf-8');
    
    // Find the _onTick method
    assert.match(vizContent, /_onTick\s*\(\)/,
      '_onTick method should exist');
    
    // Check that it updates silhouette-group
    assert.match(vizContent, /selectAll\('g\.silhouette-group'\)/,
      'should select silhouette-group elements');
    
    // Check that transform uses offset values
    assert.match(vizContent, /translate.*silhouetteXOffset.*silhouetteYOffset/,
      'should apply offset via translate transform');
  });

  await t.test('_onTick applies grayscale filter to silhouette images', () => {
    const vizContent = fs.readFileSync('./src/visualization/forceDirectedVisualization.js', 'utf-8');
    
    // Check that _onTick applies the filter
    assert.match(vizContent, /style\('filter'.*_getSilhouetteGrayscaleFilter/,
      'should apply grayscale filter to image elements');
    
    assert.match(vizContent, /selectAll\('image\.silhouette'\)/,
      'should select silhouette images');
  });

  await t.test('_onTick applies opacity to silhouette images', () => {
    const vizContent = fs.readFileSync('./src/visualization/forceDirectedVisualization.js', 'utf-8');
    
    // Check that _onTick applies opacity
    assert.match(vizContent, /attr\('opacity'.*silhouetteOpacity/,
      'should set opacity attribute on image elements');
  });

  await t.test('offset is applied via group transform, not image x/y', () => {
    const vizContent = fs.readFileSync('./src/visualization/forceDirectedVisualization.js', 'utf-8');
    
    // Check that silhouette-group uses translate with offsets
    assert.match(vizContent, /g\.selectAll\('g\.silhouette-group'\)[\s\S]*?translate\(\$\{this\.silhouetteXOffset\}/s,
      'group transform should apply XOffset');
    
    assert.match(vizContent, /silhouetteYOffset\}\)/,
      'group transform should apply YOffset');
    
    // Check that image x/y are centered within the group (independent of offset)
    assert.match(vizContent, /-silhouetteSize \/ 2/,
      'image should be centered within its group');
  });

  await t.test('silhouette controls do not move nodes, edges, labels, or hit targets', () => {
    const vizContent = fs.readFileSync('./src/visualization/forceDirectedVisualization.js', 'utf-8');
    
    // Check that silhouette methods do NOT update node positions
    const sizeMethodMatch = vizContent.match(/setSilhouetteSize\([\s\S]*?\n  \}/);
    const opacityMethodMatch = vizContent.match(/setSilhouetteOpacity\([\s\S]*?\n  \}/);
    const grayscaleMethodMatch = vizContent.match(/setSilhouetteGrayscale\([\s\S]*?\n  \}/);
    
    // These methods should NOT contain any force or position updates
    assert.ok(sizeMethodMatch && !sizeMethodMatch[0].includes('simulation.'),
      'setSilhouetteSize should not modify simulation');
    
    assert.ok(opacityMethodMatch && !opacityMethodMatch[0].includes('simulation.'),
      'setSilhouetteOpacity should not modify simulation');
    
    assert.ok(grayscaleMethodMatch && !grayscaleMethodMatch[0].includes('simulation.'),
      'setSilhouetteGrayscale should not modify simulation');
  });

});
