# PhyloExplorer — Development Roadmap

## Overview

PhyloExplorer is developed incrementally in well-defined milestones. Each milestone is independently reviewable and deliverable. The roadmap prioritizes core features and ensures a solid foundation for future expansion.

**Estimated timeline**: Milestones progress sequentially; parallel work on independent milestones is possible where noted.

---

## Milestone 0: Project Documentation ✓ COMPLETE

**Status**: Complete  
**Duration**: 1-2 weeks  
**Dependencies**: None

### Purpose
Establish authoritative project documentation to guide all future development.

### Deliverables
- ✓ `docs/PROJECT_SPEC.md` — Product vision and feature roadmap.
- ✓ `docs/ARCHITECTURE.md` — Technical architecture and design decisions.
- ✓ `docs/DATA_POLICY.md` — Scientific data integrity requirements and licensing.
- ✓ `docs/ROADMAP.md` — This file; development milestones and priorities.

### Acceptance Criteria
- ✓ All four documents created, reviewed, and corrected.
- ✓ Documents are internally consistent (no contradictions between features, architecture, and data policy).
- ✓ Unresolved questions are clearly labeled.
- ✓ No code written; only documentation.
- ✓ Example data and source metadata clearly marked as fictional.
- ✓ Temporal terminology clarified and consistent across all documents.

### Notes
- This milestone establishes the contract for all future work.
- Changes to these documents during later milestones should be exceptional and justified.
- Corrections after initial review have been applied; all architectural feedback incorporated.

---

## Milestone 1: Data Structures, Schemas, and Graph Foundation

**Status**: Planned  
**Duration**: ~2-3 weeks  
**Dependencies**: Milestone 0 complete

### Purpose
Establish foundational data structures and graph operations before any visualization. Build the architecture that supports both single and multiple phylogenetic hypotheses, with clear separation of taxonomy, phylogeny, and temporal data.

### Deliverables

#### JSON Schemas
- [ ] `data/schemas/taxonomy.schema.json`: Defines taxonomy structure (taxa, ranks, parents, sources).
- [ ] `data/schemas/hypothesis.schema.json`: Defines phylogenetic tree structure (terminal and internal nodes, hypothesis scoping).
- [ ] `data/schemas/divergence-estimates.schema.json`: Defines divergence time estimates with full temporal metadata.
- [ ] `data/schemas/source-metadata.schema.json`: Defines publication, methodology, and licensing metadata.

#### Data Loading and Validation
- [ ] **TaxonomyLoader** (`src/data/taxonomyLoader.js`): Load and validate taxonomy JSON; verify hierarchy integrity.
- [ ] **HypothesisLoader** (`src/data/hypothesisLoader.js`): Load and validate phylogenetic hypothesis JSON; verify terminal-taxonomy bindings.
- [ ] **DivergenceLoader** (`src/data/divergenceLoader.js`): Load and validate divergence estimates; link to hypothesis nodes.
- [ ] **SchemaValidator** (`src/data/schemaValidator.js`): Validate all data against JSON schemas; report detailed errors.

#### Graph Data Structure
- [ ] **GraphBuilder** (`src/graph/GraphBuilder.js`):
  - Constructor accepts hypothesis JSON and taxonomy data.
  - Methods: `addNode()`, `addEdge()`, `validate()`.
  - Performs structural validation (no cycles, all parents exist, all terminals reference valid taxa).
  - `build()` returns an immutable `PhyloGraph`.

- [ ] **PhyloGraph** (`src/graph/PhyloGraph.js`):
  - Immutable rooted tree structure.
  - Read-only query methods: `getParent()`, `getChildren()`, `getPathToRoot()`, `getMRCA()`, `getTaxonForTerminal()`.
  - No methods modify the graph after construction.
  - No coordinate constraint queries (coordinate freedom belongs to layout engines).

#### Graph Operations
- [ ] **GraphOperations** (`src/graph/graphOperations.js`):
  - `findMRCA(graph, nodeId1, nodeId2)`: Finds most recent common ancestor within a hypothesis.
  - `getPathToRoot(graph, nodeId)`: Returns path from node to root.
  - `buildPrunedGraph(graph, bookmarkedNodeIds)`: Creates subgraph with bookmarks and ancestors.
  - `validateTree(graph)`: Checks tree integrity (no cycles, valid parentage, etc.).

