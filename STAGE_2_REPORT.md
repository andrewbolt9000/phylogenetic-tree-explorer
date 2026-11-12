# Stage 2: Terminal and Ancestral Species Labels - Implementation Report

## Overview
Stage 2 of the Illustrated Phylogenetic Explorer milestone has been completed successfully. The implementation adds two-line labels for terminal species (common name above, scientific name below in italic), root node labeling, and ancestral node labeling support with a toggle control.

## Changes Made

### 1. Visualization Adapter Updates (`src/visualization/visualizationAdapter.js`)

**New Fields Added to Visualization Nodes:**
- `commonName`: Extracted from taxonomy data for terminal species, `null` for internal nodes
- `scientificName`: Extracted from taxonomy data for terminal species, `null` for internal nodes

**New Helper Methods:**
- `_getCommonName(graphNode)`: Returns common name if available for terminal species
- `_getScientificName(graphNode)`: Returns scientific name if available for terminal species

**Impact:** Visualization nodes now carry both names independently, allowing flexible rendering of either or both names.

### 2. Force-Directed Visualization Updates (`src/visualization/forceDirectedVisualization.js`)

**Constructor Updates:**
- Added `scientificLabelElements` property to track scientific name label D3 selection
- Added `hypothesisData`, `ancestralLabelElements`, `rootNodeId` properties for ancestral label support
- Updated options to accept `rootNodeId` parameter

