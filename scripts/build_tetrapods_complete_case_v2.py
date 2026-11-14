#!/usr/bin/env python3
"""
Build Tetrapods dataset with strict complete-case inclusion (57 species).

A species is included ONLY when it passes ALL THREE requirements:
1. TimeTree: exact scientific name is terminal
2. GBIF: exact species-rank match
3. PhyloPic: verified species-level image

This builder:
- Derives the 57-species set from existing audit files
- Rebuilds tree directly from TimeTree Newick
- Preserves topology, multifurcations, and branch lengths
- Generates hypothesis.json, taxonomy.json, silhouette-mapping.json
"""

import json
import sys
import subprocess
from Bio import Phylo
from io import StringIO
from pathlib import Path
from collections import defaultdict

REPO_ROOT = Path(__file__).parent.parent
DATA_DIR = REPO_ROOT / 'data'
TETRAPODS_DIR = DATA_DIR / 'tetrapods'
TIMETREE_NEWICK = DATA_DIR / 'time_tree_raw_data' / 'TT6_Tetrapods.nwk'

def load_complete_case_set():
    """Load the 57-species complete-case intersection."""
    with open(TETRAPODS_DIR / 'timetree_check.json') as f:
        tt_check = json.load(f)

    with open(TETRAPODS_DIR / 'taxonomy_check_gbif.json') as f:
        gbif_check = json.load(f)

    with open(TETRAPODS_DIR / 'phylopic_check.json') as f:
        phylopic_check = json.load(f)

    with open(TETRAPODS_DIR / 'roster.json') as f:
        roster = json.load(f)

    # Build sets
    timetree_matched = {r['species_id'] for r in tt_check['results'] if r.get('matched') == True}
    gbif_matched = {r['species_id'] for r in gbif_check['results'] if r.get('gbif_match') and r['gbif_match'].get('rank') == 'SPECIES'}
    phylopic_verified = {r['species_id'] for r in phylopic_check['results'] if r.get('status') == 'verified_exact_species_image'}

    # Intersection
    included = timetree_matched & gbif_matched & phylopic_verified

    # Build lookups
    roster_by_id = {s['id']: s for s in roster['species']}
    tt_by_id = {r['species_id']: r for r in tt_check['results']}
    gbif_by_id = {r['species_id']: r for r in gbif_check['results']}
    phylopic_by_id = {r['species_id']: r for r in phylopic_check['results']}

    print(f"Complete-case set: {len(included)} species")
    print(f"  Mammals: {len([s for s in included if roster_by_id[s]['group'] == 'mammals'])}")
    print(f"  Birds: {len([s for s in included if roster_by_id[s]['group'] == 'birds'])}")
    print(f"  Reptiles: {len([s for s in included if roster_by_id[s]['group'] == 'reptiles'])}")
    print(f"  Amphibians: {len([s for s in included if roster_by_id[s]['group'] == 'amphibians'])}")

    return included, roster_by_id, tt_by_id, gbif_by_id, phylopic_by_id

def build_label_to_species_map(included, tt_by_id):
    """Map TimeTree labels to species IDs."""
    mapping = {}
    for species_id in included:
        tt_result = tt_by_id.get(species_id)
        if tt_result and tt_result.get('matched'):
            label = tt_result['expected_tree_label']
            mapping[label] = species_id
    return mapping

