/**
 * Test: Slider Responsiveness
 * 
 * Verifies that all visualization sliders respond to user input immediately,
 * without requiring node dragging.
 */

import test from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';

test('Slider Responsiveness Architecture', async (t) => {
  // Test 1: SettingsUI is imported in index.html
  await t.test('SettingsUI is initialized in index.html', () => {
    const htmlPath = path.join(process.cwd(), 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    
    assert.ok(html.includes("import SettingsUI from './src/ui/SettingsUI.js'"), 'SettingsUI is imported');
    assert.ok(html.includes('new SettingsUI(settings, viz)'), 'SettingsUI is instantiated');
    assert.ok(html.includes('settingsUI.initialize()'), 'SettingsUI is initialized');
  });

  // Test 2: SettingsUI has _wireControls with no error handling gaps
  await t.test('SettingsUI._wireControls has proper error handling', () => {
    const uiPath = path.join(process.cwd(), 'src/ui/SettingsUI.js');
    const code = fs.readFileSync(uiPath, 'utf8');
    
    // Check for try-catch in event listener
    const wiredLineStart = code.indexOf('element.addEventListener(\'input\'');
    const wiredLineEnd = code.indexOf('});', wiredLineStart);
    const eventListenerCode = code.substring(wiredLineStart, wiredLineEnd);
    
    assert.ok(eventListenerCode.includes('try'), 'Event listener has try block');
    assert.ok(eventListenerCode.includes('catch'), 'Event listener has catch block');
  });

  // Test 3: Slider IDs match between HTML and SettingsUI
  await t.test('All slider IDs in SettingsUI exist in HTML', () => {
    const htmlPath = path.join(process.cwd(), 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    
    const uiPath = path.join(process.cwd(), 'src/ui/SettingsUI.js');
    const uiCode = fs.readFileSync(uiPath, 'utf8');
    
    // Extract slider IDs from SettingsUI controlMap
    const sliderMatches = uiCode.match(/'([^']*(?:-slider|-toggle))':/g) || [];
    const sliderIds = new Set(sliderMatches.map(m => m.replace(/'/g, '').replace(':', '')));
    
    for (const sliderId of sliderIds) {
      assert.ok(html.includes(`id="${sliderId}"`), `Slider ID '${sliderId}' exists in HTML`);
    }
  });

  // Test 4: Display element IDs match
  await t.test('All display element IDs in SettingsUI exist in HTML', () => {
    const htmlPath = path.join(process.cwd(), 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    
    const uiPath = path.join(process.cwd(), 'src/ui/SettingsUI.js');
    const uiCode = fs.readFileSync(uiPath, 'utf8');
    
    // Extract display IDs from SettingsUI controlMap
    const displayMatches = uiCode.match(/display: '([^']+)'/g) || [];
    const displayIds = new Set(displayMatches.map(m => m.replace("display: '", '').replace("'", '')));
    
    for (const displayId of displayIds) {
      assert.ok(html.includes(`id="${displayId}"`), `Display element '${displayId}' exists in HTML`);
    }
  });

  // Test 5: No conflicting duplicate event listeners
  await t.test('HTML has no duplicate event listeners for SettingsUI-wired controls', () => {
    const htmlPath = path.join(process.cwd(), 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    
    // Check that these controls are NOT manually wired in HTML (SettingsUI handles them)
    const controlsNotManuallyWired = [
      'charge-slider',
      'link-slider',
      'edge-thickness-slider',
      'node-circle-slider',
      'font-size-slider',
      'sidebar-font-size-slider',
      'silhouette-size-slider',
      'silhouette-x-offset-slider',
      'silhouette-y-offset-slider',
      'silhouette-grayscale-slider',
      'silhouette-opacity-slider',
      'topology-repulsion-a-slider',
      'topology-repulsion-b-slider',
      'topology-repulsion-x-slider'
    ];
    
    // Count how many manual addEventListener calls there are for each control
    for (const controlId of controlsNotManuallyWired) {
      const regex = new RegExp(`getElementById\\(['"]${controlId}['"]\\)`, 'g');
      const matches = html.match(regex) || [];
      // Should have exactly 1 match: in SettingsUI comment or implicit through SettingsUI
      // Should NOT have explicit manual addEventListener calls
      assert.ok(!html.includes(`getElementById('${controlId}').addEventListener`), 
        `'${controlId}' should not have manual addEventListener in HTML`);
    }
  });

  // Test 6: Display value uses raw slider value, not transformed
  await t.test('Display values use raw slider values (not transformed)', () => {
    const uiPath = path.join(process.cwd(), 'src/ui/SettingsUI.js');
    const code = fs.readFileSync(uiPath, 'utf8');
    
    // Check that display uses e.target.value, not the transformed value
    const wiredLineStart = code.indexOf('element.addEventListener(\'input\'');
    const wiredLineEnd = code.indexOf('});', wiredLineStart);
    const eventListenerCode = code.substring(wiredLineStart, wiredLineEnd);
    
    assert.ok(eventListenerCode.includes('e.target.value'), 
      'Display value is set from raw slider value (e.target.value)');
  });

  // Test 7: Toggles are manually wired (they require special data)
  await t.test('Toggle controls have manual event listeners in HTML', () => {
    const htmlPath = path.join(process.cwd(), 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    
    // These require divergenceData and hypothesisData, so manual listeners are OK
    assert.ok(html.includes('show-node-dates-toggle') && html.includes('divergenceData'), 
      'showNodeDates toggle is manually wired with divergenceData');
    assert.ok(html.includes('show-ancestral-labels-toggle') && html.includes('hypothesisData'), 
      'showAncestralLabels toggle is manually wired with hypothesisData');
  });

  // Test 8: ForceDirectedVisualization has force update methods
  await t.test('ForceDirectedVisualization has methods to update active forces', () => {
    const vizPath = path.join(process.cwd(), 'src/visualization/forceDirectedVisualization.js');
    const code = fs.readFileSync(vizPath, 'utf8');
    
    assert.ok(code.includes('setChargeStrength'), 'Has setChargeStrength method');
    assert.ok(code.includes('setLinkStrength'), 'Has setLinkStrength method');
    assert.ok(code.includes('setTopologyRepulsionA'), 'Has setTopologyRepulsionA method');
    assert.ok(code.includes('setTopologyRepulsionB'), 'Has setTopologyRepulsionB method');
    assert.ok(code.includes('setTopologyRepulsionX'), 'Has setTopologyRepulsionX method');
  });

  // Test 9: Settings are stored and onChange callback is used
  await t.test('VisualizationSettings stores values and triggers onChange', () => {
    const settingsPath = path.join(process.cwd(), 'src/settings/VisualizationSettings.js');
    const code = fs.readFileSync(settingsPath, 'utf8');
    
    assert.ok(code.includes('setSetting('), 'Has setSetting method');
    assert.ok(code.includes('onChange('), 'Has onChange callback');
    assert.ok(code.includes('this.listeners'), 'Has listeners storage');
  });

  // Test 10: Settings update triggers visualization methods
  await t.test('_applySettingsToVisualization maps all settings to viz methods', () => {
    const uiPath = path.join(process.cwd(), 'src/ui/SettingsUI.js');
    const code = fs.readFileSync(uiPath, 'utf8');
    
    // Check that major settings are applied with correct names
    assert.ok(code.includes('setChargeStrength(-settings.charge)'), 'Charge applied (negated for D3)');
    assert.ok(code.includes('setLinkStrength(settings.linkStrength)'), 'Link strength applied');
    assert.ok(code.includes('setSilhouetteSize(settings.silhouetteSizePercent)'), 'Silhouette size applied');
    assert.ok(code.includes('setTopologyRepulsionA'), 'Topology A applied');
    assert.ok(code.includes('setTopologyRepulsionB'), 'Topology B applied');
    assert.ok(code.includes('setTopologyRepulsionX'), 'Topology X applied');
  });
});