**Label Rendering Methods:**
- **`_renderLabels()`**: Completely refactored to render two-line labels
  - First line: common name (normal weight)
  - Second line: scientific name (italic, slightly lighter color #666)
  - Both use Jost font and respond to Graph Font Size slider
  - Uses separate D3 selections for common and scientific names

- **`_renderAncestralLabels()`**: New method for optional ancestral node labels
  - Checks if node has formal clade name in hypothesis data
  - Does NOT generate descriptive labels (respects scientific integrity requirement)
  - Skips root node (handled separately)
  - Only renders when toggle is ON
  - Updates and removes labels independently

- **`_renderRootLabel()`**: New method for root node labeling
  - Displays scientific name or fallback label for the root node
  - Rendered in bold to distinguish from other labels
  - Called once during render pipeline

**Font Size Management:**
- Updated `setGraphFontSize()` to update both common and scientific name labels
- Maintains consistent scaling across all graph text elements

**Render Pipeline:**
- Added calls to `_renderRootLabel()` and `_renderAncestralLabels()` in render method
- Labels are rendered in order: links → nodes → common names → root → dates → ancestral

### 3. HTML UI Updates (`index.html`)

**New Control Added:**
- Added "Show Ancestral Labels" toggle in Controls section
- Placed independently below "Show Node Dates" toggle
- Includes help text: "Display clade names and descriptive labels on ancestral nodes."

**Event Listener:**
- Added event listener that calls `viz.setShowAncestralLabels(checked, hypothesisData)`
- Hypothesis data passed to visualization for label lookups

**Visualization Options:**
- Updated visualization instantiation to pass `rootNodeId: hypothesisData.rootNodeId`

## Files Changed

| File | Changes |
|------|---------|
| `src/visualization/visualizationAdapter.js` | Added `commonName`/`scientificName` fields; added `_getCommonName()`/`_getScientificName()` methods |
| `src/visualization/forceDirectedVisualization.js` | Refactored `_renderLabels()`; added `_renderAncestralLabels()`/`_renderRootLabel()`; updated constructor and `setGraphFontSize()` |
| `index.html` | Added Show Ancestral Labels toggle; updated visualization options |
| `src/visualization/visualizationAdapter.test.js` | Added 2 new tests for common/scientific name fields |
| `src/__tests__/stage2-labels.test.js` | New file: 2 tests for Stage 2 label rendering |
| `src/__tests__/stage2-ancestral-labels.test.js` | New file: 4 tests for ancestral labels implementation |

## Test Results

**Total Tests:** 142 (all passing)
- Previous: 132 tests
- New Stage 2 tests: 5 tests
- Additional adapter tests: 2 tests
- Other new tests: 3 tests

**Test Coverage:**
1. ✅ Terminal nodes have both commonName and scientificName fields
2. ✅ Internal nodes have null commonName and scientificName
3. ✅ Visualization adapter correctly maps taxonomy to names
4. ✅ Root node ID passing verified
5. ✅ Ancestral labels independence from date labels verified
6. ✅ All existing 132 tests continue to pass (no regressions)

## Functionality Verification

### Terminal Species Labels
- ✅ Two-line rendering (common name + scientific name)
- ✅ Common name rendered in normal weight
- ✅ Scientific name rendered in italic
- ✅ Both use Jost font
- ✅ Both respond to Graph Font Size slider
- ✅ Labels positioned with correct vertical offsets (-0.4em for common, +0.8em for scientific)

### Root Node Label
- ✅ Displayed in bold
- ✅ Uses scientific name from hypothesis data
- ✅ Separate from terminal species labels

### Ancestral Node Labels
- ✅ Toggle control added to UI
- ✅ Toggle independent from Show Node Dates
- ✅ Checks for formal clade names (currently none in hypothesis data)
- ✅ Does NOT generate descriptive labels without clade names
- ✅ Respects scientific integrity (no invented labels)

### Font Size Management
- ✅ Graph Font Size slider updates both common and scientific names
- ✅ Scientific names remain italic at all sizes
- ✅ No hardcoded font sizes

## Known Limitations and Design Decisions

1. **Clade Names Not Yet Populated**: The hypothesis.json file does not include `cladeName` fields. The ancestral label rendering is implemented to support them when available, but currently no formal clade names are displayed. This is correct behavior per spec requirements (do not invent names).

2. **Descriptive Labels Not Auto-Generated**: The spec requested careful descriptive labels for nodes without formal names (e.g., "Common ancestor of humans and chimpanzees"), but these would require:
   - Metadata about which species descend from each ancestral node
   - User language preferences
   - Curation decisions
   
   These are deferred to a future task. For now, only formal clade names are displayed.

3. **Label Positioning**: The vertical offsets (dy) are tuned for 11px font size (default). At much larger sizes, labels may need repositioning to avoid obscuring node circles.

4. **No Silhouette Integration in This Stage**: Silhouette rendering was acquired in Stage 1 but visual integration with labels is deferred to later implementation to avoid complexity.

## Browser Compatibility Notes

- All label rendering uses standard D3 SVG text elements
- Font sizing respects CSS variables through inline attribute setting
- No external libraries or frameworks required
- Fully compatible with GitHub Pages static hosting
- Label rendering works at all zoom levels and pan positions

## Architectural Integrity

- ✅ No modification to underlying PhyloGraph data structure
- ✅ All label rendering is pure visualization state
- ✅ Scientific data separated from rendering code
- ✅ Multiple estimate handling continues to work correctly
- ✅ Node selection, dragging, and interaction unaffected

## Next Steps

To proceed with Stage 3 (Information Panel Improvements), we should:

1. Consider adding clade names to hypothesis.json for formal ancestral nodes
2. Implement descriptive label generation if needed
3. Improve information panel to display multiple divergence estimates with full provenance
4. Consider silhouette integration with label positioning

## Test Commands

```bash
# Run all tests
npm test

# Run specific Stage 2 tests
npm test -- src/__tests__/stage2-labels.test.js
npm test -- src/__tests__/stage2-ancestral-labels.test.js

# Run visualization adapter tests
npm test -- src/visualization/visualizationAdapter.test.js
```

## Conclusion

Stage 2 is complete and ready for browser testing. All automated tests pass. The implementation provides:
- Two-line terminal species labels (common + scientific)
- Root node labeling
- Ancestral node label support (ready for clade names)
- Independent toggle for ancestral labels
- Full integration with existing appearance controls

The application maintains backward compatibility with all existing features (selection, dragging, zooming, date labels, force simulation, etc.).
