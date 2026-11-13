/**
 * SettingsUI - Bridges between VisualizationSettings and the HTML control panel
 *
 * Responsibilities:
 * - Load and apply default settings on startup
 * - Wire UI sliders/toggles to VisualizationSettings
 * - Update UI display when settings change
 * - Handle YAML import/export
 */

import { VisualizationSettings } from '../settings/VisualizationSettings.js';

class SettingsUI {
  constructor(settings, visualization) {
    this.settings = settings;  // VisualizationSettings instance
    this.viz = visualization;  // ForceDirectedVisualization instance

    // Track which UI elements are currently being updated to avoid feedback loops
    this.updatingUI = false;
  }

  /**
   * Control mappings defining how HTML elements connect to settings.
   * Each entry specifies: element ID → { setting name, transform, display element ID, suffix }
   * This is the source of truth for control wiring and display updates.
   * @static
   */
  static getControlMap() {
    return {
      // Force/physics controls
      'charge-slider': { setting: 'charge', transform: v => parseInt(v), display: 'charge-value' },
      'leafCharge-slider': { setting: 'leafCharge', transform: v => parseInt(v), display: 'leafCharge-value' },
      'link-slider': { setting: 'linkStrength', transform: v => parseFloat(v), display: 'link-value' },
      'root-link-strength-slider': { setting: 'rootLinkStrength', transform: v => parseInt(v), display: 'root-link-strength-value' },
      'age-link-strength-slider': { setting: 'ageLinkStrength', transform: v => parseFloat(v), display: 'age-link-strength-value', suffix: '' },
      'edge-thickness-slider': { setting: 'edgeThickness', transform: v => parseFloat(v), display: 'edge-thickness-value' },

      // Topology repulsion equation: F = B * (A + X) / D
      'topology-repulsion-a-slider': { setting: 'topologyRepulsionA', transform: v => parseFloat(v), display: 'topology-repulsion-a-value' },
      'topology-repulsion-b-slider': { setting: 'topologyRepulsionB', transform: v => parseFloat(v), display: 'topology-repulsion-b-value' },
      'topology-repulsion-x-slider': { setting: 'topologyRepulsionX', transform: v => parseInt(v), display: 'topology-repulsion-x-value' },

      // Root positioning and wind controls
      'lock-root-position-toggle': { setting: 'lockRootPosition', transform: v => v.checked, isToggle: true },
      'wind-direction-slider': { setting: 'windDirection', transform: v => parseInt(v), display: 'wind-direction-value', suffix: '°' },
      'wind-strength-slider': { setting: 'windStrength', transform: v => parseInt(v), display: 'wind-strength-value' },

      // Appearance controls
      'background-white-level-slider': { setting: 'backgroundWhiteLevel', transform: v => parseInt(v), display: 'background-white-level-value', suffix: '%' },
      'node-circle-slider': { setting: 'nodeCircleSize', transform: v => parseFloat(v), display: 'node-circle-value' },
      'font-size-slider': { setting: 'graphFontSize', transform: v => parseInt(v), display: 'font-size-value' },
      'sidebar-font-size-slider': { setting: 'sidebarFontSize', transform: v => parseInt(v), display: 'sidebar-font-size-value' },

      // Silhouette controls
      'silhouette-size-slider': { setting: 'silhouetteSizePercent', transform: v => parseInt(v), display: 'silhouette-size-value', suffix: '%' },
      'silhouette-x-offset-slider': { setting: 'silhouetteXOffset', transform: v => parseInt(v), display: 'silhouette-x-offset-value', suffix: 'px' },
      'silhouette-y-offset-slider': { setting: 'silhouetteYOffset', transform: v => parseInt(v), display: 'silhouette-y-offset-value', suffix: 'px' },
      'silhouette-grayscale-slider': { setting: 'silhouetteGrayscale', transform: v => parseInt(v), display: 'silhouette-grayscale-value', suffix: '%' },
      'silhouette-opacity-slider': { setting: 'silhouetteOpacity', transform: v => parseFloat(v) / 100, display: 'silhouette-opacity-value', suffix: '%' },

      // Hover highlight controls
      'hover-highlight-size-slider': { setting: 'hoverHighlightSize', transform: v => parseInt(v), display: 'hover-highlight-size-value', suffix: 'px' },
      'hover-highlight-x-offset-slider': { setting: 'hoverHighlightXOffset', transform: v => parseInt(v), display: 'hover-highlight-x-offset-value', suffix: 'px' },
      'hover-highlight-y-offset-slider': { setting: 'hoverHighlightYOffset', transform: v => parseInt(v), display: 'hover-highlight-y-offset-value', suffix: 'px' },

      // Silhouette shadow controls
      'silhouette-shadow-enabled-toggle': { setting: 'silhouetteShadowEnabled', transform: v => v.checked, isToggle: true },
      'silhouette-shadow-x-offset-slider': { setting: 'silhouetteShadowXOffset', transform: v => parseInt(v), display: 'silhouette-shadow-x-offset-value', suffix: 'px' },
      'silhouette-shadow-y-offset-slider': { setting: 'silhouetteShadowYOffset', transform: v => parseInt(v), display: 'silhouette-shadow-y-offset-value', suffix: 'px' },
      'silhouette-shadow-opacity-slider': { setting: 'silhouetteShadowOpacity', transform: v => parseFloat(v) / 100, display: 'silhouette-shadow-opacity-value', suffix: '%' },

      // Grid controls
      'show-grid-toggle': { setting: 'showGrid', transform: v => v.checked, isToggle: true },
      'grid-spacing-slider': { setting: 'gridSpacing', transform: v => parseInt(v), display: 'grid-spacing-value' },
      'grid-minor-width-slider': { setting: 'gridMinorLineWidth', transform: v => parseFloat(v), display: 'grid-minor-width-value' },
      'grid-medium-width-slider': { setting: 'gridMediumLineWidth', transform: v => parseFloat(v), display: 'grid-medium-width-value' },
      'grid-major-width-slider': { setting: 'gridMajorLineWidth', transform: v => parseFloat(v), display: 'grid-major-width-value' },
      'grid-opacity-slider': { setting: 'gridOpacity', transform: v => parseFloat(v), display: 'grid-opacity-value' },

      // Toggle controls
      'show-node-dates-toggle': { setting: 'showNodeDates', transform: v => v.checked, isToggle: true },
      'node-date-font-size-slider': { setting: 'nodeDateFontSize', transform: v => parseInt(v), display: 'node-date-font-size-display', suffix: 'px' },
      'show-species-establishment-dates-toggle': { setting: 'showSpeciesEstablishmentDates', transform: v => v.checked, isToggle: true },
      'show-ancestral-labels-toggle': { setting: 'showAncestralLabels', transform: v => v.checked, isToggle: true },
    };
  }

