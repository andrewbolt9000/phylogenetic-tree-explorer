# PhyloExplorer — Architecture

## 1. High-Level Design Principles

PhyloExplorer is designed as a static, single-page application with clear separation of concerns:

- **Taxonomy layer**: A roster of organisms with stable identifiers, formal scientific names, common names, and taxonomic classification (kingdom, phylum, order, family, genus, species).
- **Phylogenetic hypothesis layer**: One or more rooted phylogenetic trees representing published evolutionary hypotheses, with terminal nodes referencing taxonomic identifiers and internal (ancestral) nodes with hypothesis-scoped identifiers.
- **Graph layer**: The phylogenetic tree is represented as a normalized graph structure with no dependency on visual layout. Graph operations (MRCA, path traversal, pruning) are independent of both data loading and visualization.
- **Layout layer**: Multiple independent layout algorithms (force-directed, time-axis) operate on the same underlying graph without modifying it.
- **Visualization layer**: D3.js renders the layout without modifying the underlying data or tree structure.

This separation ensures that taxonomy is authoritative and reusable across hypotheses, phylogenetic hypotheses remain distinct and never silently combined, and layouts are interchangeable.

## 2. Data Architecture

### 2.1 Organization and Formats

**Scientific datasets** are curated, validated, and stored locally as JSON files:

```
/data
  /taxonomy
    mammals.json              # Taxonomic roster of organisms (species, genera, etc.)
  /hypotheses
    hypothesis-001.json       # A rooted phylogenetic tree (published hypothesis)
    hypothesis-002.json       # Alternative hypothesis (future; not in initial release)
  /dates
    divergence-estimates.json # Multiple published estimates per ancestral node per hypothesis
    source-metadata.json      # Publication details, methodologies, licensing
  /media
    phylopic-mappings.json    # Taxonomic terminals linked to PhyloPic identifiers (future)
```

Each dataset is accompanied by **metadata** documenting:
- Source publication (authors, year, DOI).
- Methodology and assumptions.
- License and redistribution permissions.
- Date downloaded or imported.
- Version or snapshot identifier.

### 2.2 Taxonomic Roster

Taxonomy is the authoritative reference for organism identity and formal classification. It is separate from any single phylogenetic hypothesis:

```json
{
  "taxonomy": [
    {
      "id": "tax_homo_sapiens",
      "scientificName": "Homo sapiens",
      "commonName": "Human",
      "rank": "species",
      "parent": "tax_homo",
      "source": "ITIS",
      "sourceId": "180092",
      "extinct": false
    },
    {
      "id": "tax_homo",
      "scientificName": "Homo",
      "rank": "genus",
      "parent": "tax_hominini",
      "source": "ITIS",
      "sourceId": "12345",
      "extinct": false
    },
    {
      "id": "tax_hominini",
      "scientificName": "Hominini",
      "rank": "tribe",
      "parent": "tax_hominidae",
      "source": "ITIS",
      "sourceId": "67890",
      "extinct": false
    }
  ],
  "metadata": {
    "source": "ITIS",
    "sourceUrl": "https://www.itis.gov/",
    "license": "Public Domain",
    "accessDate": "2024-02-01"
  }
}
```

**Key properties**:
- **Stable taxonomic identifiers**: Each taxon has a unique, persistent `id` prefixed with `tax_` to distinguish from phylogenetic node IDs.
- **Rank field**: Distinguishes species, genus, family, order, class, phylum, etc.
- **Parent relationship**: Links to the parent taxon in the taxonomic hierarchy.
- **Source attribution**: Every taxon includes its source (ITIS, NCBI Taxonomy, etc.).
- **Extinct flag**: Indicates whether the taxon has extant (living) members.

**Important**: The taxonomic hierarchy is NOT automatically a phylogenetic tree. Taxonomy reflects formal classification, not evolutionary relationships.

### 2.3 Phylogenetic Hypothesis Structure

A phylogenetic hypothesis is a rooted tree with terminal nodes (taxa) and internal nodes (ancestors). Terminal nodes reference taxonomic identifiers; internal nodes are hypothesis-specific:

