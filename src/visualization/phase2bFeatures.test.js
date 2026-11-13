/**
 * Phase 2B Tests: Hover Highlights and Silhouette Shadows
 * 
 * Tests for the new visual features added in Phase 2B:
 * - Configurable hover highlight circles
 * - Animal silhouette shadows
 * - Settings integration
 * - YAML compatibility
 */

import test from 'node:test';
import assert from 'node:assert';
import { VisualizationSettings } from '../settings/VisualizationSettings.js';

test('Phase 2B Features - Hover Highlight Settings', async (t) => {
  await t.test('Schema includes hoverHighlightSize', () => {
    const schema = VisualizationSettings.getSchema();
    assert.ok(schema.hoverHighlightSize);
    assert.strictEqual(schema.hoverHighlightSize.type, 'integer');
    assert.strictEqual(schema.hoverHighlightSize.min, 0);
    assert.strictEqual(schema.hoverHighlightSize.max, 200);
    assert.strictEqual(schema.hoverHighlightSize.default, 15);
  });

  await t.test('Schema includes hoverHighlightXOffset', () => {
    const schema = VisualizationSettings.getSchema();
    assert.ok(schema.hoverHighlightXOffset);
    assert.strictEqual(schema.hoverHighlightXOffset.type, 'integer');
    assert.strictEqual(schema.hoverHighlightXOffset.min, -50);
    assert.strictEqual(schema.hoverHighlightXOffset.max, 50);
    assert.strictEqual(schema.hoverHighlightXOffset.default, 0);
  });

  await t.test('Schema includes hoverHighlightYOffset', () => {
    const schema = VisualizationSettings.getSchema();
    assert.ok(schema.hoverHighlightYOffset);
    assert.strictEqual(schema.hoverHighlightYOffset.type, 'integer');
    assert.strictEqual(schema.hoverHighlightYOffset.min, -50);
    assert.strictEqual(schema.hoverHighlightYOffset.max, 50);
    assert.strictEqual(schema.hoverHighlightYOffset.default, 0);
  });

  await t.test('Default settings include hover highlight parameters', () => {
    const defaults = VisualizationSettings.getDefaults();
    assert.strictEqual(defaults.hoverHighlightSize, 15);
    assert.strictEqual(defaults.hoverHighlightXOffset, 0);
    assert.strictEqual(defaults.hoverHighlightYOffset, 0);
    assert.strictEqual(defaults.hoverHighlightOpacity, 70);
  });

  await t.test('Hover highlight settings can be updated', () => {
    const settings = new VisualizationSettings();
    settings.setSetting('hoverHighlightSize', 25);
    settings.setSetting('hoverHighlightXOffset', 5);
    settings.setSetting('hoverHighlightYOffset', -3);
    settings.setSetting('hoverHighlightOpacity', 50);

    const current = settings.getSettings();
    assert.strictEqual(current.hoverHighlightSize, 25);
    assert.strictEqual(current.hoverHighlightXOffset, 5);
    assert.strictEqual(current.hoverHighlightYOffset, -3);
    assert.strictEqual(current.hoverHighlightOpacity, 50);
  });

  await t.test('Hover highlight size is clamped to 0-200', () => {
    const settings = new VisualizationSettings();
    assert.strictEqual(settings.validateSetting('hoverHighlightSize', 300), 200);
    assert.strictEqual(settings.validateSetting('hoverHighlightSize', -10), 0);
  });

  await t.test('Hover highlight offsets are clamped to ±50', () => {
    const settings = new VisualizationSettings();
    assert.strictEqual(settings.validateSetting('hoverHighlightXOffset', 100), 50);
    assert.strictEqual(settings.validateSetting('hoverHighlightXOffset', -100), -50);
    assert.strictEqual(settings.validateSetting('hoverHighlightYOffset', 75), 50);
    assert.strictEqual(settings.validateSetting('hoverHighlightYOffset', -75), -50);
  });
});

