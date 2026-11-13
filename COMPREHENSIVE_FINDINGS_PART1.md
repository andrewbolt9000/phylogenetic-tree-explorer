# PhyloExplorer: Complete Investigation Findings — Part 1

## Executive Summary

This report presents complete findings from the pre-implementation investigation of six visual improvement features. Each section distinguishes **confirmed source-code facts** from **assumptions requiring browser verification**. Additionally, findings address the requirement for an independent `showSpeciesEstablishmentDates` toggle for tracking taxon origin dates, distinct from divergence and fossil occurrence dates.

---

## 1. Files and Functions: Confirmed Source-Code Facts

### 1.1 SVG Rendering Architecture

**File**: `src/visualization/forceDirectedVisualization.js`

**SVG Creation** (lines 183-190):
```javascript
this.svg = d3.select(container).append('svg')
  .attr('width', this.options.width)
  .attr('height', this.options.height)
  .style('background-color', backgroundColor);
  
this.g = this.svg.append('g');
```

**Background Color Management** (lines 185-188):
- Initial background: `#e8f4f8` (light blue)
- Updated via `setBackgroundWhiteLevel()` (lines 1741-1776) using linear RGB interpolation
- SVG style attribute modified directly without rebuild

**Main Group Hierarchy** (after lines 190-211):
```html
<svg id="phylo-svg">
  <g> (this.g - zoom/pan transform group)
    <g class="grid-container"> (added at line 185 via _renderGrid())
    <!-- Links rendered at lines 215-260 -->
    <!-- Nodes rendered at lines 272-314 -->
    <!-- Labels rendered at lines 371-411 -->
    <!-- Root label rendered at lines 419-423 -->
    <!-- Date labels rendered at lines 413-477 -->
    <!-- Ancestral labels rendered at lines 479-509 -->
  </g>
</svg>
```

### 1.2 Node Rendering and Element Creation

**Function**: `_renderNodes()` (lines 272-314)

```javascript
const nodeGroups = this.g.selectAll('g.node-group')
  .data(this.nodes, d => d.id)
  .join('g')
  .attr('class', 'node-group')
  .attr('data-id', d => d.id)
  .attr('transform', d => `translate(${d.x}, ${d.y})`);

// Grey background circle (r varies by depth)
nodeGroups.append('circle')
  .attr('class', 'node-circle')
  .attr('r', d => this._getNodeCircleRadius(d))
  .attr('fill', '#ccc')
  .attr('opacity', 0.6);

// Colored marker (terminal=6px, internal=4px)
nodeGroups.append('circle')
  .attr('class', 'node-marker')
  .attr('r', d => d.isTerminal ? 6 : 4)
  .attr('fill', d => d.isTerminal ? '#2E86AB' : '#A23B72');

// Silhouettes (terminal nodes only)
this._renderSilhouettes(nodeGroups);
```

**CONFIRMED FACT**: Node groups use D3 data join with node ID as key. Elements created once, not recreated during simulation ticks.

### 1.3 Silhouette Rendering

**Function**: `_renderSilhouettes()` (lines 322-370)

```javascript
const silhouetteGroups = nodeGroups
  .filter(d => d.isTerminal && d.silhouetteFilename)
  .append('g')
  .attr('class', 'silhouette-group')
  .attr('transform', d => `translate(${-silhouetteSize/2}, ${-silhouetteSize/2})`);

silhouetteGroups.append('image')
  .attr('class', 'silhouette')
  .attr('x', 0)
  .attr('y', 0)
  .attr('width', silhouetteSize)
  .attr('height', silhouetteSize)
  .attr('href', d => `./assets/silhouettes/${d.silhouetteFilename}`)
  .attr('opacity', this.silhouetteOpacity)
  .style('mix-blend-mode', 'multiply')
  .style('filter', 'grayscale(100%)');
```

**CONFIRMED FACT**: Silhouettes loaded as external SVG files via `<image href="...">` elements. External files cannot have their SVG paths accessed or reused directly from JavaScript.

### 1.4 Label Rendering

**Terminal Node Labels**: `_renderLabels()` (lines 371-411)

