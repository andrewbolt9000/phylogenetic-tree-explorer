/**
 * Graph-paper grid settings and persistence tests
 * 
 * Tests for grid settings validation, defaults, schema, and YAML serialization
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { VisualizationSettings } from '../settings/VisualizationSettings.js';
import fs from 'fs';

/**
 * Test 1: Grid settings exist in schema with correct ranges
 */
test('Grid - Schema defines all grid settings with correct ranges', async (t) => {
  const schema = VisualizationSettings.getSchema();
  
  // Check showGrid
  assert.ok(schema.showGrid, 'showGrid should exist in schema');
  assert.equal(schema.showGrid.type, 'boolean', 'showGrid should be boolean');
  assert.equal(schema.showGrid.default, true, 'showGrid default should be true');
  
  // Check gridSpacing
  assert.ok(schema.gridSpacing, 'gridSpacing should exist in schema');
  assert.equal(schema.gridSpacing.type, 'integer', 'gridSpacing should be integer');
  assert.equal(schema.gridSpacing.min, 10, 'gridSpacing min should be 10');
  assert.equal(schema.gridSpacing.max, 200, 'gridSpacing max should be 200');
  assert.equal(schema.gridSpacing.default, 50, 'gridSpacing default should be 50');
  
  // Check gridMinorLineWidth
  assert.ok(schema.gridMinorLineWidth, 'gridMinorLineWidth should exist in schema');
  assert.equal(schema.gridMinorLineWidth.type, 'number', 'gridMinorLineWidth should be number');
  assert.equal(schema.gridMinorLineWidth.min, 0.25, 'gridMinorLineWidth min should be 0.25');
  assert.equal(schema.gridMinorLineWidth.max, 5, 'gridMinorLineWidth max should be 5');
  assert.equal(schema.gridMinorLineWidth.default, 0.5, 'gridMinorLineWidth default should be 0.5');
  
  // Check gridMediumLineWidth
  assert.ok(schema.gridMediumLineWidth, 'gridMediumLineWidth should exist in schema');
  assert.equal(schema.gridMediumLineWidth.type, 'number', 'gridMediumLineWidth should be number');
  assert.equal(schema.gridMediumLineWidth.default, 1.0, 'gridMediumLineWidth default should be 1.0');
  
  // Check gridMajorLineWidth
  assert.ok(schema.gridMajorLineWidth, 'gridMajorLineWidth should exist in schema');
  assert.equal(schema.gridMajorLineWidth.type, 'number', 'gridMajorLineWidth should be number');
  assert.equal(schema.gridMajorLineWidth.default, 1.5, 'gridMajorLineWidth default should be 1.5');
  
  // Check gridOpacity
  assert.ok(schema.gridOpacity, 'gridOpacity should exist in schema');
  assert.equal(schema.gridOpacity.type, 'number', 'gridOpacity should be number');
  assert.equal(schema.gridOpacity.min, 0, 'gridOpacity min should be 0');
  assert.equal(schema.gridOpacity.max, 1, 'gridOpacity max should be 1');
  assert.equal(schema.gridOpacity.default, 0.3, 'gridOpacity default should be 0.3');
});

/**
 * Test 2: Grid settings defaults include all controls
 */
test('Grid - Defaults include all six grid settings', async (t) => {
  const defaults = VisualizationSettings.getDefaults();
  
  assert.ok('showGrid' in defaults, 'showGrid should be in defaults');
  assert.ok('gridSpacing' in defaults, 'gridSpacing should be in defaults');
  assert.ok('gridMinorLineWidth' in defaults, 'gridMinorLineWidth should be in defaults');
  assert.ok('gridMediumLineWidth' in defaults, 'gridMediumLineWidth should be in defaults');
  assert.ok('gridMajorLineWidth' in defaults, 'gridMajorLineWidth should be in defaults');
  assert.ok('gridOpacity' in defaults, 'gridOpacity should be in defaults');
  
  assert.equal(defaults.showGrid, true, 'showGrid default should be true');
  assert.equal(defaults.gridSpacing, 50, 'gridSpacing default should be 50');
  assert.equal(defaults.gridMinorLineWidth, 0.5, 'gridMinorLineWidth default should be 0.5');
  assert.equal(defaults.gridMediumLineWidth, 1.0, 'gridMediumLineWidth default should be 1.0');
  assert.equal(defaults.gridMajorLineWidth, 1.5, 'gridMajorLineWidth default should be 1.5');
  assert.equal(defaults.gridOpacity, 0.3, 'gridOpacity default should be 0.3');
});