```json
{
  "hypothesisId": "phylo_hypothesis-001",
  "hypothesisName": "Example Mammalian Phylogeny (FICTIONAL)",
  "source": "doi:10.1234/example.phylogeny",
  "rootNodeId": "ancestor_h1_n0",
  "terminalIdPrefix": "tax_",
  "internalIdPrefix": "ancestor_h1_",
  "nodes": [
    {
      "id": "ancestor_h1_n0",
      "type": "internal",
      "parentId": null,
      "children": ["ancestor_h1_n1", "ancestor_h1_n2"]
    },
    {
      "id": "ancestor_h1_n1",
      "type": "internal",
      "parentId": "ancestor_h1_n0",
      "children": ["tax_homo_sapiens", "tax_pan_troglodytes"]
    },
    {
      "id": "tax_homo_sapiens",
      "type": "terminal",
      "parentId": "ancestor_h1_n1",
      "children": [],
      "taxonId": "tax_homo_sapiens"
    },
    {
      "id": "tax_pan_troglodytes",
      "type": "terminal",
      "parentId": "ancestor_h1_n1",
      "children": [],
      "taxonId": "tax_pan_troglodytes"
    },
    {
      "id": "ancestor_h1_n2",
      "type": "internal",
      "parentId": "ancestor_h1_n0",
      "children": ["tax_canis_lupus", "tax_felis_catus"]
    },
    {
      "id": "tax_canis_lupus",
      "type": "terminal",
      "parentId": "ancestor_h1_n2",
      "children": [],
      "taxonId": "tax_canis_lupus"
    },
    {
      "id": "tax_felis_catus",
      "type": "terminal",
      "parentId": "ancestor_h1_n2",
      "children": [],
      "taxonId": "tax_felis_catus"
    }
  ]
}
```

**Key properties**:
- **Hypothesis scoping**: All internal node IDs are scoped to their hypothesis (prefix `ancestor_h1_` for hypothesis 1).
- **Terminal ID convention**: Terminal nodes always have IDs matching the `terminalIdPrefix` (e.g., `tax_*`). These IDs refer to taxa in the taxonomy, not internal to the tree structure.
- **Node type**: "internal" (ancestor) or "terminal" (taxon reference).
- **Terminal nodes**: Reference taxonomic IDs via `taxonId` field; the tree itself does not store taxon details.
- **Internal nodes**: Hypothesis-specific ancestors with unique IDs scoped to the hypothesis; no corresponding formal taxon entry.
- **Parent-child relationships**: Explicit `parentId` and `children` array define the tree topology. Every non-root node has exactly one parent; each node has zero or more children.
- **Binary branching and polytomies**: This example uses binary branching (each internal node has exactly two children). Polytomies (internal nodes with more than two children) are also supported to represent uncertainty in branching order. Unary nodes (internal node with exactly one child) are not supported in the initial model but may be added in future releases to represent sampled ancestors.

**Tree validation rules**:
- Every node has a unique `id` within the hypothesis.
- Every non-root node has exactly one `parentId`.
- Root node has `parentId: null`.
- No cycles: parent-child relationships form a directed acyclic graph.
- All terminal nodes reference valid taxa from the taxonomy.
- Internal nodes have at least two children (binary or polytomous branching).

### 2.4 Divergence Estimates

Divergence estimates are associated with specific internal nodes in specific hypotheses. Multiple independent estimates are preserved:

```json
{
  "estimates": [
    {
      "hypothesisId": "phylo_hypothesis-001",
      "nodeId": "ancestor_h1_n0",
      "estimates": [
        {
          "sourceId": "source_example-2024",
          "centralEstimate": 92.5,
          "statisticType": "mean",
          "uncertaintyLower": 85.0,
          "uncertaintyUpper": 100.0,
          "uncertaintyType": "95% credible interval",
          "unit": "Ma",
          "methodology": "FICTIONAL EXAMPLE - Bayesian relaxed clock methodology",
          "calibrationNotes": "FICTIONAL EXAMPLE - This is not real data",
          "source": "doi:10.1234/example.fictional",
          "estimateDate": "2024-11-01"
        }
      ]
    }
  ],
  "sourceMetadata": {
    "source_example-2024": {
      "type": "FICTIONAL EXAMPLE - not a real publication",
      "title": "FICTIONAL EXAMPLE: Example Phylogenetic Study",
      "authors": "Example, A., Fiction, B., & Schema, C.",
      "year": 2024,
      "doi": "doi:10.1234/example.fictional",
      "license": "Example: CC-BY-4.0 (if this were real)",
      "redistributionAllowed": false,
      "note": "This is a FICTIONAL EXAMPLE for schema documentation only. Do not use as real data."
    }
  }
}
```

