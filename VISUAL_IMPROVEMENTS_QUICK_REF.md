# PhyloExplorer Visual Improvements - Quick Reference

## File Locations and Key Methods

### SVG Rendering Architecture
- **File**: `src/visualization/forceDirectedVisualization.js`
- **Key Methods**:
  - `_createSimulation()` (lines 123-225): Initial render order + setup
  - `_renderNodes()` (lines 272-314): Create node groups, circles, drag
  - `_renderLabels()` (lines 371-411): Terminal species labels
  - `_renderDateLabels()` (lines 413-477): Ancestral node dates
  - `_renderSilhouettes()` (lines 322-370): Terminal species silhouettes
  - `_onTick()` (lines 680-730): Animation loop, position updates

**Render Sequence**:
```
_createSimulation()
  → _renderGrid()
  → _renderLinks()
  → _renderNodes()
  → _renderLabels()
  → _renderRootLabel()
  → _renderDateLabels()
  → _renderAncestralLabels()
```

### SVG Structure (Each Node Group)
```html
<g class="node-group" data-id="node_id">
  <circle class="node-circle" r="..." opacity="0.6"/>          ← Hover opacity: 0.8
  <circle class="node-marker" r="6|4" fill="#2E86AB|#A23B72"/>
  <g class="silhouette-group" transform="translate(x,y)">      ← Only terminal nodes
    <image class="silhouette" href="./assets/silhouettes/...svg"/>
  </g>
  <text class="node-label-common" dy="-0.4em">Common Name</text>
  <text class="node-label-scientific" dy="0.8em" font-style="italic">Scientific Name</text>
  <text class="node-date-label" dy="1.2em">5 Ma</text>
  <text class="ancestral-label" dy="1.5em">Clade Name</text>
  <text class="root-label" dy="...">Root</text>
</g>
```

### Settings System
- **File**: `src/settings/VisualizationSettings.js`
- **Key Methods**:
  - `getDefaults()` (line 23): All setting defaults
  - `getSchema()` (line 186): Validation ranges + types
  - `toYAML()` (line 447): Export settings
  - `parseYAML()` (line 503): Import settings
  - `validateSetting()` (line 516): Validate + clamp values
  - `updateSettings()` (line 111): Atomic multi-setting update

**Settings Relevant to Visual Work**:
```javascript
backgroundWhiteLevel: 0,     // 0-100 (blend to white)
showNodeDates: true,         // Boolean (toggle date labels)
graphFontSize: 11,           // 8-20px (label font)
silhouetteSizePercent: 100,  // 30-300% (silhouette scale)
silhouetteOpacity: 1.0,      // 0-1 (silhouette transparency)
gridSpacing: 20,             // 10-200px (background grid)
```

### Settings UI Wiring
- **File**: `src/ui/SettingsUI.js`
- **Key Methods**:
  - `initialize()` (line 36): Load defaults + wire controls + listen
  - `getControlMap()` (line 20): Source of truth for HTML↔settings mapping
  - `_wireControls()` (line 139): Connect HTML sliders to settings
  - `_updateUIFromSettings()` (line 181): Sync UI when settings change
  - `_applySettingsToVisualization()` (line 239): Call viz setters

**Control Mapping Example**:
```javascript
'graphFontSize-slider': {
  setting: 'graphFontSize',
  transform: v => parseInt(v),
  display: 'graphFontSize-value',
  suffix: 'px'
}
```

### Visualization Setters
- **File**: `src/visualization/forceDirectedVisualization.js`
- **Key Setters** (all update immediately or on tick):
  - `setShowNodeDates(show, divergenceData)` (line 1106)
  - `setGraphFontSize(sizePixels)` (line 1013)
  - `setSilhouetteSizePercent(percent)` (line 1060)
  - `setSilhouetteOpacity(opacity)` (line 1073)
  - `setBackgroundWhiteLevel(level)` (line 1741)

---

## BUGS TO FIX (Priority Order)

