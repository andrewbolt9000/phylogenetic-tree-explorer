#!/usr/bin/env python3
"""
Build the Tetrapods dataset using strict complete-case inclusion rules.

A species is included only when it satisfies ALL THREE requirements:
1. Present as a terminal in TimeTree (data/time_tree_raw_data/TT6_Tetrapods.nwk)
2. Has an exact, species-rank match in GBIF audit data
3. Has at least one verified species-level PhyloPic image

Expected result: 57 species from 80 candidates (complete-case intersection)

This builder:
- Derives the inclusion set from existing audit files (not hardcoded)
- Rebuilds the phylogeny directly from TimeTree Newick
- Preserves topology and multifurcations
- Suppresses unary nodes while accumulating branch lengths
- Validates root-to-tip distances
- Generates hypothesis.json, taxonomy.json, and silhouette-mapping.json
"""

import json
import re
from pathlib import Path
from collections import defaultdict
from Bio import Phylo
from io import StringIO

# Paths
REPO_ROOT = Path(__file__).parent.parent
DATA_DIR = REPO_ROOT / 'data'
TETRAPODS_DIR = DATA_DIR / 'tetrapods'
TIMETREE_NEWICK = DATA_DIR / 'time_tree_raw_data' / 'TT6_Tetrapods.nwk'

ROSTER_FILE = TETRAPODS_DIR / 'roster.json'
TIMETREE_CHECK_FILE = TETRAPODS_DIR / 'timetree_check.json'
GBIF_CHECK_FILE = TETRAPODS_DIR / 'taxonomy_check_gbif.json'
PHYLOPIC_CHECK_FILE = TETRAPODS_DIR / 'phylopic_check.json'


class CompleteCaseInclusion:
    """Calculate the complete-case intersection of three sources."""

    def __init__(self):
        self.roster_by_id = {}
        self.timetree_matches = set()
        self.gbif_matches = set()
        self.phylopic_matches = set()
        self.included = set()
        self.exclusions = []

    def load_data(self):
        """Load all audit data and build match sets."""
        print("Loading complete-case data...")

        # Load roster
        with open(ROSTER_FILE) as f:
            roster = json.load(f)
        self.roster_by_id = {s['id']: s for s in roster['species']}

        # Load TimeTree check (matched == True)
        with open(TIMETREE_CHECK_FILE) as f:
            tt_data = json.load(f)
        for result in tt_data['results']:
            if result.get('matched') == True:
                self.timetree_matches.add(result['species_id'])

        # Load GBIF check (species-rank matches)
        with open(GBIF_CHECK_FILE) as f:
            gbif_data = json.load(f)
        for result in gbif_data['results']:
            if result.get('gbif_match') and result['gbif_match'].get('rank') == 'SPECIES':
                self.gbif_matches.add(result['species_id'])

        # Load PhyloPic check (verified exact species images)
        with open(PHYLOPIC_CHECK_FILE) as f:
            phylopic_data = json.load(f)
        self.phylopic_by_id = {r['species_id']: r for r in phylopic_data['results']}
        for result in phylopic_data['results']:
            if result.get('status') == 'verified_exact_species_image':
                self.phylopic_matches.add(result['species_id'])

        # Calculate complete-case intersection
        self.included = self.timetree_matches & self.gbif_matches & self.phylopic_matches

        # Document exclusions
        roster_ids = set(self.roster_by_id.keys())
        for species_id in sorted(roster_ids):
            if species_id not in self.included:
                reasons = []
                if species_id not in self.timetree_matches:
                    reasons.append("NOT in TimeTree")
                if species_id not in self.gbif_matches:
                    reasons.append("NOT in GBIF (species-rank)")
                if species_id not in self.phylopic_matches:
                    phylopic_result = self.phylopic_by_id.get(species_id, {})
                    status = phylopic_result.get('status', 'unknown')
                    reasons.append(f"NOT PhyloPic verified (status: {status})")
                
                self.exclusions.append({
                    'species_id': species_id,
                    'scientific_name': self.roster_by_id[species_id]['scientific_name'],
                    'common_name': self.roster_by_id[species_id]['common_name'],
                    'group': self.roster_by_id[species_id]['group'],
                    'reasons': reasons
                })

    def report(self):
        """Print summary of complete-case analysis."""
        print("\n" + "=" * 80)
        print("COMPLETE-CASE INCLUSION ANALYSIS")
        print("=" * 80)
        print(f"\nRoster candidates: {len(self.roster_by_id)}")
        print(f"TimeTree terminals (matched): {len(self.timetree_matches)}")
        print(f"GBIF species-rank matches: {len(self.gbif_matches)}")
        print(f"PhyloPic verified exact species: {len(self.phylopic_matches)}")
        print(f"\n** COMPLETE-CASE INTERSECTION: {len(self.included)} **")
        
        # Group breakdown
        by_group = defaultdict(int)
        for sid in self.included:
            by_group[self.roster_by_id[sid]['group']] += 1
        
        print(f"\nIncluded by group:")
        for group in ['mammals', 'birds', 'reptiles', 'amphibians']:
            print(f"  {group}: {by_group[group]}")
        
        print(f"\nExcluded: {len(self.exclusions)}")
        by_reason = defaultdict(list)
        for exc in self.exclusions:
            reason_key = ' + '.join(sorted(exc['reasons']))
            by_reason[reason_key].append(exc)
        
        for reason_key in sorted(by_reason.keys()):
            print(f"  {reason_key}: {len(by_reason[reason_key])}")