def load_and_prune_tree(label_to_species):
    """Load TimeTree and prune to selected terminals."""
    print(f"\nLoading TimeTree from {TIMETREE_NEWICK}...")
    with open(TIMETREE_NEWICK) as f:
        newick_str = f.read().strip()

    tree = Phylo.read(StringIO(newick_str), "newick")

    # Count original
    orig_terminals = len(list(tree.find_clades(terminal=True)))
    orig_multifurcations = sum(1 for c in tree.find_clades(terminal=False) if len(c.clades) > 2)
    print(f"  Original tree: {orig_terminals} terminals, {orig_multifurcations} multifurcating nodes")

    # Mark which terminals to keep (build mapping from clade object ID to species ID)
    clade_to_species = {}
    for clade in tree.find_clades(terminal=True):
        label = (clade.name or "").strip('"')
        if label in label_to_species:
            clade_to_species[id(clade)] = label_to_species[label]

    print(f"  Marked {len(clade_to_species)} terminals for retention")

    # Prune: recursively remove branches with no retained descendants
    def has_retained_desc(clade):
        if clade.is_terminal():
            return id(clade) in clade_to_species
        return any(has_retained_desc(child) for child in clade.clades)

    def prune_recursive(clade):
        if not clade.is_terminal():
            clade.clades = [c for c in clade.clades if has_retained_desc(c)]
            for child in clade.clades:
                prune_recursive(child)

    prune_recursive(tree.root)

    # Count after pruning
    pruned_terminals = len(list(tree.find_clades(terminal=True)))
    pruned_multifurcations = sum(1 for c in tree.find_clades(terminal=False) if len(c.clades) > 2)
    unary_before_suppress = sum(1 for c in tree.find_clades(terminal=False) if len(c.clades) == 1)
    print(f"  After pruning: {pruned_terminals} terminals, {pruned_multifurcations} multifurcations, {unary_before_suppress} unary nodes")

    # Suppress unary internal nodes while accumulating branch lengths.
    # DO NOT suppress unary nodes whose only child is a terminal.
    # CORRECTED: Only transfer the child's branch_length to grandchildren,
    # not the parent's (the parent's was already counted from its parent).
    def suppress_unary(clade, is_root=False):
        if clade.is_terminal():
            return

        # Process children first (post-order)
        for child in clade.clades:
            suppress_unary(child, is_root=False)

        # Suppress unary nodes ONLY when the only child is internal AND not at root
        while len(clade.clades) == 1 and not clade.clades[0].is_terminal() and not is_root:
            only_child = clade.clades[0]
            # CORRECTED: Transfer only the child's branch_length to grandchildren
            only_child_bl = only_child.branch_length if only_child.branch_length is not None else 0.0

            for grandchild in only_child.clades:
                if grandchild.branch_length is not None:
                    grandchild.branch_length += only_child_bl
                else:
                    grandchild.branch_length = only_child_bl

            # Replace this node's clade list
            clade.clades = only_child.clades

    suppress_unary(tree.root, is_root=True)

    # Count after suppression
    unary_after_suppress = sum(1 for c in tree.find_clades(terminal=False) if len(c.clades) == 1)
    multi_after_suppress = sum(1 for c in tree.find_clades(terminal=False) if len(c.clades) > 2)
    suppressed_count = unary_before_suppress - unary_after_suppress
    print(f"  After suppression: {suppressed_count} unary nodes removed, {multi_after_suppress} multifurcations preserved")

    # Return tree and rebuild the clade_to_species mapping (clade objects should be preserved)
    clade_to_species_after = {}
    for clade in tree.find_clades(terminal=True):
        label = (clade.name or "").strip('"')
        if label in label_to_species:
            clade_to_species_after[id(clade)] = label_to_species[label]

    print(f"  After pruning, retained {len(clade_to_species_after)} species-mapped terminals")

    return tree, clade_to_species_after, orig_multifurcations, pruned_multifurcations, multi_after_suppress