  /**
   * Initialize UI by loading defaults and wiring controls
   */
  async initialize() {
    // Load default settings from repository config
    await this._loadDefaultSettings();

    // Wire all existing controls to the settings system
    this._wireControls();

    // Listen for settings changes and update UI
    this.settings.onChange((newSettings) => {
      if (!this.updatingUI) {
        this._updateUIFromSettings(newSettings);
      }

      this._applySettingsToVisualization(newSettings);
    });

    // Apply initial settings explicitly
    // Settings loaded before listener registration may not have been applied
    const current = this.settings.getSettings();
    this._updateUIFromSettings(current);
    this._applySettingsToVisualization(current);

    // Add import/export buttons
    this._addImportExportButtons();
  }

  /**
   * Load default settings from config/default-settings.yaml
   * @private
   */
  async _loadDefaultSettings() {
    try {
      const response = await fetch('./config/default-settings.yaml');
      if (!response.ok) {
        console.warn('Could not load default settings: HTTP', response.status);
        // Use in-code defaults
        return;
      }

      const yamlText = await response.text();
      const defaultSettings = VisualizationSettings.parseYAML(yamlText);

      // Apply all defaults atomically in a single update
      this.settings.updateSettings(defaultSettings);

      console.log('[Settings] Loaded defaults from config/default-settings.yaml');
    } catch (error) {
      console.error('[Settings] Error loading defaults:', error);
    }
  }

