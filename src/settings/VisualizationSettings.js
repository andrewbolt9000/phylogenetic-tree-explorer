/**
 * Centralized settings management for PhyloExplorer visualization.
 * 
 * This module provides:
 * - A single source of truth for all visualization parameters
 * - Validation of settings values
 * - Default settings
 * - Settings persistence (via YAML)
 * 
 * All visualization controls and updates flow through this module.
 */

class VisualizationSettings {
  constructor() {
    this.settings = this.getDefaults();
    this.listeners = [];
  }

  /**
   * Get default settings.
   * These are the built-in defaults used when the application starts.
   */
  static getDefaults() {
    return {
      version: '1.0',
      
      // Force parameters
      charge: 300,                    // Repulsion strength (0-1500)
      linkStrength: 0.5,              // Link/edge stiffness (0-1)
      topologyRepulsionX: 0,           // Topology repulsion master control (0-200)
      topologyRepulsionA: 1,           // Topology repulsion baseline/offset (0-10)
      topologyRepulsionB: 1,           // Topology repulsion force scale (0-10)
      
      // Appearance parameters
      edgeThickness: 1.5,             // Stroke width of edges (0.5-3)
      nodeCircleSize: 1.0,            // Radius multiplier for node circles (0.5-2)
      graphFontSize: 11,              // Font size for node labels (8-20px)
      sidebarFontSize: 14,            // Font size for sidebar controls (10-20px)
      
      // Silhouette parameters
      silhouetteSizePercent: 100,     // Size relative to default (30-300%)
      silhouetteXOffset: 0,           // Horizontal offset in pixels (-50 to 50)
      silhouetteYOffset: 0,           // Vertical offset in pixels (-50 to 50)
      silhouetteGrayscale: 50,        // Grayscale amount (0-100, 0=black, 100=white)
      silhouetteOpacity: 1.0,         // Opacity (0-1)
      
      // Toggle parameters
      showNodeDates: false,           // Display divergence age estimates
      showAncestralLabels: false,     // Display clade names on ancestral nodes
      
      // Root-proximity edge weighting
      rootProximityWeighting: 0,      // Edge thickness scaling near root (0-1)
      
      // Edge elasticity parameters (from previous milestone)
      edgeElasticityC: 0,             // Root elasticity adjustment (0-10)
    };
  }

  /**
   * Load default settings from the current instance.
   */
  getDefaults() {
    return VisualizationSettings.getDefaults();
  }

  /**
   * Get current settings object (read-only clone).
   */
  getSettings() {
    return JSON.parse(JSON.stringify(this.settings));
  }

  /**
   * Update a single setting value.
   * Validates the value and notifies listeners if it changed.
   */
  setSetting(key, value) {
    if (!(key in this.settings)) {
      throw new Error(`Unknown setting: ${key}`);
    }

    const validated = this.validateSetting(key, value);
    if (this.settings[key] !== validated) {
      this.settings[key] = validated;
      this.notifyListeners();
      return true; // Setting changed
    }
    return false; // Setting unchanged
  }

  /**
   * Update multiple settings at once.
   * Validates all values before updating any.
   */
  updateSettings(partialSettings) {
    // First validate all
    const validated = {};
    for (const [key, value] of Object.entries(partialSettings)) {
      if (!(key in this.settings)) {
        throw new Error(`Unknown setting: ${key}`);
      }
      validated[key] = this.validateSetting(key, value);
    }

    // Then update all
    let changed = false;
    for (const [key, value] of Object.entries(validated)) {
      if (this.settings[key] !== value) {
        this.settings[key] = value;
        changed = true;
      }
    }

    if (changed) {
      this.notifyListeners();
    }
    return changed;
  }

  /**
   * Reset all settings to defaults.
   */
  resetToDefaults() {
    this.settings = this.getDefaults();
    this.notifyListeners();
  }

  /**
   * Validate a setting value based on its key.
   * Returns the validated (and possibly bounded) value.
   */
  validateSetting(key, value) {
    const schema = this.getSchema();
    if (!(key in schema)) {
      throw new Error(`Unknown setting: ${key}`);
    }

    const spec = schema[key];
    let validated = value;

    // Coerce to correct type
    if (spec.type === 'number') {
      validated = Number(value);
      if (isNaN(validated)) {
        throw new Error(`${key} must be a number, got ${value}`);
      }
    } else if (spec.type === 'boolean') {
      validated = Boolean(value);
    } else if (spec.type === 'integer') {
      validated = Math.round(Number(value));
      if (isNaN(validated)) {
        throw new Error(`${key} must be an integer, got ${value}`);
      }
    }

    // Enforce bounds
    if (typeof spec.min !== 'undefined' && validated < spec.min) {
      validated = spec.min;
    }
    if (typeof spec.max !== 'undefined' && validated > spec.max) {
      validated = spec.max;
    }

    return validated;
  }