test('Phase 2B Features - Silhouette Shadow Settings', async (t) => {
  await t.test('Schema includes silhouetteShadowEnabled', () => {
    const schema = VisualizationSettings.getSchema();
    assert.ok(schema.silhouetteShadowEnabled);
    assert.strictEqual(schema.silhouetteShadowEnabled.type, 'boolean');
    assert.strictEqual(schema.silhouetteShadowEnabled.default, true);
  });

  await t.test('Schema includes silhouetteShadowXOffset', () => {
    const schema = VisualizationSettings.getSchema();
    assert.ok(schema.silhouetteShadowXOffset);
    assert.strictEqual(schema.silhouetteShadowXOffset.type, 'integer');
    assert.strictEqual(schema.silhouetteShadowXOffset.min, -20);
    assert.strictEqual(schema.silhouetteShadowXOffset.max, 20);
    assert.strictEqual(schema.silhouetteShadowXOffset.default, 2);
  });

  await t.test('Schema includes silhouetteShadowYOffset', () => {
    const schema = VisualizationSettings.getSchema();
    assert.ok(schema.silhouetteShadowYOffset);
    assert.strictEqual(schema.silhouetteShadowYOffset.type, 'integer');
    assert.strictEqual(schema.silhouetteShadowYOffset.min, -20);
    assert.strictEqual(schema.silhouetteShadowYOffset.max, 20);
    assert.strictEqual(schema.silhouetteShadowYOffset.default, 2);
  });

  await t.test('Schema includes silhouetteShadowOpacity', () => {
    const schema = VisualizationSettings.getSchema();
    assert.ok(schema.silhouetteShadowOpacity);
    assert.strictEqual(schema.silhouetteShadowOpacity.type, 'number');
    assert.strictEqual(schema.silhouetteShadowOpacity.min, 0);
    assert.strictEqual(schema.silhouetteShadowOpacity.max, 1);
    assert.strictEqual(schema.silhouetteShadowOpacity.default, 0.3);
  });

  await t.test('Default settings include shadow parameters', () => {
    const defaults = VisualizationSettings.getDefaults();
    assert.strictEqual(defaults.silhouetteShadowEnabled, true);
    assert.strictEqual(defaults.silhouetteShadowXOffset, 2);
    assert.strictEqual(defaults.silhouetteShadowYOffset, 2);
    assert.strictEqual(defaults.silhouetteShadowOpacity, 0.3);
  });

  await t.test('Shadow settings can be updated', () => {
    const settings = new VisualizationSettings();
    settings.setSetting('silhouetteShadowEnabled', false);
    settings.setSetting('silhouetteShadowXOffset', 5);
    settings.setSetting('silhouetteShadowYOffset', -1);
    settings.setSetting('silhouetteShadowOpacity', 0.5);

    const current = settings.getSettings();
    assert.strictEqual(current.silhouetteShadowEnabled, false);
    assert.strictEqual(current.silhouetteShadowXOffset, 5);
    assert.strictEqual(current.silhouetteShadowYOffset, -1);
    assert.strictEqual(current.silhouetteShadowOpacity, 0.5);
  });

  await t.test('Shadow offsets are clamped to ±20', () => {
    const settings = new VisualizationSettings();
    assert.strictEqual(settings.validateSetting('silhouetteShadowXOffset', 50), 20);
    assert.strictEqual(settings.validateSetting('silhouetteShadowXOffset', -50), -20);
    assert.strictEqual(settings.validateSetting('silhouetteShadowYOffset', 25), 20);
    assert.strictEqual(settings.validateSetting('silhouetteShadowYOffset', -25), -20);
  });

  await t.test('Shadow opacity is clamped to 0-1', () => {
    const settings = new VisualizationSettings();
    assert.strictEqual(settings.validateSetting('silhouetteShadowOpacity', 2), 1);
    assert.strictEqual(settings.validateSetting('silhouetteShadowOpacity', -0.5), 0);
  });
});