#### Taxonomy Resolution
- [ ] **TaxonomyResolver** (`src/graph/taxonomyResolver.js`):
  - `getTaxonForTerminal(graph, terminalNodeId)`: Resolves a terminal node to its taxon record.
  - `lookupTaxonDetails(taxonomyData, taxonId)`: Retrieves full taxonomic record.

#### Synthetic Test Data
- [ ] `data/test-fixtures/taxonomy-fixture.json`: Small synthetic taxonomy (30 taxa) clearly marked as test-only.
- [ ] `data/test-fixtures/hypothesis-fixture.json`: Small synthetic phylogenetic tree (20-30 nodes) clearly marked as test-only.
- [ ] `data/test-fixtures/divergence-fixture.json`: Sample divergence estimates clearly marked as FICTIONAL EXAMPLES.
- [ ] Explicit documentation that test fixtures are synthetic, not sourced from real publications.

#### Comprehensive Testing
- [ ] Unit tests for tree integrity validation:
  - Detect cycles.
  - Verify all parents exist.
  - Verify exactly one parent per non-root node.
  
- [ ] Unit tests for graph operations:
  - MRCA correctness with various tree topologies.
  - Path-to-root completeness and order.
  - Pruning preserves valid subtrees.
  
- [ ] Unit tests for taxonomy and hypothesis loading:
  - Schema validation accepts valid data, rejects invalid data.
  - Terminal nodes properly reference taxa.
  - Hypothesis-scoped node IDs are unique within hypothesis.
  
- [ ] Data integrity tests:
  - No orphaned nodes (all terminals link to existing taxa).
  - No orphaned divergence estimates (all link to existing nodes in hypothesis).
  - All sources cited in estimates have metadata.

#### Configuration and Build
- [ ] `package.json`: Define dependencies (testing framework, Node.js tooling; D3.js deferred to M2).
- [ ] Development server setup (local serving of ES modules).
- [ ] `README.md`: Setup and development instructions.

### Acceptance Criteria
- [ ] All JSON schemas are defined and validate correctly.
- [ ] Development environment works across platforms (macOS, Linux, Windows).
- [ ] All data loading and validation functions work correctly on test fixtures.
- [ ] Tree integrity validation catches all malformed data.
- [ ] MRCA computation is correct for all test cases.
- [ ] Pruning generates valid subgraphs with preserved relationships.
- [ ] Comprehensive behavioral and edge-case tests pass for all graph operations.
- [ ] Test fixtures are clearly marked as synthetic and not sourced from real publications.
- [ ] No real datasets are included yet.
- [ ] Architecture supports multiple hypotheses (not used yet, but structure is there).
- [ ] All graph modifications occur in builder phase; finalized graphs are immutable.

### Notes
- **No visualization yet**: This milestone is purely data structures, validation, and graph operations.
- **No D3.js**: Visualization and its dependencies are deferred to Milestone 2.
- **No real data yet**: Use only synthetic test fixtures.
- **Hypothesis-scoped architecture**: Design supports multiple phylogenetic hypotheses (used only in milestone 3+).
- **Clear taxonomy-phylogeny separation**: Taxonomy is loaded once; hypotheses reference taxa via terminal nodes.
- **Immutable graph design**: Graph structure cannot be modified after construction; layout engines receive read-only access.
- **"Complete" tree definition**: A complete tree means all nodes are defined with proper parent-child relationships; does not require every mammalian species, only those in the selected published dataset.

---

## Milestone 2: Free Force-Directed Graph Visualization

**Status**: Planned  
**Duration**: ~2-3 weeks  
**Dependencies**: Milestone 1 complete

### Purpose
Implement the free (unconstrained) force-directed layout for initial release, rendering phylogenetic hypotheses with D3.js physics simulation. This milestone focuses on visualization and layout; data structures and graph operations are complete from Milestone 1.

### Deliverables

