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
      'charge-slider': { setting: 'charge', transform: v => parseInt(v), display: 'charge-value' },
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
      'node-circle-slider': { setting: 'nodeCircleSize', transform: v => parseFloat(v), display: 'node-circle-value' },
      'font-size-slider': { setting: 'graphFontSize', transform: v => parseInt(v), display: 'font-size-value' },
      'sidebar-font-size-slider': { setting: 'sidebarFontSize', transform: v => parseInt(v), display: 'sidebar-font-size-value' },
      
      // Silhouette controls
      'silhouette-size-slider': { setting: 'silhouetteSizePercent', transform: v => parseInt(v), display: 'silhouette-size-value', suffix: '%' },
      'silhouette-x-offset-slider': { setting: 'silhouetteXOffset', transform: v => parseInt(v), display: 'silhouette-x-offset-value', suffix: 'px' },
      'silhouette-y-offset-slider': { setting: 'silhouetteYOffset', transform: v => parseInt(v), display: 'silhouette-y-offset-value', suffix: 'px' },
      'silhouette-grayscale-slider': { setting: 'silhouetteGrayscale', transform: v => parseInt(v), display: 'silhouette-grayscale-value', suffix: '%' },
      'silhouette-opacity-slider': { setting: 'silhouetteOpacity', transform: v => parseFloat(v) / 100, display: 'silhouette-opacity-value', suffix: '%' },
      
      // Toggle controls
      'show-node-dates-toggle': { setting: 'showNodeDates', transform: v => v.checked, isToggle: true },
      'show-ancestral-labels-toggle': { setting: 'showAncestralLabels', transform: v => v.checked, isToggle: true },
    };
    
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
   * @private
   */
  _updateUIFromSettings(settings) {
    const sliderMap = {
      charge: 'charge-slider',
      linkStrength: 'link-slider',
      rootLinkStrength: 'root-link-strength-slider',
      ageLinkStrength: 'age-link-strength-slider',
      edgeThickness: 'edge-thickness-slider',
      topologyRepulsionA: 'topology-repulsion-a-slider',
      topologyRepulsionB: 'topology-repulsion-b-slider',
      topologyRepulsionX: 'topology-repulsion-x-slider',
      windDirection: 'wind-direction-slider',
      windStrength: 'wind-strength-slider',
      nodeCircleSize: 'node-circle-slider',
      graphFontSize: 'font-size-slider',
      sidebarFontSize: 'sidebar-font-size-slider',
      silhouetteSizePercent: 'silhouette-size-slider',
      silhouetteXOffset: 'silhouette-x-offset-slider',
      silhouetteYOffset: 'silhouette-y-offset-slider',
      silhouetteGrayscale: 'silhouette-grayscale-slider',
      silhouetteOpacity: 'silhouette-opacity-slider',
    };
    
    const toggleMap = {
      lockRootPosition: 'lock-root-position-toggle',
      showNodeDates: 'show-node-dates-toggle',
      showAncestralLabels: 'show-ancestral-labels-toggle',
    };
    
    // Update sliders
    Object.entries(sliderMap).forEach(([settingKey, elementId]) => {
      const element = document.getElementById(elementId);
      if (element && settings[settingKey] !== undefined) {
        let displayValue = settings[settingKey];
        // For opacity, convert from 0-1 to 0-100 for display
        if (settingKey === 'silhouetteOpacity') {
          displayValue = Math.round(displayValue * 100);
        }
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
    if (settings.charge !== undefined) {
      this.viz.setChargeStrength(-settings.charge);  // Negate for repulsion
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