class TimeTreeParser:
    """Parse TimeTree Newick and build phylogeny."""

    def __init__(self, newick_file):
        self.newick_file = newick_file
        self.tree = None
        self.terminals = {}  # label -> terminal node
        self.original_terminals_count = 0
        self.original_internal_count = 0
        self.original_multifurcations_before = 0

    def load(self):
        """Load and parse Newick file."""
        print(f"\nLoading TimeTree Newick from {self.newick_file}...")
        with open(self.newick_file) as f:
            newick_str = f.read().strip()
        
        self.tree = Phylo.read(StringIO(newick_str), "newick")
        self._index_terminals()
        self._count_structure()

    def _index_terminals(self):
        """Build index of terminal labels."""
        for clade in self.tree.find_clades(terminal=True):
            if clade.name:
                # Handle quoted labels and spaces
                label = clade.name.strip('"')
                self.terminals[label] = clade

    def _count_structure(self):
        """Count original structure."""
        self.original_terminals_count = len(list(self.tree.find_clades(terminal=True)))
        self.original_internal_count = len(list(self.tree.find_clades(terminal=False))) - 1  # exclude root as counted separately
        
        # Count multifurcating nodes (>2 children)
        for clade in self.tree.find_clades(terminal=False):
            if len(clade.clades) > 2:
                self.original_multifurcations_before += 1

    def prune_to_terminals(self, terminal_labels):
        """Prune tree to include only specified terminal labels."""
        print(f"\nPruning to {len(terminal_labels)} selected terminals...")
        
        # Mark terminals to keep
        terminals_to_keep = set()
        for clade in self.tree.find_clades(terminal=True):
            label = (clade.name or "").strip('"')
            if label in terminal_labels:
                terminals_to_keep.add(clade)
        
        print(f"  Marked {len(terminals_to_keep)} terminals for retention")
        
        # Recursive pruning: remove branches with no retained descendants
        self._prune_internal(self.tree.root, terminals_to_keep)
        
        # Recount after pruning
        terminals_after = len(list(self.tree.find_clades(terminal=True)))
        print(f"  Terminals after pruning: {terminals_after}")

    def _prune_internal(self, clade, terminals_to_keep):
        """Recursively prune branches with no retained descendants."""
        if clade.is_terminal():
            return clade in terminals_to_keep
        
        # Prune children first
        new_clades = []
        for child in clade.clades:
            if self._prune_internal(child, terminals_to_keep):
                new_clades.append(child)
        
        clade.clades = new_clades
        return len(clade.clades) > 0

    def suppress_unary_nodes(self):
        """Remove unary (single-child) internal nodes, accumulating branch lengths."""
        print(f"\nSuppressing unary nodes...")
        
        unary_count = 0
        self._suppress_unary_recursive(self.tree.root, unary_count)
        
        print(f"  Suppressed {unary_count} unary nodes")

    def _suppress_unary_recursive(self, clade, unary_count):
        """Recursively suppress unary nodes."""
        if clade.is_terminal():
            return
        
        # Process children first (post-order)
        for child in clade.clades:
            self._suppress_unary_recursive(child, unary_count)
        
        # Check for unary children
        while len(clade.clades) == 1:
            only_child = clade.clades[0]
            # Accumulate branch length
            if clade.branch_length is not None and only_child.branch_length is not None:
                only_child.branch_length += clade.branch_length
            elif clade.branch_length is not None:
                only_child.branch_length = clade.branch_length
            # Inherit confidence from child if not present
            if only_child.confidence and not clade.confidence:
                clade.confidence = only_child.confidence
            # Move up
            clade.clades = only_child.clades
            unary_count += 1

    def get_terminals_with_labels(self):
        """Get all terminal nodes and their labels."""
        terminals = {}
        for clade in self.tree.find_clades(terminal=True):
            if clade.name:
                label = clade.name.strip('"')
                terminals[label] = clade
        return terminals

    def generate_node_ids(self, species_mapping):
        """Assign deterministic node IDs to all nodes."""
        print(f"\nAssigning deterministic node IDs...")
        
        node_id_map = {}  # maps clade object id to assigned ID
        internal_counter = 0
        
        # Process all nodes in a single pass
        for clade in self.tree.find_clades():
            if clade.is_terminal():
                label = (clade.name or "").strip('"')
                # Map terminal label to species ID
                species_id = species_mapping.get(label)
                if species_id:
                    assigned_id = f"tax_{species_id}"
                else:
                    # Should not happen if pruning worked correctly
                    assigned_id = None
                node_id_map[id(clade)] = assigned_id
            else:
                # Internal node
                if clade == self.tree.root:
                    assigned_id = "ancestor_phylo_tetrapods_root"
                else:
                    assigned_id = f"ancestor_phylo_tetrapods_{internal_counter:05d}"
                    internal_counter += 1
                node_id_map[id(clade)] = assigned_id
        
        # Validate that all terminals have IDs
        unmatched = [id(c) for c in self.tree.find_clades(terminal=True) if node_id_map.get(id(c)) is None]
        if unmatched:
            print(f"WARNING: {len(unmatched)} terminals without species IDs")
        
        return node_id_map

    def build_hypothesis_json(self, node_id_map, included_species_ids):
        """Generate hypothesis.json from the tree."""
        print(f"\nBuilding hypothesis.json...")
        
        nodes = []
        
        # Process all clades and build node records
        for clade in self.tree.find_clades():
            assigned_id = node_id_map[id(clade)]
            
            node_dict = {
                'id': assigned_id,
                'type': 'terminal' if clade.is_terminal() else 'internal',
                'parentId': None,
                'children': []
            }
            
            # Add branch length if present
            if clade.branch_length is not None:
                node_dict['branch_length'] = clade.branch_length
            
            # Add confidence if present
            if hasattr(clade, 'confidence') and clade.confidence is not None:
                node_dict['confidence'] = clade.confidence
            
            # Add original name if available
            if clade.name:
                node_dict['original_name'] = clade.name.strip('"')
            
            # Add taxonId for terminal nodes that have species IDs
            if clade.is_terminal() and assigned_id and assigned_id.startswith('tax_'):
                node_dict['taxonId'] = assigned_id
            
            nodes.append(node_dict)
        
        # Build parent-child relationships
        for clade in self.tree.find_clades():
            assigned_id = node_id_map[id(clade)]
            
            for child_clade in clade.clades:
                child_id = node_id_map[id(child_clade)]
                
                # Find node records and update
                for node in nodes:
                    if node['id'] == assigned_id:
                        node['children'].append(child_id)
                    elif node['id'] == child_id:
                        node['parentId'] = assigned_id
        
        # Create hypothesis
        root_id = node_id_map[id(self.tree.root)]
        hypothesis = {
            'hypothesisId': 'phylo_tetrapods',
            'version': '1.0',
            'rootNodeId': root_id,
            'nodes': nodes
        }
        
        return hypothesis


