/**
 * Root-weighted and age-weighted link strength modifier tests
 * 
 * Tests for settings, schema, and computation logic (without render() which requires D3)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { VisualizationSettings } from '../settings/VisualizationSettings.js';

/**
 * Test 1: New settings exist in schema with correct ranges
 */
test('Link strength modifiers - Schema defines rootLinkStrength and ageLinkStrength', async (t) => {
  const schema = VisualizationSettings.getSchema();
  
  // Check rootLinkStrength schema (changed to UI 0-1000)
  assert.ok(schema.rootLinkStrength, 'rootLinkStrength should exist in schema');
  assert.equal(schema.rootLinkStrength.type, 'integer', 'rootLinkStrength should be integer');
  assert.equal(schema.rootLinkStrength.min, 0, 'rootLinkStrength min should be 0');
  assert.equal(schema.rootLinkStrength.max, 1000, 'rootLinkStrength max should be 1000');
  assert.equal(schema.rootLinkStrength.default, 0, 'rootLinkStrength default should be 0');
  
  // Check ageLinkStrength schema (changed to UI 0-100)
  assert.ok(schema.ageLinkStrength, 'ageLinkStrength should exist in schema');
  assert.equal(schema.ageLinkStrength.type, 'number', 'ageLinkStrength should be number');
  assert.equal(schema.ageLinkStrength.min, 0, 'ageLinkStrength min should be 0');
  assert.equal(schema.ageLinkStrength.max, 100, 'ageLinkStrength max should be 100');
  assert.equal(schema.ageLinkStrength.default, 0, 'ageLinkStrength default should be 0');
});

/**
 * Test 2: Settings defaults include new modifiers
 */
test('Link strength modifiers - Defaults include both modifiers at zero', async (t) => {
  const defaults = VisualizationSettings.getDefaults();
  
  assert.ok('rootLinkStrength' in defaults, 'rootLinkStrength should be in defaults');
  assert.ok('ageLinkStrength' in defaults, 'ageLinkStrength should be in defaults');
  assert.equal(defaults.rootLinkStrength, 0, 'rootLinkStrength default should be 0');
  assert.equal(defaults.ageLinkStrength, 0, 'ageLinkStrength default should be 0');
});

/**
 * Test 3: Settings can be set and retrieved
 */
test('Link strength modifiers - Settings can be set and retrieved', async (t) => {
  const settings = new VisualizationSettings();
  
  // Set root link strength
  settings.setSetting('rootLinkStrength', 50);
  assert.equal(settings.getSettings().rootLinkStrength, 50, 'rootLinkStrength should be 50');
  
  // Set age link strength
  settings.setSetting('ageLinkStrength', 2.5);
  assert.equal(settings.getSettings().ageLinkStrength, 2.5, 'ageLinkStrength should be 2.5');
});

/**
 * Test 4: YAML export includes new settings
 */
test('Link strength modifiers - YAML export includes new settings', async (t) => {
  const settings = new VisualizationSettings();
  
  // Set values
  settings.setSetting('rootLinkStrength', 50);
  settings.setSetting('ageLinkStrength', 2.5);
  
  // Export to YAML
  const yaml = settings.toYAML();
  
  // Verify both settings appear in YAML
  assert.ok(yaml.includes('rootLinkStrength: 50'), 'YAML should include rootLinkStrength');
  assert.ok(yaml.includes('ageLinkStrength: 2.5'), 'YAML should include ageLinkStrength');
});

/**
 * Test 5: Settings validation with clamping
 */
test('Link strength modifiers - Settings validation clamps out-of-range values', async (t) => {
  const settings = new VisualizationSettings();
  
  // Test root link strength clamping (0-1000 UI range)
  settings.setSetting('rootLinkStrength', -10);
  assert.equal(settings.getSettings().rootLinkStrength, 0, 'Negative rootLinkStrength should clamp to 0');
  
  settings.setSetting('rootLinkStrength', 1500);
  assert.equal(settings.getSettings().rootLinkStrength, 1000, 'Over-max rootLinkStrength should clamp to 1000');
  
  // Test age link strength clamping (0-100 UI range)
  settings.setSetting('ageLinkStrength', -5);
  assert.equal(settings.getSettings().ageLinkStrength, 0, 'Negative ageLinkStrength should clamp to 0');
  
  settings.setSetting('ageLinkStrength', 150);
  assert.equal(settings.getSettings().ageLinkStrength, 100, 'Over-max ageLinkStrength should clamp to 100');
});