/**
 * Test 3: Line widths increase from minor to major
 */
test('Grid - Default line widths increase from minor to medium to major', async (t) => {
  const defaults = VisualizationSettings.getDefaults();
  
  assert.ok(
    defaults.gridMinorLineWidth < defaults.gridMediumLineWidth,
    'Minor width should be less than medium width'
  );
  assert.ok(
    defaults.gridMediumLineWidth < defaults.gridMajorLineWidth,
    'Medium width should be less than major width'
  );
});

/**
 * Test 4: Grid settings validate clamping
 */
test('Grid - Settings validate and clamp to valid ranges', async (t) => {
  const settings = new VisualizationSettings();
  
  // Test spacing clamping
  settings.setSetting('gridSpacing', 500);  // Above max
  let current = settings.getSettings();
  assert.equal(current.gridSpacing, 200, 'gridSpacing should clamp to max 200');
  
  settings.setSetting('gridSpacing', -10);  // Below min
  current = settings.getSettings();
  assert.equal(current.gridSpacing, 10, 'gridSpacing should clamp to min 10');
  
  // Test line width clamping
  settings.setSetting('gridMinorLineWidth', 10);  // Above max
  current = settings.getSettings();
  assert.equal(current.gridMinorLineWidth, 5, 'gridMinorLineWidth should clamp to max 5');
  
  // Test opacity clamping
  settings.setSetting('gridOpacity', 1.5);  // Above max
  current = settings.getSettings();
  assert.equal(current.gridOpacity, 1, 'gridOpacity should clamp to max 1');
  
  settings.setSetting('gridOpacity', -0.5);  // Below min
  current = settings.getSettings();
  assert.equal(current.gridOpacity, 0, 'gridOpacity should clamp to min 0');
});

/**
 * Test 5: YAML export includes all grid settings
 */
test('Grid - YAML export includes all grid settings', async (t) => {
  const settings = new VisualizationSettings();
  settings.updateSettings({
    showGrid: false,
    gridSpacing: 75,
    gridMinorLineWidth: 0.75,
    gridMediumLineWidth: 1.25,
    gridMajorLineWidth: 1.75,
    gridOpacity: 0.5,
  });
  
  const yaml = settings.toYAML();
  
  assert.ok(yaml.includes('showGrid: false'), 'YAML should include showGrid');
  assert.ok(yaml.includes('gridSpacing: 75'), 'YAML should include gridSpacing');
  assert.ok(yaml.includes('gridMinorLineWidth:'), 'YAML should include gridMinorLineWidth');
  assert.ok(yaml.includes('gridMediumLineWidth:'), 'YAML should include gridMediumLineWidth');
  assert.ok(yaml.includes('gridMajorLineWidth:'), 'YAML should include gridMajorLineWidth');
  assert.ok(yaml.includes('gridOpacity:'), 'YAML should include gridOpacity');
});

/**
 * Test 6: YAML parsing includes grid settings
 */
test('Grid - YAML parsing restores all grid settings', async (t) => {
  const yaml = `
showGrid: true
gridSpacing: 75
gridMinorLineWidth: 0.75
gridMediumLineWidth: 1.25
gridMajorLineWidth: 1.75
gridOpacity: 0.5
showNodeDates: false
`;
  
  const settings = new VisualizationSettings();
  const parsed = VisualizationSettings.parseYAML(yaml);
  settings.updateSettings(parsed);
  const current = settings.getSettings();
  
  assert.equal(current.showGrid, true, 'showGrid should be restored from YAML');
  assert.equal(current.gridSpacing, 75, 'gridSpacing should be restored from YAML');
  assert.equal(current.gridMinorLineWidth, 0.75, 'gridMinorLineWidth should be restored from YAML');
  assert.equal(current.gridMediumLineWidth, 1.25, 'gridMediumLineWidth should be restored from YAML');
  assert.equal(current.gridMajorLineWidth, 1.75, 'gridMajorLineWidth should be restored from YAML');
  assert.equal(current.gridOpacity, 0.5, 'gridOpacity should be restored from YAML');
});

