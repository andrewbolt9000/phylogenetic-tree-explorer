# PhyloExplorer: Pre-Implementation Rendering and Persistence Investigation

## A. SVG Rendering Architecture

### 1. Main SVG Element and Group Hierarchy

**File**: `src/visualization/forceDirectedVisualization.js`

**SVG Creation** (lines 183-190):
- Main SVG element is created with background color `#e8f4f8` (light blue)
- Background can be blended to white via `backgroundWhiteLevel` setting (0-100%)
- Dimensions: `this.options.width` × `this.options.height`

**Group Hierarchy**:
```
<svg>
  <g> (this.g - main transform group for zoom/pan)
    <g class="grid-container"> (grid, first child, behind everything)
    <line class="link"> (edges, rendered first)
    <g class="node-group"> (repeated for each node)
      <circle class="node-circle"> (grey background, r varies with depth)
      <circle class="node-marker"> (colored dot, terminal=6px, internal=4px)
      <g class="silhouette-group"> (only for terminal nodes with silhouettes)
        <image class="silhouette"> (external SVG file, href to ./assets/silhouettes/*.svg)
      </g>
      <text class="node-label-common"> (terminal node common name only)
      <text class="node-label-scientific"> (terminal node scientific name only)
      <text class="node-date-label"> (internal nodes with divergence data)
      <text class="ancestral-label"> (internal nodes with clade names)
      <text class="root-label"> (only on root node)
    </g>
  </g>
</svg>
```

**Render Order** (lines 206-211):
1. Grid (_renderGrid)
2. Links (_renderLinks)
3. Nodes (_renderNodes)
4. Labels (_renderLabels)
5. Root label (_renderRootLabel)
6. Date labels (_renderDateLabels)
7. Ancestral labels (_renderAncestralLabels)

### 2. Node Element Creation and Recreation

**Initial Creation** (lines 272-314 in _renderNodes):
- Node groups created once using D3 data join with node ID as key
- Grey background circles, colored markers, and drag behavior added during creation
- Silhouettes added in nested call to _renderSilhouettes
- Labels added separately in _renderLabels, _renderDateLabels, etc.

**During Simulation Ticks** (_onTick, lines 680-730):
- Elements are NOT recreated, only transformed and repositioned
- Node positions updated via `transform: translate(x, y)` on each g.node-group
- Link x1, y1, x2, y2 updated
- Silhouette sizes recalculated and updated
- **Labels are NOT repositioned** - they follow their parent group transform

**On Settings Changes**:
- Date labels: recreated entirely in _renderDateLabels (checks if showNodeDates changed)
- Ancestral labels: recreated entirely in _renderAncestralLabels
- Labels (common/scientific names): NOT updated when text needs repositioning

### 3. SVG Stacking Order and Text Layer Guarantee

**Current Stacking** (within each node-group):
1. Grey background circle (first append, lowest z-index)
2. Colored marker circle
3. Silhouette group (if present)
4. Common name text
5. Scientific name text
6. Date label text
7. Ancestral label text
8. Root label text

**Problem**: Text elements are added to node-group AFTER other elements, but text rendering doesn't guarantee they stay on top after updates. During _onTick, transforms are updated in arbitrary order.

**Solution to Guarantee Text on Top**:
- Create a dedicated text layer as the LAST child appended to node-group
- Move all text elements to this dedicated layer during _renderLabels
- Or: Append text elements AFTER all other elements in _renderNodes
- Currently text elements are spread across _renderLabels, _renderDateLabels, _renderAncestralLabels calls

**Current Risk**: If silhouettes or circles are re-rendered (e.g., on updates), they could end up above text.

---

## B. Node Date Rendering

### Current Implementation

**Setting**: `showNodeDates` (boolean, default = true in VisualizationSettings.js)

**Trace Path**:
1. Setting stored in VisualizationSettings (line 60)
2. HTML checkbox: `show-node-dates-toggle` (index.html line 854-858)
3. Checkbox click → `settings.setSetting('showNodeDates', checked)` + `viz.setShowNodeDates(show, divergenceData)`
4. Visualization setter: `setShowNodeDates(show, divergenceData)` (line 1106-1117)
5. Method updates `this.showNodeDates` and calls `_renderDateLabels()`

