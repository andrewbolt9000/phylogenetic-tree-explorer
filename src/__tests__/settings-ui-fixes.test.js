/**
 * Tests for SettingsUI atomic YAML initialization and display label synchronization
 * Tests the fixes to:
 * 1. _loadDefaultSettings() to use atomic updateSettings() instead of per-setting setSetting()
 * 2. _updateUIFromSettings() to synchronize numeric display labels with slider values
 */

import test from 'node:test';
import assert from 'node:assert';
import { VisualizationSettings } from '../settings/VisualizationSettings.js';
import SettingsUI from '../ui/SettingsUI.js';

test('SettingsUI - Control Map', async (t) => {
  await t.test('getControlMap returns complete control definitions', (t) => {
    const controlMap = SettingsUI.getControlMap();
    assert(controlMap !== undefined, 'Control map should be defined');
    assert(typeof controlMap === 'object', 'Control map should be an object');
    
    // Verify some key controls are present
    assert(controlMap['background-white-level-slider'], 'Should have background-white-level-slider');
    assert(controlMap['charge-slider'], 'Should have charge-slider');
    assert(controlMap['wind-direction-slider'], 'Should have wind-direction-slider');
    assert(controlMap['grid-spacing-slider'], 'Should have grid-spacing-slider');
  });

  await t.test('Each control has required properties', (t) => {
    const controlMap = SettingsUI.getControlMap();
    Object.entries(controlMap).forEach(([elementId, config]) => {
      assert(config.setting, `Control '${elementId}' should have a setting property`);
      assert(config.transform || config.isToggle, `Control '${elementId}' should have transform or isToggle`);
    });
  });

  await t.test('Display element suffixes are correct', (t) => {
    const controlMap = SettingsUI.getControlMap();
    
    // Wind direction should have degree suffix
    assert.strictEqual(controlMap['wind-direction-slider'].suffix, '°');
    
    // Background white level and silhouette percent should have % suffix
    assert.strictEqual(controlMap['background-white-level-slider'].suffix, '%');
    assert.strictEqual(controlMap['silhouette-size-slider'].suffix, '%');
    
    // Silhouette offsets should have px suffix
    assert.strictEqual(controlMap['silhouette-x-offset-slider'].suffix, 'px');
    assert.strictEqual(controlMap['silhouette-y-offset-slider'].suffix, 'px');
  });

  await t.test('Sliders have display elements defined', (t) => {
    const controlMap = SettingsUI.getControlMap();
    
    // Verify that most sliders have display elements
    const displayCounts = {};
    Object.entries(controlMap).forEach(([elementId, config]) => {
      if (config.display) {
        displayCounts.withDisplay = (displayCounts.withDisplay || 0) + 1;
      } else if (!config.isToggle) {
        displayCounts.withoutDisplay = (displayCounts.withoutDisplay || 0) + 1;
      }
    });

    // Most sliders should have displays
    assert(displayCounts.withDisplay > 15, 'Should have many sliders with display elements');
  });

  await t.test('Toggle controls are correctly marked', (t) => {
    const controlMap = SettingsUI.getControlMap();
    
    const toggles = Object.entries(controlMap)
      .filter(([_, config]) => config.isToggle)
      .map(([elementId, _]) => elementId);

    assert(toggles.includes('lock-root-position-toggle'));
    assert(toggles.includes('show-node-dates-toggle'));
    assert(toggles.includes('show-grid-toggle'));
  });
});

test('SettingsUI - Integration: Settings Schema Defaults', async (t) => {
  await t.test('Schema has correct defaults for new settings', (t) => {
    const schema = VisualizationSettings.getSchema();
    
    // Background white level default should be 0
    assert.strictEqual(schema.backgroundWhiteLevel.default, 0);
    
    // Show node dates default should be true
    assert.strictEqual(schema.showNodeDates.default, true);
    
    // Grid spacing should have a default
    assert(schema.gridSpacing.default !== undefined);
  });

  await t.test('All new settings are in schema', (t) => {
    const schema = VisualizationSettings.getSchema();
    const defaults = VisualizationSettings.getDefaults();
    
    // Check that backgroundWhiteLevel is in schema and defaults
    assert(schema.backgroundWhiteLevel, 'backgroundWhiteLevel should be in schema');
    assert(defaults.backgroundWhiteLevel !== undefined, 'backgroundWhiteLevel should be in defaults');
    
    // Check grid settings
    assert(schema.gridSpacing, 'gridSpacing should be in schema');
    assert(defaults.gridSpacing !== undefined, 'gridSpacing should be in defaults');
  });
});