#### Layout Engine
- [ ] **LayoutEngine Interface** (`src/layout/LayoutEngine.js`):
  - Abstract base class defining common interface for all layouts.
  - Methods: `compute()`, `getNodePosition()`, `getLayout()`, `getNodeUncertainty()`, `isXConstrained()`, `isYConstrained()`.
  - Coordinate constraint queries belong to layouts, not to graph.
  
- [ ] **FreeForceDirectedLayout** (`src/layout/FreeForceDirectedLayout.js`):
  - Implement D3.js force simulation (charge, link, collision forces).
  - `compute(previousLayout)`: Run simulation and return layout coordinates.
  - `getNodePosition(nodeId)`: Return {x, y} for a node.
  - `isXConstrained()` returns false, `isYConstrained()` returns false.
  - Configurable parameters: charge strength, link distance, collision radius, damping, convergence threshold.

#### Visualization Layer
- [ ] **PhyloVisualization** (`src/visualization/PhyloVisualization.js`):
  - Render SVG with D3.js (circles for nodes, lines for edges).
  - Update layout coordinates from layout engine.
  - Smooth transitions when layout changes.
  - Visual distinction: terminal nodes vs. internal nodes; extant vs. extinct.
  
- [ ] **SVG Rendering**:
  - Nodes: Circles with radius based on node type; different colors for terminal/internal.
  - Edges: Lines connecting parent-child relationships.
  - Viewport: Pan (D3 drag) and zoom (D3 zoom behavior) enabled.

#### Interaction Handler
- [ ] **InteractionHandler** (`src/visualization/interactionHandler.js`):
  - Click on a node: Select and emit event.
  - Hover on a node: Display tooltip with name.
  - Trigger details panel update on node selection.

#### UI Components
- [ ] **DetailsPanel** (`src/ui/detailsPanel.js`):
  - Display selected node type (terminal or internal).
  - For terminals: Show taxon name, common name, taxonomic rank, external references.
  - For terminals: Show path from taxon to root (lineage).
  - For internals: Show node ID and any available divergence estimates.
  
- [ ] **DivergenceDisplay** (`src/ui/divergenceDisplay.js`):
  - Display available divergence estimates for internal nodes.
  - Show central estimate, uncertainty bounds, uncertainty type, source, methodology.
  - Allow user selection among multiple estimates (for future time-axis layout).

#### Dependencies
- [ ] `package.json`: Add D3.js (and testing framework as needed).
- [ ] Update `README.md` with visualization setup instructions.

#### Testing
- [ ] Unit tests for layout engine.
- [ ] Visual regression tests: Compare SVG output to baseline (synthetic data only).
- [ ] Performance tests: Ensure smooth interaction (~60 FPS simulations).
- [ ] Interaction tests: Verify click/hover handling.

#### Styling
- [ ] `styles.css`: Basic styling for SVG, panels, UI elements.
- [ ] Responsive layout for desktop; mobile support deferred.

### Acceptance Criteria
- [ ] Force-directed layout renders all nodes and edges correctly.
- [ ] Pan and zoom work smoothly without performance degradation.
- [ ] Node selection triggers details panel update.
- [ ] Hovering displays accurate tooltips.
- [ ] Layout converges in < 2 seconds on test fixtures.
- [ ] All unit and visual tests pass.
- [ ] Application runs with test fixture data without errors.
- [ ] Code follows architecture: layout is independent of data, visualization is independent of graph structure.
- [ ] Test data is synthetic; documentation clearly indicates it is not sourced from real publications.

### Notes
- **Uses test fixtures only**: No real mammalian dataset yet.
- **Synthetic data only**: All node IDs and relationships are fictional test data.
- **Visualization is read-only**: No drag-to-reposition (layout is authoritative).
- **Layout parameters may require tuning**: Adjust based on performance testing.
- **Time-axis layout architecture prepared**: LayoutEngine interface supports future constrained layout without refactoring.

---

## Milestone 3: Real Mammalian Dataset and Data Curation

**Status**: Planned  
**Duration**: ~2-4 weeks (can overlap with Milestone 2)  
**Dependencies**: Milestone 1 complete (data structures defined)

### Purpose
Curate, validate, and format a real mammalian phylogenetic hypothesis and divergence estimates into the schema. This milestone focuses on data, not code.