def build_hypothesis(tree, clade_to_species):
    """Convert tree to hypothesis.json format."""
    print(f"\nBuilding hypothesis.json...")

    # Assign IDs
    node_id_map = {}
    internal_counter = 0

    # First pass: assign IDs to all clades
    for clade in tree.find_clades():
        if clade.is_terminal():
            species_id = clade_to_species.get(id(clade))
            if species_id:
                assigned_id = f"tax_{species_id}"
            else:
                assigned_id = None  # Shouldn't happen
        else:
            if clade == tree.root:
                assigned_id = "ancestor_phylo_tetrapods_root"
            else:
                assigned_id = f"ancestor_phylo_tetrapods_{internal_counter:05d}"
                internal_counter += 1
        node_id_map[id(clade)] = assigned_id

    # Second pass: build node records
    nodes = []
    for clade in tree.find_clades():
        assigned_id = node_id_map[id(clade)]
        if not assigned_id:
            continue  # Skip unmatched nodes

        node = {
            'id': assigned_id,
            'type': 'terminal' if clade.is_terminal() else 'internal',
            'parentId': None,
            'children': []
        }

        if clade.branch_length is not None:
            node['branch_length'] = clade.branch_length

        if hasattr(clade, 'confidence') and clade.confidence is not None:
            node['confidence'] = clade.confidence

        if clade.name:
            node['original_name'] = clade.name.strip('"')

        if clade.is_terminal() and assigned_id.startswith('tax_'):
            node['taxonId'] = assigned_id

        nodes.append(node)

    # Third pass: build parent-child relationships
    for clade in tree.find_clades():
        assigned_id = node_id_map.get(id(clade))
        if not assigned_id:
            continue

        for child_clade in clade.clades:
            child_id = node_id_map.get(id(child_clade))
            if not child_id:
                continue

            # Update node records
            for node in nodes:
                if node['id'] == assigned_id:
                    node['children'].append(child_id)
                elif node['id'] == child_id:
                    node['parentId'] = assigned_id

    root_id = node_id_map.get(id(tree.root))

    hypothesis = {
        'hypothesisId': 'phylo_tetrapods',
        'hypothesisName': 'TimeTree Tetrapods (57 species complete-case)',
        'source': 'http://www.timetree.org/',
        'sourceMetadata': {
            'title': 'TimeTree Database - Tetrapods',
            'url': 'http://www.timetree.org/',
            'version': '1.0',
            'accessDate': '2025-01-13',
            'description': 'Pruned to 57 species with complete TimeTree terminal match, GBIF species-rank match, and PhyloPic verified species-level image'
        },
        'terminalIdPrefix': 'tax_',
        'internalIdPrefix': 'ancestor_phylo_tetrapods_',
        'rootNodeId': root_id,
        'nodes': nodes
    }

    terminals = [n for n in nodes if n['type'] == 'terminal']
    internals = [n for n in nodes if n['type'] == 'internal']
    print(f"  Generated {len(nodes)} nodes ({len(terminals)} terminals, {len(internals)} internals)")

    return hypothesis

def build_taxonomy(included, gbif_by_id, roster_by_id):
    """Build taxonomy.json."""
    print(f"\nBuilding taxonomy.json...")

    taxonomy_list = []
    for species_id in sorted(included):
        gbif_result = gbif_by_id.get(species_id)
        roster_entry = roster_by_id.get(species_id)

        if not gbif_result or not roster_entry:
            continue

        gbif_match = gbif_result.get('gbif_match', {})

        record = {
            'id': f"tax_{species_id}",
            'scientificName': gbif_match.get('acceptedUsageName') or gbif_match.get('scientificName', roster_entry['scientific_name']),
            'commonName': roster_entry['common_name'],
            'rank': gbif_match.get('rank', 'SPECIES'),
            'parent': None,
            'source': 'GBIF',
            'sourceId': str(gbif_match.get('usageKey', '')),
            'extinct': False,
            'notes': ''
        }
        taxonomy_list.append(record)

    taxonomy = {
        'taxonomy': taxonomy_list,
        'metadata': {
            'source': 'GBIF',
            'license': 'CC0 1.0',
            'accessDate': '2025-01-13',
            'version': '1.0',
            'notes': 'Species-rank taxonomy records for 57 Tetrapods species in complete-case dataset. Includes only species with exact species-rank matches in GBIF and verified species-level PhyloPic images.'
        }
    }

    print(f"  Generated {len(taxonomy_list)} taxonomy records")
    return taxonomy