**Key properties**:
- **Hypothesis-node binding**: Each estimate is linked to a specific hypothesis and node ID.
- **Statistic type**: Clarifies whether the central estimate is a mean, median, mode, or other statistic.
- **Uncertainty specification**: Both bounds and type are explicit; no invented bounds where a source provides none.
- **Source tracking**: Every estimate is linked to publication metadata and access/import date.
- **No averaging**: Conflicting estimates are preserved independently for user selection.

### 2.4 Additional Data

**Taxon metadata**:
```json
{
  "taxonDetails": [
    {
      "taxonId": "tax_example_species",
      "taxonomicPath": ["Animalia", "Chordata", "Mammalia", "Primates", "Hominidae", "Homo", "Homo sapiens"],
      "externalReferences": {
        "itis": "https://www.itis.gov/example",
        "ncbi-taxonomy": "https://www.ncbi.nlm.nih.gov/example",
        "wikidata": "https://www.wikidata.org/wiki/example",
        "wikipedia": "https://en.wikipedia.org/wiki/Example"
      }
    }
  ]
}
```

**Media mappings** (for future use):
```json
{
  "phylopicMappings": [
    {
      "taxonId": "tax_example_species",
      "phylopicId": "example-silhouette-id",
      "license": "CC-BY-3.0",
      "artist": "Example Artist",
      "attribution": "Silhouette by Example Artist (CC-BY-3.0)"
    }
  ]
}
```

### 2.5 Example Data Conventions

All example JSON records in documentation are **EXPLICITLY FICTIONAL** and not derived from real sources. Examples use:
- Clearly synthetic IDs: `phylo_hypothesis-001`, `ancestor_h1_n0`, `tax_example_species`.
- Illustrative placeholder DOIs and publication metadata.
- Placeholder divergence estimates for schema illustration only.
- No claims of redistribution rights without real source verification.

Real datasets will be clearly labeled as sourced data with full attribution, verified redistribution rights, and documented source publications.

## 3. Graph Data Model

The **graph layer** represents a phylogenetic hypothesis as an abstract rooted tree with no dependencies on visual layout.

### 3.1 Graph Construction Lifecycle

PhyloGraph is constructed through a clear, multi-phase process:

1. **Builder phase**: A `GraphBuilder` creates the graph from validated hypothesis JSON:
   - Constructor: `new GraphBuilder(hypothesisData, taxonomyData)`
   - Methods: `addNode()`, `addEdge()`, `validate()`
   - Performs structural validation (no cycles, all parentIds exist, all terminals reference valid taxa)
   - Errors are thrown immediately; the builder does not silently ignore invalid data

2. **Finalization**: `builder.build()` returns an immutable `PhyloGraph`:
   - All nodes and edges are fixed at construction time
   - The hypothesis topology cannot be changed after finalization

3. **Immutable operations**: The finalized `PhyloGraph` exposes read-only methods:
   - Query methods: `getParent()`, `getChildren()`, `getPathToRoot()`, `getMRCA()`, etc.
   - None of these methods modify the graph structure
   - Layout calculations receive the immutable graph and produce separate layout coordinates
   - Data loading, validation, and graph operations are completely separate

**Key principle**: Layout algorithms and visualization code receive an immutable `PhyloGraph` and must not modify topology or scientific data. Coordinate positions are stored separately from graph structure.

### 3.2 Graph Structure

```javascript
class PhyloGraph {
  constructor(hypothesisId) {
    this.hypothesisId = hypothesisId;  // Scopes this graph to a hypothesis
    this.nodes = new Map();             // id -> node (terminal or internal)
    this.edges = new Map();             // nodeId -> [childIds]
  }
  
  // Read-only query methods (never modify graph)
  getParent(nodeId) { /* ... */ }
  getChildren(nodeId) { /* ... */ }
  getPathToRoot(nodeId) { /* ... */ }
  getMRCA(nodeId1, nodeId2) { /* ... */ }
  getPruned(bookmarkedNodeIds) { /* returns new graph; original unchanged */ }
  getTaxonForTerminal(terminalNodeId) { /* Resolve terminal to taxonomy */ }
}
```

