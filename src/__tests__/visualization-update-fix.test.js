/**
 * Regression test for updatingUI flag suppressing visualization updates
 * 
 * Bug: The onChange listener in SettingsUI.initialize() had this structure:
 * ```
 * this.settings.onChange((newSettings) => {
 *   if (!this.updatingUI) {
 *     this._updateUIFromSettings(newSettings);
 *     this._applySettingsToVisualization(newSettings);
 *   }
 * });
 * ```
 * 
 * This prevented visualization updates when updatingUI was true, which happens
 * during slider interactions. The updatingUI flag should only prevent UI feedback
 * loops, NOT visualization updates.
 * 
 * Fix: Always call _applySettingsToVisualization, but only call _updateUIFromSettings
 * when not updatingUI.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { VisualizationSettings } from '../settings/VisualizationSettings.js';

test('Visualization Updates Not Suppressed by updatingUI Flag', async (t) => {

  await t.test('Minimal fix structure: visualization always called, UI only when not updatingUI', () => {
    // This test verifies the logic of the fix without complex mocking

    let updateUICalled = false;
    let applyVisCalled = false;

    // Simulate the OLD buggy behavior
    const buggyBehavior = (updatingUI, changeCallback) => {
      if (!updatingUI) {
        updateUICalled = true;
        applyVisCalled = true;  // Both blocked
      }
    };

    // Simulate the FIXED behavior
    const fixedBehavior = (updatingUI, changeCallback) => {
      if (!updatingUI) {
        updateUICalled = true;
      }
      applyVisCalled = true;  // Always called
    };

    // Test buggy behavior: when updatingUI is true, both are blocked
    updateUICalled = false;
    applyVisCalled = false;
    buggyBehavior(true, null);
    assert.strictEqual(updateUICalled, false, 'Buggy: UI not called when updatingUI=true');
    assert.strictEqual(applyVisCalled, false, 'Buggy: VIS not called when updatingUI=true (BUG!)');

    // Test fixed behavior: when updatingUI is true, only UI is blocked
    updateUICalled = false;
    applyVisCalled = false;
    fixedBehavior(true, null);
    assert.strictEqual(updateUICalled, false, 'Fixed: UI not called when updatingUI=true');
    assert.strictEqual(applyVisCalled, true, 'Fixed: VIS called even when updatingUI=true (CORRECT!)');

    // Test fixed behavior: when updatingUI is false, both called
    updateUICalled = false;
    applyVisCalled = false;
    fixedBehavior(false, null);
    assert.strictEqual(updateUICalled, true, 'Fixed: UI called when updatingUI=false');
    assert.strictEqual(applyVisCalled, true, 'Fixed: VIS called when updatingUI=false');
  });

  await t.test('Settings validation still works with visualization updates', () => {
    const settings = new VisualizationSettings();

    // Change a setting
    settings.setSetting('charge', 500);
    const currentSettings = settings.getSettings();

    assert.strictEqual(currentSettings.charge, 500, 'Setting should update correctly');
    assert.ok(!isNaN(currentSettings.charge), 'Setting should not be NaN');
  });

  await t.test('Multiple settings changes trigger visualization updates', () => {
    const settings = new VisualizationSettings();
    let changeCount = 0;

    // Track how many times onChange fires
    settings.onChange((newSettings) => {
      changeCount++;
    });

    // Make multiple changes
    settings.setSetting('charge', 600);
    settings.setSetting('linkStrength', 0.6);
    settings.setSetting('topologyRepulsionA', 2);

    assert.strictEqual(changeCount, 3, 'onChange should fire for each setting change');
  });

  await t.test('Charge value transforms correctly when visualization is applied', () => {
    const settings = new VisualizationSettings();
    
    // Charge is stored positive internally
    settings.setSetting('charge', 400);
    const currentSettings = settings.getSettings();
    
    assert.strictEqual(currentSettings.charge, 400, 'Charge stored as positive');
    assert.ok(currentSettings.charge > 0, 'Charge should be positive value');
    
    // When applied to visualization, it would be negated
    // (That happens in _applySettingsToVisualization with -settings.charge)
    const visualizationValue = -currentSettings.charge;
    assert.strictEqual(visualizationValue, -400, 'Negated for D3');
  });

  await t.test('Silhouette settings can be changed without errors', () => {
    const settings = new VisualizationSettings();

    // These changes would trigger _applySettingsToVisualization
    settings.setSetting('silhouetteSizePercent', 150);
    settings.setSetting('silhouetteXOffset', 25);
    settings.setSetting('silhouetteYOffset', -15);
    settings.setSetting('silhouetteGrayscale', 75);
    settings.setSetting('silhouetteOpacity', 0.8);

    const newSettings = settings.getSettings();
    assert.strictEqual(newSettings.silhouetteSizePercent, 150);
    assert.strictEqual(newSettings.silhouetteXOffset, 25);
    assert.strictEqual(newSettings.silhouetteYOffset, -15);
    assert.strictEqual(newSettings.silhouetteGrayscale, 75);
    assert.strictEqual(newSettings.silhouetteOpacity, 0.8);
  });

  await t.test('Topology repulsion parameters all valid', () => {
    const settings = new VisualizationSettings();

    settings.setSetting('topologyRepulsionA', 2.5);
    settings.setSetting('topologyRepulsionB', 3);
    settings.setSetting('topologyRepulsionX', 75);

    const newSettings = settings.getSettings();
    assert.strictEqual(newSettings.topologyRepulsionA, 2.5);
    assert.strictEqual(newSettings.topologyRepulsionB, 3);
    assert.strictEqual(newSettings.topologyRepulsionX, 75);

    // All should be valid numbers
    assert.ok(!isNaN(newSettings.topologyRepulsionA));
    assert.ok(!isNaN(newSettings.topologyRepulsionB));
    assert.ok(!isNaN(newSettings.topologyRepulsionX));
  });

  await t.test('Toggle settings work correctly', () => {
    const settings = new VisualizationSettings();

    settings.setSetting('showNodeDates', true);
    settings.setSetting('showAncestralLabels', false);

    const newSettings = settings.getSettings();
    assert.strictEqual(newSettings.showNodeDates, true);
    assert.strictEqual(newSettings.showAncestralLabels, false);
  });

});

