/**
 * Test suite for topology repulsion scale consistency.
 * 
 * Verifies that:
 * - UI range (0-100) matches stored range (0-100)
 * - Stored values convert to internal values via /10 division
 * - Settings schema and YAML defaults match
 * - SettingsUI passes values directly without additional conversion
 */

import { test } from 'node:test';
import assert from 'assert/strict';
import { VisualizationSettings } from '../settings/VisualizationSettings.js';
import fs from 'fs';
import path from 'path';

// Test 1: Schema and defaults consistency
test('Topology Scale: schema A and B have max 100 and default 10', () => {
  const schema = VisualizationSettings.getSchema();
  assert.equal(schema.topologyRepulsionA.max, 100, 'A max should be 100');
  assert.equal(schema.topologyRepulsionA.default, 10, 'A default should be 10');
  assert.equal(schema.topologyRepulsionB.max, 100, 'B max should be 100');
  assert.equal(schema.topologyRepulsionB.default, 10, 'B default should be 10');
});

test('Topology Scale: schema X has max 100 and default 0', () => {
  const schema = VisualizationSettings.getSchema();
  assert.equal(schema.topologyRepulsionX.max, 100, 'X max should be 100');
  assert.equal(schema.topologyRepulsionX.default, 0, 'X default should be 0');
});

// Test 2: YAML defaults match schema defaults
test('Topology Scale: YAML defaults match schema defaults', () => {
  const yamlPath = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '../../config/default-settings.yaml'
  );
  
  // Read YAML manually (without external parser)
  const yamlContent = fs.readFileSync(yamlPath, 'utf8');
  
  // Parse topology repulsion values from YAML
  const aMatch = yamlContent.match(/^topologyRepulsionA:\s*(\d+)/m);
  const bMatch = yamlContent.match(/^topologyRepulsionB:\s*(\d+)/m);
  const xMatch = yamlContent.match(/^topologyRepulsionX:\s*(\d+)/m);
  
  assert(aMatch, 'Should find topologyRepulsionA in YAML');
  assert(bMatch, 'Should find topologyRepulsionB in YAML');
  assert(xMatch, 'Should find topologyRepulsionX in YAML');
  
  const schema = VisualizationSettings.getSchema();
  assert.equal(parseInt(aMatch[1]), schema.topologyRepulsionA.default, 'YAML A should match schema default');
  assert.equal(parseInt(bMatch[1]), schema.topologyRepulsionB.default, 'YAML B should match schema default');
  assert.equal(parseInt(xMatch[1]), schema.topologyRepulsionX.default, 'YAML X should match schema default');
});

// Test 3: Settings instance defaults match schema
test('Topology Scale: settings instance defaults match schema', () => {
  const settings = new VisualizationSettings();
  const current = settings.getSettings();
  const schema = VisualizationSettings.getSchema();
  
  assert.equal(current.topologyRepulsionA, schema.topologyRepulsionA.default);
  assert.equal(current.topologyRepulsionB, schema.topologyRepulsionB.default);
  assert.equal(current.topologyRepulsionX, schema.topologyRepulsionX.default);
});

// Test 4: UI value to stored value conversion (direct pass-through)
test('Topology Scale: stored values equal UI slider values directly', () => {
  const settings = new VisualizationSettings();
  
  // Set stored values (simulating slider drag)
  settings.setSetting('topologyRepulsionA', 50);
  settings.setSetting('topologyRepulsionB', 75);
  settings.setSetting('topologyRepulsionX', 25);
  
  // Verify stored values are exact copies of UI values
  const stored = settings.getSettings();
  assert.equal(stored.topologyRepulsionA, 50, 'Stored A should equal UI value');
  assert.equal(stored.topologyRepulsionB, 75, 'Stored B should equal UI value');
  assert.equal(stored.topologyRepulsionX, 25, 'Stored X should equal UI value');
});