**Properties**:
- **Hypothesis scoping**: Each graph is associated with one hypothesis; internal node IDs are unique within that hypothesis.
- **Immutable structure**: The tree topology is fixed at construction; no methods modify the graph after finalization.
- **Terminal vs. internal**: Terminals reference taxonomy via `taxonId`; internals are hypothesis-specific.
- **Graph operations**: Methods like MRCA, path traversal, and tree pruning operate on the normalized graph without modifying it.
- **Pruning produces new graph**: `getPruned()` creates a new graph with bookmarked nodes and ancestors; the original is unchanged.
- **Caching**: Common queries (MRCA, paths) can be cached to improve performance.

### 3.3 Separating Graph Operations from Data

Graph operations (pathfinding, MRCA, pruning) are implemented in a **graph-operations module** that is independent of both data loading and visualization:

```javascript
// graphOperations.js
export function findMRCA(graph, nodeId1, nodeId2) {
  const path1 = graph.getPathToRoot(nodeId1);
  const path2 = graph.getPathToRoot(nodeId2);
  // Find the lowest common ancestor
  return path1.find(node => path2.includes(node));
}

export function getHighlightPath(graph, fromNodeId, toNodeId) {
  // Return the set of edges to highlight (does not modify graph)
}

export function buildPrunedGraph(graph, bookmarkedNodeIds) {
  // Create and return a new graph containing only bookmarks and their ancestors
  // Original graph is unchanged
}
```

## 4. Layout Architecture

The application supports multiple layout algorithms operating on the same underlying immutable graph. Each layout has different constraints and requirements:

### 4.1 Free Force-Directed Layout (Initial Release)

**Purpose**: Visual exploration of the tree structure with realistic physics-based spacing.

**Coordinate freedom**:
- Both X and Y positions are free to be influenced by physics.
- No external constraints on node positions.

**Implementation**:
- Uses D3.js force simulation.
- Forces: negative charge (repulsion), spring links (attraction), collision avoidance.
- Operates on the immutable graph structure without modifying it.
- Produces layout coordinates (x, y) for each node.
- Layout state is completely separate from data state.

**Key features**:
- Nodes repel each other (negative charge).
- Parent-child links attract each other (spring force).
- Collision detection prevents overlap.
- Convergence threshold for stability.
- Performance target: 60 FPS interaction with 100+ nodes; scales with dataset size.

### 4.2 Time-Axis Layout (Future Release)

**Purpose**: Emphasize evolutionary time calibration by constraining X positions to divergence estimates while using physics for Y positioning.

**Coordinate constraints**:
- **X-axis**: Constrained by selected divergence time estimates.
  - Root node at x = maximum divergence time in the tree.
  - Terminal (extant species) nodes at x = 0 (present day).
  - Internal nodes positioned based on their associated divergence estimate.
  - Uncertainty ranges can be visually represented (e.g., node width).
  - X positions are deterministic for a given estimate source.
  
- **Y-axis**: Free to be calculated by one-dimensional physics.
  - Vertical spring forces attract nodes toward their parent (downward).
  - Repulsion between sibling nodes prevents overlap.
  - Broader subtree spacing avoids overlaps between distant branches.
  - Damping ensures convergence to stable layout.
  - Y calculation is iterative and may not be deterministic without fixed random seeds.

**Layout algorithm**:
```
1. Assign X positions based on selected divergence estimates (deterministic).
2. Initialize Y positions near parent or randomly.
3. Iterate physics simulation:
   - Apply downward spring force (attraction to parent).
   - Apply upward repulsion (sibling and subtree spacing).
   - Apply damping.
   - Update Y positions.
   - Check convergence.
4. Return final layout.
```

**Advantages**:
- Time calibration is explicit and unambiguous.
- Divergence times are the dominant visual signal.
- Uncertainty ranges are visible (optional: node width or transparency).
- Easier to visually interpret rates of diversification over time.

**Constraints**:
- X positions cannot be freely adjusted by physics (they are fixed by estimates).
- Some nodes may be difficult to separate vertically if many diverge at similar times.
- Layout depends on the selected divergence estimate source; changing sources affects layout.