**Rendering** (_renderDateLabels, lines 413-477):
- Checks: `if (!this.showNodeDates || !this.divergenceData) { remove and return }`
- For internal nodes with divergence data, appends text.node-date-label
- Font size: `${this.fontSizeBase * 0.75}px` (hardcoded 75% of node label font)
- Text color: `#999` (grey)
- Positioned with `dy="1.2em"` (below node)

### CRITICAL BUG: showNodeDates Not Applied at Startup

**Problem**: 
- Setting `showNodeDates: true` in default-settings.yaml and in-code defaults
- HTML checkbox initialized with correct state via SettingsUI._updateUIFromSettings()
- BUT: `setShowNodeDates()` is NEVER called during initialization
- Result: Date labels do not appear on first load, only after manually toggling checkbox

**Code Evidence**:
- SettingsUI._applySettingsToVisualization (line 305-306):
  ```javascript
  if (settings.showNodeDates !== undefined) {
    // Note: these require additional data, handled separately
  }
  ```
  Comment says "handled separately" but it's NOT handled at all during initialization.

- index.html (lines 854-858) only wires the change event, never calls the setter initially

- No initialization call to `viz.setShowNodeDates()` in index.html after viz is created

### SECOND BUG: nodeDateLabels Reference Not Set

**Problem**: 
- setFontSize (line 1024) references `this.nodeDateLabels` to update date label font sizes
- But `this.nodeDateLabels` is initialized to null (line 111) and NEVER SET anywhere
- Result: Changing graphFontSize does not update date label font sizes

**Code Evidence**:
- Line 111: `this.nodeDateLabels = null;`
- Line 1024-1025: 
  ```javascript
  if (this.nodeDateLabels) {  // Always false!
    this.nodeDateLabels.attr('font-size', `${sizePixels * 0.75}px`);
  }
  ```
- In _renderDateLabels, text elements are created but never stored in `this.nodeDateLabels`

### Current Date Label Font Size

- Stored as: `fontSizeBase * 0.75` (e.g., 11px * 0.75 = 8.25px)
- Updated with graphFontSize slider (0.75 multiplier applied)
- Independent setting does NOT exist

### Recommended Implementation for nodeDateFontSize

1. Add new setting to VisualizationSettings:
   - Property: `nodeDateFontSize` 
   - Type: integer
   - Range: 6-16 pixels
   - Default: 8 (or computed from 0.75 * graphFontSize)
   - Category: appearance

2. Add HTML control in Appearance section
   - Label: "Date Label Font Size"
   - Slider 6-16px with step 1
   - Display value in px

3. Add getter/setter in ForceDirectedVisualization:
   - `setNodeDateFontSize(sizePixels)` 
   - Updates `this.nodeDateFontSize`
   - Calls `_updateNodeDateFontSize()` to apply to all date labels

4. Fix bug in _renderDateLabels:
   - Store returned selection in `this.nodeDateLabels`
   - Use configurable size instead of hardcoded 0.75 multiplier

---

## C. Text Background Implementation

### Current State
- No text backgrounds exist
- Labels rendered as plain text elements with no containers

### Recommended SVG Implementation

**Approach 1: Background Rectangles (Simple)**
- Create `<rect class="label-background">` BEFORE each text element
- Rect properties:
  - Width: text length + padding (use getComputedTextLength() after text renders)
  - Height: font height (1.2em)
  - Opacity: 0.5
  - Fill: white or light color
  - Rx/Ry: 2-4px for rounded corners

**Approach 2: Gradient with Horizontal Fade (Advanced)**
- Create reusable SVG pattern or linearGradient
- Gradient: white at center, fade to transparent at ±50% width
- Apply to background rect via fill-url or mask

**Recommended Pattern**:
```svg
<defs>
  <linearGradient id="label-fade-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
    <stop offset="0%" stop-color="white" stop-opacity="0"/>
    <stop offset="25%" stop-color="white" stop-opacity="0.5"/>
    <stop offset="75%" stop-color="white" stop-opacity="0.5"/>
    <stop offset="100%" stop-color="white" stop-opacity="0"/>
  </linearGradient>
</defs>
```

**SVG Stacking Order (within node-group)**:
```
<g class="label-group"> (added at end of node-group)
  <rect class="label-bg"> (gradient fill, z-order = lowest)
  <text class="label"> (text content, z-order = highest)
</g>
```

