# Architectural Verification: Layout Coordinate Constraints

**Milestone 0 Final Architectural Check**

---

## VERIFICATION RESULT: ✓ ARCHITECTURE IS SOUND

The PhyloExplorer architecture properly supports the two-layout design with coordinate constraints while maintaining graph immutability. The correction that removed coordinate constraint queries from the graph data structure does NOT compromise layout interchangeability.

---

## 1. COORDINATE CONSTRAINT MECHANISM: ✓ VERIFIED

### Present in Architecture:
**Section 4.3 - LayoutEngine Interface:**
```javascript
class LayoutEngine {
  // Query whether a coordinate is constrained
  isXConstrained() { /* return true for time-axis, false for free */ }
  isYConstrained() { /* return true if Y is fixed, false otherwise */ }
}
```

**Purpose:** Allow visualization layer to query whether a layout constrains X or Y coordinates. This enables:
- Different rendering strategies (free layout uses physics; time-axis uses estimates)
- UI affordances (e.g., disable dragging X if constrained)
- Smooth transitions when switching layouts

### Layout Type Behavior:
- **FreeForceDirectedLayout**: isXConstrained() = false, isYConstrained() = false
- **TimeAxisLayout**: isXConstrained() = true, isYConstrained() = false

### Key Insight:
Coordinate constraints are determined by **layout engine type**, not by the graph structure or estimate data. The queries remain at the layout level, not at the graph level. This is the correct architectural placement.

---

## 2. COMPLETE DATA FLOW FOR LAYOUT ENGINES: ✓ NEWLY DOCUMENTED

### Section 4.3.1 - Layout Engine Data Access (NEW)

**Data inputs provided to layout engines**:
1. **PhyloGraph**: The immutable graph structure (read-only)
2. **Divergence estimates**: Complete set for the active hypothesis (read-only)
3. **Selected estimate source**: User's choice when multiple estimates exist (read-only)
4. **Previous layout state** (optional): Prior coordinates for smooth transitions

**Data flow for time-axis layout**:
```
Application startup:
  1. Load and validate taxonomy, hypothesis, divergence estimates
  2. Instantiate: graph = new PhyloGraph(hypothesis)
  3. User selects estimate source
  4. Application state stores: { activeHypothesis, selectedEstimateSource, layout }
  
Layout computation (time-axis):
  1. UI layer calls: layoutEngine.compute(graph, estimates, selectedEstimateSource)
  2. TimeAxisLayout reads estimates data (does not modify it)
  3. For each node:
     - Query graph for node type/children via graph.getChildren(nodeId)
     - Query estimates for selected source and this node
     - If estimate exists: calculate X from divergence time
     - If estimate missing: mark undated, use placeholder X
  4. Calculate Y from 1D physics (independent of estimates)
  5. Return new coordinates { nodeId -> {x, y, uncertainty} }
  
Layout storage:
  1. Coordinates stored in ephemeral LayoutState (separate from graph)
  2. Graph and estimates unchanged
  3. Visualization reads from LayoutState, not graph
```

**This demonstrates:**
- ✓ Layout engines have all data they need without modifying graphs
- ✓ Coordinate constraints are enforced at the layout algorithm level
- ✓ The separation of concerns is complete and explicit

---

## 3. GRAPH IMMUTABILITY: ✓ PRESERVED

### Before Layout Calculation:
- PhyloGraph is finalized and immutable (Section 3.1: builder → finalized phase)
- Divergence estimates are read-only JSON data (Section 6.1)
- Application state (selected estimate source) is UI-only (Section 6.4, now enhanced)

### During Layout Calculation:
- Layout engines receive immutable inputs
- Layout engines have NO write methods
- Layout engines produce coordinates only (separate data structure)

### After Layout Calculation:
- Coordinates stored in ephemeral LayoutState (Section 6.3)
- Graph and estimates unchanged (Sections 6.1, 6.2)
- Switching layouts regenerates coordinates; doesn't rebuild graph

### Verification:
✓ No PhyloGraph methods modify topology  
✓ No estimate data is written to  
✓ No coordinates are stored in the graph  
✓ Coordinate freedom determined by layout engine type, not by data content  

---

## 4. TWO-LAYOUT ARCHITECTURE: ✓ FULLY SUPPORTED