### 4.3 Layout Abstraction

Both layouts implement a common interface, but the interface must not assume coordinate freedom:

```javascript
class LayoutEngine {
  constructor(graph, layoutConfig) { /* ... */ }
  
  // Compute layout; optionally use previous layout state for smoother transitions
  compute(previousLayout = null) { /* ... */ }
  
  // Query a node's position
  getNodePosition(nodeId) { /* returns {x, y, ...} */ }
  
  // Get all node positions
  getLayout() { /* returns Map<nodeId, {x, y, ...}> */ }
  
  // For time-axis layout: get X uncertainty representation (if applicable)
  getNodeUncertainty(nodeId) { /* returns {lower, upper} or null */ }
  
  // Query positioning policy for an individual node (time-axis layout only)
  // Returns: "constrained" (has divergence estimate), "undated" (no estimate), 
  //          or "interpolated" (estimated via fallback policy)
  getNodePositioningPolicy(nodeId) { /* returns string or null for free layout */ }
  
  // Enable/disable interactive forces (pause/resume physics)
  setInteractive(enabled) { /* ... */ }
  
  // Query whether a coordinate is constrained (global; describes layout type)
  isXConstrained() { /* return true for time-axis, false for free */ }
  isYConstrained() { /* return true if Y is fixed, false otherwise */ }
}
```

**Individual node positioning in time-axis layout**:

The `getNodePositioningPolicy(nodeId)` method enables visualization and interaction code to distinguish:

- **"constrained"**: Node has a divergence time estimate from the selected source; X position is scientifically determined and reproducible.
- **"undated"**: Node lacks a divergence estimate from any source; X position is undefined and marked visually (undated).
- **"interpolated"**: Node position is calculated through an explicit fallback policy (e.g., placeholder position between parent and children for visualization only, marked as estimated not empirical).
- **null** (for free-layout): The concept does not apply; all X positions are unconstrained.

This per-node distinction enables:
- Visualization to render nodes differently (e.g., lighter color or special marker for undated nodes).
- UI tooltips to display positioning source (e.g., "Position from divergence estimate: Smith et al. 2020" vs. "Undated: no divergence estimate available").
- Interaction code to enforce constraints (e.g., prevent drag if X is constrained).
- Future temporal integration (e.g., allow taxon origin to be displayed separately, but never used for X positioning).

**Switching layouts**:
- The application calls `layoutEngine.compute()` to produce new coordinates.
- Previous layout state can optionally be used as initial positions (smooth transitions).
- The underlying graph and hypothesis do not change; only visual positions change.
- Bookmarks, MRCA selections, and other state are preserved across layout switches.
- If switching from free to time-axis, X positions are recalculated from estimates.

### 4.3.1 Layout Engine Data Access and Immutability

Layout engines receive **immutable data inputs** and must not modify the graph, estimates, or application state:

**Data inputs provided to layout engines**:
1. **PhyloGraph**: The immutable graph structure (read-only; no modifications allowed).
2. **Divergence estimates** (for time-axis layout): The complete set of divergence time estimates for the active hypothesis (read-only; no modifications allowed).
3. **Selected estimate source** (for time-axis layout): The user's choice when multiple estimates exist for a node (passed from application state; layout uses this to determine which estimate to apply).
4. **Previous layout state** (optional): Prior coordinates for smooth transitions (if switching layouts or updating the view).

**Data flow for time-axis layout**:
```
Application startup:
  1. Load and validate taxonomy, hypothesis, divergence estimates
  2. Instantiate: graph = new PhyloGraph(hypothesis)
  3. User selects or defaults to an estimate source
  4. Application state stores: { activeHypothesis, selectedEstimateSource, layout }
  
Layout computation (time-axis):
  1. UI layer calls: layoutEngine.compute(graph, estimates, selectedEstimateSource, previousLayout)
  2. TimeAxisLayout reads estimates data (does not modify it)
  3. For each node:
     - Query graph for node type and children via graph.getChildren(nodeId)
     - Query estimates for selected source and this node
     - If estimate exists: calculate X from divergence time
     - If estimate missing: mark as undated; use placeholder X (see section 4.4 scenario 1)
  4. Calculate Y from 1D physics (independent of estimates)
  5. Return new coordinates { nodeId -> {x, y, uncertainty} }
  
Layout storage:
  1. New coordinates stored in ephemeral LayoutState (separate from graph)
  2. Graph and estimates remain unchanged
  3. Visualization layer reads from LayoutState, not from graph
```