/**
 * Test 7: HTML controls exist with correct attributes
 */
test('Grid - HTML controls exist with correct max and default values', async (t) => {
  const htmlPath = './index.html';
  const html = fs.readFileSync(htmlPath, 'utf-8');
  
  // Check show-grid-toggle exists
  assert.ok(html.includes('id="show-grid-toggle"'), 'show-grid-toggle checkbox should exist');
  
  // Check grid-spacing-slider exists with correct max
  assert.ok(html.includes('id="grid-spacing-slider"'), 'grid-spacing-slider should exist');
  assert.ok(html.includes('max="200"'), 'grid-spacing-slider should have max="200"');
  assert.ok(html.includes('value="50"'), 'grid-spacing-slider should have default value="50"');
  
  // Check line width sliders exist with correct ranges
  assert.ok(html.includes('id="grid-minor-width-slider"'), 'grid-minor-width-slider should exist');
  assert.ok(html.includes('id="grid-medium-width-slider"'), 'grid-medium-width-slider should exist');
  assert.ok(html.includes('id="grid-major-width-slider"'), 'grid-major-width-slider should exist');
  
  // Check opacity slider exists with correct range
  assert.ok(html.includes('id="grid-opacity-slider"'), 'grid-opacity-slider should exist');
});

/**
 * Test 8: Reset to defaults includes grid settings
 */
test('Grid - Reset to defaults restores all grid settings to defaults', async (t) => {
  const settings = new VisualizationSettings();
  
  // Change all grid settings
  settings.updateSettings({
    showGrid: false,
    gridSpacing: 100,
    gridMinorLineWidth: 2.0,
    gridMediumLineWidth: 3.0,
    gridMajorLineWidth: 4.0,
    gridOpacity: 0.8,
  });
  
  // Reset to defaults
  const defaults = VisualizationSettings.getDefaults();
  settings.updateSettings(defaults);
  
  const current = settings.getSettings();
  assert.equal(current.showGrid, true, 'showGrid should reset to true');
  assert.equal(current.gridSpacing, 50, 'gridSpacing should reset to 50');
  assert.equal(current.gridMinorLineWidth, 0.5, 'gridMinorLineWidth should reset to 0.5');
  assert.equal(current.gridMediumLineWidth, 1.0, 'gridMediumLineWidth should reset to 1.0');
  assert.equal(current.gridMajorLineWidth, 1.5, 'gridMajorLineWidth should reset to 1.5');
  assert.equal(current.gridOpacity, 0.3, 'gridOpacity should reset to 0.3');
});

/**
 * Test 9: Grid section appears in YAML comments
 */
test('Grid - YAML export includes "# GRID" section header', async (t) => {
  const settings = new VisualizationSettings();
  const yaml = settings.toYAML();
  
  assert.ok(yaml.includes('# GRID'), 'YAML should include GRID section header');
});

/**
 * Test 10: Default config file includes grid settings
 */
test('Grid - config/default-settings.yaml includes all grid settings', async (t) => {
  const yamlPath = './config/default-settings.yaml';
  const yaml = fs.readFileSync(yamlPath, 'utf-8');
  
  assert.ok(yaml.includes('showGrid:'), 'default-settings.yaml should include showGrid');
  assert.ok(yaml.includes('gridSpacing:'), 'default-settings.yaml should include gridSpacing');
  assert.ok(yaml.includes('gridMinorLineWidth:'), 'default-settings.yaml should include gridMinorLineWidth');
  assert.ok(yaml.includes('gridMediumLineWidth:'), 'default-settings.yaml should include gridMediumLineWidth');
  assert.ok(yaml.includes('gridMajorLineWidth:'), 'default-settings.yaml should include gridMajorLineWidth');
  assert.ok(yaml.includes('gridOpacity:'), 'default-settings.yaml should include gridOpacity');
});