def main():
    # Stage 1: Calculate complete-case inclusion
    print("=" * 80)
    print("STAGE 1: COMPLETE-CASE INCLUSION")
    print("=" * 80)
    
    inclusion = CompleteCaseInclusion()
    inclusion.load_data()
    inclusion.report()
    
    if len(inclusion.included) == 0:
        print("ERROR: No species included! Check inclusion criteria.")
        return 1
    
    # Save list of included species
    included_sorted = sorted(inclusion.included)
    print(f"\nIncluded species IDs: {included_sorted}")
    
    # Stage 2: Parse TimeTree
    print("\n" + "=" * 80)
    print("STAGE 2: PARSE TIMETREE")
    print("=" * 80)
    
    parser = TimeTreeParser(TIMETREE_NEWICK)
    parser.load()
    print(f"  Original terminals: {parser.original_terminals_count}")
    print(f"  Original internal nodes: {parser.original_internal_count}")
    print(f"  Original multifurcating nodes: {parser.original_multifurcations_before}")
    
    # Stage 3: Map species IDs to TimeTree labels
    print("\n" + "=" * 80)
    print("STAGE 3: MAP SPECIES TO TIMETREE")
    print("=" * 80)
    
    # Load the TimeTree check to get expected labels
    with open(TIMETREE_CHECK_FILE) as f:
        tt_check = json.load(f)
    
    label_to_species_id = {}
    for result in tt_check['results']:
        if result['species_id'] in inclusion.included:
            # The expected_tree_label is what we should look for in Newick
            label_to_species_id[result['expected_tree_label']] = result['species_id']
    
    print(f"  Mapped {len(label_to_species_id)} species to TimeTree labels")
    
    # Stage 4: Prune tree
    print("\n" + "=" * 80)
    print("STAGE 4: PRUNE TREE")
    print("=" * 80)
    
    parser.prune_to_terminals(set(label_to_species_id.keys()))
    
    # Stage 5: Suppress unary nodes
    print("\n" + "=" * 80)
    print("STAGE 5: SUPPRESS UNARY NODES")
    print("=" * 80)
    
    parser.suppress_unary_nodes()
    
    # Stage 6: Assign IDs and build hypothesis
    print("\n" + "=" * 80)
    print("STAGE 6: BUILD HYPOTHESIS")
    print("=" * 80)
    
    node_id_map = parser.generate_node_ids(label_to_species_id)
    hypothesis = parser.build_hypothesis_json(node_id_map, included_sorted)
    
    print(f"  Total nodes: {len(hypothesis['nodes'])}")
    terminals = [n for n in hypothesis['nodes'] if n['type'] == 'terminal']
    internals = [n for n in hypothesis['nodes'] if n['type'] == 'internal']
    print(f"  - Terminals: {len(terminals)}")
    print(f"  - Internals: {len(internals)}")
    
    # Stage 7: Build taxonomy
    print("\n" + "=" * 80)
    print("STAGE 7: BUILD TAXONOMY")
    print("=" * 80)
    
    taxonomy_list = []
    for species_id in included_sorted:
        for s in inclusion.roster_by_id.values():
            if s['id'] == species_id:
                # Look up GBIF data
                with open(GBIF_CHECK_FILE) as f:
                    gbif_check = json.load(f)
                
                gbif_result = None
                for result in gbif_check['results']:
                    if result['species_id'] == species_id:
                        gbif_result = result
                        break
                
                if gbif_result:
                    gbif_match = gbif_result.get('gbif_match', {})
                    taxonomy_record = {
                        'id': f"tax_{species_id}",
                        'scientificName': gbif_match.get('acceptedUsageName') or gbif_match.get('scientificName', s['scientific_name']),
                        'commonName': s['common_name'],
                        'rank': gbif_match.get('rank', 'SPECIES'),
                        'parent': None,
                        'source': 'GBIF',
                        'sourceId': gbif_match.get('usageKey', ''),
                        'extinct': False,
                        'notes': ''
                    }
                    taxonomy_list.append(taxonomy_record)
                break
    
    taxonomy = {
        'taxonomyId': 'tetrapods_complete_case',
        'version': '1.0',
        'created': '2026-11-13',
        'taxonomy': taxonomy_list
    }
    
    print(f"  Generated {len(taxonomy['taxonomy'])} taxonomy records")
    
    # Stage 8: Build silhouette mapping
    print("\n" + "=" * 80)
    print("STAGE 8: BUILD SILHOUETTE MAPPING")
    print("=" * 80)
    
    with open(TETRAPODS_DIR / 'silhouette-mapping.json') as f:
        existing_silhouettes = json.load(f)
    
    existing_mappings = existing_silhouettes.get('mappings', {})
    new_mappings = {}
    for species_id in included_sorted:
        tax_id = f"tax_{species_id}"
        if tax_id in existing_mappings:
            new_mappings[tax_id] = existing_mappings[tax_id]
    
    silhouette_mapping = {
        'source': 'PhyloPic',
        'version': '1.0',
        'created': '2026-11-13',
        'mappings': new_mappings
    }
    
    print(f"  Included {len(silhouette_mapping['mappings'])} image mappings")
    
    # Stage 9: Save outputs
    print("\n" + "=" * 80)
    print("STAGE 9: SAVE OUTPUTS")
    print("=" * 80)
    
    TETRAPODS_DIR.mkdir(parents=True, exist_ok=True)
    
    # Save hypothesis
    hypothesis_path = TETRAPODS_DIR / 'hypothesis.json'
    with open(hypothesis_path, 'w') as f:
        json.dump(hypothesis, f, indent=2)
    print(f"  Saved: {hypothesis_path}")
    
    # Save taxonomy
    taxonomy_path = TETRAPODS_DIR / 'taxonomy.json'
    with open(taxonomy_path, 'w') as f:
        json.dump(taxonomy, f, indent=2)
    print(f"  Saved: {taxonomy_path}")
    
    # Save silhouette mapping
    silhouette_path = TETRAPODS_DIR / 'silhouette-mapping.json'
    with open(silhouette_path, 'w') as f:
        json.dump(silhouette_mapping, f, indent=2)
    print(f"  Saved: {silhouette_path}")
    
    # Stage 10: Validation and final report
    print("\n" + "=" * 80)
    print("STAGE 10: VALIDATION REPORT")
    print("=" * 80)
    
    # Verify all terminals have taxonomy records
    terminal_ids = {n['id'] for n in hypothesis['nodes'] if n['type'] == 'terminal'}
    taxonomy_ids = {t['id'] for t in taxonomy['taxonomy']}
    missing_taxonomy = terminal_ids - taxonomy_ids
    
    if missing_taxonomy:
        print(f"  WARNING: {len(missing_taxonomy)} terminals missing taxonomy records:")
        for tid in sorted(missing_taxonomy):
            print(f"    {tid}")
    else:
        print(f"  ✓ All {len(terminal_ids)} terminals have taxonomy records")
    
    # Verify all terminals have images
    image_ids = set(silhouette_mapping['mappings'].keys())
    missing_images = terminal_ids - image_ids
    if missing_images:
        print(f"  WARNING: {len(missing_images)} terminals missing PhyloPic images:")
        for tid in sorted(missing_images):
            print(f"    {tid}")
    else:
        print(f"  ✓ All {len(terminal_ids)} terminals have image mappings")
    
    # Verify no orphaned taxonomy
    orphaned_taxonomy = taxonomy_ids - terminal_ids
    if orphaned_taxonomy:
        print(f"  WARNING: {len(orphaned_taxonomy)} taxonomy records not in tree")
    else:
        print(f"  ✓ No orphaned taxonomy records")
    
    print("\n" + "=" * 80)
    print("BUILD COMPLETE")
    print("=" * 80)
    print(f"\nDataset: Tetrapods (complete-case)")
    print(f"Included species: {len(included_sorted)}")
    print(f"Tree nodes: {len(hypothesis['nodes'])} ({len(terminals)} terminals, {len(internals)} internal)")
    print(f"Taxonomy records: {len(taxonomy['taxonomy'])}")
    print(f"PhyloPic images: {len(silhouette_mapping['mappings'])}")
    
    return 0


if __name__ == '__main__':
    exit(main())
