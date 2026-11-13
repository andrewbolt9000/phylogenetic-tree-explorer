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
      charge: 300,                    // Repulsion strength for non-leaf nodes (0-1500)
      leafCharge: 300,                // Repulsion strength for leaf/terminal nodes (0-1500)
      linkStrength: 0.5,              // Link/edge stiffness (0-1)
      rootLinkStrength: 0, // Root-proximity link strength modifier (UI 0-2000, internal 0-20 via /100)
      ageLinkStrength: 0,             // Age-based link strength modifier (UI 0-500, per Ma)
      topologyRepulsionX: 0,           // Topology repulsion master control (UI 0-100, internal 0-10)
      topologyRepulsionA: 10,          // Topology repulsion baseline/offset (UI 0-100, internal 0-10)
      topologyRepulsionB: 10,          // Topology repulsion force scale (UI 0-100, internal 0-10)

      // Appearance parameters
      backgroundWhiteLevel: 0,        // Background color blend (0=#e8f4f8 light blue, 100=#ffffff white)
      edgeThickness: 1.5,             // Stroke width of edges (0.5-11)
      nodeCircleSize: 1.0,            // Radius multiplier for node circles (0.5-2)
      graphFontSize: 11,              // Font size for node labels (8-20px)
      sidebarFontSize: 14,            // Font size for sidebar controls (10-20px)

      // Silhouette parameters
      silhouetteSizePercent: 100,     // Size relative to default (30-300%)
      silhouetteXOffset: 0,           // Horizontal offset in pixels (-50 to 50)
      silhouetteYOffset: 0,           // Vertical offset in pixels (-50 to 50)
      silhouetteGrayscale: 50,        // Grayscale amount (0-100, 0=black, 100=white)
      silhouetteOpacity: 1.0,         // Opacity (0-1)

      // Grid parameters
      showGrid: true,                 // Whether to display the grid
      gridSpacing: 50,                // Distance between minor grid lines (10-200 pixels)
      gridMinorLineWidth: 0.5,        // Width of ordinary grid lines (0.25-5 px)
      gridMediumLineWidth: 1.0,       // Width of every-fifth-line (0.25-5 px)
      gridMajorLineWidth: 1.5,        // Width of every-tenth-line (0.25-5 px)
      gridOpacity: 0.3,               // Grid line opacity (0-1)

      // Toggle parameters
      showNodeDates: true,            // Display divergence age estimates
      nodeDateFontSize: 8,            // Independent font size for node date labels (6-16px)
      showSpeciesEstablishmentDates: false,  // Display species/taxon establishment/description dates (placeholder, data not yet available)
      showAncestralLabels: false,     // Display clade names on ancestral nodes

      // Root-proximity edge weighting
      rootProximityWeighting: 0,      // Edge thickness scaling near root (0-1)

      // Edge elasticity parameters (from previous milestone)
      edgeElasticityC: 0,             // Root elasticity adjustment (0-10)

      // Root positioning and wind
      lockRootPosition: true,
      windDirection: 0,
      windStrength: 0,

      // Hover highlight settings
      hoverHighlightSize: 15,         // Radius of hover highlight circle (0-200px)
      hoverHighlightXOffset: 0,       // Horizontal offset in pixels (-50 to 50)
      hoverHighlightYOffset: 0,       // Vertical offset in pixels (-50 to 50)
      hoverHighlightOpacity: 70,      // Opacity of hover highlight (0-100%)

      // Text background settings
      textBackgroundYOffset: 0,       // Vertical offset of text backgrounds in pixels (-50 to 50)
      textBackgroundHeight: 1.2,      // Height multiplier for text backgrounds (0.5-2.0)

      // Silhouette shadow settings
      silhouetteShadowEnabled: true,  // Whether to display shadows
      silhouetteShadowXOffset: 2,     // Horizontal offset in pixels (-20 to 20)
      silhouetteShadowYOffset: 2,     // Vertical offset in pixels (-20 to 20)
      silhouetteShadowOpacity: 0.3,   // Shadow opacity (0-1)
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
        description: 'Repulsion strength for non-leaf nodes',
        category: 'forces',
      },
      leafCharge: {
        type: 'integer',
        min: 0,
        max: 1500,
        default: 300,
        description: 'Repulsion strength for leaf/terminal nodes',
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
      rootLinkStrength: {
        type: 'integer',
        min: 0,
        max: 2000,
        default: 0,
        description: 'Root-proximity link strength modifier (UI 0-2000, internal 0-20 via /100 conversion; 0 disables)',
        category: 'forces',
      },
      ageLinkStrength: {
        type: 'number',
        min: 0,
        max: 500,
        default: 0,
        description: 'Age-based link strength modifier (UI 0-500; produces ageLinkStrength/1000 * divergenceAgeMa contribution; 0 disables)',
        category: 'forces',
      },
      topologyRepulsionX: {
        type: 'integer',
        min: 0,
        max: 100,
        default: 0,
        description: 'Topology repulsion master control (UI 0-100, internal 0-10 after /10 conversion; 0 disables)',
        category: 'forces',
      },
      topologyRepulsionA: {
        type: 'integer',
        min: 0,
        max: 100,
        default: 10,
        description: 'Topology repulsion baseline/offset (UI 0-100, internal 0-10 after /10 conversion)',
        category: 'forces',
      },
      topologyRepulsionB: {
        type: 'integer',
        min: 0,
        max: 100,
        default: 10,
        description: 'Topology repulsion force scale multiplier (UI 0-100, internal 0-10 after /10 conversion)',
        category: 'forces',
      },

      // Appearance
      backgroundWhiteLevel: {
        type: 'integer',
        min: 0,
        max: 100,
        default: 0,
        description: 'Background color blend (0=#e8f4f8 light blue, 100=#ffffff white)',
        category: 'appearance',
      },
      edgeThickness: {
        type: 'number',
        min: 0.5,
        max: 11,
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
        default: true,
        description: 'Display divergence age estimates on nodes',
        category: 'controls',
      },
      nodeDateFontSize: {
        type: 'integer',
        min: 6,
        max: 16,
        default: 8,
        description: 'Font size for node date labels in pixels',
        category: 'appearance',
      },
      showSpeciesEstablishmentDates: {
        type: 'boolean',
        default: false,
        description: 'Display species/taxon establishment/description dates (data not yet available)',
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

      // Root positioning and wind
      lockRootPosition: {
        type: 'boolean',
        default: true,
        description: 'Keep the phylogenetic root fixed in place',
        category: 'forces',
      },
      windDirection: {
        type: 'integer',
        min: 0,
        max: 360,
        default: 0,
        description: 'Wind direction in degrees; 0 is right, 90 is down',
        category: 'forces',
      },
      windStrength: {
        type: 'integer',
        min: 0,
        max: 2000,
        default: 0,
        description: 'Directional wind force (UI 0-2000, internal 0-1.0 via /2000 conversion; 0 disables wind). Wind applies constant acceleration independent of simulation cooling.',
        category: 'forces',
      },

      // Grid parameters
      showGrid: {
        type: 'boolean',
        default: true,
        description: 'Display the background grid',
        category: 'appearance',
      },
      gridSpacing: {
        type: 'integer',
        min: 10,
        max: 200,
        default: 50,
        description: 'Distance between minor grid lines in pixels',
        category: 'appearance',
      },
      gridMinorLineWidth: {
        type: 'number',
        min: 0.25,
        max: 5,
        default: 0.5,
        description: 'Stroke width of ordinary grid lines',
        category: 'appearance',
      },
      gridMediumLineWidth: {
        type: 'number',
        min: 0.25,
        max: 5,
        default: 1.0,
        description: 'Stroke width of every-fifth grid line',
        category: 'appearance',
      },
      gridMajorLineWidth: {
        type: 'number',
        min: 0.25,
        max: 5,
        default: 1.5,
        description: 'Stroke width of every-tenth grid line',
        category: 'appearance',
      },
      gridOpacity: {
        type: 'number',
        min: 0,
        max: 1,
        default: 0.3,
        description: 'Opacity of grid lines (0-1)',
        category: 'appearance',
      },

      // Hover highlight settings
      hoverHighlightSize: {
        type: 'integer',
        min: 0,
        max: 200,
        default: 15,
        description: 'Radius of the hover highlight circle in pixels',
        category: 'appearance',
      },
      hoverHighlightXOffset: {
        type: 'integer',
        min: -50,
        max: 50,
        default: 0,
        description: 'Horizontal offset of hover highlight in pixels',
        category: 'appearance',
      },
      hoverHighlightYOffset: {
        type: 'integer',
        min: -50,
        max: 50,
        default: 0,
        description: 'Vertical offset of hover highlight in pixels',
        category: 'appearance',
      },
      hoverHighlightOpacity: {
        type: 'integer',
        min: 0,
        max: 100,
        default: 70,
        description: 'Opacity of hover highlight in percentage',
        category: 'appearance',
      },

      // Text background settings
      textBackgroundYOffset: {
        type: 'integer',
        min: -50,
        max: 50,
        default: 0,
        description: 'Vertical offset of text backgrounds in pixels',
        category: 'appearance',
      },
      textBackgroundHeight: {
        type: 'number',
        min: 0.5,
        max: 2.0,
        default: 1.2,
        description: 'Height multiplier for text background rectangles',
        category: 'appearance',
      },

      // Silhouette shadow settings
      silhouetteShadowEnabled: {
        type: 'boolean',
        default: true,
        description: 'Display shadow effects beneath silhouettes',
        category: 'appearance',
      },
      silhouetteShadowXOffset: {
        type: 'integer',
        min: -20,
        max: 20,
        default: 2,
        description: 'Horizontal offset of silhouette shadow in pixels',
        category: 'appearance',
      },
      silhouetteShadowYOffset: {
        type: 'integer',
        min: -20,
        max: 20,
        default: 2,
        description: 'Vertical offset of silhouette shadow in pixels',
        category: 'appearance',
      },
      silhouetteShadowOpacity: {
        type: 'number',
        min: 0,
        max: 1,
        default: 0.3,
        description: 'Opacity of silhouette shadows (0-1)',
        category: 'appearance',
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
      `charge: ${this.settings.charge}  # Repulsion strength for non-leaf nodes (0-1500)`,
      `leafCharge: ${this.settings.leafCharge}  # Repulsion strength for leaf/terminal nodes (0-1500)`,
      `linkStrength: ${this.settings.linkStrength.toFixed(2)}  # Link stiffness (0-1)`,
      `rootLinkStrength: ${this.settings.rootLinkStrength}  # Root-proximity modifier (UI 0-2000, internal 0-20 via /100)`,
      `ageLinkStrength: ${this.settings.ageLinkStrength.toFixed(2)}  # Age-based modifier (UI 0-500, per Ma)`,
      `topologyRepulsionX: ${this.settings.topologyRepulsionX}  # Master control; 0 disables (UI 0-100, internal 0-10)`,
      `topologyRepulsionA: ${this.settings.topologyRepulsionA}  # Baseline offset (UI 0-100, internal 0-10)`,
      `topologyRepulsionB: ${this.settings.topologyRepulsionB}  # Force scale (UI 0-100, internal 0-10)`,
      `lockRootPosition: ${this.settings.lockRootPosition}  # Keep root fixed in place`,
      `windDirection: ${this.settings.windDirection}  # Wind direction (0-360°, 0=right, 90=down, 180=left, 270=up)`,
      `windStrength: ${this.settings.windStrength}  # Wind force (UI 0-2000, internal 0-1.0 via /2000; 0 disables)`,
      '',
      '# APPEARANCE',
      `backgroundWhiteLevel: ${this.settings.backgroundWhiteLevel}  # Background color blend (0=light blue #e8f4f8, 100=white #ffffff)`,
      `edgeThickness: ${this.settings.edgeThickness.toFixed(2)}  # Stroke width (0.5-11)`,
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
      '# GRID',
      `showGrid: ${this.settings.showGrid}  # Display the background grid`,
      `gridSpacing: ${this.settings.gridSpacing}  # Distance between minor lines (10-200 px)`,
      `gridMinorLineWidth: ${this.settings.gridMinorLineWidth.toFixed(2)}  # Minor line width (0.25-5 px)`,
      `gridMediumLineWidth: ${this.settings.gridMediumLineWidth.toFixed(2)}  # Medium line width (0.25-5 px)`,
      `gridMajorLineWidth: ${this.settings.gridMajorLineWidth.toFixed(2)}  # Major line width (0.25-5 px)`,
      `gridOpacity: ${this.settings.gridOpacity.toFixed(2)}  # Grid opacity (0-1)`,
      '',
      '# HOVER HIGHLIGHT',
      `hoverHighlightSize: ${this.settings.hoverHighlightSize}  # Highlight circle radius (0-200px)`,
      `hoverHighlightXOffset: ${this.settings.hoverHighlightXOffset}  # Horizontal offset (px)`,
      `hoverHighlightYOffset: ${this.settings.hoverHighlightYOffset}  # Vertical offset (px)`,
      `hoverHighlightOpacity: ${this.settings.hoverHighlightOpacity}  # Highlight opacity (0-100%)`,
      '',
      '# TEXT BACKGROUNDS',
      `textBackgroundYOffset: ${this.settings.textBackgroundYOffset}  # Vertical offset of text backgrounds (px)`,
      `textBackgroundHeight: ${this.settings.textBackgroundHeight.toFixed(1)}  # Height multiplier (0.5-2.0)`,
      '',
      '# SILHOUETTE SHADOWS',
      `silhouetteShadowEnabled: ${this.settings.silhouetteShadowEnabled}  # Display shadow effects`,
      `silhouetteShadowXOffset: ${this.settings.silhouetteShadowXOffset}  # Horizontal offset (px)`,
      `silhouetteShadowYOffset: ${this.settings.silhouetteShadowYOffset}  # Vertical offset (px)`,
      `silhouetteShadowOpacity: ${this.settings.silhouetteShadowOpacity.toFixed(2)}  # Shadow opacity (0-1)`,
      '',
      '# TOGGLES',
      `showNodeDates: ${this.settings.showNodeDates}  # Show divergence estimates`,
      `nodeDateFontSize: ${this.settings.nodeDateFontSize}  # Node date font size (6-16px)`,
      `showSpeciesEstablishmentDates: ${this.settings.showSpeciesEstablishmentDates}  # Show species establishment dates (data pending)`,
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
   * Handles backward compatibility for new settings like leafCharge.
   */
  loadFromYAML(yamlString) {
    // Parse YAML
    const parsed = VisualizationSettings.parseYAML(yamlString);

    // Backward compatibility: if leafCharge is not in YAML but charge is,
    // use charge value for leafCharge (preserves old behavior)
    if (!('leafCharge' in parsed) && 'charge' in parsed) {
      parsed.leafCharge = parsed.charge;
    }

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
