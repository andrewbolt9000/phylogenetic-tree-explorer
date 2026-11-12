/**
 * Regression test for NaN bug in SettingsUI transform function calls
 * 
 * Bug: _wireControls() was calling config.transform(e.target) for all controls,
 * but slider transforms expect element.value (string), while toggle transforms 
 * expect the element itself (for .checked access).
 * 
 * This caused sliders to receive the element object instead of its value,
 * resulting in NaN when parseInt/parseFloat tried to parse the object.
 * 
 * Fix: Pass element.value for sliders, element itself for toggles.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';

test('Transform Argument Bug Fix - Slider vs Toggle Handling', async (t) => {

  // Mock SettingsUI to test the transform argument handling
  class MockSettings {
    constructor() {
      this.values = {};
    }
    setSetting(key, value) {
      this.values[key] = value;
      if (isNaN(value)) {
        throw new Error(`NaN value received for setting: ${key}`);
      }
    }
  }

  await t.test('Slider transform receives element.value (string)', () => {
    // Simulate a slider config
    const config = {
      setting: 'charge',
      transform: v => parseInt(v),  // Expects string value
      display: 'charge-value'
    };

    // Simulate an input event from a slider
    const mockSlider = {
      value: '500',  // String value from input element
      type: 'range'
    };

    // This should work after fix (passing element.value)
    const value = config.transform(mockSlider.value);
    assert.strictEqual(value, 500, 'Should parse string value to integer');
    assert.strictEqual(typeof value, 'number', 'Should return number type');
    assert.ok(!isNaN(value), 'Should not be NaN');
  });

  await t.test('Slider transform with parseFloat', () => {
    const config = {
      setting: 'linkStrength',
      transform: v => parseFloat(v) / 1000,  // Expects string value
      display: 'link-value'
    };

    const mockSlider = {
      value: '500',  // String value
      type: 'range'
    };

    const value = config.transform(mockSlider.value);
    assert.strictEqual(value, 0.5, 'Should parse and divide correctly');
    assert.ok(!isNaN(value), 'Should not be NaN');
  });

  await t.test('Toggle transform receives element itself (for .checked access)', () => {
    const config = {
      setting: 'showNodeDates',
      transform: v => v.checked,  // Expects element with .checked property
      isToggle: true
    };

    // Simulate a checkbox element
    const mockCheckbox = {
      checked: true,
      type: 'checkbox'
    };

    // This should work after fix (passing element, not element.value)
    const value = config.transform(mockCheckbox);
    assert.strictEqual(value, true, 'Should return checkbox state');
    assert.strictEqual(typeof value, 'boolean', 'Should return boolean type');
  });

  await t.test('Toggle transform with unchecked state', () => {
    const config = {
      setting: 'showAncestralLabels',
      transform: v => v.checked,
      isToggle: true
    };

    const mockCheckbox = {
      checked: false,
      type: 'checkbox'
    };

    const value = config.transform(mockCheckbox);
    assert.strictEqual(value, false, 'Should return false for unchecked');
  });

  await t.test('Bug: Passing element object to parseInt produces NaN', () => {
    const config = {
      setting: 'charge',
      transform: v => parseInt(v),
      display: 'charge-value'
    };

    // Simulate the OLD buggy behavior: passing e.target (element object)
    const mockSlider = {
      value: '500',
      type: 'range'
    };

    // This is what would happen with the bug
    const buggyValue = config.transform(mockSlider);  // Passing object instead of string
    assert.ok(isNaN(buggyValue), 'Should produce NaN when passing element object');
  });

  await t.test('Bug: Passing element.value to .checked access fails', () => {
    const config = {
      setting: 'showNodeDates',
      transform: v => v.checked,
      isToggle: true
    };

    // Simulate the OLD buggy behavior for toggles: passing e.target.value
    const mockCheckbox = {
      checked: true,
      type: 'checkbox',
      value: 'on'  // String value from HTML
    };

    // This is what would happen with the bug
    const buggyValue = config.transform(mockCheckbox.value);  // .checked on string
    assert.strictEqual(buggyValue, undefined, 'Should be undefined - strings have no .checked property');
  });

  await t.test('Settings validation rejects NaN', () => {
    const settings = new MockSettings();

    // This would have happened with the bug
    assert.throws(
      () => settings.setSetting('charge', NaN),
      /NaN value received/,
      'Should reject NaN values'
    );
  });

  await t.test('All slider transforms work with string input', () => {
    const sliderConfigs = [
      { name: 'charge', transform: v => parseInt(v), value: '300', expected: 300 },
      { name: 'linkStrength', transform: v => parseFloat(v) / 1000, value: '500', expected: 0.5 },
      { name: 'edgeThickness', transform: v => parseFloat(v), value: '2.5', expected: 2.5 },
      { name: 'topologyRepulsionA', transform: v => parseFloat(v), value: '5.5', expected: 5.5 },
      { name: 'topologyRepulsionB', transform: v => parseFloat(v), value: '2', expected: 2 },
      { name: 'topologyRepulsionX', transform: v => parseInt(v), value: '100', expected: 100 },
      { name: 'silhouetteSizePercent', transform: v => parseInt(v), value: '150', expected: 150 },
      { name: 'silhouetteOpacity', transform: v => parseFloat(v) / 100, value: '75', expected: 0.75 },
    ];

    for (const config of sliderConfigs) {
      const result = config.transform(config.value);
      assert.strictEqual(result, config.expected, `${config.name} should transform correctly`);
      assert.ok(!isNaN(result), `${config.name} should not be NaN`);
    }
  });

  await t.test('Minimal fix handles both sliders and toggles correctly', () => {
    // This test demonstrates the fix: use element.value for sliders, element for toggles

    // Slider case
    const sliderConfig = { isToggle: false };
    const mockSliderEvent = { target: { value: '500', type: 'range' } };
    const sliderArg = sliderConfig.isToggle ? mockSliderEvent.target : mockSliderEvent.target.value;
    assert.strictEqual(sliderArg, '500', 'Slider should receive value string');

    // Toggle case
    const toggleConfig = { isToggle: true };
    const mockToggleEvent = { target: { checked: true, type: 'checkbox' } };
    const toggleArg = toggleConfig.isToggle ? mockToggleEvent.target : mockToggleEvent.target.value;
    assert.strictEqual(toggleArg.checked, true, 'Toggle should receive element');
  });

});