### Bug #1: showNodeDates Not Applied at Startup (CRITICAL)
- **Problem**: Date labels not visible on first load
- **Root Cause**: `setShowNodeDates()` never called during init
- **Fix Location**: `index.html` (~line 780-790)
- **Fix Code**:
  ```javascript
  // After viz is created and settings loaded:
  const divergenceData = await divergenceLoader.loadDivergenceData();
  viz.setShowNodeDates(settings.getSettings().showNodeDates, divergenceData);
  ```
- **Status**: Fixable immediately

### Bug #2: nodeDateLabels Reference Not Set (CRITICAL)
- **Problem**: Changing graphFontSize doesn't update date label sizes
- **Root Cause**: `this.nodeDateLabels` always null, never populated
- **Fix Location**: `src/visualization/forceDirectedVisualization.js` line ~470
- **Fix Code**:
  ```javascript
  // In _renderDateLabels(), when creating text elements:
  this.nodeDateLabels = d3.select(element).selectAll('text.node-date-label');
  ```
- **Status**: Fixable immediately

### Bug #3: Text Layer Not Guaranteed on Top (MEDIUM)
- **Problem**: Silhouettes or circles could render above text on updates
- **Root Cause**: Text elements appended after circles, but no z-order protection
- **Fix Location**: `src/visualization/forceDirectedVisualization.js` _renderNodes/Labels
- **Recommendation**: Create dedicated text layer or use `.insert()` to reorder
- **Status**: Need to verify with browser testing

---

## FEATURE IMPLEMENTATION QUICK GUIDE

### Feature: nodeDateFontSize Setting

**Files to Edit**:
1. `src/settings/VisualizationSettings.js`
   - Add to `getDefaults()`: `nodeDateFontSize: 8`
   - Add to `getSchema()`: `nodeDateFontSize: { type: 'integer', min: 6, max: 16, default: 8 }`

2. `src/visualization/forceDirectedVisualization.js`
   - Add property: `this.nodeDateFontSize = 8;`
   - Add setter: `setNodeDateFontSize(sizePixels) { ... _updateNodeDateFontSize() }`
   - Add method: `_updateNodeDateFontSize() { this.nodeDateLabels.attr('font-size', ...) }`
   - In _renderDateLabels: use `this.nodeDateFontSize` instead of hardcoded 0.75

3. `index.html` (Appearance section)
   - Add slider: `<input type="range" id="node-date-font-size-slider" min="6" max="16">`
   - Add display: `<span id="node-date-font-size-value">8</span> px`

4. `src/ui/SettingsUI.js`
   - Add to controlMap: `'node-date-font-size-slider': { setting: 'nodeDateFontSize', ... }`

### Feature: Text Background Labels

**SVG Pattern to Add**:
```javascript
// In _renderLabels() or _createSimulation():
this.g.append('defs').append('linearGradient')
  .attr('id', 'label-bg-gradient')
  .attr('x1', '0%').attr('y1', '0%')
  .attr('x2', '100%').attr('y2', '0%')
  .selectAll('stop')
  .data([
    { offset: '0%', color: 'white', opacity: 0 },
    { offset: '25%', color: 'white', opacity: 0.5 },
    { offset: '75%', color: 'white', opacity: 0.5 },
    { offset: '100%', color: 'white', opacity: 0 }
  ])
  .enter().append('stop')
  .attr('offset', d => d.offset)
  .attr('stop-color', d => d.color)
  .attr('stop-opacity', d => d.opacity);
```

**Rect Creation** (before text in _renderLabels):
```javascript
nodeGroups.append('rect')
  .attr('class', 'label-bg')
  .attr('x', -40)  // Estimate width
  .attr('y', -8)
  .attr('width', 80)
  .attr('height', 16)
  .attr('fill', 'url(#label-bg-gradient)')
  .attr('rx', 3)
  .attr('pointer-events', 'none');
```

### Feature: Hover Highlight Circle

**Location**: `src/visualization/forceDirectedVisualization.js` in `_renderNodes()`

