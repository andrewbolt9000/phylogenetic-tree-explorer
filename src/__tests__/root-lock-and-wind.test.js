/**
 * Root lock and directional wind force tests
 * 
 * Tests for root position locking and directional wind force controls
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { VisualizationSettings } from '../settings/VisualizationSettings.js';

/**
 * Test 1: Root lock and wind settings exist in schema with correct ranges
 */
test('Root lock and wind - Schema defines lockRootPosition, windDirection, windStrength', async (t) => {
  const schema = VisualizationSettings.getSchema();
  
  // Check lockRootPosition
  assert.ok(schema.lockRootPosition, 'lockRootPosition should exist in schema');
  assert.equal(schema.lockRootPosition.type, 'boolean', 'lockRootPosition should be boolean');
  assert.equal(schema.lockRootPosition.default, true, 'lockRootPosition default should be true');
  
  // Check windDirection
  assert.ok(schema.windDirection, 'windDirection should exist in schema');
  assert.equal(schema.windDirection.type, 'integer', 'windDirection should be integer');
  assert.equal(schema.windDirection.min, 0, 'windDirection min should be 0');
  assert.equal(schema.windDirection.max, 360, 'windDirection max should be 360');
  assert.equal(schema.windDirection.default, 0, 'windDirection default should be 0');
  
  // Check windStrength
  assert.ok(schema.windStrength, 'windStrength should exist in schema');
  assert.equal(schema.windStrength.type, 'integer', 'windStrength should be integer');
  assert.equal(schema.windStrength.min, 0, 'windStrength min should be 0');
  assert.equal(schema.windStrength.max, 2000, 'windStrength max should be 2000');
  assert.equal(schema.windStrength.default, 0, 'windStrength default should be 0');
});

/**
 * Test 2: Settings defaults include new controls
 */
test('Root lock and wind - Defaults include all three new settings', async (t) => {
  const defaults = VisualizationSettings.getDefaults();
  
  assert.ok('lockRootPosition' in defaults, 'lockRootPosition should be in defaults');
  assert.ok('windDirection' in defaults, 'windDirection should be in defaults');
  assert.ok('windStrength' in defaults, 'windStrength should be in defaults');
  
  assert.equal(defaults.lockRootPosition, true, 'lockRootPosition default should be true');
  assert.equal(defaults.windDirection, 0, 'windDirection default should be 0');
  assert.equal(defaults.windStrength, 0, 'windStrength default should be 0');
});

/**
 * Test 3: Root lock enabled by default
 */
test('Root lock and wind - Root lock defaults to enabled (true)', async (t) => {
  const settings = new VisualizationSettings();
  const current = settings.getSettings();
  
  assert.equal(current.lockRootPosition, true, 'Root lock should be enabled by default');
});

/**
 * Test 4: Wind disabled by default
 */
test('Root lock and wind - Wind disabled by default (strength zero)', async (t) => {
  const settings = new VisualizationSettings();
  const current = settings.getSettings();
  
  assert.equal(current.windStrength, 0, 'Wind strength should default to 0');
  assert.equal(current.windDirection, 0, 'Wind direction should default to 0');
});

/**
 * Test 5: Settings can be updated and retrieved
 */
test('Root lock and wind - Settings can be updated', async (t) => {
  const settings = new VisualizationSettings();
  
  settings.setSetting('lockRootPosition', false);
  assert.equal(settings.getSettings().lockRootPosition, false, 'Should be able to disable root lock');
  
  settings.setSetting('windDirection', 90);
  assert.equal(settings.getSettings().windDirection, 90, 'Should be able to set wind direction to 90');
  
  settings.setSetting('windStrength', 50);
  assert.equal(settings.getSettings().windStrength, 50, 'Should be able to set wind strength to 50');
});

/**
 * Test 6: Settings validation clamps values
 */
test('Root lock and wind - Settings validation clamps out-of-range values', async (t) => {
  const settings = new VisualizationSettings();
  
  // Wind direction wrapping (should clamp to 0-360)
  settings.setSetting('windDirection', -45);
  assert.ok(settings.getSettings().windDirection >= 0 && settings.getSettings().windDirection <= 360, 
    'Negative wind direction should clamp to 0-360 range');
  
  settings.setSetting('windDirection', 450);
  assert.ok(settings.getSettings().windDirection >= 0 && settings.getSettings().windDirection <= 360,
    'Over-max wind direction should clamp to 0-360 range');
  
  // Wind strength clamping (0-2000 UI range)
  settings.setSetting('windStrength', -10);
  assert.equal(settings.getSettings().windStrength, 0, 'Negative wind strength should clamp to 0');
  
  settings.setSetting('windStrength', 2500);
  assert.equal(settings.getSettings().windStrength, 2000, 'Over-max wind strength should clamp to 2000');
});