  /**
   * Get the schema defining all valid settings.
   * Each entry specifies type, bounds, description, and UI category.
   */
  static getSchema() {
    return {
      version: {
        type: 'string',
        description: 'Settings format version',
        category: 'metadata',
      },
      
      // Forces
      charge: {
        type: 'integer',
        min: 0,
        max: 1500,
        default: 300,
        description: 'Repulsion strength between nodes',
        category: 'forces',
      },
      linkStrength: {
        type: 'number',
        min: 0,
        max: 1,
        default: 0.5,
        description: 'Link/edge stiffness (spring strength)',
        category: 'forces',
      },
      topologyRepulsionX: {
        type: 'integer',
        min: 0,
        max: 200,
        default: 0,
        description: 'Topology repulsion master control (0 disables)',
        category: 'forces',
      },
      topologyRepulsionA: {
        type: 'number',
        min: 0,
        max: 10,
        default: 1,
        description: 'Topology repulsion baseline/offset',
        category: 'forces',
      },
      topologyRepulsionB: {
        type: 'number',
        min: 0,
        max: 10,
        default: 1,
        description: 'Topology repulsion force scale multiplier',
        category: 'forces',
      },
      
      // Appearance
      edgeThickness: {
        type: 'number',
        min: 0.5,
        max: 3,
        default: 1.5,
        description: 'Stroke width of phylogenetic edges',
        category: 'appearance',
      },
      nodeCircleSize: {
        type: 'number',
        min: 0.5,
        max: 2,
        default: 1.0,
        description: 'Radius multiplier for node background circles',
        category: 'appearance',
      },
      graphFontSize: {
        type: 'integer',
        min: 8,
        max: 20,
        default: 11,
        description: 'Font size for node labels in pixels',
        category: 'appearance',
      },
      sidebarFontSize: {
        type: 'integer',
        min: 10,
        max: 20,
        default: 14,
        description: 'Font size for sidebar controls in pixels',
        category: 'appearance',
      },
      
      // Silhouettes
      silhouetteSizePercent: {
        type: 'integer',
        min: 30,
        max: 300,
        default: 100,
        description: 'Silhouette size relative to default (%)',
        category: 'silhouettes',
      },
      silhouetteXOffset: {
        type: 'integer',
        min: -50,
        max: 50,
        default: 0,
        description: 'Horizontal offset for silhouettes (pixels)',
        category: 'silhouettes',
      },
      silhouetteYOffset: {
        type: 'integer',
        min: -50,
        max: 50,
        default: 0,
        description: 'Vertical offset for silhouettes (pixels)',
        category: 'silhouettes',
      },
      silhouetteGrayscale: {
        type: 'integer',
        min: 0,
        max: 100,
        default: 50,
        description: 'Grayscale amount (0=black, 50=gray, 100=white)',
        category: 'silhouettes',
      },
      silhouetteOpacity: {
        type: 'number',
        min: 0,
        max: 1,
        default: 1.0,
        description: 'Opacity of silhouettes',
        category: 'silhouettes',
      },
      
      // Toggles
      showNodeDates: {
        type: 'boolean',
        default: false,
        description: 'Display divergence age estimates on nodes',
        category: 'controls',
      },
      showAncestralLabels: {
        type: 'boolean',
        default: false,
        description: 'Display clade names on ancestral nodes',
        category: 'controls',
      },
      
      // Root proximity weighting
      rootProximityWeighting: {
        type: 'number',
        min: 0,
        max: 1,
        default: 0,
        description: 'Edge thickness weighting near root',
        category: 'appearance',
      },
      
      // Edge elasticity
      edgeElasticityC: {
        type: 'number',
        min: 0,
        max: 10,
        default: 0,
        description: 'Root elasticity adjustment',
        category: 'forces',
      },
    };
  }

  /**
   * Get schema for a single setting or all settings.
   */
  getSchema(key) {
    const allSchema = VisualizationSettings.getSchema();
    return key ? allSchema[key] : allSchema;
  }

