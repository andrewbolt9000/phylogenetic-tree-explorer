# AGENTS.md — PhyloExplorer

## 1. Project purpose

PhyloExplorer is a static, browser-based application for exploring mammalian evolutionary relationships through interactive phylogenetic trees.

The initial release will focus on mammals, with an architecture that can eventually accommodate larger and more diverse datasets.

The complete product requirements are maintained in:

- `docs/PROJECT_SPEC.md`
- `docs/ARCHITECTURE.md`
- `docs/DATA_POLICY.md`
- `docs/ROADMAP.md`

These documents are the authoritative project specification. Read the relevant documents before making architectural or implementation decisions.

## 2. Core product vision

The long-term application includes:

- Interactive force-directed phylogenetic graph.
- Evolutionary time-axis graph with horizontal time positioning and one-dimensional vertical physics.
- PhyloPic SVG silhouettes for animal nodes.
- Taxonomic information and external references.
- Multiple published divergence estimates with uncertainty ranges and source citations.
- Animal search and individual taxon details.
- Selection of two animals and identification of their most recent common ancestor (MRCA).
- Highlighting of evolutionary paths between selected animals and their MRCA.
- Bookmarked animals.
- Filtering and pruning the tree to bookmarked animals and their ancestors.
- Zooming, panning, and support for larger datasets.
- Static deployment through GitHub Pages.

Do not attempt to implement the entire vision in a single task. Follow the roadmap incrementally.

## 3. Architectural requirements

### Application technology

- Use HTML, CSS, JavaScript ES modules, and D3.js.
- Use static JSON datasets.
- Target GitHub Pages hosting.
- Do not introduce a backend or database unless explicitly approved.
- Avoid unnecessary frameworks and dependencies.
- Ensure asset paths work when the site is hosted from a GitHub Pages repository subpath.

### Data and graph architecture

- Keep scientific data separate from visualization code.
- Use stable identifiers for taxa and ancestral nodes.
- Represent parent-child relationships explicitly.
- Treat the underlying phylogenetic tree as authoritative.
- Never allow visual layout calculations to modify evolutionary relationships.
- Separate graph data, graph operations, and layout implementations.
- Both graph layouts must use the same underlying graph model.
- Preserve application state when switching layouts wherever practical.

### Evolutionary time

- Store dates in millions of years ago (Ma).
- Preserve multiple published estimates independently.
- Store uncertainty ranges when available.
- Never silently average conflicting estimates.
- Distinguish divergence estimates, taxon origins, and first fossil occurrences.
- Record the source and methodology for every estimate.

### Scientific integrity and licensing

- Never invent scientific data, relationships, dates, sources, identifiers, or licenses.
- Never treat an unverified relationship as established fact.
- Record provenance for imported data.
- Verify redistribution rights before including external datasets or media in the repository.
- Do not assume that API accessibility implies permission to redistribute.
- Preserve required image attribution and licensing information.

## 4. Development workflow

For every task:

1. Read this file.
2. Read relevant project documentation.
3. Inspect the existing repository and its conventions before changing anything.
4. Understand the current implementation before modifying it.
5. Make the smallest coherent change that completes the requested task.
6. Add or update automated tests where appropriate.
7. Run relevant tests and validation.
8. Report exactly what changed and what was tested.

Do not rewrite working code unnecessarily.

Do not introduce unrelated features or refactoring into a narrowly scoped task.

Do not assume that a previous implementation is correct without inspecting it.

## 5. Incremental development

- Follow `docs/ROADMAP.md`.
- Work on the current milestone only.
- Do not automatically proceed to the next milestone.
- Do not implement future features merely because they are described in the project specification.
- Identify architectural implications of future features, but implement them only when scheduled.
- Stop and report when the requested milestone is complete.

If a requirement is ambiguous or conflicts with the existing architecture, explain the issue and propose a solution rather than making a consequential assumption.

## 6. Code quality

- Prefer simple, readable, modular code.
- Use meaningful names and consistent formatting.
- Avoid duplicated logic.
- Keep modules focused on specific responsibilities.
- Handle invalid or missing data explicitly.
- Avoid unnecessary abstractions and premature optimization.
- Add comments to explain non-obvious decisions, not to narrate obvious code.
- Do not suppress errors merely to make tests pass.

## 7. Testing and validation

- Validate imported datasets before they are used by the application.
- Test tree integrity, identifiers, parent-child relationships, and date records.
- Add regression tests for bug fixes.
- Do not claim tests passed unless they were actually run.
- Report failures and limitations honestly.

## 8. Dependencies and external resources

- Do not install dependencies without a task requiring them.
- Prefer established, maintained libraries.
- Document new dependencies and why they are needed.
- Do not make the deployed application depend on external APIs for essential functionality.
- Bundle required runtime assets locally.

## 9. Task completion reports

At the end of each task, report:

- Summary of changes.
- Files created, modified, or deleted.
- Tests and validation performed, including results.
- Any unresolved issues or assumptions.
- Whether the requested milestone is complete.

Wait for explicit instructions before starting another milestone.

## 10. Priority of instructions

If instructions conflict, use this order:

1. Explicit instructions in the current user task.
2. This `AGENTS.md` and the authoritative project specifications.
3. Existing repository conventions and established architecture.
4. General coding preferences.

Never silently discard a scientific integrity, licensing, or data provenance requirement.