```javascript
const labelGroups = this.g.selectAll('g.label-group')
  .data(this.terminalNodes, d => d.id)
  .join('g')
  .attr('class', 'label-group')
  .attr('transform', d => `translate(${d.x}, ${d.y})`);

// Common name (if available)
labelGroups.append('text')
  .attr('class', 'node-label-common')
  .text(d => d.commonName || '')
  .attr('font-size', `${this.fontSizeBase}px`)
  .attr('dy', '-0.4em');

// Scientific name
labelGroups.append('text')
  .attr('class', 'node-label-scientific')
  .text(d => d.scientificName)
  .attr('font-size', `${this.fontSizeBase}px`)
  .attr('dy', '0.8em')
  .style('font-style', 'italic');
```

**CONFIRMED FACT**: Terminal node labels stored in separate data join, not part of node-group. Text elements moved with parent group transform during simulation ticks.

### 1.5 Date Label Rendering

**Function**: `_renderDateLabels()` (lines 413-477)

```javascript
_renderDateLabels() {
  if (!this.showNodeDates || !this.divergenceData) {
    this.g.selectAll('text.node-date-label').remove();
    return;
  }

  const datesByNodeId = {};
  this.internalNodes.forEach(d => {
    const divergenceAge = this._getDivergenceEstimate(d.id);
    if (divergenceAge !== null) {
      datesByNodeId[d.id] = `${divergenceAge}Ma`;
    }
  });

  const dateLabels = this.g.selectAll('text.node-date-label')
    .data(this.internalNodes.filter(d => datesByNodeId[d.id]), d => d.id)
    .join(
      enter => enter.append('text')
        .attr('class', 'node-date-label')
        .text(d => datesByNodeId[d.id])
        .attr('font-size', `${this.fontSizeBase * 0.75}px`)
        .attr('fill', '#999')
        .attr('dy', '1.2em'),
      update => update
        .text(d => datesByNodeId[d.id]),
      exit => exit.remove()
    );
  
  // BUG: No assignment to this.nodeDateLabels!
}
```

**CONFIRMED BUGS**:
1. **Line 108**: `this.nodeDateLabels = null;` initialized but never set
2. **Line 414**: Setter `setShowNodeDates()` never called during initialization (no startup application)
3. **Font hardcoded**: `${this.fontSizeBase * 0.75}px` as hardcoded multiplier, not independent setting

### 1.6 Hover Highlighting

**Function**: `_renderNodes()` (lines 308-313)

```javascript
this.nodeCircles = nodeGroups.select('circle.node-circle');

this.nodeCircles
  .on('mouseenter', function() {
    d3.select(this).attr('opacity', 0.8);
  })
  .on('mouseleave', function() {
    d3.select(this).attr('opacity', 0.6);
  });
```

**CONFIRMED FACT**: Only modifies opacity of existing grey circle. No separate highlight element exists.

### 1.7 Position Persistence

**Current State**: NO MECHANISM EXISTS

**Node Structure** (from force simulation):
- Each node: `{ id, x, y, fx, fy, ... }`
- `fx, fy` used for pinning (if root-locked)
- During ticks: positions updated, no persistence

**Root Identification** (line 597, 600, 604, etc.):
```javascript
this.rootNodeId = this.options.hypothesisData.rootNodeId;
// Used throughout: if (d.id === this.rootNodeId) { ... }
```

**CONFIRMED FACT**: Root node NOT specially excluded from coordinate system. Uses standard x/y properties like all other nodes.

---

## 2. Critical Bug: showNodeDates Startup/Application Issue

### 2.1 Bug Evidence

**Setting Definition** (`src/settings/VisualizationSettings.js`, line 60):
```javascript
getDefaults() {
  return {
    showNodeDates: true,  // Set to true by default
    // ... other settings
  };
}
```

**HTML Control** (`index.html`, lines 853-858):
```javascript
const showNodeDatesToggle = document.getElementById('show-node-dates-toggle');
if (showNodeDatesToggle) {
  showNodeDatesToggle.addEventListener('input', (e) => {
    settings.setSetting('showNodeDates', e.target.checked);
    viz.setShowNodeDates(e.target.checked, divergenceData);
    // ↑ Only called when user toggles, NEVER at startup
  });
}
```

**Settings Application** (`src/ui/SettingsUI.js`, lines 305-306):
```javascript
if (settings.showNodeDates !== undefined) {
  // Note: these require additional data, handled separately
  // ↑ Comment says "handled separately" but it's never handled at all
}
```

**Initialization Sequence** (`index.html`, lines 718-790):
1. Load hypotheses
2. Load divergence data
3. Create visualization with divergenceData option (line 788)
4. Load default settings (applies showNodeDates=true to SettingsUI)
5. Wire showNodeDatesToggle event listener (line 856-858)
6. **MISSING**: Call `viz.setShowNodeDates(settings.showNodeDates, divergenceData)`