### Layout Interchangeability:
Both layouts inherit from LayoutEngine and implement the same interface.

**FreeForceDirectedLayout (Initial Release, M2):**
- Input: graph + layout config (physics parameters)
- Constraints: None
- Algorithm: D3.js force simulation on both axes
- Output: {x, y} positions

**TimeAxisLayout (Future, M8):**
- Input: graph + estimates + selected estimate source + layout config
- Constraints: X constrained by divergence times; Y free
- Algorithm: X from selected estimate (deterministic); Y from 1D physics
- Output: {x, y, uncertainty}

### Switching Between Layouts (Section 4.3):
When user toggles layout:
1. Application calls: `layoutEngine.compute(graph, estimates, selectedEstimateSource)`
2. New coordinates generated
3. LayoutState updated with new {x, y} values
4. Visualization re-rendered
5. **Graph and estimates untouched**

### Smooth Transitions:
- `compute(previousLayout)` parameter enables reusing prior positions as initial state
- Prevents jarring visual jumps when switching layouts
- Maintains interaction state (bookmarks, MRCA selection)

---

## 5. MISSING TEMPORAL EVIDENCE: ✓ FULLY DEFINED

### Five Scenarios (Section 4.4):

1. **Missing estimate for internal node:**
   - Result: Placeholder X position (visualized as "undated")
   - Guarantee: No synthetic date added to dataset

2. **Multiple conflicting estimates:**
   - Result: User selects which source to display
   - Guarantee: All estimates accessible; one explicitly selected

3. **Only some nodes have estimates:**
   - Result: Dated nodes positioned accurately; undated marked visually
   - Guarantee: No averaging or interpolation

4. **Extinct terminal taxon:**
   - Result: Uses divergence time (if available), taxon origin (if available), or undated
   - Guarantee: Source of position clearly indicated

5. **Uncertainty specification preservation:**
   - Result: Bounds + interval type + methodology + calibration notes stored
   - Guarantee: Never reduced to two untyped numbers

### UI Reporting (Section 4.4):
- Undated nodes marked in UI (grayed, labeled)
- On hover: shows estimate source and methodology
- Multiple estimates available for user comparison
- Never silently uses default or assumed estimate

### Validation:
✓ No fabrication principle enforced  
✓ No silent interpolation  
✓ No averaging of conflicting estimates  
✓ Uncertainty fully preserved  

---

## 6. GRAPH AND LAYOUT SEPARATION: ✓ CLEAR

### Three Distinct Layers:

**Graph Layer (Section 3):**
- Immutable after construction via GraphBuilder
- Represents topology and hypothesis-scoped relationships
- No knowledge of coordinates or layout
- Provides read-only query methods only

**Layout Layer (Section 4, enhanced in 4.3.1):**
- Stateless (or ephemeral state only)
- Receives immutable inputs: graph + estimates + user selections
- Produces coordinates only
- Cannot modify graph or estimates
- Interchangeable via LayoutEngine interface

**Visualization Layer (Section 5):**
- Reads coordinates from Layout, not from Graph
- Renders SVG based on current layout
- D3.js handles DOM updates
- No business logic about tree structure

### Data Flow (Section 4.3.1):
```
Immutable Data:
  Graph (read-only queries) → Layout
  Estimates (read-only access) → Layout
  
ApplicationState:
  Selected estimate source → Layout
  
Layout Output:
  Coordinates (ephemeral) → LayoutState
  
Visualization:
  Reads LayoutState (not Graph or Estimates)
```

Result: Layout engines can be swapped without modifying graph or rebuilding structure.

---

## 7. SCIENTIFIC DATA INTEGRITY: ✓ MAINTAINED

### What Cannot Be Modified:
- Taxonomic relationships (rooted hierarchy)
- Phylogenetic topology (hypothesis-specific branching)
- Divergence estimates (values, bounds, uncertainty type)
- Source attribution (publication metadata)

### What Can Change:
- Selected estimate source (user choice → stored in ApplicationState)
- Visual coordinates (layout output only)
- UI state (selection, bookmarks, highlights)
- Browser cache (localStorage for bookmarks)

### Verification:
✓ No layout calculation can add/remove nodes  
✓ No estimate selection can modify tree topology  
✓ No coordinate calculation can change scientific data  
✓ All data changes are explicit and UI-driven  

