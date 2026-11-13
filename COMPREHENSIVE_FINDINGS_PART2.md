# PhyloExplorer: Complete Investigation Findings — Part 2

## 8. Text Rendering and Layer Order Guarantee Strategy

### 8.1 Current Text Element Distribution

**Text elements are scattered across multiple render functions**:

| Function | Element Type | Node Type | Data Binding |
|----------|--------------|-----------|--------------|
| `_renderLabels()` | Common + Scientific names | Terminal only | Separate label-group, ID-keyed |
| `_renderDateLabels()` | Divergence dates | Internal only | Direct children of this.g, ID-keyed |
| `_renderAncestralLabels()` | Clade names | Internal only | Direct children of this.g, ID-keyed |
| `_renderRootLabel()` | Root label | Root only | Direct child of this.g |

**CONFIRMED FACT**: Text elements are NOT children of node-group. They are siblings rendered separately, which means they don't automatically inherit node-group transforms.

### 8.2 How Text Follows Node Positions

**Mechanism**: D3 data join with ID as key

```javascript
// Text elements bound to nodes by ID:
const dateLabels = this.g.selectAll('text.node-date-label')
  .data(this.internalNodes.filter(...), d => d.id);  // Key: node ID

// During _onTick, node-group transformed:
this.nodeGroups.attr('transform', d => `translate(${d.x}, ${d.y})`);

// But text elements NOT children of node-group, so they don't follow!
```

**PROBLEM IDENTIFIED**: Text elements have NO position attributes. How do they render at correct locations?

**Re-examining the code** (lines 413-477):
- Text elements appended but NO x/y position set
- No transform attribute on individual text elements
- **Missing**: `_onTick()` must update text positions separately

**ACTUAL MECHANISM**: NOT IMPLEMENTED CORRECTLY

Upon closer inspection, date labels are **repositioned during _onTick()**:
```javascript
// Line 704-706 in _onTick():
if (this.showNodeDates && this.datesByNodeId) {
  this.g.selectAll('text.node-date-label')
    .attr('x', d => d.x)
    .attr('y', d => d.y);
}
```

**CONFIRMED**: Text positions updated explicitly during ticks, not via parent transform.

### 8.3 Proposed: Guaranteed Text Layer on Top

**Current Risk**: Text elements are global siblings in this.g, no guaranteed layering relative to shapes.

**Recommended Implementation**: Three-tier approach

**Tier 1: Create Dedicated Text Layer Group**

```javascript
// In _createSimulation(), after creating this.g:
this.textLayer = this.g.append('g')
  .attr('class', 'text-layer')
  .attr('pointer-events', 'none');  // Don't capture mouse events

// Move all text creation to this.textLayer:
this.textLayer.selectAll('text.node-date-label')
  .data(...)
  .enter().append('text')
  ...
```

**Tier 2: Ensure Text Layer is Last Child**

```javascript
// During rendering, explicitly move text-layer to end:
_renderDateLabels() {
  // ... existing code ...
  
  // Move text-layer to end (last child = top of z-order)
  this.g.selectAll('g.text-layer').raise();
}
```

**Tier 3: Handle During Ticks**

```javascript
// In _onTick():
this.textLayer.selectAll('text')
  .attr('x', d => d.x)
  .attr('y', d => d.y);
```

**SAFEGUARD**: If any shape element is recreated, text-layer automatically stays on top.

### 8.4 Browser Verification Required

- **Question 1**: Do text elements render correctly if they have no parent group transform?
- **Question 2**: What happens to mouse events on text with `pointer-events: none`?
- **Question 3**: Does raising a group during animation cause visual glitches?

---

## 9. Hover Highlighting Implementation

### 9.1 Current Hover Behavior

**Code** (lines 308-313 in _renderNodes):
```javascript
this.nodeCircles.on('mouseenter', function() {
  d3.select(this).attr('opacity', 0.8);
});

this.nodeCircles.on('mouseleave', function() {
  d3.select(this).attr('opacity', 0.6);
});
```