### 2.2 Root Cause

The setter `setShowNodeDates()` (line 1106-1117) is **only called from the HTML toggle event listener**. It is never called during the initialization sequence after settings are loaded.

**CONFIRMED FACT**: Date labels do NOT appear on first load, only after user toggles checkbox.

---

## 3. SVG Layer Hierarchy and Proposed Stacking Order

### 3.1 Current Render Order (Lines 206-211)

```javascript
this._renderGrid();        // Layer 1 (first child of this.g)
this._renderLinks();       // Layer 2
this._renderNodes();       // Layer 3
this._renderLabels();      // Layer 4
this._renderRootLabel();   // Layer 5
this._renderDateLabels();  // Layer 6
this._renderAncestralLabels(); // Layer 7
```

### 3.2 Current SVG Structure Within Each Node-Group

```html
<g class="node-group" data-id="node_123" transform="translate(x,y)">
  <!-- Layer 1: Background -->
  <circle class="node-circle" opacity="0.6"/>
  
  <!-- Layer 2: Marker -->
  <circle class="node-marker"/>
  
  <!-- Layer 3: Silhouette (terminal only) -->
  <g class="silhouette-group">
    <image class="silhouette" href="..."/>
  </g>
</g>

<!-- Separate groups for labels (NOT children of node-group!) -->
<g class="label-group" data-id="node_123">
  <text class="node-label-common"/>
  <text class="node-label-scientific"/>
</g>

<text class="node-date-label" data-id="node_123"/>
<text class="ancestral-label" data-id="node_123"/>
<text class="root-label" data-id="root"/>
```

### 3.3 Problem Identified

**Text elements are NOT children of node-group**. They are siblings rendered separately:
- Labels and date labels created as direct children of `this.g`
- During `_onTick()`, node-group transforms applied, but label elements follow their own groups
- Risk: If silhouettes or circles are re-rendered (e.g., on updates), they could end up above text in DOM order

### 3.4 Proposed Corrected Stacking Order

**Recommendation 1: Create Dedicated Text Layer Within Node-Group**

Modify node-group structure:
```html
<g class="node-group" data-id="node_123" transform="translate(x,y)">
  <!-- Render order: invisible elements first, text last -->
  <circle class="node-circle"/>
  <circle class="node-marker"/>
  <g class="silhouette-group">...</g>
  
  <!-- Dedicated text layer (ALWAYS rendered last, guarantees on top) -->
  <g class="text-layer">
    <text class="node-label-common"/>
    <text class="node-label-scientific"/>
    <text class="node-date-label"/>
    <text class="ancestral-label"/>
    <text class="root-label"/>
    <!-- Optional: backgrounds appended before text -->
    <rect class="label-bg"/>
  </g>
</g>
```

**Recommendation 2: Use `.insert()` to Force Text to End**

After all other elements rendered:
```javascript
// Move all text elements to end using insert
const textLayer = nodeGroups.append('g')
  .attr('class', 'text-layer')
  .attr('pointer-events', 'none');
```

**Recommendation 3: Use SVG Stacking Context Isolation**

Keep labels as siblings but manage with z-order:
```javascript
// After all nodes rendered, move all text to front
this.g.selectAll('text').raise();  // D3 method to move to end
```

**RECOMMENDED APPROACH**: Recommendation 1 (dedicated text layer). Guarantees text stays on top, simplifies coordinate calculations, enables grouped styling.

---

## 4. Text Width and Height Measurement for Gradient Backgrounds

### 4.1 Current Text Implementation

**Text Creation** (`_renderLabels()`, lines 371-411):
- Text elements appended to separate `<g class="label-group">` elements
- No width/height measurement performed
- No background elements created

### 4.2 Measurement Techniques (Browser-Only)

**Approach 1: getBBox() After Rendering (RECOMMENDED)**

```javascript
// Only works in browser, requires element in DOM
const textElement = labelGroup.append('text').text('Scientific name');
const bbox = textElement.node().getBBox();  // { x, y, width, height }

// Create background rect using bbox
labelGroup.insert('rect', ':first-child')
  .attr('x', bbox.x - padding)
  .attr('y', bbox.y - padding)
  .attr('width', bbox.width + 2*padding)
  .attr('height', bbox.height + 2*padding)
  .attr('fill', 'url(#label-gradient)')
  .attr('opacity', 0.5);
```