### Deliverables

#### Dataset Selection and Acquisition
- [ ] Select a published mammalian phylogeny (e.g., dos Reis et al. 2018, or similar).
- [ ] Verify redistribution rights and license.
- [ ] Document source and citation requirements.

#### Data Extraction and Formatting
- [ ] Extract taxonomic information (species, genera, families, orders).
- [ ] Format taxonomy into schema: `data/taxonomy/mammals.json`.
- [ ] Extract phylogenetic tree topology.
- [ ] Format hypothesis into schema: `data/hypotheses/mammals-primary.json`.
- [ ] Extract divergence estimates and uncertainty ranges.
- [ ] Format divergence data into schema: `data/dates/divergence-estimates.json`.
- [ ] Create comprehensive source metadata: `data/dates/source-metadata.json`.

#### Data Validation
- [ ] Run schema validator on all formatted data.
- [ ] Validate tree structure (no cycles, all nodes valid, complete topology).
- [ ] Verify all terminals reference valid taxa.
- [ ] Verify all divergence estimates reference valid nodes.
- [ ] Cross-check sample values against published paper.
- [ ] Document any data transformations or assumptions.

#### Documentation
- [ ] Create `data/DATASET.md`: Details about the mammalian dataset.
  - Source publication and citation.
  - Number of species/nodes.
  - Date range of evolutionary tree.
  - License and redistribution terms.
  - Known limitations or gaps.
  - Decisions made during formatting.

#### Peer Review
- [ ] Have a domain expert (if available) spot-check accuracy.
- [ ] Document feedback and corrections applied.

### Acceptance Criteria
- [ ] Mammalian dataset is complete and valid against schema.
- [ ] All sources are cited with verified redistribution rights.
- [ ] Tree structure is validated (no errors).
- [ ] Data loads and renders in Milestone 2 visualization without errors.
- [ ] Spot checks confirm accuracy (e.g., known species in expected positions).
- [ ] Dataset documentation is complete and clear.
- [ ] Initial release will use this dataset.

### Notes
- **Dataset must be real and sourced**: No synthetic or averaged data.
- **Can proceed in parallel**: Doesn't depend on Milestone 2 visualization (data validation is independent).
- **Small initial dataset acceptable**: 200–300 species is sufficient for initial release if larger dataset is difficult to obtain.
- **Extensible structure**: Schema and format support future dataset additions.

---

## Milestone 4: Search and Taxon Discovery

**Status**: Planned  
**Duration**: ~1-2 weeks  
**Dependencies**: Milestones 2 and 3 complete

### Purpose
Enable users to search for and discover species within the visualization.

### Deliverables

#### Search Functionality
- [ ] **Search Bar** (`src/ui/searchBar.js`):
  - Input field for search queries.
  - Real-time full-text search (scientific name, common name, partial matches).
  - Case-insensitive matching.
  
- [ ] **SearchEngine** (`src/ui/searchEngine.js`):
  - Index taxa from taxonomy and hypothesis terminals.
  - Query matching and ranking.
  - Limit results to top N matches (e.g., 20).

#### Search UI
- [ ] Display matching species in a dropdown or results panel.
- [ ] Click a result to select and zoom to that node in the graph.
- [ ] Highlight search result in visualization.

#### Taxon Details Display
- [ ] Show full taxonomic path (Kingdom → Phylum → ... → Species).
- [ ] Display common names (if available).
- [ ] Show external references (ITIS, NCBI, Wikipedia, etc.).
- [ ] For internal nodes: Show node ID and associated divergence estimates.

#### Testing
- [ ] Unit tests for search matching and ranking.
- [ ] Performance tests: search should return results in < 100 ms.
- [ ] Test edge cases (empty query, special characters, no matches).

### Acceptance Criteria
- [ ] Search finds taxa by scientific name, common name, and partial matches.
- [ ] Results appear within 100 ms of user input.
- [ ] Clicking a result zooms to and highlights that node.
- [ ] Search is case-insensitive.
- [ ] No crashes on edge cases or invalid input.
- [ ] All search tests pass.

### Notes
- Search is critical for usability; performance and accuracy are essential.
- Supports discovery of both terminal (taxon) and internal (ancestor) nodes.

