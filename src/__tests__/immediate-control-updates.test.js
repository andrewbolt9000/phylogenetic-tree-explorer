import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

test('Immediate Control Updates Without Node Dragging', async (t) => {

  await t.test('Silhouette setters call _updateSilhouettesImmediate', () => {
    const vizCode = fs.readFileSync('./src/visualization/forceDirectedVisualization.js', 'utf-8');
    
    // Verify all silhouette setters call _updateSilhouettesImmediate
    assert.match(vizCode, /setSilhouetteSize\([\s\S]*?\{[\s\S]*?_updateSilhouettesImmediate\(\)/,
      'setSilhouetteSize should call _updateSilhouettesImmediate');
    
    assert.match(vizCode, /setSilhouetteXOffset\([\s\S]*?\{[\s\S]*?_updateSilhouettesImmediate\(\)/,
      'setSilhouetteXOffset should call _updateSilhouettesImmediate');
    
    assert.match(vizCode, /setSilhouetteYOffset\([\s\S]*?\{[\s\S]*?_updateSilhouettesImmediate\(\)/,
      'setSilhouetteYOffset should call _updateSilhouettesImmediate');
    
    assert.match(vizCode, /setSilhouetteOpacity\([\s\S]*?\{[\s\S]*?_updateSilhouettesImmediate\(\)/,
      'setSilhouetteOpacity should call _updateSilhouettesImmediate');
    
    assert.match(vizCode, /setSilhouetteGrayscale\([\s\S]*?\{[\s\S]*?_updateSilhouettesImmediate\(\)/,
      'setSilhouetteGrayscale should call _updateSilhouettesImmediate');
  });

  await t.test('_updateSilhouettesImmediate method exists and updates DOM', () => {
    const vizCode = fs.readFileSync('./src/visualization/forceDirectedVisualization.js', 'utf-8');
    
    // Verify method exists
    assert.match(vizCode, /_updateSilhouettesImmediate\(\)/,
      '_updateSilhouettesImmediate method should exist');
    
    // Verify it updates silhouette-group transforms
    assert.match(vizCode, /_updateSilhouettesImmediate[\s\S]*?selectAll\('g\.silhouette-group'\)/,
      '_updateSilhouettesImmediate should update silhouette-group');
    
    // Verify it updates image sizes
    assert.match(vizCode, /_updateSilhouettesImmediate[\s\S]*?selectAll\('image\.silhouette'\)/,
      '_updateSilhouettesImmediate should update image.silhouette');
    
    // Verify it applies opacity and grayscale
    assert.match(vizCode, /_updateSilhouettesImmediate[\s\S]*?\.attr\('opacity', this\.silhouetteOpacity\)/,
      '_updateSilhouettesImmediate should apply opacity');
    
    assert.match(vizCode, /_updateSilhouettesImmediate[\s\S]*?\.style\('filter'.*_getSilhouetteGrayscaleFilter/,
      '_updateSilhouettesImmediate should apply grayscale filter');
  });

  await t.test('SettingsUI calls visualization setters when settings change', () => {
    const settingsUICode = fs.readFileSync('./src/ui/SettingsUI.js', 'utf-8');
    
    // Verify SettingsUI calls silhouette setters with correct setting names
    assert.match(settingsUICode, /setSilhouetteSize\(settings\.silhouetteSizePercent\)/,
      'SettingsUI should call setSilhouetteSize with silhouetteSizePercent');
    
    assert.match(settingsUICode, /setSilhouetteXOffset\(settings\.silhouetteXOffset\)/,
      'SettingsUI should call setSilhouetteXOffset');
    
    assert.match(settingsUICode, /setSilhouetteYOffset\(settings\.silhouetteYOffset\)/,
      'SettingsUI should call setSilhouetteYOffset');
    
    assert.match(settingsUICode, /setSilhouetteOpacity\(settings\.silhouetteOpacity\)/,
      'SettingsUI should call setSilhouetteOpacity');
    
    assert.match(settingsUICode, /setSilhouetteGrayscale\(settings\.silhouetteGrayscale\)/,
      'SettingsUI should call setSilhouetteGrayscale');
  });

  await t.test('Force update methods reheat simulation', () => {
    const vizCode = fs.readFileSync('./src/visualization/forceDirectedVisualization.js', 'utf-8');
    
    // Verify charge setter reheats simulation
    assert.match(vizCode, /setChargeStrength[\s\S]*?\.alpha\([\s\S]*?\.restart\(\)/,
      'setChargeStrength should reheat simulation');
    
    // Verify link strength setter reheats simulation
    assert.match(vizCode, /setLinkStrength[\s\S]*?\.alpha\([\s\S]*?\.restart\(\)/,
      'setLinkStrength should reheat simulation');
  });

  await t.test('Topology repulsion setter updates force and reheats', () => {
    const vizCode = fs.readFileSync('./src/visualization/forceDirectedVisualization.js', 'utf-8');
    
    // Verify topology setter calls _updateTopologyRepulsion
    assert.match(vizCode, /setTopologyRepulsionA[\s\S]*?_updateTopologyRepulsion\(\)/,
      'setTopologyRepulsionA should call _updateTopologyRepulsion');
    
    assert.match(vizCode, /setTopologyRepulsionB[\s\S]*?_updateTopologyRepulsion\(\)/,
      'setTopologyRepulsionB should call _updateTopologyRepulsion');
    
    assert.match(vizCode, /setTopologyRepulsionX[\s\S]*?_updateTopologyRepulsion\(\)/,
      'setTopologyRepulsionX should call _updateTopologyRepulsion');
    
    // Verify _updateTopologyRepulsion reheats simulation
    assert.match(vizCode, /_updateTopologyRepulsion[\s\S]*?\.alpha\([\s\S]*?\.restart\(\)/,
      '_updateTopologyRepulsion should reheat simulation');
  });

  await t.test('Silhouette controls are NOT manually wired in HTML', () => {
    const htmlCode = fs.readFileSync('./index.html', 'utf-8');
    
    // These should NOT have manual addEventListener in index.html
    // They should only be in SettingsUI
    const silhouetteListeners = htmlCode.match(/silhouette-size-slider.*addEventListener|silhouette-x-offset-slider.*addEventListener/g);
    
    assert.ok(!silhouetteListeners || silhouetteListeners.length === 0,
      'Silhouette sliders should not have manual event listeners in index.html (handled by SettingsUI)');
  });

  await t.test('All control update pathways are centralized in SettingsUI', () => {
    const settingsUICode = fs.readFileSync('./src/ui/SettingsUI.js', 'utf-8');
    
    // Verify the onChange callback applies settings to visualization
    assert.match(settingsUICode, /this\.settings\.onChange\([\s\S]*?_applySettingsToVisualization\(/,
      'SettingsUI should wire onChange to apply settings');
    
    // Verify _applySettingsToVisualization is called when settings change
    assert.match(settingsUICode, /_applySettingsToVisualization\([\s\S]*?\{[\s\S]*?if \(settings\./,
      '_applySettingsToVisualization should check all settings');
  });

});