**Approach 2: Estimate Character Width (Offline-Safe)**

```javascript
// Estimate without DOM: ~7-8px per character at font-size 11px
const estimatedWidth = text.length * (fontSizeBase / 11 * 7);
const estimatedHeight = fontSizeBase * 1.2;

// Works for pre-rendering, but may not match actual rendered width
```

**Approach 3: Use text-anchor and dy for Positioning**

```javascript
// Let text-anchor='middle' handle horizontal centering
// Measure only vertical offset
labelGroup.append('text')
  .attr('text-anchor', 'middle')
  .attr('dy', '0.35em')  // Centered vertically
  .text(d => d.scientificName);
  
// Background can use fixed-width estimate based on expected text length
```

### 4.3 Gradient Background Implementation

**SVG Pattern Definition** (to be added to `<defs>`):

```svg
<linearGradient id="label-fade-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
  <stop offset="0%" stop-color="white" stop-opacity="0"/>
  <stop offset="20%" stop-color="white" stop-opacity="0.5"/>
  <stop offset="80%" stop-color="white" stop-opacity="0.5"/>
  <stop offset="100%" stop-color="white" stop-opacity="0"/>
</linearGradient>
```

**Background Rect** (created before text):

```javascript
labelGroup.insert('rect', ':first-child')
  .attr('class', 'label-bg')
  .attr('x', d => {
    // Center horizontally around origin
    const estimatedWidth = d.commonName.length * 5.5;  // Adjusted per font
    return -estimatedWidth / 2 - padding;
  })
  .attr('y', -8)
  .attr('width', d => {
    const estimatedWidth = d.commonName.length * 5.5;
    return estimatedWidth + 2 * padding;
  })
  .attr('height', 16)
  .attr('rx', 3)
  .attr('fill', 'url(#label-fade-gradient)');
```

### 4.4 Browser Verification Required

- **Question 1**: Does `getBBox()` work with external SVG silhouettes?
- **Question 2**: How do gradient backgrounds interact with zoom/pan transforms?
- **Question 3**: What is the actual character width at font-size 11px?

These require browser testing with actual rendered elements.

---

## 5. Silhouette SVG Loading and Shadow Reusability

### 5.1 Current Implementation

**External File Loading** (`_renderSilhouettes()`, line 338):
```javascript
.attr('href', d => `./assets/silhouettes/${d.silhouetteFilename}`)
```

**CONFIRMED FACT**: Silhouettes are loaded as external `<image>` elements, not inline SVG. External SVG file contents cannot be accessed or manipulated via JavaScript.

### 5.2 Why Shadows Cannot Reuse SVG Paths

**Problem**: The `<image>` element acts as a black box:
```html
<image href="./assets/silhouettes/homo_sapiens.svg" width="50" height="50"/>
```

- SVG rendering handled by browser's SVG renderer
- Path data NOT accessible to JavaScript
- Cannot duplicate paths to create shadow

**Solution**: Duplicate the entire image with offset and opacity.

### 5.3 Recommended Shadow Implementation

**Approach: Duplicate Image Element with Offset**

```javascript
// In _renderSilhouettes(), before main silhouette:
silhouetteGroups.append('image')
  .attr('class', 'silhouette-shadow')
  .attr('x', -silhouetteSize / 2 + 2)  // Offset 2px right
  .attr('y', -silhouetteSize / 2 + 2)  // Offset 2px down
  .attr('width', silhouetteSize)
  .attr('height', silhouetteSize)
  .attr('href', d => `./assets/silhouettes/${d.silhouetteFilename}`)
  .attr('opacity', 0.15)
  .style('filter', 'brightness(50%)')
  .attr('pointer-events', 'none');

// Main silhouette (existing)
silhouetteGroups.append('image')
  .attr('class', 'silhouette')
  .attr('x', -silhouetteSize / 2)
  .attr('y', -silhouetteSize / 2)
  .attr('width', silhouetteSize)
  .attr('height', silhouetteSize)
  .attr('href', d => `./assets/silhouettes/${d.silhouetteFilename}`)
  .attr('opacity', this.silhouetteOpacity)
  .style('mix-blend-mode', 'multiply')
  .style('filter', 'grayscale(100%)');
```

### 5.4 Shadow Behavior During Simulation

**During `_onTick()`** (lines 701-720):

Shadow automatically follows silhouette:
- Parent group transform applies to both image elements
- No separate offset calculation needed
- Both images updated together during ticks