---

## Milestone 5: MRCA Comparison and Evolutionary Distance

**Status**: Planned  
**Duration**: ~1-2 weeks  
**Dependencies**: Milestone 4 complete

### Purpose
Allow users to explore evolutionary relationships by selecting two taxa and identifying their most recent common ancestor (MRCA).

### Deliverables

#### MRCA Selection UI
- [ ] **Dual Selection Interface** (`src/ui/mrca-selector.js`):
  - Two input fields or search boxes for selecting nodes.
  - Display selected node names/IDs clearly.
  - Clear or reset selections button.
  - Prevent selecting the same node twice.

#### MRCA Computation and Display
- [ ] Call `findMRCA()` graph operation within the current hypothesis.
- [ ] Display the MRCA node with its ID.
- [ ] Show the divergence time from MRCA to present (central estimate).
- [ ] Display uncertainty ranges for available divergence estimates.
- [ ] Show source and methodology for the displayed estimate.

#### Path Highlighting
- [ ] Highlight the evolutionary path from first selected node to MRCA (one color).
- [ ] Highlight the path from second selected node to MRCA (another color).
- [ ] Highlight the MRCA node prominently (distinct appearance).
- [ ] Clear highlighting when selections change.

#### Evolutionary Distance Summary
- [ ] Display time from first selected node to MRCA.
- [ ] Display time from second selected node to MRCA.
- [ ] Calculate and display total "evolutionary distance" if applicable.
- [ ] Show uncertainty ranges based on selected divergence estimate.

#### Multiple Divergence Estimates
- [ ] If multiple estimates exist for the MRCA node, display options.
- [ ] Allow user to select which estimate to use for display.
- [ ] Update path highlighting and time display based on selection.

#### Testing
- [ ] Unit tests for MRCA computation (verify against known pairs).
- [ ] Integration tests with path traversal.
- [ ] Visual tests for path highlighting.
- [ ] Test edge cases (same node selected twice, extinct nodes, etc.).

### Acceptance Criteria
- [ ] MRCA is correctly identified for any two valid nodes within a hypothesis.
- [ ] Paths are highlighted correctly and are visible.
- [ ] Divergence times are displayed accurately (from the selected estimate).
- [ ] MRCA computation is fast (< 10 ms).
- [ ] Multiple estimates are offered and can be switched.
- [ ] All tests pass.

### Notes
- This feature demonstrates phylogenetic relationships and evolutionary time.
- Clarifies divergence time (when lineages split) vs. other temporal concepts.
- Path highlighting must be visually clear without obscuring the graph.

---

## Milestone 6: Bookmarks and Tree Pruning

**Status**: Planned  
**Duration**: ~1-2 weeks  
**Dependencies**: Milestone 5 complete

### Purpose
Allow users to maintain a personalized subset of the tree (bookmarks) and visualize only bookmarked nodes and their common ancestors.

### Deliverables

#### Bookmarking
- [ ] **BookmarkManager** (`src/ui/bookmarkManager.js`):
  - Maintain in-memory set of bookmarked node IDs.
  - Persist bookmarks to browser localStorage (by node ID, works across hypotheses).
  - Bookmark button on each node in details panel.
  - Visual indicator (star/highlight) on bookmarked nodes in the graph.

#### Tree Pruning
- [ ] **PruningManager** (`src/ui/pruningManager.js`):
  - Toggle button: "Show All" ↔ "Show Only Bookmarks".
  - When pruning is active:
    - Display only bookmarked nodes and their ancestors.
    - Relayout graph to show pruned subgraph.
    - Preserve all ancestral relationships.
  - When pruning is off: Display full tree.

#### Pruned Graph Computation
- [ ] Call `buildPrunedGraph()` graph operation.
- [ ] Verify that the pruned graph is valid (all relationships preserved).
- [ ] Update visualization to show pruned tree.
- [ ] Preserve MRCA selections and path highlighting across pruning toggle.

#### State Persistence
- [ ] Bookmarks persist across page reloads (localStorage).
- [ ] Pruning state (on/off) persists across reloads.
- [ ] Toggling pruning preserves selected nodes and MRCA state.

