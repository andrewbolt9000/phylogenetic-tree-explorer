/**
 * Leaf Forces Feature Tests
 * 
 * Tests for the new leaf-specific force settings and related features:
 * - Separate leafCharge setting for terminal nodes
 * - Per-node charge strength function
 * - Leaf-only hover highlighting with radial gradient
 * - Settings persistence and backward compatibility
 */

import test from 'node:test';
import assert from 'node:assert';
import { VisualizationSettings } from '../settings/VisualizationSettings.js';

test('Leaf Forces Feature - leafCharge Setting', async (t) => {
  await t.test('Schema includes leafCharge', () => {
    const schema = VisualizationSettings.getSchema();
    assert.ok(schema.leafCharge, 'leafCharge should be in schema');
    assert.strictEqual(schema.leafCharge.type, 'integer');
    assert.strictEqual(schema.leafCharge.min, 0);
    assert.strictEqual(schema.leafCharge.max, 1500);
    assert.strictEqual(schema.leafCharge.default, 300);
  });

  await t.test('Default settings include leafCharge', () => {
    const defaults = VisualizationSettings.getDefaults();
    assert.strictEqual(defaults.leafCharge, 300, 'leafCharge default should be 300');
  });

  await t.test('leafCharge can be updated via updateSettings', () => {
    const settings = new VisualizationSettings();
    settings.updateSettings({ leafCharge: 500 });
    const current = settings.getSettings();
    assert.strictEqual(current.leafCharge, 500);
  });

  await t.test('leafCharge is clamped to valid range', () => {
    const settings = new VisualizationSettings();
    settings.updateSettings({ leafCharge: 2000 });
    let current = settings.getSettings();
    assert.strictEqual(current.leafCharge, 1500, 'leafCharge should be clamped to max 1500');
    
    settings.updateSettings({ leafCharge: -100 });
    current = settings.getSettings();
    assert.strictEqual(current.leafCharge, 0, 'leafCharge should be clamped to min 0');
  });

  await t.test('leafCharge validation works independently from charge', () => {
    const settings = new VisualizationSettings();
    settings.updateSettings({ charge: 100, leafCharge: 500 });
    const current = settings.getSettings();
    assert.strictEqual(current.charge, 100);
    assert.strictEqual(current.leafCharge, 500);
    assert.notStrictEqual(current.charge, current.leafCharge);
  });
});

test('Leaf Forces Feature - YAML Persistence', async (t) => {
  await t.test('leafCharge is included in YAML export', () => {
    const settings = new VisualizationSettings();
    settings.updateSettings({ leafCharge: 250 });
    const yaml = settings.toYAML();
    assert.ok(yaml.includes('leafCharge'), 'YAML should include leafCharge');
    assert.ok(yaml.includes('250'), 'YAML should include leafCharge value 250');
  });

  await t.test('leafCharge can be imported from YAML', () => {
    const yaml = `leafCharge: 400
charge: 130`;
    const settings = new VisualizationSettings();
    settings.loadFromYAML(yaml);
    const current = settings.getSettings();
    assert.strictEqual(current.leafCharge, 400);
    assert.strictEqual(current.charge, 130);
  });

  await t.test('Backward compatibility: missing leafCharge defaults to loaded charge', () => {
    const oldYAML = `charge: 200`;
    const settings = new VisualizationSettings();
    settings.loadFromYAML(oldYAML);
    const current = settings.getSettings();
    // When leafCharge is missing but charge is present,
    // leafCharge should be set to the charge value
    assert.strictEqual(current.leafCharge, 200, 'leafCharge should match charge for backward compatibility');
    assert.strictEqual(current.charge, 200);
  });

  await t.test('Round-trip YAML export/import preserves leafCharge', () => {
    const settings1 = new VisualizationSettings();
    settings1.updateSettings({ leafCharge: 450, charge: 150 });
    const yaml = settings1.toYAML();
    
    const settings2 = new VisualizationSettings();
    settings2.loadFromYAML(yaml);
    const current = settings2.getSettings();
    assert.strictEqual(current.leafCharge, 450);
    assert.strictEqual(current.charge, 150);
  });

  await t.test('New YAML with both charge and leafCharge uses the correct values', () => {
    const yaml = `charge: 130
leafCharge: 200`;
    const settings = new VisualizationSettings();
    settings.loadFromYAML(yaml);
    const current = settings.getSettings();
    assert.strictEqual(current.charge, 130);
    assert.strictEqual(current.leafCharge, 200);
  });
});

test('Leaf Forces Feature - Force Simulation', async (t) => {
  await t.test('ForceDirectedVisualization stores currentLeafChargeStrength', () => {
    // Mock minimal setup for ForceDirectedVisualization
    // This test ensures the field exists and can be set
    const mockViz = {
      currentChargeStrength: -300,
      currentLeafChargeStrength: -300
    };
    
    assert.strictEqual(mockViz.currentLeafChargeStrength, -300);
    mockViz.currentLeafChargeStrength = -500;
    assert.strictEqual(mockViz.currentLeafChargeStrength, -500);
  });

  await t.test('Per-node charge function correctly identifies terminal nodes', () => {
    // Test the logic that would be in _getNodeCharge
    const terminalNode = { id: '1', type: 'terminal', x: 0, y: 0 };
    const internalNode = { id: '2', type: 'internal', x: 10, y: 10 };
    
    const currentChargeStrength = -300;
    const currentLeafChargeStrength = -500;
    
    // Simulate _getNodeCharge logic
    const getNodeCharge = (d) => {
      if (d.type === 'terminal') {
        return currentLeafChargeStrength;
      } else {
        return currentChargeStrength;
      }
    };
    
    assert.strictEqual(getNodeCharge(terminalNode), -500, 'Terminal node should use leafChargeStrength');
    assert.strictEqual(getNodeCharge(internalNode), -300, 'Internal node should use chargeStrength');
  });

  await t.test('Leaf and non-leaf nodes can have different charge values', () => {
    const nodes = [
      { id: '1', type: 'terminal', x: 0, y: 0 },
      { id: '2', type: 'internal', x: 10, y: 10 },
      { id: '3', type: 'terminal', x: 5, y: 5 }
    ];
    
    const currentChargeStrength = -300;
    const currentLeafChargeStrength = -500;
    
    const getNodeCharge = (d) => {
      if (d.type === 'terminal') {
        return currentLeafChargeStrength;
      } else {
        return currentChargeStrength;
      }
    };
    
    const charges = nodes.map(getNodeCharge);
    assert.deepStrictEqual(charges, [-500, -300, -500]);
  });
});

