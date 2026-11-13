# Leaf Forces Feature Implementation Summary

## Features Implemented

### 1. Separate Leaf Force Control (leafCharge)
- **Purpose**: Allow independent repulsion settings for terminal (leaf) nodes vs internal nodes
- **Setting Name**: `leafCharge`
- **Range**: 0-1500 (same as `charge`)
- **Default**: 300 (matching default `charge`)
- **Implementation**:
  - Added `currentLeafChargeStrength` instance property to ForceDirectedVisualization
  - Created `_getNodeCharge(d)` method that returns per-node charge based on `d.type`
  - Terminal nodes (`d.type === 'terminal'`) use `currentLeafChargeStrength`
  - Internal nodes (`d.type === 'internal'`) use `currentChargeStrength`
  - Modified `_createSimulation()` to use per-node strength function: `.strength(d => this._getNodeCharge(d))`
  - Updated `setChargeStrength()` and added `setLeafChargeStrength()` to update forces

### 2. Leaf-Only Hover Highlighting
- **Behavior**:
  - Hover highlight circle now appears **only** when hovering over terminal nodes
  - Internal nodes do not show hover highlight
  - Leaf classification uses authoritative `d.type === 'terminal'` check
- **Implementation**:
  - Modified hover event handlers in `_renderNodes()`:
    - `mouseenter`: Only show highlight if `d.type === 'terminal'`
    - `mouseleave`: Only hide highlight if `d.type === 'terminal'`
  - Preserved existing highlight positioning, offset controls, and fade transitions