def build_silhouette_mapping(included):
    """Build silhouette-mapping.json from existing data."""
    print(f"\nBuilding silhouette-mapping.json...")

    with open(TETRAPODS_DIR / 'silhouette-mapping.json') as f:
        existing = json.load(f)

    existing_mappings = existing.get('mappings', {})
    new_mappings = {}

    for species_id in included:
        tax_id = f"tax_{species_id}"
        if tax_id in existing_mappings:
            new_mappings[tax_id] = existing_mappings[tax_id]

    silhouettes = {
        'source': 'PhyloPic',
        'version': '1.0',
        'created': '2026-11-13',
        'mappings': new_mappings
    }

    print(f"  Included {len(silhouettes['mappings'])} image mappings")
    return silhouettes

def validate_enriched_hypothesis(hypothesis, expected_node_count=167, expected_terminal_count=57,
                                 expected_internal_count=110, expected_root_age=352.08192,
                                 age_tolerance=1e-5, verbose=True):
    """
    Validate enriched hypothesis with all 7 hardened checks.

    Args:
        hypothesis: The hypothesis dictionary with nodes and rootNodeId
        expected_node_count: Expected total nodes (default 167)
        expected_terminal_count: Expected terminal nodes (default 57)
        expected_internal_count: Expected internal nodes (default 110)
        expected_root_age: Expected root age in Ma (default 352.08192)
        age_tolerance: Tolerance for age comparisons (default 1e-5)
        verbose: Whether to print validation progress (default True)

    Raises:
        ValueError: If validation fails
    """
    import math

    if verbose:
        print(f"Validating enriched hypothesis (hardened validation)...")

    nodes_by_id = {n['id']: n for n in hypothesis['nodes']}

    # Validation 1: Exact node counts
    total_nodes = len(hypothesis['nodes'])
    terminals = [n for n in hypothesis['nodes'] if n['type'] == 'terminal']
    internals = [n for n in hypothesis['nodes'] if n['type'] == 'internal']

    if total_nodes != expected_node_count:
        raise ValueError(f"Total node count mismatch: {total_nodes} != {expected_node_count}")
    if len(terminals) != expected_terminal_count:
        raise ValueError(f"Terminal count mismatch: {len(terminals)} != {expected_terminal_count}")
    if len(internals) != expected_internal_count:
        raise ValueError(f"Internal node count mismatch: {len(internals)} != {expected_internal_count}")
    if verbose:
        print(f"  ✓ Node counts correct ({expected_node_count} total, {expected_terminal_count} terminals, {expected_internal_count} internals)")

    # Validation 2: Unique node IDs
    node_ids = [n['id'] for n in hypothesis['nodes']]
    if len(node_ids) != len(set(node_ids)):
        duplicates = [nid for nid in set(node_ids) if node_ids.count(nid) > 1]
        raise ValueError(f"Duplicate node IDs: {duplicates}")
    if verbose:
        print(f"  ✓ All node IDs are unique")

    # Validation 3: All nodes have age_ma property with numeric, finite values
    if verbose:
        print("  Validating age_ma properties...")
    for node in hypothesis['nodes']:
        if 'age_ma' not in node:
            raise ValueError(f"Node {node['id']} missing age_ma property")

        age = node['age_ma']

        # Reject booleans even though bool is subclass of int
        if isinstance(age, bool):
            raise ValueError(f"Node {node['id']} age_ma is boolean: {age}")

        # Must be numeric
        if not isinstance(age, (int, float)):
            raise ValueError(f"Node {node['id']} age_ma is not numeric: {type(age).__name__}")

        # Must be finite
        if not math.isfinite(age):
            raise ValueError(f"Node {node['id']} age_ma is not finite: {age}")
    if verbose:
        print(f"  ✓ All {total_nodes} nodes have numeric, finite age_ma")

    # Validation 4: Root age is exactly correct
    root_id = hypothesis.get('rootNodeId')
    if not root_id:
        raise ValueError(f"Missing rootNodeId")
    if root_id not in nodes_by_id:
        raise ValueError(f"Root ID {root_id} not found in nodes")

    root_node = nodes_by_id[root_id]
    root_age = root_node['age_ma']

    if abs(root_age - expected_root_age) > age_tolerance:
        raise ValueError(f"Root age incorrect: {root_age} != {expected_root_age} (error: {abs(root_age - expected_root_age):.8f})")
    if verbose:
        print(f"  ✓ Root age correct: {root_age:.5f} Ma")

    # Validation 5: All terminal ages satisfy abs(age_ma) <= tolerance
    if verbose:
        print("  Validating terminal ages...")
    terminal_age_violations = []
    for term in terminals:
        age = term['age_ma']
        if abs(age) > age_tolerance:
            terminal_age_violations.append({
                'id': term['id'],
                'age': age,
                'deviation': abs(age)
            })

    if terminal_age_violations:
        raise ValueError(f"Found {len(terminal_age_violations)} terminals with invalid ages: {terminal_age_violations[0]['id']}: {terminal_age_violations[0]['age']:.8f} Ma")
    if verbose:
        print(f"  ✓ All {len(terminals)} terminal ages within tolerance")

    # Validation 6: Verify ages match accumulated branch lengths (independent recalculation)
    if verbose:
        print("  Independent branch length verification...")
    branch_mismatches = []

    for node in hypothesis['nodes']:
        stored_age = node['age_ma']

        # Calculate accumulated distance from root, excluding root's own branch_length
        accumulated_distance = 0.0
        current = node

        while current['parentId'] is not None:
            parent = nodes_by_id[current['parentId']]
            if current['branch_length'] is not None:
                accumulated_distance += current['branch_length']
            current = parent

        # Expected age from accumulated distance
        expected_age = expected_root_age - accumulated_distance
        expected_age_rounded = round(expected_age, 5)

        # Check match
        if abs(stored_age - expected_age_rounded) > age_tolerance:
            branch_mismatches.append({
                'node': node['id'],
                'stored': stored_age,
                'expected': expected_age_rounded,
                'error': abs(stored_age - expected_age_rounded),
                'accumulated_distance': accumulated_distance
            })

    if branch_mismatches:
        raise ValueError(f"Found {len(branch_mismatches)} age-to-branch-length mismatches: {branch_mismatches[0]['node']}: stored={branch_mismatches[0]['stored']:.5f}, expected={branch_mismatches[0]['expected']:.5f}")
    if verbose:
        print(f"  ✓ All {total_nodes} ages verified against branch lengths")

    # Validation 7: Verify parent ages >= child ages (temporal consistency)
    if verbose:
        print("  Validating temporal consistency...")
    temporal_violations = []

    for node in hypothesis['nodes']:
        if node['parentId'] is not None:
            parent = nodes_by_id[node['parentId']]
            parent_age = parent['age_ma']
            child_age = node['age_ma']

            # Parent should be older than or equal to child, within tolerance
            if parent_age < child_age - age_tolerance:
                temporal_violations.append({
                    'child': node['id'],
                    'child_age': child_age,
                    'parent': parent['id'],
                    'parent_age': parent_age,
                    'violation': child_age - parent_age
                })

    if temporal_violations:
        raise ValueError(f"Found {len(temporal_violations)} temporal inconsistencies: {temporal_violations[0]['child']} ({temporal_violations[0]['child_age']:.5f}) > {temporal_violations[0]['parent']} ({temporal_violations[0]['parent_age']:.5f})")
    if verbose:
        print(f"  ✓ All {total_nodes - 1} parent-child pairs temporally consistent")