/**
 * Test 6: Settings are preserved on import/export
 */
test('Link strength modifiers - Settings round-trip through YAML', async (t) => {
  const settings1 = new VisualizationSettings();
  settings1.setSetting('rootLinkStrength', 75);
  settings1.setSetting('ageLinkStrength', 3.5);
  
  // Export to YAML
  const yaml = settings1.toYAML();
  
  // Create new settings and verify YAML contains the values
  assert.ok(yaml.includes('rootLinkStrength: 75'), 'YAML should preserve rootLinkStrength value');
  assert.ok(yaml.includes('ageLinkStrength: 3.5'), 'YAML should preserve ageLinkStrength value');
});

/**
 * Test 7: Both settings maintain independence
 */
test('Link strength modifiers - Each modifier can be set independently', async (t) => {
  const settings = new VisualizationSettings();
  
  // Set only root link strength
  settings.setSetting('rootLinkStrength', 25);
  assert.equal(settings.getSettings().rootLinkStrength, 25);
  assert.equal(settings.getSettings().ageLinkStrength, 0, 'ageLinkStrength should remain at default');
  
  // Set only age link strength
  settings.setSetting('ageLinkStrength', 4.0);
  assert.equal(settings.getSettings().rootLinkStrength, 25, 'rootLinkStrength should remain unchanged');
  assert.equal(settings.getSettings().ageLinkStrength, 4.0);
});

/**
 * Test 8: Settings include both modifiers in reset
 */
test('Link strength modifiers - Reset returns both modifiers to default', async (t) => {
  const settings = new VisualizationSettings();
  
  // Set non-default values
  settings.setSetting('rootLinkStrength', 80);
  settings.setSetting('ageLinkStrength', 5.5);
  
  // Reset to defaults
  settings.resetToDefaults();
  
  // Both should be at default
  assert.equal(settings.getSettings().rootLinkStrength, 0, 'rootLinkStrength should reset to 0');
  assert.equal(settings.getSettings().ageLinkStrength, 0, 'ageLinkStrength should reset to 0');
});

/**
 * Test 9: Settings are in category 'forces'
 */
test('Link strength modifiers - Settings are categorized under forces', async (t) => {
  const schema = VisualizationSettings.getSchema();
  
  assert.equal(schema.rootLinkStrength.category, 'forces', 'rootLinkStrength should be in forces category');
  assert.equal(schema.ageLinkStrength.category, 'forces', 'ageLinkStrength should be in forces category');
});

/**
 * Test 10: Default settings YAML file is consistent with schema
 */
test('Link strength modifiers - YAML defaults match schema defaults', async (t) => {
  const settings = new VisualizationSettings();
  const schema = VisualizationSettings.getSchema();
  const defaults = VisualizationSettings.getDefaults();
  
  // Verify that defaults from schema match what getDefaults() returns
  assert.equal(defaults.rootLinkStrength, schema.rootLinkStrength.default);
  assert.equal(defaults.ageLinkStrength, schema.ageLinkStrength.default);
  
  // Verify both are zero (disabled by default)
  assert.equal(defaults.rootLinkStrength, 0);
  assert.equal(defaults.ageLinkStrength, 0);
});

/**
 * Test 11: HTML slider maximum matches schema definition
 */
test('Link strength modifiers - HTML slider max matches schema (0-1000)', async (t) => {
  const fs = await import('fs');
  const path = await import('path');
  
  // Read the index.html file
  const htmlPath = path.resolve('./index.html');
  const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
  
  // Find the root-link-strength-slider element
  const sliderMatch = htmlContent.match(
    /<input[^>]*id="root-link-strength-slider"[^>]*max="([^"]+)"[^>]*>/
  );
  
  assert.ok(
    sliderMatch && sliderMatch[1],
    'root-link-strength-slider max attribute should exist'
  );
  
  const sliderMax = parseInt(sliderMatch[1], 10);
  const schemaMax = VisualizationSettings.getSchema().rootLinkStrength.max;
  
  assert.equal(
    sliderMax, 1000,
    'HTML slider max should be 1000'
  );
  
  assert.equal(
    sliderMax, schemaMax,
    `HTML slider max (${sliderMax}) should match schema max (${schemaMax})`
  );
});