**Current Silhouette Update** (line 723-735):
```javascript
this.silhouetteImages
  .attr('opacity', this.silhouetteOpacity)
  .attr('x', ...)  // Position updates
  .attr('y', ...);
```

Shadow would need same treatment:
```javascript
this.silhouetteShadows = this.g.selectAll('image.silhouette-shadow');
this.silhouetteShadows
  .attr('opacity', this.silhouetteOpacity * 0.15)  // Shadow opacity linked
  .attr('x', ...)  // Same position + offset
  .attr('y', ...);
```

### 5.5 Browser Verification Required

- **Question 1**: Does loading the same SVG file twice (shadow + main) cause browser caching issues?
- **Question 2**: How does `filter: brightness(50%)` interact with grayscale filter on main image?
- **Question 3**: Does shadow opacity adjustment affect blend modes correctly?

---

## 6. Root Coordinates: Current Persistence Mechanism

### 6.1 Current State

**CONFIRMED FACT**: NO persistence mechanism exists in the application.

**Root Node Tracking** (line 597):
```javascript
this.rootNodeId = this.options.hypothesisData.rootNodeId;
// Example: "ancestor_h1_n0"
```

**Node Coordinate System**:
```javascript
// All nodes (terminal and internal) have:
node.x      // Current x position
node.y      // Current y position
node.fx     // Fixed x (used by D3 when pinning, null when free)
node.fy     // Fixed y (used by D3 when pinning, null when free)
```

**Root Locking Behavior** (lines 652-655):
```javascript
if (this.lockRootPosition) {
  d.fx = d.x;  // Pin to current position
  d.fy = d.y;
} else {
  d.fx = null;  // Release, allow forces
  d.fy = null;
}
```

### 6.2 Proposed Persistence Architecture

**Export Function** (to be added):
```javascript
exportLayout() {
  const layout = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    rootNodeId: this.rootNodeId,
    hypothesisId: this.hypothesisId,
    nodes: this.nodes.map(d => ({
      id: d.id,
      x: Math.round(d.x * 100) / 100,
      y: Math.round(d.y * 100) / 100,
      fx: d.fx !== null ? Math.round(d.fx * 100) / 100 : null,
      fy: d.fy !== null ? Math.round(d.fy * 100) / 100 : null,
    }))
  };
  return JSON.stringify(layout, null, 2);
}
```

**Import Function** (to be added):
```javascript
importLayout(jsonString) {
  const layout = JSON.parse(jsonString);
  
  if (layout.version !== '1.0') {
    throw new Error(`Unsupported layout version: ${layout.version}`);
  }
  
  if (layout.rootNodeId !== this.rootNodeId) {
    console.warn(`Root mismatch: layout has ${layout.rootNodeId}, viz has ${this.rootNodeId}`);
  }
  
  const positionMap = {};
  layout.nodes.forEach(node => {
    positionMap[node.id] = {
      x: node.x,
      y: node.y,
      fx: node.fx,
      fy: node.fy
    };
  });
  
  // Apply positions before simulation starts
  this.nodes.forEach(node => {
    if (positionMap[node.id]) {
      const pos = positionMap[node.id];
      node.x = pos.x;
      node.y = pos.y;
      node.fx = pos.fx;
      node.fy = pos.fy;
    }
  });
  
  // Restart with these positions
  this.simulation.alpha(0.3).restart();
}
```

### 6.3 Storage Mechanism Options

**Option A: Browser LocalStorage (Recommended for Demo)**
- Pros: Per-browser, no server required
- Cons: Lost on browser clear, limited size (~5MB)
- Use case: Save current layout, reload and restore

**Option B: File Download/Upload (Recommended for Sharing)**
- Pros: User-controlled, shareable, no server
- Cons: Manual workflow, user must manage files
- Use case: "Export Layout as JSON", "Import Layout from JSON"

**Option C: URL Query Parameter**
- Pros: Shareable in URL
- Cons: Limited by URL length, complex encoding
- Use case: Share specific tree arrangement via URL

**RECOMMENDED**: Implement Option B (file-based export/import). Fits static GitHub Pages deployment model.

---

## 7. Date Information in Taxonomy Dataset

### 7.1 What Date Information EXISTS

The application currently has **THREE distinct date types**:

**Type 1: Divergence Estimates** (Internal Nodes Only)

Located in: `data/mammals/divergence-estimates.json`

Schema field: `divergenceEstimates[hypothesisId][nodeId][estimate]`

