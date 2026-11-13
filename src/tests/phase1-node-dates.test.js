/**
 * Phase 1: Node Date Initialization and Settings
 * Tests for bug fixes and new settings added in Phase 1
 */

import test from 'node:test';
import assert from 'node:assert';
import { VisualizationSettings } from '../settings/VisualizationSettings.js';

test('Phase 1: Node Date Settings', async (suite) => {
  await suite.test('showNodeDates defaults to true', () => {
    const settings = new VisualizationSettings();
    assert.strictEqual(settings.getSettings().showNodeDates, true);
  });

  await suite.test('nodeDateFontSize defaults to 8', () => {
    const settings = new VisualizationSettings();
    assert.strictEqual(settings.getSettings().nodeDateFontSize, 8);
  });

  await suite.test('nodeDateFontSize schema defines 6-16 range', () => {
    const schema = VisualizationSettings.getSchema();
    assert.strictEqual(schema.nodeDateFontSize.min, 6);
    assert.strictEqual(schema.nodeDateFontSize.max, 16);
    assert.strictEqual(schema.nodeDateFontSize.default, 8);
  });

  await suite.test('nodeDateFontSize accepts valid values', () => {
    const settings = new VisualizationSettings();
    settings.setSetting('nodeDateFontSize', 10);
    assert.strictEqual(settings.getSettings().nodeDateFontSize, 10);
  });

  await suite.test('nodeDateFontSize clamps to minimum', () => {
    const settings = new VisualizationSettings();
    settings.setSetting('nodeDateFontSize', 2);
    assert.strictEqual(settings.getSettings().nodeDateFontSize, 6);
  });

  await suite.test('nodeDateFontSize clamps to maximum', () => {
    const settings = new VisualizationSettings();
    settings.setSetting('nodeDateFontSize', 30);
    assert.strictEqual(settings.getSettings().nodeDateFontSize, 16);
  });

  await suite.test('showSpeciesEstablishmentDates defaults to false', () => {
    const settings = new VisualizationSettings();
    assert.strictEqual(settings.getSettings().showSpeciesEstablishmentDates, false);
  });

  await suite.test('showSpeciesEstablishmentDates is boolean setting', () => {
    const schema = VisualizationSettings.getSchema();
    assert.strictEqual(schema.showSpeciesEstablishmentDates.type, 'boolean');
    assert.strictEqual(schema.showSpeciesEstablishmentDates.default, false);
  });

  await suite.test('Settings schema includes new settings', () => {
    const schema = VisualizationSettings.getSchema();
    assert(schema.nodeDateFontSize);
    assert(schema.showSpeciesEstablishmentDates);
  });

  await suite.test('YAML export includes nodeDateFontSize', () => {
    const settings = new VisualizationSettings();
    settings.setSetting('nodeDateFontSize', 10);
    const yaml = settings.toYAML();
    assert(yaml.includes('nodeDateFontSize: 10'));
  });

  await suite.test('YAML export includes showSpeciesEstablishmentDates', () => {
    const settings = new VisualizationSettings();
    const yaml = settings.toYAML();
    assert(yaml.includes('showSpeciesEstablishmentDates: false'));
  });

  await suite.test('YAML import preserves nodeDateFontSize', () => {
    const yaml = `nodeDateFontSize: 12`;
    const settings = new VisualizationSettings();
    settings.loadFromYAML(yaml);
    assert.strictEqual(settings.getSettings().nodeDateFontSize, 12);
  });

  await suite.test('YAML import preserves showSpeciesEstablishmentDates', () => {
    const yaml = `showSpeciesEstablishmentDates: true`;
    const settings = new VisualizationSettings();
    settings.loadFromYAML(yaml);
    assert.strictEqual(settings.getSettings().showSpeciesEstablishmentDates, true);
  });

  await suite.test('Round-trip export/import preserves nodeDateFontSize', () => {
    const settings1 = new VisualizationSettings();
    settings1.setSetting('nodeDateFontSize', 12);
    const yaml = settings1.toYAML();
    
    const settings2 = new VisualizationSettings();
    settings2.loadFromYAML(yaml);
    assert.strictEqual(settings2.getSettings().nodeDateFontSize, 12);
  });

  await suite.test('Round-trip export/import preserves showSpeciesEstablishmentDates', () => {
    const settings1 = new VisualizationSettings();
    settings1.setSetting('showSpeciesEstablishmentDates', true);
    const yaml = settings1.toYAML();
    
    const settings2 = new VisualizationSettings();
    settings2.loadFromYAML(yaml);
    assert.strictEqual(settings2.getSettings().showSpeciesEstablishmentDates, true);
  });

  await suite.test('Reset to defaults restores nodeDateFontSize to 8', () => {
    const settings = new VisualizationSettings();
    settings.setSetting('nodeDateFontSize', 14);
    settings.resetToDefaults();
    assert.strictEqual(settings.getSettings().nodeDateFontSize, 8);
  });

  await suite.test('Reset to defaults restores showSpeciesEstablishmentDates to false', () => {
    const settings = new VisualizationSettings();
    settings.setSetting('showSpeciesEstablishmentDates', true);
    settings.resetToDefaults();
    assert.strictEqual(settings.getSettings().showSpeciesEstablishmentDates, false);
  });

  await suite.test('updateSettings applies nodeDateFontSize', () => {
    const settings = new VisualizationSettings();
    const changed = settings.updateSettings({ nodeDateFontSize: 14 });
    assert.strictEqual(changed, true);
    assert.strictEqual(settings.getSettings().nodeDateFontSize, 14);
  });

  await suite.test('updateSettings applies showSpeciesEstablishmentDates', () => {
    const settings = new VisualizationSettings();
    const changed = settings.updateSettings({ showSpeciesEstablishmentDates: true });
    assert.strictEqual(changed, true);
    assert.strictEqual(settings.getSettings().showSpeciesEstablishmentDates, true);
  });

  await suite.test('showNodeDates is still true by default (not broken)', () => {
    const settings = new VisualizationSettings();
    assert.strictEqual(settings.getSettings().showNodeDates, true);
  });
});