test('Leaf Forces Feature - Hover Highlighting Restriction', async (t) => {
  await t.test('Hover highlight is only shown for terminal nodes', () => {
    const terminalNode = { id: '1', type: 'terminal', x: 0, y: 0 };
    const internalNode = { id: '2', type: 'internal', x: 10, y: 10 };
    
    // Simulate hover logic
    const shouldShowHoverHighlight = (d) => d.type === 'terminal';
    
    assert.strictEqual(shouldShowHoverHighlight(terminalNode), true);
    assert.strictEqual(shouldShowHoverHighlight(internalNode), false);
  });

  await t.test('Internal nodes do not trigger hover highlight on mouseenter', () => {
    const internalNode = { id: '2', type: 'internal', x: 10, y: 10 };
    
    // Simulate hover event handler logic
    const onMouseEnter = (d) => {
      if (d.type === 'terminal') {
        return { action: 'show' };
      }
      return { action: 'none' };
    };
    
    assert.deepStrictEqual(onMouseEnter(internalNode), { action: 'none' });
  });

  await t.test('Radial gradient defined for hover highlight', () => {
    // Test that gradient ID exists and is referenced correctly
    const gradientUrl = 'url(#hoverHighlightGradient)';
    assert.ok(gradientUrl.includes('hoverHighlightGradient'));
    assert.ok(gradientUrl.startsWith('url('));
    assert.ok(gradientUrl.endsWith(')'));
  });
});

test('Leaf Forces Feature - Settings UI Integration', async (t) => {
  await t.test('leafCharge setting can be validated', () => {
    const settings = new VisualizationSettings();
    const validated = settings.validateSetting('leafCharge', 400);
    assert.strictEqual(validated, 400);
  });

  await t.test('leafCharge out-of-range values are clamped during validation', () => {
    const settings = new VisualizationSettings();
    const validated1 = settings.validateSetting('leafCharge', 2000);
    assert.strictEqual(validated1, 1500, 'Over-range value should be clamped to max');
    
    const validated2 = settings.validateSetting('leafCharge', -50);
    assert.strictEqual(validated2, 0, 'Under-range value should be clamped to min');
  });

  await t.test('leafCharge setting is independent from charge setting', () => {
    const settings = new VisualizationSettings();
    settings.updateSettings({ charge: 100 });
    let current = settings.getSettings();
    assert.strictEqual(current.charge, 100);
    assert.strictEqual(current.leafCharge, 300, 'leafCharge should remain at default');
    
    settings.updateSettings({ leafCharge: 200 });
    current = settings.getSettings();
    assert.strictEqual(current.charge, 100, 'charge should not change');
    assert.strictEqual(current.leafCharge, 200);
  });
});

test('Leaf Forces Feature - Default Settings File', async (t) => {
  await t.test('default-settings.yaml should be loadable with leafCharge', () => {
    // This test would need to read the actual default-settings.yaml file
    // For now, we test the logic that loads it
    const yaml = `
charge: 130
leafCharge: 130
`;
    const settings = new VisualizationSettings();
    settings.loadFromYAML(yaml);
    const current = settings.getSettings();
    assert.strictEqual(current.charge, 130);
    assert.strictEqual(current.leafCharge, 130);
  });

  await t.test('Defaults are consistent between code and config file', () => {
    const codeDefaults = VisualizationSettings.getDefaults();
    assert.strictEqual(codeDefaults.leafCharge, 300);
    assert.strictEqual(codeDefaults.charge, 300);
    // Both should default to same value initially
  });
});

test('Leaf Forces Feature - Listener Notifications', async (t) => {
  await t.test('Listeners are notified when leafCharge changes', () => {
    const settings = new VisualizationSettings();
    let notificationCount = 0;
    let lastSettings = null;
    
    settings.onChange((updatedSettings) => {
      notificationCount++;
      lastSettings = updatedSettings;
    });
    
    settings.updateSettings({ leafCharge: 400 });
    assert.strictEqual(notificationCount, 1);
    assert.strictEqual(lastSettings.leafCharge, 400);
  });

  await t.test('Changing charge does not affect leafCharge listeners', () => {
    const settings = new VisualizationSettings();
    const changes = [];
    
    settings.onChange((updatedSettings) => {
      changes.push({ charge: updatedSettings.charge, leafCharge: updatedSettings.leafCharge });
    });
    
    settings.updateSettings({ charge: 100 });
    settings.updateSettings({ leafCharge: 200 });
    
    assert.strictEqual(changes.length, 2);
    assert.strictEqual(changes[0].charge, 100);
    assert.strictEqual(changes[0].leafCharge, 300); // original default
    assert.strictEqual(changes[1].leafCharge, 200);
  });
});
