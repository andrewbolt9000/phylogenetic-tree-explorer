# Phase 2F: Internal Node taxonId Support

## Overview

Updated PhyloExplorer to support animal taxa associated with internal phylogenetic nodes while preserving the existing tree topology. This allows OTT-provided internal nodes (which represent genera, families, or higher taxa) to have their own silhouettes and labels rendered.

## Motivation

Open Tree of Life's induced subtree returned 593 terminal species from our 600 selected taxa. Some selected OTT IDs represent internal nodes (genera or higher taxa) rather than species. Previously, these could not be rendered as animals in the visualization. Now they can be, while still maintaining the original OTT topology.

## Changes Made

### 1. Schema Update
**File:** `data/schemas/hypothesis.schema.json`

- Modified `taxonId` property description from "For terminal nodes only" to allow internal nodes
- `taxonId` remains required for terminal nodes (unchanged)
- `taxonId` is now optional for internal nodes (new)
- When present on an internal node, taxonId must reference a valid taxonomy entry

### 2. Validation Logic
**File:** `src/data/hypothesisLoader.js`

Updated `_validateTreeStructure()` method:
- Internal nodes may now have an optional `taxonId` property
- If an internal node has a `taxonId`, it must reference an existing taxonomy entry
- If validation fails, throws `ValidationError` with descriptive message
- Preserved existing constraints: internal nodes still require ≥2 children

### 3. Visualization Adapter
**File:** `src/visualization/visualizationAdapter.js`

Generalized name and silhouette resolution:
- `_getNodeLabel()`: Now works for any node with a `taxonId` (terminal or internal)
- `_getCommonName()`: Now works for any node with a `taxonId`
- `_getScientificName()`: Now works for any node with a `taxonId`
- `getSilhouetteFilename()`: Now works for any node with a `taxonId`
- Internal nodes without `taxonId` still use ancestor labels (e.g., "Ancestor 0")

### 4. Force-Directed Visualization
**File:** `src/visualization/forceDirectedVisualization.js`

Updated rendering to support internal nodes with taxonId:
- `_renderSilhouettes()`: Changed condition from `d.type === 'terminal' && d.silhouetteFilename` to just `d.silhouetteFilename`
  - Silhouettes now render for any node that has them (terminal or internal with taxonId)
- `_renderLabels()`: Changed condition from filtering `d.type === 'terminal'` to filtering by presence of `commonName` or `scientificName`
  - Labels now render for any node with taxonId and corresponding name data

### 5. Tests
**File:** `src/visualization/visualizationAdapter.test.js`

Added comprehensive test suite for internal nodes with taxonId:
- ✓ Internal node with valid taxonId resolves to taxon name
- ✓ Internal node with taxonId resolves silhouette filename
- ✓ Internal node without taxonId uses ancestor label
- ✓ Internal node with invalid taxonId does not crash
- ✓ Terminal nodes still work correctly alongside internal nodes with taxonId

Total: 5 new tests, all passing

## Test Results

```
✓ All 524 tests pass
  - 250 visualization adapter tests (including 5 new tests for internal taxonId)
  - 274 other tests (hypothesis loader, graph builder, settings, etc.)
```

## Backward Compatibility

✓ Fully backward compatible
- Existing datasets without internal taxonIds continue to work unchanged
- Terminal nodes render identically to before
- Internal nodes without taxonId still use ancestor labels
- Tree topology is never modified

## Behavior Examples

### Internal node WITH taxonId
- Node ID: `ancestor_h1_n1`
- taxonId: `genus_xy`
- Taxonomy: `{ id: 'genus_xy', scientificName: 'Genus XY', rank: 'genus' }`
- Result: Renders "Genus XY" label, displays silhouette for genus_xy.svg

### Internal node WITHOUT taxonId
- Node ID: `ancestor_h1_n0`
- taxonId: null
- Result: Renders "Ancestor 0" label, no silhouette

### Terminal node (unchanged)
- Node ID: `tax_a`
- taxonId: `tax_a`
- Taxonomy: `{ id: 'tax_a', scientificName: 'Species A', commonName: 'Animal A' }`
- Result: Renders both common and scientific names, displays species silhouette (unchanged behavior)

## Architectural Notes

1. **Separation of Concerns**: Visualization adapter now resolves names/silhouettes based on taxonId presence, not node type
2. **Node Type Preservation**: Node types (terminal/internal) are never modified; taxonId association is metadata
3. **Rendering Logic**: Silhouette and label rendering now check for data presence rather than node type
4. **Validation**: Invalid internal taxonIds are caught during tree validation, not during rendering

## Known Limitations

- Lineage distance calculation for internal nodes is not yet implemented (marked as future work)
- Image URL extraction from PhyloPic is not yet used for display
- Ancestor image selection fallback is not yet implemented

## Files Modified

1. `data/schemas/hypothesis.schema.json`
2. `src/data/hypothesisLoader.js`
3. `src/visualization/visualizationAdapter.js`
4. `src/visualization/forceDirectedVisualization.js`
5. `src/visualization/visualizationAdapter.test.js`

## Files Not Modified

- `src/graph/PhyloGraph.js` (unchanged)
- `src/data/schemaValidator.js` (unchanged)
- All other visualization and settings code (unchanged)
- Original master lists and resolver utilities (unchanged)