**Immutability constraints**:
- Layout engines **must not** modify `PhyloGraph` (all methods are read-only queries).
- Layout engines **must not** modify divergence estimates (they are immutable data inputs).
- Layout engines **must not** modify the "selected estimate source" choice (that is application-level state).
- Layout engines **must not** store coordinates in the graph or estimates (coordinates go to LayoutState).
- If a layout engine needs to cache calculations, caches are **cleared and regenerated** when the layout is switched or the data changes.

**Why this matters for the two-layout architecture**:
- `FreeForceDirectedLayout.isXConstrained()` returns `false` because no external data constrains X positions.
- `TimeAxisLayout.isXConstrained()` returns `true` because divergence estimates constrain X positions.
- Both layouts receive the **same immutable graph and estimates**; they differ only in how they calculate coordinates.
- Switching layouts does not require rebuilding the graph or re-validating estimates; only coordinate positions change.

### 4.4 Handling Missing Temporal Evidence

The time-axis layout and divergence display must explicitly handle incomplete or conflicting temporal data. The application never fabricates, interpolates, or silently assumes dates for nodes that lack estimates.

**Scenarios and behaviors**:

1. **Missing estimate for an internal node**:
   - The node's position cannot be determined from divergence data alone.
   - Option: Use a placeholder X position (e.g., linear interpolation between parent and children for visualization only).
   - The placeholder is marked as "undated" or "estimated" in the UI.
   - The underlying estimate data record remains empty; no synthetic date is added to the dataset.

2. **Multiple conflicting estimates for the same node**:
   - All estimates are presented to the user.
   - User explicitly selects which estimate to use for X positioning.
   - Application displays the selected estimate's uncertainty interval (if available).
   - Alternative estimates are available for reference and comparison.

3. **Only some internal nodes have estimates**:
   - Nodes with estimates are positioned accurately according to divergence time.
   - Nodes without estimates must be positioned consistently but are visually marked as undated.
   - The application does not average the parent and child estimates to fill in missing nodes.

4. **Terminal node represents an extinct taxon**:
   - An extinct terminal may have a taxon origin date (from fossil record or molecular estimate) stored in the data.
   - Taxon origin is a distinct concept from divergence time and must not be used as a substitute for a divergence estimate.
   - X position: If a divergence time is available, use it. If no divergence estimate exists, the node is marked undated; taxon origin is NOT used for time-axis positioning.
   - Taxon origin may be displayed in the UI as a separate, clearly labeled piece of information (e.g., "Origin date" different from "Divergence time").
   - The source and meaning of every temporal value displayed must be explicitly indicated.

5. **Uncertainty specification must be preserved**:
   - If an estimate has uncertainty bounds, they retain their full specification: bounds, interval type (credible interval, confidence interval, standard error, etc.), methodology, and calibration notes.
   - Uncertainty is never reduced to two untyped numbers; the interval type is always explicit.
   - In future visualizations, uncertainty can be represented as node width, transparency, or error bars.

**Explicit UI reporting**:
- Nodes without divergence estimates are marked in the UI (e.g., grayed, labeled "no date").
- On hover or click, a node displays its estimate source and methodology.
- If multiple estimates exist, the currently displayed estimate is highlighted; others are accessible.
- The application never silently uses a default or assumed estimate.

## 5. Visualization Layer

### 5.1 D3.js Rendering

The visualization layer uses D3.js to render SVG elements based on the current layout:

```javascript
class PhyloVisualization {
  constructor(svgElement, graph, layout) { /* ... */ }
  render() { /* ... */ }
  update() { /* ... */ }
  highlight(nodeIds) { /* ... */ }
  resetHighlight() { /* ... */ }
}
```

**Rendering pipeline**:
1. Layout engine computes node positions.
2. D3 data binding associates DOM elements with graph nodes.
3. SVG elements (circles for nodes, lines for edges) are positioned based on layout.
4. Event listeners (click, hover) are attached to enable interaction.
5. Highlighting and transitions are applied based on user interaction.

### 5.2 User Interaction