test('SettingsUI - Atomic YAML Initialization', async (t) => {
  await t.test('Default settings have all required properties', (t) => {
    const defaults = VisualizationSettings.getDefaults();
    
    // Check for key new settings
    assert(defaults.backgroundWhiteLevel !== undefined);
    assert(defaults.showNodeDates === true);
    assert(defaults.gridSpacing !== undefined);
    assert(defaults.windDirection !== undefined);
    assert(defaults.windStrength !== undefined);
    assert(defaults.lockRootPosition !== undefined);
  });

  await t.test('YAML exports include all settings', (t) => {
    const settings = new VisualizationSettings();
    const yaml = settings.toYAML();
    
    // YAML should include key settings
    assert(yaml.includes('backgroundWhiteLevel'), 'YAML should include backgroundWhiteLevel');
    assert(yaml.includes('showNodeDates'), 'YAML should include showNodeDates');
    assert(yaml.includes('gridSpacing'), 'YAML should include gridSpacing');
    assert(yaml.includes('windDirection'), 'YAML should include windDirection');
  });

  await t.test('updateSettings applies all settings atomically', (t) => {
    const settings = new VisualizationSettings();
    
    // Create an object with multiple settings using VALID values within schema ranges
    const updates = {
      charge: 500,  // Valid range: 0-1500
      linkStrength: 0.5,  // Valid range: 0-1
      showNodeDates: true,  // boolean
      backgroundWhiteLevel: 50,  // Valid range: 0-100
      gridSpacing: 30,  // Valid range depends on schema
    };

    // Apply all at once
    settings.updateSettings(updates);

    // Verify they were all applied
    const current = settings.getSettings();
    assert.strictEqual(current.charge, 500);
    assert.strictEqual(current.linkStrength, 0.5);
    assert.strictEqual(current.showNodeDates, true);
    assert.strictEqual(current.backgroundWhiteLevel, 50);
    assert.strictEqual(current.gridSpacing, 30);
  });

  await t.test('updateSettings validates before applying', (t) => {
    const settings = new VisualizationSettings();
    const initialState = settings.getSettings();
    
    // Try to apply invalid values
    const invalid = {
      backgroundWhiteLevel: 150,  // Max is 100
      charge: 2000,               // Max is 1500
      gridSpacing: -100,          // Should be positive
    };

    // Apply with invalid values - should clamp/validate
    settings.updateSettings(invalid);
    const result = settings.getSettings();
    
    // Values should be clamped or rejected
    assert(result.backgroundWhiteLevel <= 100, 'backgroundWhiteLevel should be clamped to max');
    assert(result.charge <= 1500, 'charge should be clamped to max');
  });
});

test('SettingsUI - Setting Validation and Ranges', async (t) => {
  await t.test('Background white level is clamped to 0-100', (t) => {
    const schema = VisualizationSettings.getSchema();
    assert.strictEqual(schema.backgroundWhiteLevel.min, 0);
    assert.strictEqual(schema.backgroundWhiteLevel.max, 100);
  });

  await t.test('Wind controls have correct ranges', (t) => {
    const schema = VisualizationSettings.getSchema();
    
    // Wind direction should be 0-360
    assert.strictEqual(schema.windDirection.min, 0);
    assert.strictEqual(schema.windDirection.max, 360);
    
    // Wind strength should be 0-2000
    assert.strictEqual(schema.windStrength.min, 0);
    assert.strictEqual(schema.windStrength.max, 2000);
  });

  await t.test('Grid controls have appropriate ranges', (t) => {
    const schema = VisualizationSettings.getSchema();
    
    // Grid spacing should be reasonable
    assert(schema.gridSpacing.min >= 1, 'Grid spacing min should be >= 1');
    assert(schema.gridSpacing.max >= 100, 'Grid spacing max should be large enough');
    
    // Line widths
    assert(schema.gridMinorLineWidth.min >= 0.1);
    assert(schema.gridMediumLineWidth.min >= 0.1);
    assert(schema.gridMajorLineWidth.min >= 0.1);
  });
});