```javascript
// After creating grey circle:
nodeGroups
  .insert('circle', ':first-child')
  .attr('class', 'node-highlight')
  .attr('r', d => this._getNodeCircleRadius(d) * 1.5)
  .attr('fill', '#2E86AB')
  .attr('opacity', 0)
  .attr('pointer-events', 'none');

// Update hover handler:
this.nodeCircles
  .on('mouseenter', function(event, d) {
    d3.select(this.parentNode).select('.node-highlight')
      .transition().duration(100)
      .attr('opacity', 0.2);
  })
  .on('mouseleave', function(event, d) {
    d3.select(this.parentNode).select('.node-highlight')
      .transition().duration(100)
      .attr('opacity', 0);
  });
```

### Feature: Silhouette Shadow

**Location**: `src/visualization/forceDirectedVisualization.js` in `_renderSilhouettes()`

```javascript
// Before main silhouette image:
silhouetteGroup
  .insert('image', ':first-child')
  .attr('class', 'silhouette-shadow')
  .attr('x', -silhouetteSize / 2 + 2)
  .attr('y', -silhouetteSize / 2 + 2)
  .attr('width', silhouetteSize)
  .attr('height', silhouetteSize)
  .attr('href', `./assets/silhouettes/${d.silhouetteFilename}`)
  .attr('opacity', 0.15)
  .attr('pointer-events', 'none')
  .style('filter', 'brightness(50%)');

// In _onTick(), update shadow alongside main image
```

### Feature: Position Persistence

**New Methods in ForceDirectedVisualization**:
```javascript
exportLayout() {
  return JSON.stringify({
    version: '1.0',
    rootNodeId: this.rootNodeId,
    nodes: this.nodes.map(d => ({ id: d.id, x: d.x, y: d.y, fx: d.fx, fy: d.fy }))
  }, null, 2);
}

importLayout(jsonString) {
  const layout = JSON.parse(jsonString);
  const posMap = {};
  layout.nodes.forEach(n => { posMap[n.id] = n; });
  this.nodes.forEach(d => {
    if (posMap[d.id]) {
      d.x = posMap[d.id].x;
      d.y = posMap[d.id].y;
      d.fx = posMap[d.id].fx;
      d.fy = posMap[d.id].fy;
    }
  });
  this.simulation.alpha(0.3).restart();
}
```

**HTML Controls** (new section):
```html
<section>
  <h3>Layout</h3>
  <button id="export-layout-button">Export Layout as JSON</button>
  <button id="import-layout-button">Import Layout</button>
</section>
```

---

## Testing Strategy

**Unit Tests to Add**:
- `showNodeDates` applies on startup ✓
- Font size changes propagate to date labels ✓
- Text backgrounds render behind text ✓
- Hover highlight appears/disappears correctly ✓
- Shadow image loads/positions correctly ✓
- Layout export/import round-trip preserves positions ✓

**Browser Tests** (manual):
- Drag node while hovered (verify drag still works)
- Toggle date labels (verify immediate appearance/disappearance)
- Change font sizes (verify all label types update)
- Zoom/pan with text backgrounds (verify no visual glitches)
- Export layout, reload, import (verify positions restored)

---

## Commit Strategy

**Suggested Commits** (one per feature):
1. Fix: showNodeDates initialization + nodeDateLabels reference
2. Feature: nodeDateFontSize setting
3. Feature: Text background labels
4. Feature: Hover highlight circle
5. Feature: Silhouette shadows
6. Feature: Position persistence (export/import)

**Test Coverage per Commit**:
- Add tests for the feature being added
- Run full test suite
- Verify no regressions in existing tests

---

## Reference: Current Settings & Defaults

See `config/default-settings.yaml` for live defaults.

Key values for planning:
- `graphFontSize: 11` (default node label font)
- `silhouetteSizePercent: 100` (default silhouette scale)
- `silhouetteOpacity: 1.0` (fully opaque)
- `backgroundWhiteLevel: 100` (white background in example config)
- `showNodeDates: true` (dates shown by default)