#### Testing
- [ ] Unit tests for `buildPrunedGraph()` logic.
- [ ] Integration tests: add bookmarks → prune → verify visible nodes.
- [ ] Visual tests for pruned tree layout.
- [ ] Test with various bookmark combinations (0, 1, many).
- [ ] Test persistence across page reload.

### Acceptance Criteria
- [ ] Bookmarks are added/removed smoothly and have visual indicator.
- [ ] Bookmarks persist across page reloads.
- [ ] Pruned tree contains only bookmarked nodes and their ancestors (not other descendants).
- [ ] Pruned tree layout is valid and rendered correctly.
- [ ] Toggling pruning on/off preserves selection and MRCA state.
- [ ] Performance is acceptable even with many bookmarks.
- [ ] All tests pass.

### Notes
- Bookmarking enables personalized views for research or teaching purposes.
- Pruning must be fast even with hundreds of bookmarks.
- Ancestors of bookmarked nodes remain visible even if not explicitly bookmarked.

---

## Milestone 7: Deployment to GitHub Pages

**Status**: Planned  
**Duration**: ~1 week  
**Dependencies**: Milestones 1–6 complete

### Purpose
Make the application publicly accessible via GitHub Pages.

### Deliverables

#### Build and Asset Configuration
- [ ] Verify ES modules are served correctly on GitHub Pages (no build step necessary if supported).
- [ ] Configure asset paths to work at repository subpath.
- [ ] Optimize assets (minify CSS/JS if necessary for performance).
- [ ] Ensure data JSON files are accessible from the deployed site.

#### GitHub Pages Setup
- [ ] Configure repository settings to enable GitHub Pages.
- [ ] Deploy from the `main` branch (or `gh-pages` if needed).
- [ ] Verify site is accessible at the public GitHub Pages URL.

#### Public Documentation
- [ ] Update `README.md`: Project overview, features, setup instructions, and link to live site.
- [ ] Create `CONTRIBUTING.md`: Guidelines for contributing code or data.
- [ ] Add `LICENSE` file: Specify license (e.g., MIT for code; CC-BY or CC0 for data as appropriate).
- [ ] Add `ACKNOWLEDGMENTS.md`: Cite data sources and contributors.

#### Testing
- [ ] Verify application works at public URL (full test of all features).
- [ ] Test on multiple browsers (Chrome, Firefox, Safari, Edge).
- [ ] Verify data loads correctly from the deployed site.
- [ ] Check responsive design (desktop primary; mobile support limited but acceptable).
- [ ] Verify no console errors or warnings.

#### Performance and Optimization
- [ ] Measure page load time; target < 2 seconds for data + initial render.
- [ ] Verify force-directed layout performs smoothly (60 FPS).
- [ ] Test with real mammalian dataset performance.
- [ ] Optimize if necessary (caching, lazy loading data).

#### Privacy and Security
- [ ] Ensure no external API calls are required.
- [ ] Verify no user data is collected or transmitted.
- [ ] All data is served from the repository.

### Acceptance Criteria
- [ ] Application is accessible at the GitHub Pages URL.
- [ ] All features (search, MRCA, bookmarks, pruning) work on the public site.
- [ ] Initial page load is < 2 seconds.
- [ ] Works on Chrome, Firefox, and Safari.
- [ ] No console errors or warnings.
- [ ] Data loads correctly from the deployed site.
- [ ] Force-directed layout performs smoothly.

### Notes
- This milestone marks the public launch of PhyloExplorer.
- Real-world usage may reveal performance or usability improvements for future releases.

---

## Milestone 8: Time-Axis Layout (Future Release)

**Status**: Planned (post-initial release)  
**Duration**: ~3-4 weeks  
**Dependencies**: Milestones 1–7 complete

### Purpose
Implement the time-constrained layout, where X positions are determined by divergence estimates and Y positions are calculated by one-dimensional physics.

### Deliverables

#### Time-Axis Layout Engine
- [ ] **TimeAxisLayout** (`src/layout/TimeAxisLayout.js`):
  - Inherit from LayoutEngine interface.
  - `isXConstrained()` returns true.
  - Assign X positions deterministically from selected divergence estimates.
  - Calculate Y positions using 1D physics (spring to parent, sibling repulsion).
  - `compute(previousLayout)`: Run physics simulation until convergence.

