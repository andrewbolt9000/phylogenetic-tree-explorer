import { test } from 'node:test';
import assert from 'assert/strict';
import { VisualizationSettings } from './VisualizationSettings.js';

// Tests for VisualizationSettings - Defaults and Initialization
test('VisualizationSettings: initialize with defaults', () => {
  const settings = new VisualizationSettings();
  const current = settings.getSettings();
  assert.equal(current.charge, 300);
  assert.equal(current.linkStrength, 0.5);
  assert.equal(current.topologyRepulsionX, 0);
});

test('VisualizationSettings: has sensible defaults', () => {
  const defaults = VisualizationSettings.getDefaults();
  assert(defaults.hasOwnProperty('charge'));
  assert(defaults.hasOwnProperty('linkStrength'));
});

// Tests for Validation
test('VisualizationSettings: validate and bound integer values', () => {
  const settings = new VisualizationSettings();
  settings.setSetting('charge', 2000);
  assert.equal(settings.getSettings().charge, 1500);
  settings.setSetting('charge', -100);
  assert.equal(settings.getSettings().charge, 0);
});

test('VisualizationSettings: validate boolean values', () => {
  const settings = new VisualizationSettings();
  settings.setSetting('showNodeDates', true);
  assert.equal(settings.getSettings().showNodeDates, true);
});

test('VisualizationSettings: throw on unknown setting', () => {
  const settings = new VisualizationSettings();
  assert.throws(() => settings.setSetting('unknownSetting', 42));
});

// Tests for Setting Updates
test('VisualizationSettings: update a single setting', () => {
  const settings = new VisualizationSettings();
  settings.setSetting('charge', 500);
  assert.equal(settings.getSettings().charge, 500);
});

test('VisualizationSettings: return true if setting changed', () => {
  const settings = new VisualizationSettings();
  const changed = settings.setSetting('charge', 500);
  assert.equal(changed, true);
});

test('VisualizationSettings: return false if unchanged', () => {
  const settings = new VisualizationSettings();
  const changed = settings.setSetting('charge', 300);
  assert.equal(changed, false);
});

test('VisualizationSettings: update multiple settings', () => {
  const settings = new VisualizationSettings();
  settings.updateSettings({
    charge: 400,
    linkStrength: 0.75,
    silhouetteSizePercent: 150,
  });
  const current = settings.getSettings();
  assert.equal(current.charge, 400);
  assert.equal(current.linkStrength, 0.75);
  assert.equal(current.silhouetteSizePercent, 150);
});

// Tests for Reset
test('VisualizationSettings: reset to defaults', () => {
  const settings = new VisualizationSettings();
  settings.updateSettings({charge: 600, silhouetteSizePercent: 200});
  settings.resetToDefaults();
  const current = settings.getSettings();
  assert.equal(current.charge, 300);
  assert.equal(current.silhouetteSizePercent, 100);
});

// Tests for YAML Export
test('VisualizationSettings: export as YAML', () => {
  const settings = new VisualizationSettings();
  const yaml = settings.toYAML();
  assert(yaml.includes('# PhyloExplorer Visualization Settings'));
  assert(yaml.includes('charge: 300'));
});

// Tests for YAML Parsing
test('VisualizationSettings: parse YAML settings', () => {
  const yamlString = `charge: 500\nlinkStrength: 0.75`;
  const parsed = VisualizationSettings.parseYAML(yamlString);
  assert.equal(parsed.charge, 500);
  assert.equal(parsed.linkStrength, 0.75);
});

test('VisualizationSettings: skip YAML comments', () => {
  const yamlString = `# Comment\ncharge: 400`;
  const parsed = VisualizationSettings.parseYAML(yamlString);
  assert.equal(parsed.charge, 400);
});

test('VisualizationSettings: parse booleans from YAML', () => {
  const yamlString = `showNodeDates: true`;
  const parsed = VisualizationSettings.parseYAML(yamlString);
  assert.equal(parsed.showNodeDates, true);
});

// Tests for YAML Load
test('VisualizationSettings: load from YAML string', () => {
  const settings = new VisualizationSettings();
  const yamlString = `charge: 600\nlinkStrength: 0.85`;
  settings.loadFromYAML(yamlString);
  const current = settings.getSettings();
  assert.equal(current.charge, 600);
  assert.equal(current.linkStrength, 0.85);
});

test('VisualizationSettings: validate before YAML load', () => {
  const settings = new VisualizationSettings();
  const yamlString = `charge: 999999`;
  settings.loadFromYAML(yamlString);
  assert.equal(settings.getSettings().charge, 1500);
});

// Tests for Round-trip
test('VisualizationSettings: preserve through export/import', () => {
  const settings1 = new VisualizationSettings();
  settings1.updateSettings({charge: 550, linkStrength: 0.65});
  const yaml = settings1.toYAML();
  const settings2 = new VisualizationSettings();
  settings2.loadFromYAML(yaml);
  assert.deepEqual(settings2.getSettings(), settings1.getSettings());
});