  /**
   * Export settings as a YAML string.
   */
  toYAML() {
    const lines = [
      '# PhyloExplorer Visualization Settings',
      `# Version: ${this.settings.version}`,
      '# Generated at: ' + new Date().toISOString(),
      '',
      '# FORCES',
      `charge: ${this.settings.charge}  # Repulsion strength (0-1500)`,
      `linkStrength: ${this.settings.linkStrength.toFixed(2)}  # Link stiffness (0-1)`,
      `topologyRepulsionX: ${this.settings.topologyRepulsionX}  # Master control; 0 disables (0-200)`,
      `topologyRepulsionA: ${this.settings.topologyRepulsionA.toFixed(2)}  # Baseline offset (0-10)`,
      `topologyRepulsionB: ${this.settings.topologyRepulsionB.toFixed(2)}  # Force scale (0-10)`,
      `edgeElasticityC: ${this.settings.edgeElasticityC.toFixed(2)}  # Root elasticity (0-10)`,
      '',
      '# APPEARANCE',
      `edgeThickness: ${this.settings.edgeThickness.toFixed(2)}  # Stroke width (0.5-3)`,
      `nodeCircleSize: ${this.settings.nodeCircleSize.toFixed(2)}  # Node circle radius (0.5-2)`,
      `graphFontSize: ${this.settings.graphFontSize}  # Node label font (8-20px)`,
      `sidebarFontSize: ${this.settings.sidebarFontSize}  # Sidebar font (10-20px)`,
      `rootProximityWeighting: ${this.settings.rootProximityWeighting.toFixed(2)}  # Edge thickness near root (0-1)`,
      '',
      '# SILHOUETTES',
      `silhouetteSizePercent: ${this.settings.silhouetteSizePercent}  # Size relative to default (30-300%)`,
      `silhouetteXOffset: ${this.settings.silhouetteXOffset}  # Horizontal offset (px)`,
      `silhouetteYOffset: ${this.settings.silhouetteYOffset}  # Vertical offset (px)`,
      `silhouetteGrayscale: ${this.settings.silhouetteGrayscale}  # Grayscale (0-100, 0=black, 100=white)`,
      `silhouetteOpacity: ${this.settings.silhouetteOpacity.toFixed(2)}  # Opacity (0-1)`,
      '',
      '# TOGGLES',
      `showNodeDates: ${this.settings.showNodeDates}  # Show divergence estimates`,
      `showAncestralLabels: ${this.settings.showAncestralLabels}  # Show clade names`,
    ];

    return lines.join('\n');
  }

  /**
   * Parse settings from YAML string.
   * Returns an object with parsed settings, or throws on error.
   */
  static parseYAML(yamlString) {
    const settings = {};
    const lines = yamlString.split('\n');
    const schema = VisualizationSettings.getSchema();

    for (const line of lines) {
      // Skip comments and empty lines
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Parse key: value
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex === -1) {
        continue; // Skip malformed lines
      }

      const key = trimmed.substring(0, colonIndex).trim();
      const valueStr = trimmed.substring(colonIndex + 1).trim();

      // Remove inline comments
      let value = valueStr;
      const commentIndex = valueStr.indexOf('#');
      if (commentIndex !== -1) {
        value = valueStr.substring(0, commentIndex).trim();
      }

      // Skip if not a known setting
      if (!(key in schema)) {
        continue;
      }

      // Parse value based on type
      const spec = schema[key];
      try {
        if (spec.type === 'boolean') {
          settings[key] = value.toLowerCase() === 'true';
        } else if (spec.type === 'integer') {
          settings[key] = Math.round(parseFloat(value));
        } else if (spec.type === 'number') {
          settings[key] = parseFloat(value);
        } else {
          settings[key] = value;
        }
      } catch (e) {
        throw new Error(`Failed to parse ${key}: ${value}`);
      }
    }

    return settings;
  }

  /**
   * Load settings from YAML string.
   * Validates all values before updating.
   * Throws on validation error; leaves existing settings unchanged.
   */
  loadFromYAML(yamlString) {
    // Parse YAML
    const parsed = VisualizationSettings.parseYAML(yamlString);

    // Validate all parsed values
    const validated = {};
    for (const [key, value] of Object.entries(parsed)) {
      validated[key] = this.validateSetting(key, value);
    }

    // Update settings
    this.updateSettings(validated);
  }

  /**
   * Register a listener to be called when settings change.
   * Listener receives the updated settings object.
   */
  onChange(listener) {
    if (typeof listener !== 'function') {
      throw new Error('Listener must be a function');
    }
    this.listeners.push(listener);
  }

  /**
   * Unregister a listener.
   */
  offChange(listener) {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Notify all listeners of a settings change.
   * @private
   */
  notifyListeners() {
    const current = this.getSettings();
    for (const listener of this.listeners) {
      try {
        listener(current);
      } catch (e) {
        console.error('[VisualizationSettings] Error in listener:', e);
      }
    }
  }
}

export { VisualizationSettings };