**Implementation Details**:
1. Add settings for background control:
   - `labelBackgroundOpacity` (0-1, default 0.5)
   - `labelBackgroundEnabled` (boolean, default false)

2. Modify _renderLabels to:
   - Create label-bg rect before each text
   - Use getComputedTextLength() to size rect
   - Add gradient reference to fill

3. During _onTick:
   - Rects move with node via parent group transform
   - No position recalculation needed

4. For both text types (common/scientific):
   - Use same background logic
   - Could share single gradient definition

**Measurement Challenge**:
- Text length unknown until rendered
- Solution: 
  - Render text first (or make rough estimate)
  - Use getBBox() on text element (only works in browser)
  - Or use approximate character width (7-10px per character at size 11)

---

## D. Hover Highlighting

### Current Implementation

**File**: `src/visualization/forceDirectedVisualization.js` (lines 308-313)

```javascript
this.nodeCircles
  .on('mouseenter', function() {
    d3.select(this).attr('opacity', 0.8);
  })
  .on('mouseleave', function() {
    d3.select(this).attr('opacity', 0.6);
  });
```

**Current Behavior**: 
- Only changes opacity of existing grey circle (node-circle)
- Grey circle opacity goes from 0.6 → 0.8 on hover

### Recommended Hover Highlight Implementation

**Approach: Larger Semi-Transparent Circle Behind Node**

1. Add highlight circle during _renderNodes:
   ```
   nodeGroups
     .insert('circle', ':first-child')  // Insert as first child (below everything)
     .attr('class', 'node-highlight')
     .attr('r', d => this._getNodeCircleRadius(d) * 1.5)  // 1.5x grey circle
     .attr('fill', '#000')
     .attr('opacity', 0)  // Hidden by default
     .attr('pointer-events', 'none');  // Don't interfere with events
   ```

2. Wire hover to highlight:
   ```javascript
   this.nodeCircles
     .on('mouseenter', function(event, d) {
       // Find the highlight circle in this node's group
       d3.select(this.parentNode).select('.node-highlight')
         .attr('opacity', 0.2);
     })
     .on('mouseleave', function(event, d) {
       d3.select(this.parentNode).select('.node-highlight')
         .attr('opacity', 0);
     });
   ```

3. During _onTick:
   - Highlight circle automatically moves with group transform
   - No extra positioning needed

**Alternative Approach: Modify Grey Circle Glow**
- Keep existing grey circle
- On hover: increase radius + increase opacity
- Problem: Changes pointer-events area, might interfere with clicking
- Not recommended

**Drag Safety**:
- Since highlight uses `.insert(':first-child')`, it's rendered BEFORE circles
- `pointer-events: none` ensures it doesn't capture mouse events
- Existing drag behavior on nodeGroups is unaffected
- Existing pointer-events on nodeCir cles remain `all`