  /**
   * Wire HTML controls to settings
   * This connects existing sliders and toggles to the VisualizationSettings system
   * @private
   */
  _wireControls() {
    const controlMap = SettingsUI.getControlMap();

    let wiredCount = 0;
    let skippedCount = 0;

    Object.entries(controlMap).forEach(([elementId, config]) => {
      const element = document.getElementById(elementId);
      if (!element) {
        // Control doesn't exist in this version - skip it
        skippedCount++;
        return;
      }

      wiredCount++;

      // Wire control to settings
      element.addEventListener('input', (e) => {
        try {
          this.updatingUI = true;
          const value = config.transform(
            config.isToggle ? e.target : e.target.value
          );
          this.settings.setSetting(config.setting, value);
          this.updatingUI = false;

          // Update display if this control has a value display
          if (config.display) {
            const displayElement = document.getElementById(config.display);
            if (displayElement) {
              // For display, use the raw slider value (not the transformed value)
              // This ensures users see "300" not "-300" for charge
              let displayValue = e.target.value;
              if (config.suffix) {
                displayValue = displayValue + config.suffix;
              }
              displayElement.textContent = displayValue;
            }
          }
        } catch (error) {
          console.error(`[SettingsUI] Error handling control '${elementId}':`, error);
          this.updatingUI = false;
        }
      });
    });

    console.log(`[SettingsUI] Wired ${wiredCount} controls, skipped ${skippedCount} missing controls`);
  }

  /**
   * Update UI controls from settings
   * Synchronizes slider values and display labels with current settings.
   * @private
   */
  _updateUIFromSettings(settings) {
    const controlMap = SettingsUI.getControlMap();

    // Update all controls based on controlMap
    Object.entries(controlMap).forEach(([elementId, config]) => {
      const element = document.getElementById(elementId);
      if (!element) return;

      const settingValue = settings[config.setting];
      if (settingValue === undefined) return;

      if (config.isToggle) {
        // Toggle control
        element.checked = settingValue;
      } else {
        // Slider control: update value and display label
        let sliderValue = settingValue;

        // For silhouetteOpacity, convert from 0-1 to 0-100 for slider display
        if (config.setting === 'silhouetteOpacity') {
          sliderValue = Math.round(settingValue * 100);
        }

        element.value = sliderValue;

        // Update display label if this control has one
        if (config.display) {
          const displayElement = document.getElementById(config.display);
          if (displayElement) {
            let displayValue = element.value;  // Use slider value, not transformed value
            if (config.suffix) {
              displayValue = displayValue + config.suffix;
            }
            displayElement.textContent = displayValue;
          }
        }
      }
    });
  }