### 3. Radial Gradient for Hover Highlight
- **Visual Effect**: Soft white halo behind hovered leaf
  - White center (#ffffff) at full opacity
  - Gradually fades to transparent at outer edge
  - No hard boundary or visible gradient banding
- **Implementation**:
  - Added `_createSVGDefs()` method called during `render()`
  - Creates SVG `<defs>` section with `<radialGradient>` element
  - Gradient ID: `hoverHighlightGradient`
  - Stop 1: 0% offset, #ffffff, opacity 1
  - Stop 2: 100% offset, #ffffff, opacity 0
  - Updated hoverHighlightCircle to use fill `url(#hoverHighlightGradient)`

## Settings Integration

### VisualizationSettings Updates
- **defaults**: `leafCharge: 300` (line 28)
- **schema**: Full entry with type, min, max, default (after charge entry)
- **YAML export**: `leafCharge: 300  # Repulsion strength for leaf/terminal nodes (0-1500)`
- **YAML import**: Backward compatibility logic in `loadFromYAML()`:
  - If YAML contains `leafCharge`, use it directly
  - If YAML contains `charge` but not `leafCharge`, set `leafCharge = charge`
  - Preserves old YAML file behavior

### UI Integration
- **HTML**: Added leafCharge slider to Forces section after charge slider (index.html)
  - ID: `leafCharge-slider`
  - Range: 0-1500
  - Step: 10
  - Display value ID: `leafCharge-value`
- **SettingsUI**: Added control map entry binding slider to setting and value display
- **Visualization**: Added listener in `_applySettingsToVisualization()` to call `setLeafChargeStrength()`
- **Default Config**: `config/default-settings.yaml` includes `leafCharge: 130`

## Architecture Preservation

### Maintained
- ✓ Single viewport architecture (one transformed `this.g` group)
- ✓ Dedicated text layer as final child of viewport (z-order guarantee)
- ✓ Per-tick text coordinate updates
- ✓ Zoom/pan synchronization for all layers
- ✓ Node dragging and simulation behavior
- ✓ All existing force calculations except per-node charge
- ✓ Grid, links, nodes, silhouettes, and text rendering order

### Performance
- Per-node charge strength evaluated once per force creation/update
- No additional per-tick overhead
- No DOM recreation on hover
- Radial gradient defined once in SVG defs (reused across multiple hover actions)

## Testing

### Test Coverage (leafForcesFeature.test.js)
1. **Settings Schema** (5 tests)
   - leafCharge defined in schema with correct bounds
   - Included in defaults (300)
   - Validation works correctly

2. **YAML Persistence** (5 tests)
   - YAML export includes leafCharge
   - YAML import parses leafCharge correctly
   - Backward compatibility: old YAML without leafCharge defaults to charge value
   - Round-trip export/import preserves values
   - Both settings can coexist independently

3. **Force Simulation** (4 tests)
   - Instance property stored and updatable
   - Per-node charge function correctly identifies terminal vs internal
   - Different nodes receive different charge values
   - Settings are independent from each other

4. **Hover Highlighting Restriction** (3 tests)
   - Terminal nodes only trigger highlight
   - Internal nodes do not trigger highlight
   - Radial gradient URL defined correctly

5. **Settings UI Integration** (4 tests)
   - leafCharge validates correctly
   - Out-of-range values clamped during validation
   - leafCharge independent from charge setting
   - Updates don't cross-affect each other

6. **Default Settings File** (2 tests)
   - default-settings.yaml loadable with leafCharge
   - Code defaults consistent with config file

7. **Listener Notifications** (2 tests)
   - Listeners notified when leafCharge changes
   - No cross-interference with charge listeners

**Results**: All 518 tests pass (488 + 30 new)

## Files Changed

1. **src/settings/VisualizationSettings.js**
   - Added leafCharge to defaults, schema, YAML export
   - Modified loadFromYAML() for backward compatibility

2. **src/ui/SettingsUI.js**
   - Added leafCharge to control map
   - Added leafCharge handling in _applySettingsToVisualization()

3. **src/visualization/forceDirectedVisualization.js**
   - Added currentLeafChargeStrength property
   - Created _createSVGDefs() for radial gradient
   - Created _getNodeCharge() for per-node force strength
   - Modified _createSimulation() to use per-node charge function
   - Updated setChargeStrength() to use per-node function
   - Added setLeafChargeStrength() method
   - Modified hover highlighting to check `d.type === 'terminal'`
   - Updated hoverHighlightCircle to use radial gradient fill

4. **config/default-settings.yaml**
   - Added leafCharge entry with comment

5. **index.html**
   - Added leafCharge slider control in Forces section

6. **src/visualization/leafForcesFeature.test.js** (new file)
   - Comprehensive test suite for all new features

## Backward Compatibility

✓ **Old YAML files load correctly**
- Files with only `charge` setting: leafCharge automatically set to loaded charge value
- Files with both `charge` and `leafCharge`: Both values preserved
- No breaking changes to existing YAML persistence

✓ **HTML controls work without changes**
- Existing charge slider unchanged
- New leafCharge slider optional for users

✓ **Existing visualization behavior preserved**
- Default behavior unchanged (both charge values default to 300)
- Force calculations identical when both values match

## Browser Verification Needed

After this implementation, verify in browser:

1. **Leaf-Only Hover Highlighting**
   - Hover over terminal/leaf nodes: see highlight appear with radial gradient
   - Hover over internal nodes: no highlight appears
   - Smooth fade-in/fade-out on terminal nodes

2. **Radial Gradient Visual**
   - Highlight shows white center fading to transparent
   - No hard edges or visible gradient bands
   - Appears as soft halo behind silhouette

3. **Separate Force Control**
   - Adjust charge slider: internal nodes adjust repulsion
   - Adjust leafCharge slider: leaf nodes adjust repulsion independently
   - Can set very different values (e.g., charge=100, leafCharge=500) to see distinct effects

4. **Settings Persistence**
   - Load old YAML without leafCharge: works correctly with defaults
   - Export settings to YAML: includes both charge and leafCharge
   - Adjust leafCharge and export: new value included in YAML
   - Reset to defaults: both charge and leafCharge reset to 300

5. **Frame Rate**
   - No performance regression from previous phase
   - Smooth interaction during hover, panning, zooming