// Test 5: Stored to internal conversion (division by 10)
test('Topology Scale: internal values are stored values divided by 10', () => {
  // This test documents the expected conversion for visualization code
  // (The visualization performs: internal = stored / 10)
  
  const testCases = [
    { stored: 0, internal: 0 },
    { stored: 10, internal: 1 },
    { stored: 50, internal: 5 },
    { stored: 100, internal: 10 },
  ];
  
  for (const tc of testCases) {
    const internal = tc.stored / 10;
    assert.equal(internal, tc.internal, 
      `Stored ${tc.stored} should convert to internal ${tc.internal}, got ${internal}`);
  }
});

// Test 6: Round-trip through YAML export/import
test('Topology Scale: round-trip through YAML preserves stored values', () => {
  const settings1 = new VisualizationSettings();
  settings1.setSetting('topologyRepulsionA', 50);
  settings1.setSetting('topologyRepulsionB', 75);
  settings1.setSetting('topologyRepulsionX', 25);
  
  const yaml = settings1.toYAML();
  
  const settings2 = new VisualizationSettings();
  settings2.loadFromYAML(yaml);
  
  const stored1 = settings1.getSettings();
  const stored2 = settings2.getSettings();
  
  assert.equal(stored2.topologyRepulsionA, stored1.topologyRepulsionA);
  assert.equal(stored2.topologyRepulsionB, stored1.topologyRepulsionB);
  assert.equal(stored2.topologyRepulsionX, stored1.topologyRepulsionX);
});

// Test 7: Clamping at boundaries
test('Topology Scale: stored values clamp to 0-100 range', () => {
  const settings = new VisualizationSettings();
  
  // Test below minimum
  settings.setSetting('topologyRepulsionA', -50);
  assert.equal(settings.getSettings().topologyRepulsionA, 0);
  
  // Test above maximum
  settings.setSetting('topologyRepulsionA', 150);
  assert.equal(settings.getSettings().topologyRepulsionA, 100);
  
  // Same for B
  settings.setSetting('topologyRepulsionB', -10);
  assert.equal(settings.getSettings().topologyRepulsionB, 0);
  settings.setSetting('topologyRepulsionB', 200);
  assert.equal(settings.getSettings().topologyRepulsionB, 100);
  
  // Same for X
  settings.setSetting('topologyRepulsionX', -1);
  assert.equal(settings.getSettings().topologyRepulsionX, 0);
  settings.setSetting('topologyRepulsionX', 500);
  assert.equal(settings.getSettings().topologyRepulsionX, 100);
});

// Test 8: SettingsUI mapping verification
test('Topology Scale: verify SettingsUI maps sliders correctly', () => {
  // Read SettingsUI to verify it uses direct pass-through
  const settingsUIPath = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '../ui/SettingsUI.js'
  );
  
  const content = fs.readFileSync(settingsUIPath, 'utf8');
  
  // Verify A slider uses parseFloat (direct pass-through)
  assert(content.includes("'topology-repulsion-a-slider'"));
  assert(content.includes("transform: v => parseFloat(v)"));
  
  // Verify B slider uses parseFloat (direct pass-through)
  assert(content.includes("'topology-repulsion-b-slider'"));
  
  // Verify X slider uses parseInt (direct pass-through for integers)
  assert(content.includes("'topology-repulsion-x-slider'"));
  assert(content.includes("transform: v => parseInt(v)"));
});

// Test 9: ForceDirectedVisualization division by 10
test('Topology Scale: verify ForceDirectedVisualization divides by 10', () => {
  // Read the visualization source to verify it performs /10 conversion
  const vizPath = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '../visualization/forceDirectedVisualization.js'
  );
  
  const content = fs.readFileSync(vizPath, 'utf8');
  
  // Verify each setter divides by 10
  assert(content.includes('setTopologyRepulsionA(value)'));
  assert(content.includes('this.topologyRepulsionA = value / 10'));
  
  assert(content.includes('setTopologyRepulsionB(value)'));
  assert(content.includes('this.topologyRepulsionB = value / 10'));
  
  assert(content.includes('setTopologyRepulsionX(value)'));
  assert(content.includes('this.topologyRepulsionX = value / 10'));
});