**Interaction handlers**:
- **Search**: Query the graph to find matching taxa; zoom to the result.
- **Selection**: Click to select a taxon; fetch and display its details.
- **MRCA**: Select two taxa and compute their MRCA.
- **Bookmarking**: Click a bookmark icon to add/remove a taxon from bookmarks.
- **Pruning**: Activate a filter to show only bookmarks and their ancestors.
- **Layout switching**: Toggle between layout engines (initial: force-directed only).

## 6. State Management

The application maintains several layers of state:

### 6.1 Data State (Immutable)
- Taxonomic roster.
- Phylogenetic hypotheses.
- Divergence estimates.
- Metadata and source attribution.
- **Storage**: JSON files in `/data`.
- **Lifecycle**: Loaded once at application startup; never modified during runtime.

### 6.2 Graph State (Authoritative)
- The normalized graph structure for the active hypothesis.
- Parent-child relationships, node IDs (hypothesis-scoped), terminal mappings.
- **Storage**: In-memory `PhyloGraph` instance.
- **Lifecycle**: Built once from the selected hypothesis; never modified by visualization.

### 6.3 Layout State (Ephemeral)
- Current node positions (x, y, optional uncertainty bounds) from the active layout engine.
- Physics simulation parameters (forces, damping, convergence).
- **Storage**: In-memory layout engine instance.
- **Lifecycle**: Regenerated when switching layouts, resizing viewport, or changing hypothesis.

### 6.4 Application State (Transient)
- Selected hypothesis (scopes the active graph).
- Selected taxa/nodes (for MRCA or details).
- Bookmarked nodes (may span multiple hypotheses).
- Active filter (full tree or pruned view).
- Highlighted edges/paths.
- Current search query.
- **Selected estimate source**: When multiple divergence time estimates exist for nodes, this tracks which source/publication the user has chosen for visualization in the time-axis layout. When changed, layout coordinates are recalculated but graph and estimate data remain unchanged.
- Active layout engine (free force-directed or time-axis; initial: force-directed only).
- **Storage**: In-memory application state; bookmarks and estimate source selection persisted to browser localStorage.
- **Immutability principle**: Application state changes (like switching estimate sources) trigger layout recalculation, not data modification.

## 7. Module Structure (Proposed)

The application is organized into the following modules (not all created initially):

```
/src
  /data
    taxonomyLoader.js      # Load and validate taxonomy JSON
    hypothesisLoader.js    # Load and validate phylogenetic hypothesis JSON
    divergenceLoader.js    # Load and validate divergence estimates JSON
    schemaValidator.js     # Validate all data against JSON schemas
    
  /taxonomy
    rankHierarchy.js       # Rank hierarchy knowledge base (28 OTL ranks, utilities)
    rankHierarchy.test.js  # Tests for rank ordering and APIs
    
  /graph
    PhyloGraph.js          # Graph data structure (hypothesis-scoped)
    graphOperations.js     # MRCA, pathfinding, pruning (work within one hypothesis)
    taxonomyResolver.js    # Resolve terminals to taxonomic details
    
  /layout
    LayoutEngine.js        # Abstract base class (handles coordinate freedom)
    FreeForceDirectedLayout.js # D3.js force simulation
    TimeAxisLayout.js      # Time-constrained layout (future)
    
  /visualization
    PhyloVisualization.js  # D3.js rendering
    interactionHandler.js  # User input handling
    
  /ui
    searchBar.js           # Search functionality
    detailsPanel.js        # Taxon and node details display
    bookmarkManager.js     # Bookmark UI and state
    hypothesisSelector.js  # Select active hypothesis (future)
    
  /app
    applicationState.js    # Global state management
    appInitializer.js      # Bootstrap and initialization
    main.js                # Entry point
    
/tests
  # Test files mirror source structure
  
/data
  /taxonomy
    mammals.json              # Taxonomic roster (single source)
  /hypotheses
    mammals-hypothesis-001.json  # Phylogenetic tree (current hypothesis)
  /dates
    divergence-estimates.json    # Divergence times linked to hypothesis
    source-metadata.json         # Publication details and licenses
  /schemas
    taxonomy.schema.json
    hypothesis.schema.json
    divergence-estimates.schema.json
    
/docs
  PROJECT_SPEC.md
  ARCHITECTURE.md
  DATA_POLICY.md
  ROADMAP.md
  
index.html
styles.css
```