  /**
   * Apply settings to visualization
   * @private
   */
  _applySettingsToVisualization(settings) {
    if (!this.viz) return;

    // Apply force parameters
    if (settings.charge !== undefined) {
      this.viz.setChargeStrength(-settings.charge);  // Negate for repulsion
    }
    if (settings.leafCharge !== undefined) {
      this.viz.setLeafChargeStrength(-settings.leafCharge);  // Negate for repulsion
    }
    if (settings.linkStrength !== undefined) {
      this.viz.setLinkStrength(settings.linkStrength);
    }
    if (settings.rootLinkStrength !== undefined) {
      this.viz.setRootLinkStrength(settings.rootLinkStrength);
    }
    if (settings.ageLinkStrength !== undefined) {
      this.viz.setAgeLinkStrength(settings.ageLinkStrength);
    }
    if (settings.lockRootPosition !== undefined) {
      this.viz.setRootLocked(settings.lockRootPosition);
    }
    if (settings.windDirection !== undefined) {
      this.viz.setWindDirection(settings.windDirection);
    }
    if (settings.windStrength !== undefined) {
      this.viz.setWindStrength(settings.windStrength);
    }

    // Apply topology repulsion parameters (A, B, X)
    if (settings.topologyRepulsionA !== undefined) {
      this.viz.setTopologyRepulsionA(settings.topologyRepulsionA);
    }
    if (settings.topologyRepulsionB !== undefined) {
      this.viz.setTopologyRepulsionB(settings.topologyRepulsionB);
    }
    if (settings.topologyRepulsionX !== undefined) {
      this.viz.setTopologyRepulsionX(settings.topologyRepulsionX);
    }

    // Apply appearance parameters
    if (settings.backgroundWhiteLevel !== undefined) {
      this.viz.setBackgroundWhiteLevel(settings.backgroundWhiteLevel);
    }
    if (settings.edgeThickness !== undefined) {
      this.viz.setEdgeThickness(settings.edgeThickness);
    }
    if (settings.nodeCircleSize !== undefined) {
      this.viz.setNodeCircleSize(settings.nodeCircleSize);
    }
    if (settings.graphFontSize !== undefined) {
      this.viz.setGraphFontSize(settings.graphFontSize);
    }

    // Apply silhouette parameters
    if (settings.silhouetteSizePercent !== undefined) {
      this.viz.setSilhouetteSize(settings.silhouetteSizePercent);
    }
    if (settings.silhouetteXOffset !== undefined) {
      this.viz.setSilhouetteXOffset(settings.silhouetteXOffset);
    }
    if (settings.silhouetteYOffset !== undefined) {
      this.viz.setSilhouetteYOffset(settings.silhouetteYOffset);
    }
    if (settings.silhouetteOpacity !== undefined) {
      this.viz.setSilhouetteOpacity(settings.silhouetteOpacity);
    }
    if (settings.silhouetteGrayscale !== undefined) {
      this.viz.setSilhouetteGrayscale(settings.silhouetteGrayscale);
    }

    // Apply CSS-based parameters
    if (settings.sidebarFontSize !== undefined) {
      document.documentElement.style.setProperty('--sidebar-font-size', settings.sidebarFontSize + 'px');
    }

    // Apply toggle parameters
    if (settings.showNodeDates !== undefined) {
      // Note: these require additional data, handled separately
    }
    if (settings.nodeDateFontSize !== undefined) {
      this.viz.setNodeDateFontSize(settings.nodeDateFontSize);
    }
    if (settings.showSpeciesEstablishmentDates !== undefined) {
      // Placeholder: data sources not yet available
    }

    // Apply grid parameters
    if (settings.showGrid !== undefined) {
      this.viz.setShowGrid(settings.showGrid);
    }
    if (settings.gridSpacing !== undefined) {
      this.viz.setGridSpacing(settings.gridSpacing);
    }
    if (settings.gridMinorLineWidth !== undefined) {
      this.viz.setGridMinorLineWidth(settings.gridMinorLineWidth);
    }
    if (settings.gridMediumLineWidth !== undefined) {
      this.viz.setGridMediumLineWidth(settings.gridMediumLineWidth);
    }
    if (settings.gridMajorLineWidth !== undefined) {
      this.viz.setGridMajorLineWidth(settings.gridMajorLineWidth);
    }
    if (settings.gridOpacity !== undefined) {
      this.viz.setGridOpacity(settings.gridOpacity);
    }
    
    // Apply hover highlight parameters
    if (settings.hoverHighlightSize !== undefined) {
      this.viz.setHoverHighlightSize(settings.hoverHighlightSize);
    }
    if (settings.hoverHighlightXOffset !== undefined) {
      this.viz.setHoverHighlightXOffset(settings.hoverHighlightXOffset);
    }
    if (settings.hoverHighlightYOffset !== undefined) {
      this.viz.setHoverHighlightYOffset(settings.hoverHighlightYOffset);
    }

    // Apply silhouette shadow parameters
    if (settings.silhouetteShadowEnabled !== undefined) {
      this.viz.setSilhouetteShadowEnabled(settings.silhouetteShadowEnabled);
    }
    if (settings.silhouetteShadowXOffset !== undefined) {
      this.viz.setSilhouetteShadowXOffset(settings.silhouetteShadowXOffset);
    }
    if (settings.silhouetteShadowYOffset !== undefined) {
      this.viz.setSilhouetteShadowYOffset(settings.silhouetteShadowYOffset);
    }
    if (settings.silhouetteShadowOpacity !== undefined) {
      this.viz.setSilhouetteShadowOpacity(settings.silhouetteShadowOpacity);
    }

    if (settings.showAncestralLabels !== undefined) {
      // Note: these require additional data, handled separately
    }
  }