#### Divergence Estimate Selection
- [ ] UI to select which divergence estimate source to use for X positioning.
- [ ] Update layout when estimate selection changes.
- [ ] Warn if node has no available estimate.

#### Uncertainty Visualization
- [ ] Optionally represent uncertainty bounds visually (node width, transparency, error bars).
- [ ] Display uncertainty alongside estimate in details panel.

#### Testing
- [ ] Unit tests for X position assignment (verify deterministic behavior).
- [ ] Integration tests for Y position calculation.
- [ ] Visual regression tests for time-axis layout.
- [ ] Performance tests on real mammalian dataset.

### Acceptance Criteria
- [ ] X positions are correctly assigned from divergence estimates.
- [ ] Y positions are calculated without cycles or invalid layouts.
- [ ] Layout converges smoothly and displays clearly.
- [ ] Time calibration is visually apparent (older divergences to the right).
- [ ] Users can select different estimate sources and see layout update.
- [ ] All tests pass.

---

## Post-Release Roadmap

The following milestones are planned for expansion after the initial release:

### Milestone 9: Multiple Phylogenetic Hypotheses
- Add support for loading and switching between multiple phylogenetic hypotheses.
- Hypothesis selector UI.
- MRCA and other operations respect the selected hypothesis.

### Milestone 10: Extended Taxon Groups
- Add non-mammalian taxa (birds, reptiles, amphibians, fish).
- Support for multiple independent trees or combined dataset.

### Milestone 11: PhyloPic Integration
- Fetch and cache PhyloPic silhouettes.
- Display silhouettes on terminal nodes.
- Proper attribution and license compliance.

### Milestone 12: Fossil Integration
- Add first fossil occurrence dates.
- Distinguish taxon origin from divergence time.
- Extinct lineage visualization.

### Milestone 13: Advanced Analysis Tools
- Phylogenetic distance matrices.
- Speciation and extinction rate analysis.
- Cladogram export (Newick, Nexus formats).
---

## Summary Table: Initial Release Milestones

| Milestone | Title | Duration | Start After | Status |
|-----------|-------|----------|-------------|--------|
| 0 | Project Documentation | 1-2 weeks | — | ✓ Current |
| 1 | Data Structures & Graph Foundation | 2-3 weeks | M0 | Planned |
| 2 | Force-Directed Graph Visualization | 2-3 weeks | M1 | Planned |
| 3 | Real Mammalian Dataset (can overlap M2) | 2-4 weeks | M1 | Planned |
| 4 | Search & Taxon Discovery | 1-2 weeks | M2, M3 | Planned |
| 5 | MRCA Comparison | 1-2 weeks | M4 | Planned |
| 6 | Bookmarks & Tree Pruning | 1-2 weeks | M5 | Planned |
| 7 | GitHub Pages Deployment | 1 week | M1–6 | Planned |
| 8 | Time-Axis Layout | 3-4 weeks | M1–7 | Post-release |

**Initial Release Completion**: Milestones 0–7 complete.  
**Estimated timeline**: 3–4 months for initial release, depending on team size and data availability.

---

## Flexibility and Adjustments

This roadmap is a guide, not a rigid mandate. Adjustments may be necessary based on:
- Unexpected technical challenges.
- Data availability or licensing issues.
- Community feedback or requests.
- Resource availability.

Any significant deviations from this roadmap should be documented and explained before implementation.

---

## Unresolved Questions

1. **Dataset selection**: Which published mammalian phylogeny is most appropriate for the initial release? Does it have verified redistribution rights?

2. **Data size**: Should the initial release include 200–300 species or attempt a more comprehensive dataset? This affects development timeline and performance requirements.

3. **Build tools**: Can ES modules be served directly from GitHub Pages, or is a build step necessary?

4. **Divergence estimate selection**: When multiple conflicting estimates exist, how should the UI present them? Should one be default, or always require user selection?

5. **Mobile support**: Should the initial release prioritize mobile responsiveness, or is desktop primary sufficient?

These questions should be resolved before or during Milestone 1.
