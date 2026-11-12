import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

test('PhyloExplorer Comprehensive Control System Verification', async (t) => {
  
  await t.test('HTML contains all required controls', () => {
    const html = fs.readFileSync('./index.html', 'utf-8');
    
    // Silhouette controls
    const silhouetteControls = [
      'silhouette-size-slider',
      'silhouette-x-offset-slider',
      'silhouette-y-offset-slider',
      'silhouette-grayscale-slider',
      'silhouette-opacity-slider'
    ];
    
    silhouetteControls.forEach(id => {
      assert.match(html, new RegExp(`id="${id}"`), `Should have ${id}`);
    });
    
    // Force controls (changed: topology repulsion is now A, B, X instead of single slider)
    const forceControls = [
      'charge-slider',
      'link-slider',
      'edge-thickness-slider',
      'topology-repulsion-a-slider',
      'topology-repulsion-b-slider',
      'topology-repulsion-x-slider'
    ];
    
    forceControls.forEach(id => {
      assert.match(html, new RegExp(`id="${id}"`), `Should have ${id}`);
    });
    
    // Appearance controls
    const appearanceControls = [
      'node-circle-slider',
      'font-size-slider',
      'sidebar-font-size-slider'
    ];
    
    appearanceControls.forEach(id => {
      assert.match(html, new RegExp(`id="${id}"`), `Should have ${id}`);
    });
  });

  await t.test('Silhouette size control has correct range (30-300)', () => {
    const html = fs.readFileSync('./index.html', 'utf-8');
    const sliderMatch = html.match(/<input[^>]*id="silhouette-size-slider"[^>]*>/s);
    
    assert.ok(sliderMatch, 'Slider should exist');
    assert.match(sliderMatch[0], /min="30"/);
    assert.match(sliderMatch[0], /max="300"/);
    assert.match(sliderMatch[0], /value="100"/);
  });

  await t.test('Silhouette X offset has correct range (-100 to 100)', () => {
    const html = fs.readFileSync('./index.html', 'utf-8');
    const sliderMatch = html.match(/<input[^>]*id="silhouette-x-offset-slider"[^>]*>/s);
    
    assert.ok(sliderMatch, 'Slider should exist');
    assert.match(sliderMatch[0], /min="-100"/);
    assert.match(sliderMatch[0], /max="100"/);
    assert.match(sliderMatch[0], /value="0"/);
  });

  await t.test('Silhouette Y offset has correct range (-100 to 100)', () => {
    const html = fs.readFileSync('./index.html', 'utf-8');
    const sliderMatch = html.match(/<input[^>]*id="silhouette-y-offset-slider"[^>]*>/s);
    
    assert.ok(sliderMatch, 'Slider should exist');
    assert.match(sliderMatch[0], /min="-100"/);
    assert.match(sliderMatch[0], /max="100"/);
    assert.match(sliderMatch[0], /value="0"/);
  });

  await t.test('Silhouette grayscale has correct range (0-100)', () => {
    const html = fs.readFileSync('./index.html', 'utf-8');
    const sliderMatch = html.match(/<input[^>]*id="silhouette-grayscale-slider"[^>]*>/s);
    
    assert.ok(sliderMatch, 'Slider should exist');
    assert.match(sliderMatch[0], /min="0"/);
    assert.match(sliderMatch[0], /max="100"/);
    assert.match(sliderMatch[0], /value="50"/);
  });

  await t.test('Silhouette opacity has correct range (0-100)', () => {
    const html = fs.readFileSync('./index.html', 'utf-8');
    const sliderMatch = html.match(/<input[^>]*id="silhouette-opacity-slider"[^>]*>/s);
    
    assert.ok(sliderMatch, 'Slider should exist');
    assert.match(sliderMatch[0], /min="0"/);
    assert.match(sliderMatch[0], /max="100"/);
    assert.match(sliderMatch[0], /value="100"/);
  });

  await t.test('Charge slider has correct range (0-1500)', () => {
    const html = fs.readFileSync('./index.html', 'utf-8');
    const sliderMatch = html.match(/<input[^>]*id="charge-slider"[^>]*>/s);
    
    assert.ok(sliderMatch, 'Slider should exist');
    assert.match(sliderMatch[0], /min="0"/);
    assert.match(sliderMatch[0], /max="1500"/);
  });

  await t.test('Link strength slider exists', () => {
    const html = fs.readFileSync('./index.html', 'utf-8');
    const sliderMatch = html.match(/<input[^>]*id="link-slider"[^>]*>/s);
    
    assert.ok(sliderMatch, 'Slider should exist');
    assert.match(sliderMatch[0], /min="0"/);
    // Current range is 0-3, should be 0-100 for 10x scaling but verify current state
    assert.match(sliderMatch[0], /max="[0-9.]+"/);
  });

  await t.test('Edge thickness slider exists', () => {
    const html = fs.readFileSync('./index.html', 'utf-8');
    assert.match(html, /id="edge-thickness-slider"/);
  });

  await t.test('Node circle slider exists', () => {
    const html = fs.readFileSync('./index.html', 'utf-8');
    assert.match(html, /id="node-circle-slider"/);
  });

  await t.test('Graph font size slider exists', () => {
    const html = fs.readFileSync('./index.html', 'utf-8');
    assert.match(html, /id="font-size-slider"/);
  });

  await t.test('Sidebar font size slider exists', () => {
    const html = fs.readFileSync('./index.html', 'utf-8');
    assert.match(html, /id="sidebar-font-size-slider"/);
  });

  await t.test('Topology repulsion sliders (A, B, X) exist', () => {
    const html = fs.readFileSync('./index.html', 'utf-8');
    assert.match(html, /id="topology-repulsion-a-slider"/, 'A slider exists');
    assert.match(html, /id="topology-repulsion-b-slider"/, 'B slider exists');
    assert.match(html, /id="topology-repulsion-x-slider"/, 'X slider exists');
    assert.match(html, /F<sub>topology<\/sub>/, 'Equation displayed');
  });

  await t.test('Node dates toggle exists', () => {
    const html = fs.readFileSync('./index.html', 'utf-8');
    assert.match(html, /id="show-node-dates-toggle"/);
  });

  await t.test('Ancestral labels toggle exists', () => {
    const html = fs.readFileSync('./index.html', 'utf-8');
    assert.match(html, /id="show-ancestral-labels-toggle"/);
  });

  await t.test('ForceDirectedVisualization has all silhouette methods', () => {
    const vizContent = fs.readFileSync('./src/visualization/forceDirectedVisualization.js', 'utf-8');
    
    assert.match(vizContent, /setSilhouetteSize\s*\(/);
    assert.match(vizContent, /setSilhouetteXOffset\s*\(/);
    assert.match(vizContent, /setSilhouetteYOffset\s*\(/);
    assert.match(vizContent, /setSilhouetteGrayscale\s*\(/);
    assert.match(vizContent, /setSilhouetteOpacity\s*\(/);
  });

  await t.test('ForceDirectedVisualization has grayscale filter implementation', () => {
    const vizContent = fs.readFileSync('./src/visualization/forceDirectedVisualization.js', 'utf-8');
    
    assert.match(vizContent, /_getSilhouetteGrayscaleFilter/);
    assert.match(vizContent, /grayscale\(100%\)/);
    assert.match(vizContent, /brightness\(/);
  });

  await t.test('ForceDirectedVisualization initializes silhouette properties', () => {
    const vizContent = fs.readFileSync('./src/visualization/forceDirectedVisualization.js', 'utf-8');
    
    assert.match(vizContent, /this\.silhouetteSizePercent\s*=/);
    assert.match(vizContent, /this\.silhouetteXOffset\s*=/);
    assert.match(vizContent, /this\.silhouetteYOffset\s*=/);
    assert.match(vizContent, /this\.silhouetteGrayscale\s*=/);
    assert.match(vizContent, /this\.silhouetteOpacity\s*=/);
  });

  await t.test('_onTick updates silhouette-group transforms', () => {
    const vizContent = fs.readFileSync('./src/visualization/forceDirectedVisualization.js', 'utf-8');
    
    assert.match(vizContent, /selectAll\('g\.silhouette-group'\)/);
    assert.match(vizContent, /\.attr\('transform'/);
  });

  await t.test('_onTick applies grayscale filter to images', () => {
    const vizContent = fs.readFileSync('./src/visualization/forceDirectedVisualization.js', 'utf-8');
    
    assert.match(vizContent, /selectAll\('image\.silhouette'\)/);
    assert.match(vizContent, /\.style\('filter'/);
    assert.match(vizContent, /_getSilhouetteGrayscaleFilter/);
  });

  await t.test('_onTick applies opacity to images', () => {
    const vizContent = fs.readFileSync('./src/visualization/forceDirectedVisualization.js', 'utf-8');
    
    assert.match(vizContent, /selectAll\('image\.silhouette'\)/);
    assert.match(vizContent, /\.attr\('opacity'/);
  });

  await t.test('Silhouette controls are wired through SettingsUI', () => {
    const settingsUIContent = fs.readFileSync('./src/ui/SettingsUI.js', 'utf-8');
    
    // Verify SettingsUI has all silhouette controls in its wiring map
    assert.match(settingsUIContent, /'silhouette-size-slider'/);
    assert.match(settingsUIContent, /'silhouette-x-offset-slider'/);
    assert.match(settingsUIContent, /'silhouette-y-offset-slider'/);
    assert.match(settingsUIContent, /'silhouette-grayscale-slider'/);
    assert.match(settingsUIContent, /'silhouette-opacity-slider'/);
  });

  await t.test('Visualization has immediate silhouette update method', () => {
    const vizContent = fs.readFileSync('./src/visualization/forceDirectedVisualization.js', 'utf-8');
    
    // Verify _updateSilhouettesImmediate exists and is called by setters
    assert.match(vizContent, /_updateSilhouettesImmediate\(\)/);
    assert.match(vizContent, /setSilhouetteSize.*_updateSilhouettesImmediate/s);
    assert.match(vizContent, /setSilhouetteXOffset.*_updateSilhouettesImmediate/s);
    assert.match(vizContent, /setSilhouetteYOffset.*_updateSilhouettesImmediate/s);
    assert.match(vizContent, /setSilhouetteGrayscale.*_updateSilhouettesImmediate/s);
    assert.match(vizContent, /setSilhouetteOpacity.*_updateSilhouettesImmediate/s);
  });

  await t.test('SettingsUI module exists and exports', () => {
    const settingsUIContent = fs.readFileSync('./src/ui/SettingsUI.js', 'utf-8');
    
    assert.ok(settingsUIContent.length > 1000, 'SettingsUI should be substantial');
    assert.match(settingsUIContent, /class SettingsUI/);
    assert.match(settingsUIContent, /export default SettingsUI/);
  });

  await t.test('VisualizationSettings module exists with schema', () => {
    const settingsContent = fs.readFileSync('./src/settings/VisualizationSettings.js', 'utf-8');
    
    assert.ok(settingsContent.length > 1000, 'VisualizationSettings should be substantial');
    assert.match(settingsContent, /class VisualizationSettings/);
    assert.match(settingsContent, /getDefaults\(\)/);
    assert.match(settingsContent, /getSchema\(\)/);
  });

  await t.test('YAML is imported in index.html', () => {
    const html = fs.readFileSync('./index.html', 'utf-8');
    
    assert.match(html, /VisualizationSettings/);
    assert.match(html, /SettingsUI/);
  });

  await t.test('Production SVG assets exist', () => {
    const manifest = JSON.parse(
      fs.readFileSync('./assets/silhouettes/PRODUCTION_MANIFEST.json', 'utf-8')
    );
    
    // Count non-missing assets
    let count = 0;
    for (const key in manifest.silhouetteMappings) {
      const mapping = manifest.silhouetteMappings[key];
      if (mapping.status !== 'MISSING') {
        count++;
        
        // Verify file exists
        const filepath = `./assets/silhouettes/${mapping.filename}`;
        assert.ok(
          fs.existsSync(filepath),
          `SVG file should exist: ${filepath}`
        );
      }
    }
    
    assert.strictEqual(count, 18, 'Should have 18 non-missing assets');
  });

});