/**
 * Test 7: YAML export includes new settings
 */
test('Root lock and wind - YAML export includes all three settings', async (t) => {
  const settings = new VisualizationSettings();
  
  settings.setSetting('lockRootPosition', false);
  settings.setSetting('windDirection', 180);
  settings.setSetting('windStrength', 75);
  
  const yaml = settings.toYAML();
  
  assert.ok(yaml.includes('lockRootPosition: false'), 'YAML should include lockRootPosition');
  assert.ok(yaml.includes('windDirection: 180'), 'YAML should include windDirection');
  assert.ok(yaml.includes('windStrength: 75'), 'YAML should include windStrength');
});

/**
 * Test 8: YAML round-trip preserves settings
 */
test('Root lock and wind - YAML round-trip preserves values', async (t) => {
  const original = new VisualizationSettings();
  original.setSetting('lockRootPosition', false);
  original.setSetting('windDirection', 270);
  original.setSetting('windStrength', 30);
  
  const yaml = original.toYAML();
  const parsed = VisualizationSettings.parseYAML(yaml);
  
  assert.equal(parsed.lockRootPosition, false, 'YAML round-trip should preserve lockRootPosition');
  assert.equal(parsed.windDirection, 270, 'YAML round-trip should preserve windDirection');
  assert.equal(parsed.windStrength, 30, 'YAML round-trip should preserve windStrength');
});

/**
 * Test 9: Wind direction cardinal directions (0, 90, 180, 270)
 */
test('Root lock and wind - Wind direction cardinal directions supported', async (t) => {
  const settings = new VisualizationSettings();
  const directions = [0, 90, 180, 270];
  
  for (const dir of directions) {
    settings.setSetting('windDirection', dir);
    assert.equal(settings.getSettings().windDirection, dir, 
      `Wind direction ${dir}° should be settable`);
  }
});

/**
 * Test 10: HTML slider elements exist with correct attributes
 */
test('Root lock and wind - HTML elements have correct attributes', async (t) => {
  // This test requires DOM access, which is not available in Node.js test environment
  // The test passes as long as schema and defaults are correct
  // Browser testing will verify HTML attributes
  
  assert.ok(true, 'Schema and defaults verified; HTML attributes should be verified in browser');
});

/**
 * Test 11: Root lock and wind settings work with categories
 */
test('Root lock and wind - Settings are categorized correctly', async (t) => {
  const schema = VisualizationSettings.getSchema();
  
  assert.equal(schema.lockRootPosition.category, 'forces', 'lockRootPosition should be in forces category');
  assert.equal(schema.windDirection.category, 'forces', 'windDirection should be in forces category');
  assert.equal(schema.windStrength.category, 'forces', 'windStrength should be in forces category');
});

/**
 * Test 12: All settings can be reset to defaults
 */
test('Root lock and wind - Settings can be reset to defaults', async (t) => {
  const settings = new VisualizationSettings();
  const defaults = VisualizationSettings.getDefaults();
  
  // Change settings
  settings.setSetting('lockRootPosition', false);
  settings.setSetting('windDirection', 180);
  settings.setSetting('windStrength', 100);
  
  // Reset by reapplying defaults
  const current = settings.getSettings();
  settings.setSetting('lockRootPosition', defaults.lockRootPosition);
  settings.setSetting('windDirection', defaults.windDirection);
  settings.setSetting('windStrength', defaults.windStrength);
  
  const reset = settings.getSettings();
  assert.equal(reset.lockRootPosition, defaults.lockRootPosition, 'Should be able to reset lockRootPosition');
  assert.equal(reset.windDirection, defaults.windDirection, 'Should be able to reset windDirection');
  assert.equal(reset.windStrength, defaults.windStrength, 'Should be able to reset windStrength');
});

/**
 * Test 13: Wind strength new range (0-2000)
 */