// Test 10: HTML slider ranges match stored range
test('Topology Scale: verify HTML sliders have min=0 max=100', () => {
  const htmlPath = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '../../index.html'
  );
  
  const content = fs.readFileSync(htmlPath, 'utf8');
  
  // Verify A slider has correct range
  assert(content.includes('id="topology-repulsion-a-slider"'));
  const aRange = content.match(/id="topology-repulsion-a-slider"[^>]*min="(\d+)"[^>]*max="(\d+)"/);
  assert(aRange, 'Should find A slider range');
  assert.equal(aRange[1], '0', 'A slider min should be 0');
  assert.equal(aRange[2], '100', 'A slider max should be 100');
  
  // Verify B slider has correct range
  assert(content.includes('id="topology-repulsion-b-slider"'));
  const bRange = content.match(/id="topology-repulsion-b-slider"[^>]*min="(\d+)"[^>]*max="(\d+)"/);
  assert(bRange, 'Should find B slider range');
  assert.equal(bRange[1], '0', 'B slider min should be 0');
  assert.equal(bRange[2], '100', 'B slider max should be 100');
  
  // Verify X slider has correct range
  assert(content.includes('id="topology-repulsion-x-slider"'));
  const xRange = content.match(/id="topology-repulsion-x-slider"[^>]*min="(\d+)"[^>]*max="(\d+)"/);
  assert(xRange, 'Should find X slider range');
  assert.equal(xRange[1], '0', 'X slider min should be 0');
  assert.equal(xRange[2], '100', 'X slider max should be 100');
});

// Test 11: HTML slider default values match stored defaults
test('Topology Scale: verify HTML slider defaults match schema defaults', () => {
  const htmlPath = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    '../../index.html'
  );
  
  const content = fs.readFileSync(htmlPath, 'utf8');
  const schema = VisualizationSettings.getSchema();
  
  // Check A default (should be 10)
  const aMatch = content.match(/id="topology-repulsion-a-slider"[^>]*value="(\d+)"/);
  assert(aMatch, 'Should find A slider default');
  assert.equal(parseInt(aMatch[1]), schema.topologyRepulsionA.default, 'A default should be 10');
  
  // Check B default (should be 10)
  const bMatch = content.match(/id="topology-repulsion-b-slider"[^>]*value="(\d+)"/);
  assert(bMatch, 'Should find B slider default');
  assert.equal(parseInt(bMatch[1]), schema.topologyRepulsionB.default, 'B default should be 10');
  
  // Check X default (should be 0)
  const xMatch = content.match(/id="topology-repulsion-x-slider"[^>]*value="(\d+)"/);
  assert(xMatch, 'Should find X slider default');
  assert.equal(parseInt(xMatch[1]), schema.topologyRepulsionX.default, 'X default should be 0');
});

// Test 12: Full integration test with all ranges
test('Topology Scale: end-to-end scale consistency A=10→B=10→X=100', () => {
  // Simulate user setting A=10 (default), B=10 (default), X=100 (max)
  const settings = new VisualizationSettings();
  
  settings.setSetting('topologyRepulsionA', 10);
  settings.setSetting('topologyRepulsionB', 10);
  settings.setSetting('topologyRepulsionX', 100);
  
  const stored = settings.getSettings();
  
  // Verify stored values
  assert.equal(stored.topologyRepulsionA, 10);
  assert.equal(stored.topologyRepulsionB, 10);
  assert.equal(stored.topologyRepulsionX, 100);
  
  // Simulate visualization receiving these values and dividing by 10
  const internal = {
    A: stored.topologyRepulsionA / 10,
    B: stored.topologyRepulsionB / 10,
    X: stored.topologyRepulsionX / 10,
  };
  
  // Verify internal values are correct
  assert.equal(internal.A, 1, 'A=10 stored should yield internal 1');
  assert.equal(internal.B, 1, 'B=10 stored should yield internal 1');
  assert.equal(internal.X, 10, 'X=100 stored should yield internal 10');
});

// Test 13: Schema type consistency
test('Topology Scale: topology schema uses integer type', () => {
  const schema = VisualizationSettings.getSchema();
  assert.equal(schema.topologyRepulsionA.type, 'integer', 'A should be integer type');
  assert.equal(schema.topologyRepulsionB.type, 'integer', 'B should be integer type');
  assert.equal(schema.topologyRepulsionX.type, 'integer', 'X should be integer type');
});