**Accessibility**:
- Consider adding stroke to highlight for better visibility
- Or: Subtle color change (e.g., #2E86AB instead of #000)

---

## E. Silhouette Shadows

### Current Implementation

**File**: `src/visualization/forceDirectedVisualization.js` (lines 322-370)

- Silhouettes loaded as external SVG files via `<image>` element
- Href: `./assets/silhouettes/${d.silhouetteFilename}`
- Rendering: Single image per terminal node
- Updated during _onTick with size/position/opacity changes

**Key Properties**:
- Loaded as: external file (not inline SVG)
- Size: calculated from baseSize * (silhouetteSizePercent / 100)
- Transform: `translate(silhouetteXOffset, silhouetteYOffset)`
- Styling: `mix-blend-mode: 'multiply'`, `opacity: 0.85`, `filter: grayscale`

### Shadow Implementation

**Problem**: External image files cannot reuse paths directly for shadow
- Cannot access SVG path data from external `<image>` element
- Would need inline SVG or separate shadow rendering

**Approach 1: Duplicate Image with Offset (Recommended)**

1. In _renderSilhouettes, create shadow before main silhouette:
   ```javascript
   // Shadow
   silhouetteGroup
     .insert('image', ':first-child')  // Insert before main image
     .attr('class', 'silhouette-shadow')
     .attr('x', -silhouetteSize / 2 + 2)  // Offset right/down
     .attr('y', -silhouetteSize / 2 + 2)
     .attr('width', silhouetteSize)
     .attr('height', silhouetteSize)
     .attr('href', `./assets/silhouettes/${d.silhouetteFilename}`)
     .attr('opacity', 0.15)  // Very faint shadow
     .attr('pointer-events', 'none')
     .style('filter', 'brightness(50%)');  // Darken shadow
   ```

2. During _onTick, update shadow alongside main silhouette:
   - Same offset multipliers
   - Ensure shadow stays behind main image

3. When silhouetteXOffset/silhouetteYOffset change:
   - Add constant shadow offset (2-4px right/down) to user offset
   - E.g., shadow at `(userX + 2, userY + 2)`

**Approach 2: CSS Filter Drop-Shadow (Simpler)**
- Apply `filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.3))` to silhouette
- Problem: Affects entire image, not just opaque areas
- Simpler but less control

**Recommended Approach 1** - More control over shadow appearance

**Settings to Add** (optional):
- `silhouetteShadowOffset` (px, default 2)
- `silhouetteShadowOpacity` (0-1, default 0.15)
- Toggle: `showSilhouetteShadow` (default true)

---

## F. Root-Position Persistence

### Current Implementation

**Status**: NO PERSISTENCE MECHANISM EXISTS

**Root Node Identification**:
- Property: `this.rootNodeId` (set from options during init)
- Source: `hypothesisData.rootNodeId` passed from index.html
- Confirmed usage: lines 597, 600, 604, 652, 1215, 1221, etc.

**Root Node Behavior**:
- If `lockRootPosition = true`: 
  - After drag, `d.fx = d.x; d.fy = d.y` keeps node pinned (line 652-655)
- If `lockRootPosition = false`:
  - After drag, `d.fx = null; d.fy = null` releases node

**Nodes Array**:
- Contains `x, y` coordinates for all nodes (force-directed layout)
- Terminal and internal nodes treated equally in layout
- Root is NOT excluded from normal force simulation

### Position Persistence Architecture

**Needed Components**:

1. **Serialization** (export positions):
   - Capture all nodes: `{ id, x, y }`
   - OR: Only non-default positions (comparison check)
   - Format: JSON or YAML

2. **Storage**:
   - Option A: Browser localStorage (volatile, per-session)
   - Option B: Download as file (user-controlled)
   - Option C: URL parameter encoding (limited size)

3. **Restoration** (import positions):
   - After graph rendered, apply saved positions before simulation starts
   - Set as `d.fx, d.fy` if locking enabled
   - Or set as initial `d.x, d.y` with forces applied

**Implementation Approach**:

```javascript
// Export
exportLayout() {
  const layout = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    rootNodeId: this.rootNodeId,
    nodes: this.nodes.map(d => ({
      id: d.id,
      x: Math.round(d.x * 100) / 100,  // Round to 0.01
      y: Math.round(d.y * 100) / 100,
      fx: d.fx !== null ? Math.round(d.fx * 100) / 100 : null,
      fy: d.fy !== null ? Math.round(d.fy * 100) / 100 : null,
    }))
  };
  return JSON.stringify(layout, null, 2);
}

// Import
importLayout(jsonString) {
  const layout = JSON.parse(jsonString);
  if (layout.version !== '1.0') throw new Error('Invalid layout version');
  
  const positionMap = {};
  layout.nodes.forEach(node => {
    positionMap[node.id] = { x: node.x, y: node.y, fx: node.fx, fy: node.fy };
  });
  
  // Apply to current nodes before simulation
  this.nodes.forEach(node => {
    if (positionMap[node.id]) {
      const pos = positionMap[node.id];
      node.x = pos.x;
      node.y = pos.y;
      node.fx = pos.fx;  // May be null
      node.fy = pos.fy;
    }
  });
  
  // Restart simulation
  this.simulation.alpha(0.3).restart();
}
```

**Root Node Special Handling**:
- Export includes `rootNodeId` for verification
- Import can warn if root mismatch
- Root locked state applies from current settings (not persisted)

**File Format**:
```json
{
  "version": "1.0",
  "timestamp": "2026-11-12T17:19:07Z",
  "rootNodeId": "ancestor_0",
  "nodes": [
    { "id": "Homo_sapiens", "x": 150.5, "y": -200.3, "fx": null, "fy": null },
    { "id": "ancestor_0", "x": 0, "y": 0, "fx": 0, "fy": 0 },
    ...
  ]
}
```

**URL Compatibility**:
- Could add `layoutId` query parameter
- Fetch layout from server if needed
- Or store in localStorage with key = `phyloexplorer_layout_${timestamp}`

---

## G. Summary: Implementation Dependencies and Order

### Dependency Graph
```
Text Backgrounds
  ├─ Depends on: Label rendering (already exists)
  └─ Independent

Hover Highlighting
  ├─ Depends on: Existing node rendering
  └─ Independent

Silhouette Shadows
  ├─ Depends on: Silhouette rendering (already exists)
  └─ Independent

Node Date Font Size Setting
  ├─ Depends on: Fix showNodeDates initialization bug
  └─ Bugfix first, then new setting

Show Node Dates Initialization
  ├─ Depends on: BUGFIX REQUIRED
  └─ Must do before other date-related work

Position Persistence
  ├─ Depends on: Existing node coordinate system
  └─ Independent
```

### Recommended Implementation Order

1. **FIRST: Fix showNodeDates initialization bug** (Blocking other work)
   - Bug: Setting not applied at startup
   - Fix: Call `viz.setShowNodeDates(settings.showNodeDates, divergenceData)` during init
   - Estimated effort: 10 minutes
   - Also fix: Store date label selection in `this.nodeDateLabels`

2. **SECOND: Add nodeDateFontSize setting** (Depends on bug fix)
   - Add to VisualizationSettings schema
   - Add HTML control
   - Add visualization setter
   - Estimated effort: 20 minutes

3. **THIRD (Parallel**: Do any of the independent features
   - Text backgrounds (20-30 minutes)
   - Hover highlighting (15 minutes)
   - Silhouette shadows (15 minutes)
   - Position persistence (30-40 minutes)

### Potential Regressions

- **Text backgrounds**: May overlap with node elements if not carefully layered
  - Mitigation: Use `:first-child` insertion strategy
  - Test: Verify text stays on top in all zoom/pan states

- **Hover highlighting**: Could interfere with drag if not marked `pointer-events: none`
  - Mitigation: Explicitly set pointer-events: none
  - Test: Verify drag still works on hovered nodes

- **Silhouette shadows**: Doubling image load count
  - Mitigation: Small opacity means little visual impact if missing
  - Test: Verify graceful fallback if shadow image fails

- **Position persistence**: Must not break existing node layout logic
  - Mitigation: Use same coordinate system, just pre-set positions
  - Test: Verify simulation still converges with pre-set positions

### Tests Needed

**Existing tests to verify still pass**:
- `silhouette-controls-fix.test.js` (silhouette rendering)
- `stage2-labels.test.js` (label rendering)
- All force/physics tests (position changes don't affect forces)

**New tests to add**:
1. showNodeDates applies on startup
2. nodeDateLabels reference is set and updated
3. Text background elements render in correct order
4. Hover highlight doesn't interfere with drag
5. Shadow image loads and positions correctly
6. Layout export/import preserves node positions
7. Invalid layout import fails gracefully
8. Font size changes update all label types

---

## Confirmed Bugs to Fix

| Bug | Severity | Location | Fix |
|-----|----------|----------|-----|
| showNodeDates not applied at startup | HIGH | index.html init sequence | Call viz.setShowNodeDates() after viz creation |
| nodeDateLabels never set | HIGH | _renderDateLabels | Store selection in this.nodeDateLabels |
| Date label font size not updatable | MEDIUM | setFontSize method | Add nodeDateFontSize setting |
| Text layer not guaranteed on top | MEDIUM | _renderNodes, _renderLabels | Create dedicated text layer or reorder appends |

---

## Current Test Coverage

**Tests that cover these areas**:
- `silhouette-controls-fix.test.js`: Silhouette rendering, sizing, offset
- `stage2-labels.test.js`: Label rendering and updates
- `grid-settings.test.js`: Grid rendering and z-order
- `root-lock-and-wind.test.js`: Root locking behavior

**Tests that do NOT exist**:
- showNodeDates initialization
- Date label updates
- Text background rendering
- Hover highlighting
- Position persistence
- Font size propagation to all label types

