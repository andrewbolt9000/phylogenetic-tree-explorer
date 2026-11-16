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


test('VisualizationSettings: velocity and alpha decay default to current D3 values and round-trip', async () => {
  const { default: SettingsUI } = await import('../ui/SettingsUI.js');
  const settings = new VisualizationSettings();
  assert.equal(settings.getSettings().velocityDecay, 0.4);
  assert.equal(settings.getSettings().alphaDecay, 0.02);

  settings.setSetting('velocityDecay', 2);
  settings.setSetting('alphaDecay', 0);
  assert.equal(settings.getSettings().velocityDecay, 0.9, 'clamped to schema max');
  assert.equal(settings.getSettings().alphaDecay, 0.001, 'clamped to schema min');

  settings.updateSettings({ velocityDecay: 0.65, alphaDecay: 0.035 });
  const parsed = VisualizationSettings.parseYAML(settings.toYAML());
  assert.equal(parsed.velocityDecay, 0.65);
  assert.equal(parsed.alphaDecay, 0.035);

  // Sliders map to the settings, and settings are applied to the visualization setters.
  const controls = SettingsUI.getControlMap();
  assert.equal(controls['velocity-decay-slider'].setting, 'velocityDecay');
  assert.equal(controls['alpha-decay-slider'].setting, 'alphaDecay');
  const calls = {};
  const viz = new Proxy({}, { get: (_, name) => (value) => { calls[name] = value; } });
  globalThis.document = { documentElement: { style: { setProperty() {} } } };
  try {
    new SettingsUI(settings, viz)._applySettingsToVisualization(settings.getSettings());
  } finally {
    delete globalThis.document;
  }
  assert.equal(calls.setVelocityDecay, 0.65);
  assert.equal(calls.setAlphaDecay, 0.035);
});

// ---------------------------------------------------------------------------
// YAML export/import must cover every sidebar setting, including the dataset.
// ---------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

const INDEX_HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const DEFAULT_CONFIG_YAML = readFileSync(new URL('../../config/default-settings.yaml', import.meta.url), 'utf8');

function attr(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return match ? match[1] : undefined;
}

