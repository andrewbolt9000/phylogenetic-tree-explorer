/**
 * SettingsUI - Bridges between VisualizationSettings and the HTML control panel
 * 
 * Responsibilities:
 * - Load and apply default settings on startup
 * - Wire UI sliders/toggles to VisualizationSettings
 * - Update UI display when settings change
 * - Handle YAML import/export
 */

class SettingsUI {
  constructor(settings, visualization) {
    this.settings = settings;  // VisualizationSettings instance
    this.viz = visualization;  // ForceDirectedVisualization instance
    
    // Track which UI elements are currently being updated to avoid feedback loops
    this.updatingUI = false;
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
        this._applySettingsToVisualization(newSettings);
      }
    });
    
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
      const defaultSettings = this.settings.parseYAML(yamlText);
      
      // Apply defaults (but don't overwrite any user-provided settings)
      Object.entries(defaultSettings).forEach(([key, value]) => {
        this.settings.setSetting(key, value);
      });
      
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
    const controlMap = {
      // Force/physics controls
      'charge-slider': { setting: 'chargeStrength', transform: v => -parseInt(v), display: 'charge-value' },
      'link-strength-slider': { setting: 'linkStrength', transform: v => parseInt(v) / 1000, display: 'link-strength-value' },
      'edge-thickness-slider': { setting: 'edgeThickness', transform: v => parseFloat(v), display: 'edge-thickness-value' },
      
      // Appearance controls
      'node-circle-scale-slider': { setting: 'nodeCircleScale', transform: v => parseFloat(v), display: 'node-circle-scale-value' },
      'graph-font-size-slider': { setting: 'fontSizeBase', transform: v => parseInt(v), display: 'graph-font-size-value' },
      
      // Silhouette controls
      'silhouette-size-slider': { setting: 'silhouetteSize', transform: v => parseInt(v), display: 'silhouette-size-value', suffix: '%' },
      'silhouette-x-offset-slider': { setting: 'silhouetteXOffset', transform: v => parseInt(v), display: 'silhouette-x-offset-value', suffix: 'px' },
      'silhouette-y-offset-slider': { setting: 'silhouetteYOffset', transform: v => parseInt(v), display: 'silhouette-y-offset-value', suffix: 'px' },
      'silhouette-grayscale-slider': { setting: 'silhouetteGrayscale', transform: v => parseInt(v), display: 'silhouette-grayscale-value', suffix: '%' },
      'silhouette-opacity-slider': { setting: 'silhouetteOpacity', transform: v => parseInt(v) / 100, display: 'silhouette-opacity-value', suffix: '%' },
      
      // Toggle controls
      'show-node-dates-toggle': { setting: 'showNodeDates', transform: v => v.checked, isToggle: true },
      'show-ancestral-labels-toggle': { setting: 'showAncestralLabels', transform: v => v.checked, isToggle: true },
    };
    
    Object.entries(controlMap).forEach(([elementId, config]) => {
      const element = document.getElementById(elementId);
      if (!element) {
        // Control doesn't exist in this version - skip it
        return;
      }
      
      // Wire control to settings
      element.addEventListener('input', (e) => {
        this.updatingUI = true;
        const value = config.transform(e.target);
        this.settings.setSetting(config.setting, value);
        this.updatingUI = false;
        
        // Update display if this control has a value display
        if (config.display) {
          const displayElement = document.getElementById(config.display);
          if (displayElement) {
            const displayValue = config.suffix ? value + config.suffix : value;
            displayElement.textContent = displayValue;
          }
        }
      });
    });
  }

  /**
   * Update UI controls from settings
   * @private
   */
  _updateUIFromSettings(settings) {
    const sliderMap = {
      chargeStrength: 'charge-slider',
      linkStrength: 'link-strength-slider',
      edgeThickness: 'edge-thickness-slider',
      nodeCircleScale: 'node-circle-scale-slider',
      fontSizeBase: 'graph-font-size-slider',
      silhouetteSize: 'silhouette-size-slider',
      silhouetteXOffset: 'silhouette-x-offset-slider',
      silhouetteYOffset: 'silhouette-y-offset-slider',
      silhouetteGrayscale: 'silhouette-grayscale-slider',
      silhouetteOpacity: 'silhouette-opacity-slider',
    };
    
    const toggleMap = {
      showNodeDates: 'show-node-dates-toggle',
      showAncestralLabels: 'show-ancestral-labels-toggle',
    };
    
    // Update sliders
    Object.entries(sliderMap).forEach(([settingKey, elementId]) => {
      const element = document.getElementById(elementId);
      if (element && settings[settingKey] !== undefined) {
        // Handle charge specially (it's stored negative, displayed positive)
        const displayValue = settingKey === 'chargeStrength' ? -settings[settingKey] : settings[settingKey];
        element.value = displayValue;
      }
    });
    
    // Update toggles
    Object.entries(toggleMap).forEach(([settingKey, elementId]) => {
      const element = document.getElementById(elementId);
      if (element && settings[settingKey] !== undefined) {
        element.checked = settings[settingKey];
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
    if (settings.chargeStrength !== undefined) {
      this.viz.setChargeStrength(settings.chargeStrength);
    }
    if (settings.linkStrength !== undefined) {
      this.viz.setLinkStrength(settings.linkStrength);
    }
    
    // Apply appearance parameters
    if (settings.edgeThickness !== undefined) {
      this.viz.setEdgeThickness(settings.edgeThickness);
    }
    if (settings.nodeCircleScale !== undefined) {
      this.viz.setNodeCircleScale(settings.nodeCircleScale);
    }
    if (settings.fontSizeBase !== undefined) {
      this.viz.setFontSize(settings.fontSizeBase);
    }
    
    // Apply silhouette parameters
    if (settings.silhouetteSize !== undefined) {
      this.viz.setSilhouetteSize(settings.silhouetteSize);
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
    
    // Apply toggle parameters
    if (settings.showNodeDates !== undefined) {
      // Note: these require additional data, handled separately
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
          
          // Validate by attempting to apply settings
          const errors = [];
          Object.entries(importedSettings).forEach(([key, value]) => {
            try {
              this.settings.setSetting(key, value);
            } catch (error) {
              errors.push(`${key}: ${error.message}`);
            }
          });
          
          if (errors.length > 0) {
            alert('Some settings could not be imported:\n' + errors.join('\n'));
          } else {
            alert('Settings imported successfully!');
            console.log('[SettingsUI] Settings imported from file');
          }
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