---

## 8. ARCHITECT DECISIONS DOCUMENTED: ✓ COMPLETE

### New Section 4.3.1 - Layout Engine Data Access and Immutability

**Explains:**
1. What data layout engines receive (graph + estimates + user selections)
2. How data flows from JSON to layout calculation to visualization
3. Why graph and estimates remain immutable during layout
4. How "selected estimate source" is managed as ApplicationState
5. Why this architecture supports the two-layout design

### Updated Section 6.4 - Application State

**Now includes:**
- Selected estimate source (when multiple estimates exist)
- Active layout engine type (free force-directed vs. time-axis)
- Principle: Changing these triggers layout recalculation, not data modification
- Persistence: Both bookmarks and estimate source persisted to localStorage

---

## FINAL VERDICT: COORDINATE CONSTRAINT ARCHITECTURE ✓ SOUND

### What Was Verified:
- ✓ LayoutEngine interface has `isXConstrained()` and `isYConstrained()`
- ✓ Constraint queries are at the layout level (correct placement)
- ✓ Layout engines receive all necessary data inputs
- ✓ Layout engines cannot modify graph, estimates, or application state
- ✓ Coordinate data stored separately from scientific data (LayoutState)
- ✓ Five undated scenarios prevent fabrication or silent assumptions
- ✓ Switching layouts regenerates coordinates without rebuilding graph
- ✓ Graph immutability enforced through all phases

### No Architectural Vulnerabilities Found:
- Graph cannot be modified after PhyloGraph.build()
- No mutable coordinates in scientific data structures
- No silent averaging or interpolation of temporal data
- No fabricated divergence times
- All design decisions prevent data corruption

### Architecture Remains Clean After Final Verification:
- **Separation of concerns:** Graph ↔ Layout ↔ Visualization
- **Immutability chain:** Data (JSON) → PhyloGraph (immutable) → Layout (read-only inputs) → Coordinates (ephemeral)
- **Interchangeable layouts:** Both FreeForceDirected and TimeAxis implement LayoutEngine interface
- **Future-proof:** TimeAxisLayout can be added in M8 without modifying existing code or violating any invariants

### The Two-Layout Architecture is Solid:
The concern about removing coordinate constraint queries from the graph was valid, but the solution is correct: constraint information belongs at the **layout level** (via `isXConstrained()`/`isYConstrained()`), not at the **graph level**. The graph is properly immutable; layout engines have all the data they need without modifying anything.

---

## MILESTONE 0 FINAL STATUS: ✓ COMPLETE

**All Eight Corrections Verified:**
1. ✓ Temporal terminology (distinct concepts, no false ordering)
2. ✓ Example tree (valid structure, all nodes defined)
3. ✓ Graph immutability (construction lifecycle with clear phases)
4. ✓ Missing temporal evidence (five scenarios, no fabrication)
5. ✓ Stable identifiers (independent of scientific names)
6. ✓ Fictional examples (unmistakably marked, real metadata separate)
7. ✓ Roadmap reconciled (M0 complete, D3.js in M2, clear milestones)
8. ✓ Consistency verified (no contradictions across documents)

**Plus: Final Architectural Check**
- ✓ Layout coordinate constraint mechanism verified sound
- ✓ Graph immutability preserved despite layout engine complexity
- ✓ Data flow from estimates to layout to visualization documented
- ✓ Two-layout interchangeability confirmed architecturally feasible
- ✓ Missing temporal evidence handling prevents fabrication

---

## APPROVED FOR MILESTONE 1 IMPLEMENTATION

**Documentation Status: Ready**
- Four specification documents are internally consistent
- Architectural decisions are documented and justified
- No blocking issues remain
- Implementation can proceed with confidence

**Next Steps:**
1. Begin Milestone 1: Data Structures & Graph Foundation
2. Implement GraphBuilder and PhyloGraph as specified
3. Create synthetic test fixtures (30-taxon tree) as described in architecture
4. Build JSON schemas and validation layer
5. Implement graph operations (MRCA, pathfinding, pruning)

Generated by Copilot  
Milestone 0: Project Documentation  
PhyloExplorer — Static Browser-Based Phylogenetic Tree Explorer