def main():
    print("=" * 80)
    print("BUILD TETRAPODS DATASET (COMPLETE-CASE)")
    print("=" * 80)

    # Stage 1: Load complete-case set
    included, roster_by_id, tt_by_id, gbif_by_id, phylopic_by_id = load_complete_case_set()

    # Stage 2: Build mapping
    label_to_species = build_label_to_species_map(included, tt_by_id)

    # Stage 3: Load and prune tree
    tree, clade_to_species, orig_multi, pruned_multi, final_multi = load_and_prune_tree(label_to_species)

    # Stage 4: Build outputs
    hypothesis = build_hypothesis(tree, clade_to_species)
    taxonomy = build_taxonomy(included, gbif_by_id, roster_by_id)
    silhouettes = build_silhouette_mapping(included)

    # Stage 5: Save
    print(f"\nSaving outputs...")
    TETRAPODS_DIR.mkdir(parents=True, exist_ok=True)

    with open(TETRAPODS_DIR / 'hypothesis.json', 'w') as f:
        json.dump(hypothesis, f, indent=2)
    print(f"  ✓ hypothesis.json")

    with open(TETRAPODS_DIR / 'taxonomy.json', 'w') as f:
        json.dump(taxonomy, f, indent=2)
    print(f"  ✓ taxonomy.json")

    with open(TETRAPODS_DIR / 'silhouette-mapping.json', 'w') as f:
        json.dump(silhouettes, f, indent=2)
    print(f"  ✓ silhouette-mapping.json")

    # Stage 6: Enrich with node ages
    print(f"\nEnriching hypothesis with node ages...")
    enrichment_script = REPO_ROOT / 'scripts' / 'add_node_ages_tetrapods.py'
    try:
        result = subprocess.run(
            [sys.executable, str(enrichment_script)],
            capture_output=True,
            text=True,
            check=True
        )
        print(result.stdout, end='')
    except subprocess.CalledProcessError as e:
        print(f"✗ Age enrichment failed with exit code {e.returncode}")
        print(f"stderr:\n{e.stderr}")
        sys.exit(1)
    except FileNotFoundError:
        print(f"✗ Enrichment script not found: {enrichment_script}")
        sys.exit(1)

    # Stage 7: Comprehensive post-enrichment validation
    print(f"\nValidating enriched hypothesis...")
    with open(TETRAPODS_DIR / 'hypothesis.json') as f:
        enriched_hypothesis = json.load(f)

    try:
        validate_enriched_hypothesis(enriched_hypothesis, verbose=True)
    except ValueError as e:
        print(f"✗ Validation failed: {e}")
        sys.exit(1)

    # Stage 8: Report
    print(f"\n" + "=" * 80)
    print("COMPLETION REPORT")
    print("=" * 80)
    print(f"\nIncluded species: {len(included)}")
    print(f"Tree nodes: {len(hypothesis['nodes'])}")
    print(f"  - Terminals: {len([n for n in hypothesis['nodes'] if n['type'] == 'terminal'])}")
    print(f"  - Internal: {len([n for n in hypothesis['nodes'] if n['type'] == 'internal'])}")
    print(f"Taxonomy records: {len(taxonomy['taxonomy'])}")
    print(f"PhyloPic mappings: {len(silhouettes['mappings'])}")
    print(f"\nMultifurcations: {orig_multi} (original) → {pruned_multi} (after pruning) → {final_multi} (after suppression)")

    # Verify correspondence
    term_ids = {n['id'] for n in hypothesis['nodes'] if n['type'] == 'terminal'}
    tax_ids = {t['id'] for t in taxonomy['taxonomy']}
    img_ids = set(silhouettes['mappings'].keys())

    missing_tax = term_ids - tax_ids
    missing_img = term_ids - img_ids

    if missing_tax:
        print(f"\nWARNING: {len(missing_tax)} terminals missing taxonomy")
    else:
        print(f"\n✓ All terminals have taxonomy records")

    if missing_img:
        print(f"WARNING: {len(missing_img)} terminals missing images")
    else:
        print(f"✓ All terminals have image mappings")

    orphaned_tax = tax_ids - term_ids
    if orphaned_tax:
        print(f"WARNING: {len(orphaned_tax)} orphaned taxonomy records")
    else:
        print(f"✓ No orphaned taxonomy records")

    print("\n" + "=" * 80)

if __name__ == '__main__':
    main()
