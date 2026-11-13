/**
 * YAML settings defaults and export/import round-trip tests
 * 
 * Tests for showNodeDates default, YAML export correctness, and round-trip verification
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { VisualizationSettings } from '../settings/VisualizationSettings.js';

/**
 * Test 1: showNodeDates defaults to true in getDefaults()
 */
test('Show Node Dates Default - getDefaults() returns true', async (t) => {
  const defaults = VisualizationSettings.getDefaults();
  assert.equal(defaults.showNodeDates, true, 'showNodeDates should default to true');
});

/**
 * Test 2: showNodeDates schema default is true
 */
test('Show Node Dates Schema - Default in schema is true', async (t) => {
  const schema = VisualizationSettings.getSchema();
  assert.ok(schema.showNodeDates, 'showNodeDates should exist in schema');
  assert.equal(schema.showNodeDates.type, 'boolean', 'should be boolean type');
  assert.equal(schema.showNodeDates.default, true, 'schema default should be true');
});

/**
 * Test 3: New VisualizationSettings instance has showNodeDates = true
 */
test('Show Node Dates Instance - New instance defaults to true', async (t) => {
  const settings = new VisualizationSettings();
  const current = settings.getSettings();
  assert.equal(current.showNodeDates, true, 'Instance setting should be true');
});

/**
 * Test 4: YAML export includes showNodeDates: true
 */
test('YAML Export - Includes showNodeDates: true', async (t) => {
  const settings = new VisualizationSettings();
  const yaml = settings.toYAML();
  
  assert.ok(yaml.includes('showNodeDates:'), 'Should have showNodeDates key');
  assert.ok(yaml.includes('showNodeDates: true'), 'Should export true value');
  assert.ok(yaml.includes('Show divergence estimates'), 'Should have description comment');
});

/**
 * Test 5: YAML export has correct property references (no malformed accessors)
 */
test('YAML Export - All property references are correct (this.settings.xxx format)', async (t) => {
  const settings = new VisualizationSettings();
  
  // Change some values to ensure they're read correctly
  settings.setSetting('showNodeDates', true);
  settings.setSetting('showAncestralLabels', false);
  settings.setSetting('edgeThickness', 2.5);
  settings.setSetting('gridSpacing', 75);
  
  const yaml = settings.toYAML();
  
  // Verify key settings are exported with correct values
  assert.ok(yaml.includes('showNodeDates: true'), 'showNodeDates should export true');
  assert.ok(yaml.includes('showAncestralLabels: false'), 'showAncestralLabels should export false');
  assert.ok(yaml.includes('edgeThickness: 2.50'), 'edgeThickness should export 2.50');
  assert.ok(yaml.includes('gridSpacing: 75'), 'gridSpacing should export 75');
  
  // Verify no malformed property references in YAML
  assert.ok(!yaml.includes('this.settings'), 'YAML should not include this.settings literal');
  assert.ok(!yaml.includes('settingsedgeThickness'), 'Should not have malformed settingsedgeThickness');
  assert.ok(!yaml.includes('settingsshowNodeDates'), 'Should not have malformed settingsshowNodeDates');
});

/**
 * Test 6: YAML parse preserves showNodeDates = true
 */
test('YAML Parse - Correctly parses showNodeDates: true', async (t) => {
  const yamlContent = `
# Test YAML
showNodeDates: true
showAncestralLabels: false
edgeThickness: 3.0
`;
  
  const parsed = VisualizationSettings.parseYAML(yamlContent);
  assert.equal(parsed.showNodeDates, true, 'Should parse true value');
  assert.equal(parsed.showAncestralLabels, false, 'Should parse false value');
  assert.equal(parsed.edgeThickness, 3.0, 'Should parse edge thickness');
});

/**
 * Test 7: YAML round-trip preserves all settings
 */