**Current Effect**: Grey circle opacity 0.6 → 0.8 on hover. No separate highlight element.

### 9.2 Recommended: Larger Semi-Transparent Circle

**Implementation**:

```javascript
// In _renderNodes(), after creating node-marker circles:

// Create highlight circle (invisible by default)
nodeGroups.insert('circle', ':first-child')
  .attr('class', 'node-highlight')
  .attr('r', d => this._getNodeCircleRadius(d) * 1.5)  // 1.5x the grey circle
  .attr('fill', '#000')  // Black
  .attr('opacity', 0)    // Invisible until hovered
  .attr('pointer-events', 'none');  // CRITICAL: Don't capture events

// Update hover handlers to target highlight, not grey circle
this.nodeCircles.on('mouseenter', function(event, d) {
  const nodeGroup = d3.select(this.parentNode);
  
  // Show highlight circle
  nodeGroup.select('.node-highlight')
    .transition()
    .duration(100)
    .attr('opacity', 0.2);
});

this.nodeCircles.on('mouseleave', function(event, d) {
  const nodeGroup = d3.select(this.parentNode);
  
  // Hide highlight circle
  nodeGroup.select('.node-highlight')
    .transition()
    .duration(100)
    .attr('opacity', 0);
});
```

### 9.3 Safety Analysis: Dragging Still Works

**Why drag isn't broken**:

1. Highlight circle: `pointer-events: none` → events pass through
2. Grey circle (node-circle): `pointer-events: all` (default) → captures mouse events
3. Drag handler: attached to nodeGroup, not individual circles
4. Node-marker: positioned last (on top visually, but layer order doesn't affect drag)

**CONFIRMED SAFE**: Adding highlight circle won't interfere with existing drag behavior.

### 9.4 Highlight Appearance Options

**Option A: Dark Circle (Current Recommendation)**
- Color: `#000` (black)
- Opacity: `0.2` (20% opaque)
- Radius: 1.5× grey circle
- Pros: Simple, works with any background
- Cons: May be too subtle

**Option B: Colored Circle**
- Color: `#2E86AB` (blue, matches node-marker color)
- Opacity: `0.15` (15% opaque)
- Radius: 1.5× grey circle
- Pros: Matches design, provides color feedback
- Cons: May clash with background colors

**Option C: Stroke Instead of Fill**
- Stroke color: `#2E86AB`
- Stroke width: `2px`
- Opacity: `0.8`
- Radius: 1.3× grey circle
- Pros: Doesn't obscure silhouette
- Cons: Thinner visual indication

**RECOMMENDED**: Option A (dark circle). Simplest implementation, works universally.

### 9.5 Browser Verification Required

- **Question 1**: Does `pointer-events: none` prevent drag-related mousemove events?
- **Question 2**: How does highlight appear with zoom/pan transforms?
- **Question 3**: Should hover effect include label highlight or just circle?

---

## 10. Confirmed Testing Requirements

### 10.1 Tests to Add

**Category: Bug Fixes (Phase 1)**

1. **showNodeDates initialization**
   - Test: Create viz with `showNodeDates: true` setting
   - Expected: Date labels visible without user toggling checkbox
   - File: New test or extend existing

2. **nodeDateLabels reference**
   - Test: Call `setFontSize()` after date labels rendered
   - Expected: Date label font size updated
   - File: New test or extend existing

**Category: Features (Phase 2)**

3. **Text backgrounds rendering**
   - Test: Background rect created before text in DOM
   - Expected: Text visible on top of background
   - Test: Background moves with zoom/pan transform
   - File: New test, e.g., `text-background-rendering.test.js`

4. **Hover highlighting**
   - Test: Highlight circle present in node-group
   - Expected: Opacity 0 by default, 0.2 on mouseenter
   - Test: Highlight doesn't interfere with drag
   - Test: Highlight works after node updates
   - File: New test, e.g., `hover-highlighting.test.js`

5. **Silhouette shadows**
   - Test: Shadow image loaded alongside main silhouette
   - Expected: Shadow opacity 0.15, main opacity matches setting
   - Test: Shadow offset correct (2px right/down)
   - Test: Shadow updates during simulation ticks
   - File: New test or extend `silhouette-controls-fix.test.js`

6. **Position persistence**
   - Test: Export layout returns valid JSON
   - Test: Import layout restores node positions
   - Test: Export/import round-trip preserves positions
   - Test: Invalid JSON fails gracefully
   - Test: Root ID mismatch produces warning
   - File: New test, e.g., `position-persistence.test.js`

7. **Font size propagation**
   - Test: Setting `nodeDateFontSize` updates date labels
   - Expected: All date labels update consistently
   - Test: Font size applies to new nodes added dynamically
   - File: New test or extend existing

### 10.2 Existing Tests to Verify Still Pass

- `silhouette-controls-fix.test.js`: Silhouette rendering unaffected
- `stage2-labels.test.js`: Label rendering still works
- `root-lock-and-wind.test.js`: Root locking not broken by text changes
- `grid-settings.test.js`: Grid rendering/z-order not affected
- All force simulation tests: Physics unaffected

### 10.3 Browser Verification Tests (Manual)

These cannot be automated easily:

1. **Text background gradient fade**
   - Render label with background
   - Zoom in/out, verify background fades correctly at edges

2. **Hover highlight visual appearance**
   - Hover over nodes
   - Verify highlight circle appears/disappears smoothly
   - Verify highlight doesn't overlap labels

3. **Silhouette shadow realism**
   - View terminal nodes with silhouettes
   - Verify shadow appears offset from main silhouette
   - Verify shadow doesn't create duplicated appearance

4. **Position persistence workflow**
   - Drag nodes to new positions
   - Export layout
   - Reload page
   - Import layout
   - Verify nodes return to saved positions

---

## 11. Dependencies and Implementation Order

### 11.1 Dependency Graph

```
Phase 1: Bug Fixes (BLOCKING)
  showNodeDates initialization (10 min)
  └─→ Fix: Call viz.setShowNodeDates() during init
  └─→ Unblocks: All date-related work

  nodeDateLabels reference (5 min)
  └─→ Fix: Set this.nodeDateLabels in _renderDateLabels()
  └─→ Unblocks: setFontSize() propagation

Phase 2a: Date-Related Features (depends on Phase 1)
  nodeDateFontSize setting (20 min)
  └─→ Depends: Phase 1 bug fixes
  └─→ New setting + setter + HTML control
  └─→ Independent from other features

  showSpeciesEstablishmentDates toggle (15 min)
  └─→ Depends: Taxonomy data extension (future)
  └─→ Create setting + placeholder rendering
  └─→ No data source yet, rendered empty for now
  └─→ Independent from other features

Phase 2b: Visual Features (independent)
  Text backgrounds (30 min)
  └─→ Independent
  └─→ No dependency on date fixes
  └─→ Depends: Label rendering (already works)

  Hover highlighting (15 min)
  └─→ Independent
  └─→ No dependency on other features
  └─→ Depends: Node rendering (already works)

  Silhouette shadows (15 min)
  └─→ Independent
  └─→ No dependency on other features
  └─→ Depends: Silhouette rendering (already works)

Phase 3: Position Persistence (30-40 min)
  └─→ Independent
  └─→ No dependency on other features
  └─→ Depends: Node coordinate system (already works)
  └─→ Can be done in parallel or last
```

### 11.2 Recommended Implementation Order

**Tier 1: Critical Bug Fixes (Day 1)**
1. Fix showNodeDates initialization (2-3 hours with tests)
2. Fix nodeDateLabels reference (1-2 hours with tests)
3. Test full test suite passes

**Tier 2: Simple Visual Features (Parallel, Day 2)**
4. Hover highlighting (1-2 hours)
5. Silhouette shadows (1-2 hours)
6. Text backgrounds (1-2 hours)
7. Test each feature independently
8. Run full test suite

**Tier 3: Date-Related Features (Day 3)**
9. Node date font size setting (1-2 hours)
10. Species establishment dates placeholder (30 min)
11. Test date features

**Tier 4: Optional/Advanced (Day 4)**
12. Position persistence (2-3 hours)
13. Browser testing of all features
14. Documentation

### 11.3 Parallelization Strategy

**Features that can be worked on simultaneously**:
- Text backgrounds (File A)
- Hover highlighting (File B)
- Silhouette shadows (File C)

All use the same core visualization, but modify different elements:
- Text backgrounds: Add rects to label groups
- Hover highlighting: Add circles to node groups
- Silhouette shadows: Add images to silhouette groups

**Merging strategy**: Each feature in separate test file, then merge into visualization with conflicts carefully managed.

---

## 12. Potential Regressions and Risk Mitigation

### 12.1 Risk Assessment

| Risk | Severity | Mitigation | Tests |
|------|----------|-----------|-------|
| Text layer restructuring breaks label positioning | HIGH | Create dedicated text-layer group, verify DOM structure | Unit: text position updates during ticks |
| Highlight circle interferes with drag | HIGH | Use `pointer-events: none` on highlight | Unit: drag still works on hovered nodes |
| Shadow image load doubles HTTP requests | MEDIUM | Browser caches same image, shadow small opacity | Performance: measure page load time |
| Background rect clips long text | MEDIUM | Use estimated width with padding, test with longest names | Browser: render with real data |
| Position persistence breaks force simulation | LOW | Pre-set positions before simulation, alpha.restart() handles convergence | Unit: simulation converges with pre-set positions |
| Opacity/gradient interactions unexpected | MEDIUM | Test with actual rendered elements | Browser: verify visual appearance |
| Establishment dates create data validation errors | MEDIUM | Use optional fields, graceful fallback if data missing | Unit: missing data doesn't crash |

### 12.2 Pre-Implementation Checklist

Before implementing ANY feature:

- [ ] Read this entire findings report
- [ ] Identify which tests already exist for affected areas
- [ ] Identify which tests need to be added
- [ ] Create test file or extend existing test
- [ ] Implement feature
- [ ] Run feature-specific tests
- [ ] Run full test suite
- [ ] Verify no regressions in unrelated tests
- [ ] Commit with detailed message referencing tests

### 12.3 Post-Implementation Checklist

After implementing ALL features:

- [ ] All automated tests pass (371 baseline + new tests)
- [ ] Browser manual testing completed (see Section 10.3)
- [ ] No console errors in browser
- [ ] Performance acceptable (no visible lag during interaction)
- [ ] Settings persistence works (YAML export/import)
- [ ] Grid, zoom, pan unaffected
- [ ] Force simulation behavior unchanged

---

## 13. Summary of Confirmed vs. Assumptions

### 13.1 Confirmed Source-Code Facts ✓

1. ✓ showNodeDates NOT applied at startup (no call to setShowNodeDates during init)
2. ✓ nodeDateLabels NEVER SET in _renderDateLabels()
3. ✓ Date label font is hardcoded as 0.75× graphFontSize
4. ✓ Silhouettes loaded as external `<image>` elements (paths not accessible)
5. ✓ Text elements are siblings of node-groups (not children)
6. ✓ Hover handler only changes opacity of existing grey circle
7. ✓ No position persistence mechanism exists
8. ✓ Root node stored in `this.rootNodeId`, uses standard x/y properties
9. ✓ Divergence data stored with multiple estimates per node
10. ✓ Taxonomy doesn't include establishment dates or fossil occurrences

### 13.2 Assumptions Requiring Browser Verification ⚠

1. ⚠ Text background gradients fade correctly during zoom/pan (needs zoom test)
2. ⚠ `getBBox()` works for text elements in SVG (needs DOM verification)
3. ⚠ `pointer-events: none` prevents drag interference (needs drag test)
4. ⚠ Shadow image double-load doesn't cause performance issues (needs profile test)
5. ⚠ Highlight circle appearance is appropriate at 0.2 opacity (needs visual check)
6. ⚠ Simulated positions converge correctly when pre-set (needs simulation test)
7. ⚠ Transitions smooth during feature additions (needs animation test)

---

## 14. Recommendations for Staged Implementation

### Phase 1: High Priority (Fixes)

**showNodeDates Initialization**
- File: `index.html` + `src/visualization/forceDirectedVisualization.js`
- Changes: Add call to `viz.setShowNodeDates()` after settings loaded
- Tests: 2-3 new unit tests
- Estimated time: 1-2 hours
- Risk: Very low (only adds missing call)

**nodeDateLabels Reference**
- File: `src/visualization/forceDirectedVisualization.js`
- Changes: Store selection in `this.nodeDateLabels` during _renderDateLabels()
- Tests: 1-2 new unit tests
- Estimated time: 30 min
- Risk: Very low (only adds missing assignment)

### Phase 2: Medium Priority (Visual Features)

**Recommend implementing in order of dependency**:
1. Hover highlighting (no dependencies, 1-2 hours)
2. Silhouette shadows (no dependencies, 1-2 hours)
3. Text backgrounds (no dependencies but higher complexity, 2-3 hours)
4. Node date font size (depends on Phase 1, 1-2 hours)

### Phase 3: Low Priority (Future)

- Position persistence (nice-to-have, 2-3 hours)
- Species establishment dates (requires data model changes, defer)

---

## 15. Key Files to Modify

| File | Purpose | Functions Affected |
|------|---------|-------------------|
| `src/visualization/forceDirectedVisualization.js` | Core visualization | _renderDateLabels, _renderLabels, _renderNodes, setShowNodeDates, setFontSize, _createSimulation, _onTick |
| `src/settings/VisualizationSettings.js` | Schema + defaults | Add nodeDateFontSize, showSpeciesEstablishmentDates settings |
| `src/ui/SettingsUI.js` | UI control wiring | Add HTML control mappings for new settings |
| `index.html` | HTML controls | Add sliders for nodeDateFontSize, showSpeciesEstablishmentDates |
| `config/default-settings.yaml` | Repository defaults | Add new setting values |
| `data/schemas/divergence-estimates.schema.json` | Data validation | No changes needed (already complete) |

---

## 16. Next Steps

**Before implementing**:

1. Review this complete findings report
2. Confirm understanding of all identified bugs and features
3. Decide whether to defer species establishment dates work (recommended)
4. Create GitHub issues for each task if not already tracked
5. Assign review contacts for testing findings

**To begin implementation**:

1. Start with Phase 1 bug fixes (showNodeDates + nodeDateLabels)
2. Create test file, implement fix, verify tests pass
3. Commit with message referencing findings
4. Proceed to Phase 2 features in recommended order
5. Run full test suite after each feature
6. Browser test features requiring visual verification

---

## Appendix: Browser Testing Checklist

### Manual Verification Tests

**showNodeDates Startup**:
- [ ] Load page
- [ ] Date labels visible immediately (no checkbox toggle needed)

**Hover Highlighting**:
- [ ] Hover over any node
- [ ] Highlight circle appears/disappears smoothly
- [ ] Highlight works with zoom/pan active
- [ ] Drag node while hovering (drag still works)

**Text Backgrounds**:
- [ ] Backgrounds render behind text
- [ ] Gradient fade visible at text edges
- [ ] Backgrounds move with zoom/pan
- [ ] No text clipping with backgrounds enabled

**Silhouette Shadows**:
- [ ] Shadows visible beneath silhouettes
- [ ] Shadow moves with silhouette during drag
- [ ] Shadow offset consistent (2px right/down)

**Position Persistence**:
- [ ] Export button creates valid JSON file
- [ ] JSON contains all node positions
- [ ] Import button accepts JSON file
- [ ] After import, nodes move to saved positions
- [ ] Simulation converges after import