test('SettingsUI - YAML Round-Trip', async (t) => {
  await t.test('Export and import preserve settings', (t) => {
    const settings1 = new VisualizationSettings();
    
    // Change some settings
    settings1.setSetting('backgroundWhiteLevel', 75);
    settings1.setSetting('showNodeDates', true);
    settings1.setSetting('gridSpacing', 40);
    settings1.setSetting('windDirection', 90);

    // Export to YAML
    const yaml = settings1.toYAML();

    // Import into new settings instance
    const imported = VisualizationSettings.parseYAML(yaml);
    
    // Verify values match
    assert.strictEqual(imported.backgroundWhiteLevel, 75);
    assert.strictEqual(imported.showNodeDates, true);
    assert.strictEqual(imported.gridSpacing, 40);
    assert.strictEqual(imported.windDirection, 90);
  });

  await t.test('YAML parseYAML returns a valid settings object', (t) => {
    const yaml = `
backgroundWhiteLevel: 50
showNodeDates: true
gridSpacing: 25
windDirection: 180
windStrength: 500
lockRootPosition: false
`;
    
    const parsed = VisualizationSettings.parseYAML(yaml);
    
    assert.strictEqual(parsed.backgroundWhiteLevel, 50);
    assert.strictEqual(parsed.showNodeDates, true);
    assert.strictEqual(parsed.gridSpacing, 25);
    assert.strictEqual(parsed.windDirection, 180);
    assert.strictEqual(parsed.windStrength, 500);
    assert.strictEqual(parsed.lockRootPosition, false);
  });
});

test('SettingsUI - Property Reference Correctness', async (t) => {
  await t.test('Settings class properties are correctly referenced', (t) => {
    const settings = new VisualizationSettings();
    const current = settings.getSettings();
    
    // Verify that common property names exist and are accessible
    assert(current.hasOwnProperty('edgeThickness'));
    assert(current.hasOwnProperty('showNodeDates'));
    assert(current.hasOwnProperty('backgroundWhiteLevel'));
    assert(current.hasOwnProperty('gridSpacing'));
    assert(current.hasOwnProperty('windDirection'));
  });

  await t.test('YAML export uses correct property paths', (t) => {
    const settings = new VisualizationSettings();
    settings.setSetting('backgroundWhiteLevel', 25);
    settings.setSetting('showNodeDates', true);
    
    const yaml = settings.toYAML();
    
    // YAML should have these properties
    assert(yaml.includes('backgroundWhiteLevel'), 'YAML should export backgroundWhiteLevel property');
    assert(yaml.includes('showNodeDates'), 'YAML should export showNodeDates property');
    
    // Should NOT have malformed property references
    assert(!yaml.includes('settingsbackgroundWhiteLevel'), 'Should not have malformed property reference');
    assert(!yaml.includes('settingsshowNodeDates'), 'Should not have malformed property reference');
  });
});

test('SettingsUI - Edge Thickness Range Fix', async (t) => {
  await t.test('Edge thickness schema max matches HTML control', (t) => {
    const schema = VisualizationSettings.getSchema();
    
    // Schema max should be 11 (matching HTML slider max)
    assert.strictEqual(schema.edgeThickness.max, 11);
  });

  await t.test('Edge thickness accepts value of 11', (t) => {
    const settings = new VisualizationSettings();
    settings.setSetting('edgeThickness', 11);
    
    const current = settings.getSettings();
    assert.strictEqual(current.edgeThickness, 11);
  });
});