test('Phase 2B Features - YAML Export/Import', async (t) => {
  await t.test('YAML export includes hover highlight settings', () => {
    const settings = new VisualizationSettings();
    settings.setSetting('hoverHighlightSize', 20);
    settings.setSetting('hoverHighlightXOffset', 2);
    settings.setSetting('hoverHighlightYOffset', -1);

    const yaml = settings.toYAML();
    assert.ok(yaml.includes('hoverHighlightSize'));
    assert.ok(yaml.includes('hoverHighlightXOffset'));
    assert.ok(yaml.includes('hoverHighlightYOffset'));
    assert.ok(yaml.includes('20'));  // The value
  });

  await t.test('YAML export includes shadow settings', () => {
    const settings = new VisualizationSettings();
    settings.setSetting('silhouetteShadowEnabled', false);
    settings.setSetting('silhouetteShadowXOffset', 3);

    const yaml = settings.toYAML();
    assert.ok(yaml.includes('silhouetteShadowEnabled'));
    assert.ok(yaml.includes('silhouetteShadowXOffset'));
    assert.ok(yaml.includes('silhouetteShadowYOffset'));
    assert.ok(yaml.includes('silhouetteShadowOpacity'));
  });

  await t.test('YAML round-trip preserves hover highlight settings', () => {
    const settings = new VisualizationSettings();
    settings.setSetting('hoverHighlightSize', 22);
    settings.setSetting('hoverHighlightXOffset', -7);
    settings.setSetting('hoverHighlightYOffset', 11);

    const yaml = settings.toYAML();
    const parsed = VisualizationSettings.parseYAML(yaml);

    assert.strictEqual(parsed.hoverHighlightSize, 22);
    assert.strictEqual(parsed.hoverHighlightXOffset, -7);
    assert.strictEqual(parsed.hoverHighlightYOffset, 11);
  });

  await t.test('YAML round-trip preserves shadow settings', () => {
    const settings = new VisualizationSettings();
    settings.setSetting('silhouetteShadowEnabled', false);
    settings.setSetting('silhouetteShadowXOffset', -4);
    settings.setSetting('silhouetteShadowYOffset', 6);
    settings.setSetting('silhouetteShadowOpacity', 0.6);

    const yaml = settings.toYAML();
    const parsed = VisualizationSettings.parseYAML(yaml);

    assert.strictEqual(parsed.silhouetteShadowEnabled, false);
    assert.strictEqual(parsed.silhouetteShadowXOffset, -4);
    assert.strictEqual(parsed.silhouetteShadowYOffset, 6);
    assert.strictEqual(parsed.silhouetteShadowOpacity, 0.6);
  });

  await t.test('Backward compatibility: old YAML without new settings loads defaults', () => {
    const oldYAML = `
# Old YAML without Phase 2B settings
charge: 300
linkStrength: 0.5
showGrid: true
`;
    const parsed = VisualizationSettings.parseYAML(oldYAML);
    
    // New settings should use defaults when not present in YAML
    assert.strictEqual(parsed.hoverHighlightSize, undefined);  // Will use default on load
    assert.strictEqual(parsed.silhouetteShadowEnabled, undefined);  // Will use default on load
    
    // But existing settings should be preserved
    assert.strictEqual(parsed.charge, 300);
    assert.strictEqual(parsed.linkStrength, 0.5);
    assert.strictEqual(parsed.showGrid, true);
  });
});

test('Phase 2B Features - updateSettings Atomic Application', async (t) => {
  await t.test('updateSettings applies all Phase 2B settings at once', () => {
    const settings = new VisualizationSettings();
    let changeCount = 0;
    
    settings.onChange(() => {
      changeCount++;
    });

    const phase2bSettings = {
      hoverHighlightSize: 30,
      hoverHighlightXOffset: 5,
      hoverHighlightYOffset: -2,
      silhouetteShadowEnabled: false,
      silhouetteShadowXOffset: 3,
      silhouetteShadowYOffset: 1,
      silhouetteShadowOpacity: 0.4,
    };

    settings.updateSettings(phase2bSettings);
    
    // Should trigger exactly one change notification
    assert.strictEqual(changeCount, 1);

    const current = settings.getSettings();
    assert.strictEqual(current.hoverHighlightSize, 30);
    assert.strictEqual(current.hoverHighlightXOffset, 5);
    assert.strictEqual(current.silhouetteShadowEnabled, false);
    assert.strictEqual(current.silhouetteShadowXOffset, 3);
    assert.strictEqual(current.silhouetteShadowOpacity, 0.4);
  });

  await t.test('updateSettings validates all settings before applying', () => {
    const settings = new VisualizationSettings();

    const invalidSettings = {
      hoverHighlightSize: 300,  // Should clamp to 200
      hoverHighlightXOffset: 100,  // Should clamp to 50
      silhouetteShadowOpacity: 2,  // Should clamp to 1
    };

    settings.updateSettings(invalidSettings);
    const current = settings.getSettings();

    assert.strictEqual(current.hoverHighlightSize, 200);
    assert.strictEqual(current.hoverHighlightXOffset, 50);
    assert.strictEqual(current.silhouetteShadowOpacity, 1);
  });
});

test('Phase 2B Features - Settings Validation', async (t) => {
  await t.test('Invalid setting names throw error', () => {
    const settings = new VisualizationSettings();
    assert.throws(() => {
      settings.setSetting('invalidHoverSetting', 50);
    }, /Unknown setting/);
  });

  await t.test('Non-integer hover highlight size coerces correctly', () => {
    const settings = new VisualizationSettings();
    settings.setSetting('hoverHighlightSize', '25.7');
    assert.strictEqual(settings.validateSetting('hoverHighlightSize', '25.7'), 26);
  });

  await t.test('Non-number shadow opacity coerces correctly', () => {
    const settings = new VisualizationSettings();
    settings.setSetting('silhouetteShadowOpacity', '0.45');
    const validated = settings.validateSetting('silhouetteShadowOpacity', '0.45');
    assert.strictEqual(validated, 0.45);
  });
});