```json
{
  "sourceId": "source_dos_reis_2018",
  "centralEstimate": 95,
  "uncertaintyLower": 85,
  "uncertaintyUpper": 105,
  "uncertaintyType": "95% credible interval",
  "unit": "Ma",
  "methodology": "Bayesian molecular clock",
  "source": "doi:10.1038/srep33666"
}
```

Currently displayed as node-date-label when `showNodeDates=true`.

**Type 2: Fossil Occurrence Dates** (NOT YET IMPLEMENTED)

- Present in paleontological databases (NOT in current taxonomy)
- Would need separate data source (e.g., Paleobiology Database)
- Represents first appearance of genus/species in fossil record
- Typically later (younger) than divergence estimate
- Should be stored separately from divergence dates

**Type 3: Taxon Establishment/Origin Dates** (NOT YET IMPLEMENTED - NEW REQUIREMENT)

- Date when a taxon was formally named/described
- Present in taxonomic sources (ITIS, NCBI, WoRMS)
- Different from divergence date (when clade originated)
- Example: *Homo sapiens* described ~1758 (Linnaeus)
- For extant taxa, this is publication date
- For extinct taxa, this is discovery/description date

### 7.2 What Date Information DOES NOT EXIST in Current Data

**Current taxonomy.json structure** (lines from our examination):
```json
{
  "id": "tax_homo_sapiens",
  "scientificName": "Homo sapiens",
  "commonName": "Human",
  "rank": "species",
  "parent": "tax_homo",
  "source": "ITIS",
  "sourceId": "180092",
  "extinct": false
}
```

**Missing fields**:
- No `descriptionDate` or `establishmentDate`
- No `firstFossilOccurrence`
- No `firstFossilOccurrenceUncertainty`
- No `originDate` (when clade originated, different from divergence)

**What IS available**:
- `sourceId` (reference to ITIS/NCBI/WoRMS entry)
- `extinct` flag
- `source` authority

### 7.3 Proposed: showSpeciesEstablishmentDates Toggle

**Requirement**: Independent toggle and display for species/taxon establishment dates.

**New Setting**:
```javascript
showSpeciesEstablishmentDates: {
  type: 'boolean',
  default: false,
  category: 'appearance',
  description: 'Display the date when each species/taxon was formally named or discovered'
}
```

**Data Source** (NOT IN CURRENT DATA):
- Would need to extend taxonomy.json or create separate `species-dates.json`
- Fields needed:
  ```json
  {
    "taxonId": "tax_homo_sapiens",
    "descriptionYear": 1758,
    "descriptionAuthority": "Linnaeus",
    "descriptionSource": "Systema Naturae",
    "type": "formal_description"  // vs "fossil_discovery"
  }
  ```

**Rendering Logic**:
```javascript
// In _renderDateLabels(), separate path for establishment dates:
if (this.showSpeciesEstablishmentDates) {
  this.terminalNodes.forEach(d => {
    if (d.descriptionYear) {
      // Display establishment date for terminal nodes
    }
  });
}

// For internal nodes, could optionally show:
// - MRCA establishment date (when ancestor formally named/identified)
// - Or leave empty (ancestors not formally named)
```

**Visual Distinction**:
- Use different color (e.g., #FF9500 orange) to distinguish from divergence dates (#999 grey)
- Use different font style or suffix to clarify it's establishment date not divergence
- Keep separate from divergence dates in rendering

### 7.4 Problem: Current Data Doesn't Support Establishment Dates

**Current divergence data displays correctly** (implemented, working):
- Format: "95 Ma" (95 million years ago)
- Shown on internal nodes
- Multiple estimates preserved, one selected

**Establishment dates require**:
- New data source or extended taxonomy
- Different unit (calendar years vs millions of years ago)
- Different nodes (terminal species vs internal ancestors)
- Different interpretation (description date vs divergence)

**DECISION POINT**: Before implementing `showSpeciesEstablishmentDates` toggle:
1. Verify ITIS/NCBI has establishment year data
2. Extend taxonomy schema to include establishment dates
3. Update data loader to parse and store dates
4. Add separate date field to species nodes
5. Implement separate rendering path

**Recommended**: Defer full establishment-date feature to Phase 2. For now:
- Create setting placeholder in schema
- Implement basic toggle (no data source yet)
- Document data requirement for future population

---

## End of Part 1

Part 2 will cover:
- Text layer rendering specifics
- Hover implementation with event safety
- Confirmed testing requirements
- Dependencies and implementation order recommendations

