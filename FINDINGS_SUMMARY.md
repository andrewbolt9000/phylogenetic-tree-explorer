# PhyloExplorer: Investigation Findings — Executive Summary

## Complete Investigation Delivered

Two comprehensive documents have been created containing all findings from the pre-implementation investigation:

1. **COMPREHENSIVE_FINDINGS_PART1.md** (25 KB)
   - Files and functions responsible for rendering
   - Critical bugs discovered and confirmed
   - SVG layer hierarchy and proposed fixes
   - Text measurement techniques
   - Silhouette loading and shadow implementation
   - Position persistence architecture
   - Detailed analysis of date information in datasets

2. **COMPREHENSIVE_FINDINGS_PART2.md** (19 KB)
   - Text rendering and layer order guarantee strategy
   - Hover highlighting implementation details
   - Complete testing requirements
   - Dependencies between features
   - Risk assessment and mitigation
   - Implementation order recommendations
   - Browser verification checklist

---

## Key Findings Summary

### Confirmed Critical Bugs (Phase 1 — Must Fix First)

| Bug | Severity | Location | Root Cause | Fix |
|-----|----------|----------|-----------|-----|
| showNodeDates not applied at startup | CRITICAL | index.html init sequence | No call to viz.setShowNodeDates() during initialization | Call setter after settings loaded |
| nodeDateLabels reference never set | CRITICAL | _renderDateLabels() line 414 | this.nodeDateLabels initialized to null, never populated | Store D3 selection during render |
| Date label font not independent | MEDIUM | _renderDateLabels() line 416 | Font hardcoded as 0.75× graphFontSize | Add nodeDateFontSize setting |

### Date Information Available in Current Dataset

**Type 1: Divergence Estimates** ✓ Implemented
- Central estimates + uncertainty ranges
- Multiple sources per node preserved
- Currently displayed when showNodeDates=true

**Type 2: Fossil Occurrence Dates** ✗ Not available
- Would require separate data source
- Not in current taxonomy or divergence data
- Future feature: add Paleobiology Database integration

**Type 3: Species Establishment Dates** ✗ Data not loaded
- Publication/description date for species
- Currently NOT in taxonomy.json
- Requires schema extension: add `descriptionYear`, `descriptionAuthority`
- Separate from divergence dates (when clade originated)

### New Requirement: showSpeciesEstablishmentDates Toggle

**Status**: Deferred pending data model changes

**What's needed**:
1. Extend taxonomy schema to include `descriptionYear`, `descriptionAuthority`
2. Populate field for all species from ITIS/NCBI/WoRMS
3. Create separate render path (different units: years vs Ma)
4. Display on terminal nodes (species), not internal ancestors

**Timeline**: Post Phase 1. Can create placeholder setting now, populate data later.

---

## Staged Implementation Path

### Phase 1: Critical Bug Fixes (1-2 hours)
- [x] showNodeDates initialization
- [x] nodeDateLabels reference
- **Status**: Ready to implement, no blockers
- **Risk**: Very low

### Phase 2: Visual Features (Parallelizable, 4-6 hours)
- [ ] Hover highlighting (independent)
- [ ] Silhouette shadows (independent)
- [ ] Text backgrounds (independent)
- [ ] Node date font size (depends on Phase 1)
- **Status**: All ready, can work in parallel
- **Risk**: Low-medium (requires browser verification)

### Phase 3: Optional Features (2-3 hours)
- [ ] Position persistence (independent)
- [ ] Species establishment dates (data model changes needed)
- **Status**: Recommended to defer establishment dates
- **Risk**: Medium-low

---

## Files to Modify

| File | Changes | Complexity |
|------|---------|-----------|
| index.html | Add init call; add new HTML controls | Low |
| src/visualization/forceDirectedVisualization.js | 6 methods; add reference store; new setters | Medium |
| src/settings/VisualizationSettings.js | Add 2 new settings to schema | Low |
| src/ui/SettingsUI.js | Add control mappings | Low |
| config/default-settings.yaml | Add 2 new settings | Low |

---

## Critical Architectural Insights

1. **SVG Structure Issue**
   - Text elements are siblings of node-groups, not children
   - Text positions updated separately during ticks
   - Risk: Text may not stay on top if shapes recreated
   - Solution: Create dedicated text-layer group as last child

2. **Silhouette Limitation**
   - External `<image>` elements can't expose SVG paths
   - Solution: Duplicate entire image for shadows, not reuse paths

3. **Date Types Are Distinct**
   - Divergence estimates: when clade split (internal nodes, Ma)
   - Establishment dates: when species formally named (terminal nodes, years)
   - Fossil dates: first fossil appearance (optional, future)
   - Must keep separate in schema and rendering

4. **Position Persistence Not Implemented**
   - Need export/import mechanism
   - Fits static GitHub Pages model if using files
   - Pre-set positions before simulation, then simulate naturally

---

## Browser Verification Required

These assumptions can only be verified by testing in browser:

1. Text background gradients fade correctly during zoom/pan
2. `getBBox()` works for measuring text dimensions
3. `pointer-events: none` prevents drag interference
4. Shadow image double-load doesn't cause performance issues
5. Highlight circle opacity 0.2 is visually appropriate
6. Simulated positions converge correctly when pre-set
7. Transitions smooth during feature additions

---

## Recommendation: Deferred Work

**Defer to Phase 2 or later**:
- Full species establishment dates feature (data model incomplete)
- Position persistence (nice-to-have, adds complexity)
- Text background gradient (requires getBBox browser testing)

**Implement in Phase 1**:
- Bug fixes (showNodeDates, nodeDateLabels)
- Create placeholder showSpeciesEstablishmentDates setting

**Implement in Phase 2**:
- All visual features (hover, shadows, text backgrounds)
- Node date font size setting
- Browser testing of all features

---

## Testing Strategy

### Unit Tests to Add
- showNodeDates applied at startup
- Date label font size updated when setting changed
- Text background elements created in correct order
- Hover highlighting opacity updates correctly
- Shadow images positioned with offset
- Position export/import round-trip
- Species establishment dates setting doesn't crash (even if no data)

### Existing Tests to Verify Still Pass
- All force simulation tests (no physics changes)
- Grid rendering tests (not affected)
- Silhouette rendering tests (shadows added alongside)
- Label rendering tests (text layer adds structure)

### Manual Browser Tests
- Hover smooth appearance/disappearance
- Text backgrounds fade at edges with zoom
- Shadows render realistically
- Position persistence full workflow

---

## Next Actions

1. **Review**: Read both COMPREHENSIVE_FINDINGS documents completely
2. **Decide**: Confirm deferred work and implementation order
3. **Create Issues**: File GitHub issues for each phase
4. **Begin**: Start Phase 1 bug fixes
5. **Test**: Run full test suite after each feature
6. **Browser Test**: Manually verify features requiring visual verification

---

## Documents Provided

- **COMPREHENSIVE_FINDINGS_PART1.md**: Detailed technical analysis, code locations, architecture
- **COMPREHENSIVE_FINDINGS_PART2.md**: Testing strategy, dependencies, implementation order
- **FINDINGS_SUMMARY.md**: This executive summary

All source code references include file paths and line numbers for quick navigation.