  /**
   * Add YAML import/export buttons to the UI
   * @private
   */
  _addImportExportButtons() {
    // Find the settings panel (look for a good place to put these buttons)
    const panel = document.querySelector('.settings-panel') ||
      document.querySelector('.sidebar') ||
      document.querySelector('aside') ||
      document.querySelector('#sidebar');
    if (!panel) {
      console.warn('[SettingsUI] Could not find panel for import/export buttons');
      return;
    }

    // Create a settings management section
    const section = document.createElement('div');
    section.className = 'settings-management';
    section.innerHTML = `
      <h3>Settings Management</h3>
      <button id="export-settings-btn" class="settings-btn">Export Settings as YAML</button>
      <button id="import-settings-btn" class="settings-btn">Import Settings from YAML</button>
      <p class="info-text" style="font-size: 0.9em;">
        Export current settings to a YAML file for backup or sharing.
        Import a previously exported file to restore settings.
      </p>
    `;

    panel.appendChild(section);

    // Wire export button
    document.getElementById('export-settings-btn').addEventListener('click', () => {
      this._exportSettings();
    });

    // Wire import button
    document.getElementById('import-settings-btn').addEventListener('click', () => {
      this._showImportDialog();
    });
  }

  /**
   * Export current settings to a YAML file
   * @private
   */
  _exportSettings() {
    const yamlContent = this.settings.toYAML();

    // Create a blob and download
    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `phyloexplorer-settings-${new Date().toISOString().split('T')[0]}.yaml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('[SettingsUI] Settings exported');
  }

  /**
   * Show file import dialog and import settings
   * @private
   */
  _showImportDialog() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yaml,.yml';

    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const yamlContent = event.target.result;
          const importedSettings = this.settings.parseYAML(yamlContent);

          // Validate all settings before applying any
          const errors = [];
          for (const [key, value] of Object.entries(importedSettings)) {
            try {
              this.settings.validateSetting(key, value);
            } catch (error) {
              errors.push(`${key}: ${error.message}`);
            }
          }

          if (errors.length > 0) {
            alert('Settings import cancelled due to validation errors:\n' + errors.join('\n'));
            console.log('[SettingsUI] Import validation failed; no settings changed');
            return;
          }

          // All settings validated; apply atomically
          this.settings.updateSettings(importedSettings);
          alert('Settings imported successfully!');
          console.log('[SettingsUI] Settings imported from file');
        } catch (error) {
          alert('Error parsing YAML file: ' + error.message);
          console.error('[SettingsUI] Import error:', error);
        }
      };

      reader.readAsText(file);
    });

    document.body.appendChild(input);
    input.click();
    document.body.removeChild(input);
  }
}

// Export for use in index.html and other modules
export default SettingsUI;

if (typeof window !== 'undefined') {
  window.SettingsUI = SettingsUI;
}