## 8. Dependency Strategy

### 8.1 Required Dependencies
- **D3.js** (v7 or later): For force simulation, data binding, and SVG manipulation.
- **No framework**: No React, Vue, Angular, or other frontend framework for simplicity and static deployment.

### 8.2 Optional Future Dependencies
- **Rollup** or **esbuild**: For bundling ES modules (may not be needed for GitHub Pages).
- **Jest** or **Vitest**: For unit testing (added when testing framework is chosen).
- **PostCSS**: For CSS preprocessing (only if needed).

### 8.3 Build Strategy
- Development: Direct file serving with `http-server` or similar.
- Production: Direct ES module loading or bundle with Rollup if needed for performance.
- No build step required for initial release if GitHub Pages handles ES modules well.

## 9. Performance Considerations

### 9.1 Target Performance
- **Initial load**: < 2 seconds (data + visualization).
- **Interaction**: Force simulation at 60 FPS.
- **Search**: < 100 ms response time.
- **MRCA computation**: < 10 ms.

### 9.2 Optimization Strategies
- Lazy load divergence estimates (show only for visible time range initially).
- Implement culling for nodes outside the current viewport.
- Cache common graph operations (MRCA, paths).
- Use requestAnimationFrame for smooth animations.

### 9.3 Initial Constraints
- Support 200–500 mammalian species (first release).
- Defer optimization until performance problems are measured.

## 10. Security and Data Integrity

### 10.1 No User-Generated Code Execution
- All application logic is static JavaScript.
- No eval(), Function(), or dynamic code execution.
- Data is strictly JSON; no executable code in data files.

### 10.2 Input Validation
- All user input (search queries, selections) is treated as untrusted.
- Validation is performed before querying the graph.
- DOM manipulation uses safe methods (textContent, not innerHTML).

### 10.3 External Data Handling
- Data files are validated at load time (schema, structure, relationships).
- Invalid or missing data is reported explicitly; never silently ignored.
- No external API calls for core functionality; all data is bundled.

## 11. Future Architectural Considerations

### 11.1 Scalability
- Current design supports up to several thousand nodes comfortably.
- Beyond 5,000 nodes, consider spatial indexing for performance.
- Multiple independent trees can be loaded via modular data loading.

### 11.2 Extensibility
- Adding new divergence estimates: Add to data files; no code changes required.
- Adding new taxa groups: Load alternate data files; graph structure handles arbitrary trees.
- Adding new layouts: Implement LayoutEngine interface; no changes to existing code.
- Adding new media types: Extend data schema; visualization adapts via plugin architecture (future).

### 11.3 Testing Strategy
- Unit tests for graph operations (MRCA, pathfinding, pruning).
- Integration tests for data loading and validation.
- Visual regression tests for layouts (pixel comparison of SVG output).
- No end-to-end tests initially; defer to later milestones.

## 12. Unresolved Questions

1. **Build tool selection**: Is a build step necessary for GitHub Pages, or can ES modules be served directly? This affects initial setup and deployment.
   
2. **CSS framework**: Should we use a minimal CSS framework (e.g., classless CSS) or write all CSS from scratch for maximum control and minimal dependencies?

3. **Divergence estimate selection**: When multiple conflicting estimates exist for a node, how should the UI present them? Options:
   - Show all, let user choose.
   - Show the most recent estimate by default.
   - Show a weighted average with caveats (discouraged).

4. **PhyloPic integration**: How should the initial release handle taxa without PhyloPic silhouettes? Options:
   - Proceed without silhouettes; add them as they become available.
   - Use generic placeholders.
   - Defer PhyloPic integration to a later milestone.

5. **Dataset selection**: Which mammalian phylogeny should be used for the initial release? Candidate sources:
   - Springer et al. (2004) or updates: Comprehensive mammalian supertree.
   - dos Reis et al. (2018): Well-calibrated molecular phylogeny.
   - Recent TimeTree or timetree.org snapshots.
   - This decision affects data sourcing and requires verification of redistribution rights.

6. **Performance targets**: What is the acceptable dataset size for the first release (200 species vs. all ~6,000 mammals)? Smaller dataset = faster to implement; larger = more comprehensive.