/** Fake sidebar built from the real <input>/<select> elements in index.html. */
function createFakeSidebar() {
  const elements = new Map();
  for (const [tag] of INDEX_HTML.matchAll(/<input\b[^>]*>/g)) {
    const id = attr(tag, 'id');
    if (!id) continue;
    elements.set(id, {
      id, tagName: 'INPUT', type: attr(tag, 'type'),
      min: attr(tag, 'min'), max: attr(tag, 'max'), step: attr(tag, 'step'),
      value: attr(tag, 'value') ?? '', checked: /\schecked[\s>]/.test(tag), listeners: {},
    });
  }
  for (const [, id, body] of INDEX_HTML.matchAll(/<select[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
    const options = [...body.matchAll(/<option value="([^"]+)"/g)].map(m => m[1]);
    elements.set(id, { id, tagName: 'SELECT', options, value: options[0], listeners: {} });
  }
  for (const element of elements.values()) {
    element.addEventListener = (name, handler) => { element.listeners[name] = handler; };
  }

  const displays = new Map();
  const document = {
    documentElement: { style: { setProperty() {} } },
    querySelector: () => null,
    getElementById(id) {
      if (elements.has(id)) return elements.get(id);
      if (!displays.has(id)) displays.set(id, { id, textContent: '' });
      return displays.get(id);
    },
  };
  const userInput = (element) => {
    element.listeners.input({ target: element });
  };
  return { elements, document, userInput };
}

/** A value on the slider's step grid that differs from the given slider value. */
function nonDefaultSliderValue(element, defaultSliderValue) {
  const min = Number(element.min);
  const max = Number(element.max);
  const step = Number(element.step ?? 1);
  const steps = Math.floor((max - min) / step);
  let k = Math.max(1, Math.round(steps * 0.37));
  let value = Number((min + k * step).toFixed(6));
  if (value === Number(defaultSliderValue)) value = Number((min + (k + 1) * step).toFixed(6));
  return String(value);
}

async function createInitializedSettingsUI() {
  const { default: SettingsUI } = await import('../ui/SettingsUI.js');
  const sidebar = createFakeSidebar();
  const settings = new VisualizationSettings();
  const viz = new Proxy({}, { get: () => () => {} });
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  const originalLog = console.log;
  globalThis.document = sidebar.document;
  globalThis.fetch = async () => ({ ok: true, text: async () => DEFAULT_CONFIG_YAML });
  console.warn = () => {};
  console.log = () => {};
  try {
    const ui = new SettingsUI(settings, viz);
    await ui.initialize();
    return { ui, settings, sidebar, SettingsUI };
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
    console.log = originalLog;
  }
}

test('YAML policy: every sidebar control is a setting and every setting is exported', async () => {
  const { default: SettingsUI } = await import('../ui/SettingsUI.js');
  const controlMap = SettingsUI.getControlMap();
  const { elements } = createFakeSidebar();

  for (const id of elements.keys()) {
    assert.ok(controlMap[id], `sidebar control #${id} must be mapped to a setting`);
  }

  const exported = VisualizationSettings.parseYAML(new VisualizationSettings().toYAML());
  for (const key of Object.keys(VisualizationSettings.getSchema())) {
    if (key === 'version') continue;  // exported in the header comment
    assert.ok(key in exported, `${key} must be exported to YAML`);
  }

  assert.deepEqual(
    elements.get('dataset-selector').options,
    VisualizationSettings.getSchema().dataset.enum,
    'dataset setting must accept exactly the datasets offered by the selector'
  );
});

test('YAML round-trip restores every sidebar setting and the selected dataset', async () => {
  const { ui, settings, sidebar, SettingsUI } = await createInitializedSettingsUI();
  try {
    const controlMap = SettingsUI.getControlMap();
    const applicationDefaults = settings.getSettings();

    // 1-2. Set every sidebar control (including the dataset) through its real wiring.
    const sliderValues = {};
    for (const [id, config] of Object.entries(controlMap)) {
      const element = sidebar.elements.get(id);
      if (element.tagName === 'SELECT') {
        element.value = element.options.find(o => o !== applicationDefaults.dataset);
      } else if (config.isToggle) {
        element.checked = !element.checked;
      } else {
        element.value = nonDefaultSliderValue(element, element.value);
      }
      sliderValues[id] = config.isToggle ? element.checked : element.value;
      sidebar.userInput(element);
    }

    const customized = settings.getSettings();
    for (const config of Object.values(controlMap)) {
      assert.notDeepEqual(customized[config.setting], applicationDefaults[config.setting],
        `${config.setting} should have been changed from its default`);
    }
    assert.notEqual(customized.dataset, applicationDefaults.dataset);

    // 3. Export.
    const yaml = settings.toYAML();

    // 4. Change everything back to the application defaults.
    settings.updateSettings(applicationDefaults);
    assert.equal(settings.getSettings().dataset, applicationDefaults.dataset);

    // 5. Import.
    const result = ui.importYAML(yaml);
    assert.deepEqual(result, { success: true, errors: [] });

    // 6. Every setting and every sidebar control is restored.
    assert.deepEqual(settings.getSettings(), customized);
    for (const [id, config] of Object.entries(controlMap)) {
      const element = sidebar.elements.get(id);
      const shown = config.isToggle ? element.checked : String(element.value);
      const expected = config.isToggle ? sliderValues[id] : String(sliderValues[id]);
      assert.equal(shown, expected, `#${id} should show the imported value`);
    }
  } finally {
    delete globalThis.document;
  }
});

test('YAML: maxSampledSpecies and dataset export and import', async () => {
  const { ui, settings, sidebar } = await createInitializedSettingsUI();
  try {
    settings.updateSettings({ maxSampledSpecies: 37, dataset: 'mammals-600' });
    const yaml = settings.toYAML();
    assert.match(yaml, /^maxSampledSpecies: 37\b/m);
    assert.match(yaml, /^dataset: mammals-600\b/m);

    settings.updateSettings({ maxSampledSpecies: 3, dataset: 'animals' });
    assert.equal(ui.importYAML(yaml).success, true);
    assert.equal(settings.getSettings().maxSampledSpecies, 37);
    assert.equal(settings.getSettings().dataset, 'mammals-600');
    assert.equal(sidebar.elements.get('max-sampled-species').value, 37);
    assert.equal(sidebar.elements.get('dataset-selector').value, 'mammals-600');

    assert.equal(ui.importYAML('dataset: "tetrapods"\n').success, true, 'quoted strings are accepted');
    assert.equal(settings.getSettings().dataset, 'tetrapods');
  } finally {
    delete globalThis.document;
  }
});

test('YAML import: older files without newer fields use application defaults', async () => {
  const { ui, settings } = await createInitializedSettingsUI();
  try {
    const applicationDefaults = settings.getSettings();
    settings.updateSettings({ maxSampledSpecies: 42, dataset: 'animals', velocityDecay: 0.8, showGrid: false });

    const oldYaml = '# PhyloExplorer Visualization Settings\n# Version: 1.0\ncharge: 500  # old file\nedgeThickness: 3.00\n';
    assert.equal(ui.importYAML(oldYaml).success, true);

    const imported = settings.getSettings();
    assert.equal(imported.charge, 500);
    assert.equal(imported.edgeThickness, 3);
    assert.equal(imported.leafCharge, 500, 'legacy leafCharge falls back to charge');
    for (const key of ['maxSampledSpecies', 'dataset', 'velocityDecay', 'alphaDecay', 'showGrid', 'gridSpacing']) {
      assert.equal(imported[key], applicationDefaults[key], `${key} missing from file uses the default`);
    }
  } finally {
    delete globalThis.document;
  }
});

test('YAML import: invalid values are rejected without changing settings; values are exported losslessly', async () => {
  const { ui, settings } = await createInitializedSettingsUI();
  try {
    const before = settings.getSettings();
    const result = ui.importYAML([
      'charge: 400',
      'dataset: dinosaurs',
      'maxSampledSpecies: lots',
      'showGrid: maybe',
      'linkStrength: abc',
    ].join('\n'));

    assert.equal(result.success, false);
    assert.deepEqual(result.errors.map(e => e.split(':')[0]).sort(),
      ['dataset', 'linkStrength', 'maxSampledSpecies', 'showGrid']);
    assert.deepEqual(settings.getSettings(), before, 'nothing changes when any value is invalid');

    // Out-of-range numbers are clamped to the schema bounds, as for sidebar input.
    assert.equal(ui.importYAML('maxSampledSpecies: 500\ncharge: -20\n').success, true);
    assert.equal(settings.getSettings().maxSampledSpecies, 50);
    assert.equal(settings.getSettings().charge, 0);

    // Values finer than the conventional display precision are not truncated.
    settings.updateSettings({ linkStrength: 0.123, alphaDecay: 0.0125, textBackgroundHeight: 1.25 });
    const reparsed = VisualizationSettings.parseYAML(settings.toYAML());
    assert.equal(reparsed.linkStrength, 0.123);
    assert.equal(reparsed.alphaDecay, 0.0125);
    assert.equal(reparsed.textBackgroundHeight, 1.25);
  } finally {
    delete globalThis.document;
  }
});