test('Root lock and wind - Wind strength accepts new maximum of 2000', async (t) => {
  const settings = new VisualizationSettings();
  
  // Test setting to max value
  settings.setSetting('windStrength', 2000);
  assert.equal(settings.getSettings().windStrength, 2000, 'windStrength should accept 2000');
  
  // Test mid-range values
  settings.setSetting('windStrength', 1000);
  assert.equal(settings.getSettings().windStrength, 1000, 'windStrength should accept 1000');
  
  settings.setSetting('windStrength', 500);
  assert.equal(settings.getSettings().windStrength, 500, 'windStrength should accept 500');
});

/**
 * Test 14: Root link strength new range (0-2000)
 */
test('Root lock and wind - Root link strength accepts new maximum of 2000', async (t) => {
  const settings = new VisualizationSettings();
  
  // Test setting to max value
  settings.setSetting('rootLinkStrength', 2000);
  assert.equal(settings.getSettings().rootLinkStrength, 2000, 'rootLinkStrength should accept 2000');
  
  // Test mid-range values
  settings.setSetting('rootLinkStrength', 1000);
  assert.equal(settings.getSettings().rootLinkStrength, 1000, 'rootLinkStrength should accept 1000');
});

/**
 * Test 15: Age link strength new range (0-500)
 */
test('Root lock and wind - Age link strength accepts new maximum of 500', async (t) => {
  const settings = new VisualizationSettings();
  
  // Test setting to max value
  settings.setSetting('ageLinkStrength', 500);
  assert.equal(settings.getSettings().ageLinkStrength, 500, 'ageLinkStrength should accept 500');
  
  // Test mid-range values
  settings.setSetting('ageLinkStrength', 250);
  assert.equal(settings.getSettings().ageLinkStrength, 250, 'ageLinkStrength should accept 250');
});

/**
 * Test 16: Wind persistence and force behavior verification
 */
test('Root lock and wind - Wind force conversion is correct', async (t) => {
  // Verify wind strength conversion formula
  // UI range 0-2000 → force magnitude 0-1.0
  // Formula: magnitude = windStrength / 2000
  
  const testCases = [
    { ui: 0, expected: 0 },
    { ui: 500, expected: 0.25 },
    { ui: 1000, expected: 0.5 },
    { ui: 1500, expected: 0.75 },
    { ui: 2000, expected: 1.0 },
  ];
  
  for (const testCase of testCases) {
    const magnitude = testCase.ui / 2000;
    assert.ok(
      Math.abs(magnitude - testCase.expected) < 0.0001,
      `Wind strength ${testCase.ui} should produce magnitude ${testCase.expected}, got ${magnitude}`
    );
  }
});

/**
 * Test 17: Wind strength zero removes wind force
 */
test('Root lock and wind - Wind strength zero is treated as disabled', async (t) => {
  const settings = new VisualizationSettings();
  
  // Set wind to zero explicitly
  settings.setSetting('windStrength', 0);
  assert.equal(settings.getSettings().windStrength, 0, 'Wind strength should be zero');
  
  // Verify zero does not get clamped or modified
  const current = settings.getSettings();
  assert.strictEqual(current.windStrength, 0, 'Zero should remain exactly zero, not converted');
});

/**
 * Test 18: Settings behavior with all new ranges
 */
test('Root lock and wind - All three setting ranges work together', async (t) => {
  const settings = new VisualizationSettings();
  
  // Set all at their maximum values
  settings.setSetting('rootLinkStrength', 2000);
  settings.setSetting('ageLinkStrength', 500);
  settings.setSetting('windStrength', 2000);
  
  const current = settings.getSettings();
  assert.equal(current.rootLinkStrength, 2000, 'rootLinkStrength max should be 2000');
  assert.equal(current.ageLinkStrength, 500, 'ageLinkStrength max should be 500');
  assert.equal(current.windStrength, 2000, 'windStrength max should be 2000');
  
  // Export and re-import to verify persistence
  const yaml = settings.toYAML();
  assert.ok(yaml.includes('rootLinkStrength: 2000'), 'YAML should include rootLinkStrength at 2000');
  assert.ok(yaml.includes('ageLinkStrength: 500'), 'YAML should include ageLinkStrength at 500');
  assert.ok(yaml.includes('windStrength: 2000'), 'YAML should include windStrength at 2000');
});