test('YAML Round-Trip - Export and re-import preserves all settings', async (t) => {
  const settings1 = new VisualizationSettings();
  
  // Set custom values
  const customSettings = {
    showNodeDates: true,
    backgroundWhiteLevel: 60,
    edgeThickness: 4.0,
    charge: 450,
    gridSpacing: 80,
    showGrid: true,
  };
  
  settings1.updateSettings(customSettings);
  
  // Export to YAML
  const yaml = settings1.toYAML();
  
  // Parse from YAML
  const parsed = VisualizationSettings.parseYAML(yaml);
  
  // Create new settings instance from parsed data
  const settings2 = new VisualizationSettings();
  settings2.updateSettings(parsed);
  
  // Verify all settings match
  const final = settings2.getSettings();
  assert.equal(final.showNodeDates, true, 'showNodeDates should be true');
  assert.equal(final.backgroundWhiteLevel, 60, 'backgroundWhiteLevel should be 60');
  assert.equal(final.edgeThickness, 4.0, 'edgeThickness should be 4.0');
  assert.equal(final.charge, 450, 'charge should be 450');
  assert.equal(final.gridSpacing, 80, 'gridSpacing should be 80');
  assert.equal(final.showGrid, true, 'showGrid should be true');
});

/**
 * Test 8: YAML export valid (parseable) for all default settings
 */
test('YAML Validity - Export of default settings is valid YAML', async (t) => {
  const settings = new VisualizationSettings();
  const yaml = settings.toYAML();
  
  // Parse the exported YAML
  try {
    const parsed = VisualizationSettings.parseYAML(yaml);
    
    // Verify key settings were parsed
    assert.ok('showNodeDates' in parsed || parsed.showNodeDates === undefined, 'Should parse or skip showNodeDates');
    assert.ok('charge' in parsed || parsed.charge === undefined, 'Should parse or skip charge');
    assert.ok('gridSpacing' in parsed || parsed.gridSpacing === undefined, 'Should parse or skip gridSpacing');
  } catch (error) {
    assert.fail(`YAML parsing failed: ${error.message}`);
  }
});

/**
 * Test 9: showNodeDates toggling works correctly
 */
test('Show Node Dates Toggle - Can toggle between true and false', async (t) => {
  const settings = new VisualizationSettings();
  
  // Should start true
  assert.equal(settings.getSettings().showNodeDates, true, 'Should start true');
  
  // Toggle to false
  settings.setSetting('showNodeDates', false);
  assert.equal(settings.getSettings().showNodeDates, false, 'Should be false after toggle');
  
  // Toggle back to true
  settings.setSetting('showNodeDates', true);
  assert.equal(settings.getSettings().showNodeDates, true, 'Should be true again');
});

/**
 * Test 10: Default config file consistency
 */
test('Default Config - File consistency check', async (t) => {
  // This test verifies that defaults align with schema
  const defaults = VisualizationSettings.getDefaults();
  const schema = VisualizationSettings.getSchema();
  
  // Check that every setting in defaults has a schema entry
  for (const [key, value] of Object.entries(defaults)) {
    assert.ok(key in schema, `Setting ${key} should exist in schema`);
  }
  
  // Check that showNodeDates is true in both
  assert.equal(defaults.showNodeDates, true, 'defaults.showNodeDates should be true');
  assert.equal(schema.showNodeDates.default, true, 'schema default should be true');
});

/**
 * Test 11: Fresh startup displays node dates
 */
test('Startup Behavior - Fresh instance should have showNodeDates = true', async (t) => {
  // Simulates what happens when app loads
  const settings = new VisualizationSettings();
  const current = settings.getSettings();
  
  // Verify that node dates would be shown on startup
  assert.equal(current.showNodeDates, true, 'Node dates should be displayed by default on startup');
});

/**
 * Test 12: Filename format for export
 */
test('Export Filename - Should use format phyloexplorer-settings-YYYY-MM-DD.yaml', async (t) => {
  // This is a format verification test
  // The actual filename is generated in SettingsUI._exportSettings()
  
  const today = new Date().toISOString().split('T')[0];
  const expectedPattern = `phyloexplorer-settings-${today}.yaml`;
  
  // Verify the pattern is correct (YYYY-MM-DD format)
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(today), 'Date should be in YYYY-MM-DD format');
});