// Tests for Listeners
test('VisualizationSettings: notify listeners on change', () => {
  const settings = new VisualizationSettings();
  let callCount = 0;
  settings.onChange(() => callCount++);
  settings.setSetting('charge', 400);
  assert.equal(callCount, 1);
});

test('VisualizationSettings: not notify on unchanged', () => {
  const settings = new VisualizationSettings();
  let callCount = 0;
  settings.onChange(() => callCount++);
  settings.setSetting('charge', 300);
  assert.equal(callCount, 0);
});

test('VisualizationSettings: allow removing listeners', () => {
  const settings = new VisualizationSettings();
  let callCount = 0;
  const listener = () => callCount++;
  settings.onChange(listener);
  settings.offChange(listener);
  settings.setSetting('charge', 400);
  assert.equal(callCount, 0);
});

// Tests for Topology Repulsion Scale Consistency
test('VisualizationSettings: topology repulsion defaults are A=10, B=10, X=0', () => {
  const settings = new VisualizationSettings();
  const current = settings.getSettings();
  assert.equal(current.topologyRepulsionA, 10, 'A should default to 10');
  assert.equal(current.topologyRepulsionB, 10, 'B should default to 10');
  assert.equal(current.topologyRepulsionX, 0, 'X should default to 0');
});

test('VisualizationSettings: topology schema defines 0-100 range for A', () => {
  const schema = VisualizationSettings.getSchema();
  assert.equal(schema.topologyRepulsionA.min, 0);
  assert.equal(schema.topologyRepulsionA.max, 100);
  assert.equal(schema.topologyRepulsionA.default, 10);
});

test('VisualizationSettings: topology schema defines 0-100 range for B', () => {
  const schema = VisualizationSettings.getSchema();
  assert.equal(schema.topologyRepulsionB.min, 0);
  assert.equal(schema.topologyRepulsionB.max, 100);
  assert.equal(schema.topologyRepulsionB.default, 10);
});

test('VisualizationSettings: topology schema defines 0-100 range for X', () => {
  const schema = VisualizationSettings.getSchema();
  assert.equal(schema.topologyRepulsionX.min, 0);
  assert.equal(schema.topologyRepulsionX.max, 100);
  assert.equal(schema.topologyRepulsionX.default, 0);
});

test('VisualizationSettings: topology A accepts 0 and 100', () => {
  const settings = new VisualizationSettings();
  settings.setSetting('topologyRepulsionA', 0);
  assert.equal(settings.getSettings().topologyRepulsionA, 0);
  settings.setSetting('topologyRepulsionA', 100);
  assert.equal(settings.getSettings().topologyRepulsionA, 100);
});

test('VisualizationSettings: topology B accepts 0 and 100', () => {
  const settings = new VisualizationSettings();
  settings.setSetting('topologyRepulsionB', 0);
  assert.equal(settings.getSettings().topologyRepulsionB, 0);
  settings.setSetting('topologyRepulsionB', 100);
  assert.equal(settings.getSettings().topologyRepulsionB, 100);
});

test('VisualizationSettings: topology X accepts 0 and 100', () => {
  const settings = new VisualizationSettings();
  settings.setSetting('topologyRepulsionX', 0);
  assert.equal(settings.getSettings().topologyRepulsionX, 0);
  settings.setSetting('topologyRepulsionX', 100);
  assert.equal(settings.getSettings().topologyRepulsionX, 100);
});

test('VisualizationSettings: topology values above 100 are clamped to 100', () => {
  const settings = new VisualizationSettings();
  settings.setSetting('topologyRepulsionA', 150);
  assert.equal(settings.getSettings().topologyRepulsionA, 100);
  settings.setSetting('topologyRepulsionB', 200);
  assert.equal(settings.getSettings().topologyRepulsionB, 100);
  settings.setSetting('topologyRepulsionX', 150);
  assert.equal(settings.getSettings().topologyRepulsionX, 100);
});

test('VisualizationSettings: topology values below 0 are clamped to 0', () => {
  const settings = new VisualizationSettings();
  settings.setSetting('topologyRepulsionA', -10);
  assert.equal(settings.getSettings().topologyRepulsionA, 0);
  settings.setSetting('topologyRepulsionB', -5);
  assert.equal(settings.getSettings().topologyRepulsionB, 0);
  settings.setSetting('topologyRepulsionX', -50);
  assert.equal(settings.getSettings().topologyRepulsionX, 0);
});

test('VisualizationSettings: topology can set intermediate values', () => {
  const settings = new VisualizationSettings();
  settings.setSetting('topologyRepulsionA', 50);
  assert.equal(settings.getSettings().topologyRepulsionA, 50);
  settings.setSetting('topologyRepulsionB', 75);
  assert.equal(settings.getSettings().topologyRepulsionB, 75);
  settings.setSetting('topologyRepulsionX', 25);
  assert.equal(settings.getSettings().topologyRepulsionX, 25);
});

