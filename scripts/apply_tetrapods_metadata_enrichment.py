#!/usr/bin/env python3
"""
Apply ancestor metadata enrichment to the actual Tetrapods hypothesis.json file.

This script:
1. Loads hypothesis.json
2. Runs enrichment
3. Validates the result
4. Saves to hypothesis.json
"""

import json
import sys
from pathlib import Path
import re


def extract_canonical_name(scientific_name):
    """Extract genus species from scientific name."""
    if not scientific_name:
        return None
    match = re.match(r'^([A-Z][a-z]+\s+[a-z]+)', scientific_name)
    return match.group(1) if match else None


def load_data():
    """Load all required data files."""
    base_dir = Path(__file__).parent.parent / 'data' / 'tetrapods'
    
    with open(base_dir / 'hypothesis.json') as f:
        hypothesis = json.load(f)
    
    with open(base_dir / 'taxonomy.json') as f:
        taxonomy_file = json.load(f)
    
    with open(base_dir / 'taxonomy_check_gbif.json') as f:
        gbif_check = json.load(f)
    
    return hypothesis, taxonomy_file, gbif_check


def build_lookups(taxonomy_file, gbif_check):
    """Build taxon ID to GBIF and group lookups."""
    # Build GBIF lookup by canonical name
    gbif_by_canonical = {}
    gbif_group_by_canonical = {}
    for result in gbif_check.get('results', []):
        gbif_match = result.get('gbif_match', {})
        canonical = gbif_match.get('canonicalName', '')
        group = result.get('group')
        if canonical and gbif_match:
            gbif_by_canonical[canonical] = gbif_match
        if canonical and group:
            gbif_group_by_canonical[canonical] = group
    
    # Map taxonomy entries by canonical name
    taxon_id_to_gbif = {}
    group_lookup = {}
    
    for tax in taxonomy_file.get('taxonomy', []):
        tax_id = tax.get('id')
        scientific_name = tax.get('scientificName', '')
        
        if not tax_id or not scientific_name:
            continue
        
        base_name = extract_canonical_name(scientific_name)
        
        if base_name:
            if base_name in gbif_by_canonical:
                taxon_id_to_gbif[tax_id] = gbif_by_canonical[base_name]
            if base_name in gbif_group_by_canonical:
                group_lookup[tax_id] = gbif_group_by_canonical[base_name]
    
    return taxon_id_to_gbif, group_lookup


def get_all_descendants(node_id, nodes_by_id):
    """Recursively get all terminal descendants of a node."""
    node = nodes_by_id.get(node_id)
    if not node:
        return []
    
    if node['type'] == 'terminal':
        return [node_id]
    
    descendants = []
    for child_id in node.get('children', []):
        descendants.extend(get_all_descendants(child_id, nodes_by_id))
    
    return descendants


def find_deepest_shared_classification(terminal_node_ids, nodes_by_id, 
                                       taxon_id_to_gbif, group_lookup):
    """Find the deepest shared classification among terminal descendants."""
    if len(terminal_node_ids) < 2:
        return None
    
    classifications = []
    for terminal_id in terminal_node_ids:
        node = nodes_by_id.get(terminal_id)
        if not node:
            continue
        
        taxon_id = node.get('taxonId')
        if not taxon_id or taxon_id not in taxon_id_to_gbif:
            continue
        
        gbif = taxon_id_to_gbif[taxon_id]
        classifications.append(gbif)
    
    if len(classifications) < 2:
        return None
    
    # Check each level from deepest (family) to shallowest (kingdom)
    levels = ['family', 'order', 'class', 'phylum', 'kingdom']
    
    for level in levels:
        values = set()
        for gbif in classifications:
            val = gbif.get(level)
            if val:
                values.add(val)
        
        if len(values) == 1:
            shared_value = list(values)[0]
            count_with_level = sum(1 for gbif in classifications if gbif.get(level) == shared_value)
            if count_with_level >= 2:
                return {
                    'name': shared_value,
                    'rank': level.capitalize(),
                    'descendant_count': count_with_level
                }
    
    return None


def get_descendant_composition(terminal_node_ids, nodes_by_id, group_lookup):
    """Count descendants by group."""
    composition = {
        'mammals': 0,
        'birds': 0,
        'reptiles': 0,
        'amphibians': 0
    }
    
    for terminal_id in terminal_node_ids:
        node = nodes_by_id.get(terminal_id)
        if not node:
            continue
        
        taxon_id = node.get('taxonId')
        if not taxon_id or taxon_id not in group_lookup:
            continue
        
        group = group_lookup[taxon_id]
        if group in composition:
            composition[group] += 1
    
    return composition


def enrich_internal_node(node_id, nodes_by_id, taxon_id_to_gbif, group_lookup):
    """Enrich an internal node with metadata."""
    node = nodes_by_id.get(node_id)
    if not node or node['type'] != 'internal':
        return {}
    
    terminal_descendants = get_all_descendants(node_id, nodes_by_id)
    descendant_count = len(terminal_descendants)
    
    metadata = {
        'descendant_species_count': descendant_count,
        'immediate_child_count': len(node.get('children', [])),
    }
    
    composition = get_descendant_composition(terminal_descendants, nodes_by_id, group_lookup)
    metadata['descendant_composition'] = composition
    
    child_counts = []
    for child_id in node.get('children', []):
        child_descendants = get_all_descendants(child_id, nodes_by_id)
        child_counts.append(len(child_descendants))
    metadata['child_branch_species_counts'] = child_counts
    
    if descendant_count >= 2:
        tax_summary = find_deepest_shared_classification(
            terminal_descendants, nodes_by_id, taxon_id_to_gbif, group_lookup
        )
        if tax_summary:
            metadata['taxonomic_summary'] = {
                'name': tax_summary['name'],
                'rank': tax_summary['rank'],
                'method': 'deepest_shared_descendant_taxon',
                'source': 'GBIF',
                'descendant_species_count': tax_summary['descendant_count']
            }
    
    return metadata


def apply_enrichment(hypothesis, taxon_id_to_gbif, group_lookup):
    """Apply enrichment to all internal nodes."""
    nodes_by_id = {node['id']: node for node in hypothesis['nodes']}
    
    enriched_count = 0
    for node in hypothesis['nodes']:
        if node['type'] != 'internal':
            continue
        
        metadata = enrich_internal_node(node['id'], nodes_by_id, taxon_id_to_gbif, group_lookup)
        
        for key, value in metadata.items():
            if key not in node:
                node[key] = value
        
        enriched_count += 1
    
    return enriched_count


def save_hypothesis(hypothesis, output_path):
    """Save enriched hypothesis to file with proper JSON formatting."""
    with open(output_path, 'w') as f:
        json.dump(hypothesis, f, indent=2)


def main():
    """Main entry point."""
    print("Loading data...")
    hypothesis, taxonomy_file, gbif_check = load_data()
    
    print("Building lookups...")
    taxon_id_to_gbif, group_lookup = build_lookups(taxonomy_file, gbif_check)
    
    print(f"GBIF taxa: {len(taxon_id_to_gbif)}")
    print(f"Group mappings: {len(group_lookup)}")
    
    print("Applying enrichment...")
    enriched_count = apply_enrichment(hypothesis, taxon_id_to_gbif, group_lookup)
    print(f"Enriched {enriched_count} internal nodes")
    
    # Count results
    internal_nodes = [n for n in hypothesis['nodes'] if n['type'] == 'internal']
    nodes_with_tax = sum(1 for n in internal_nodes if 'taxonomic_summary' in n)
    
    print(f"Nodes with taxonomic_summary: {nodes_with_tax} of {len(internal_nodes)}")
    
    # Count by rank
    rank_counts = {}
    for node in internal_nodes:
        tax_summary = node.get('taxonomic_summary')
        if tax_summary:
            rank = tax_summary.get('rank', 'Unknown')
            rank_counts[rank] = rank_counts.get(rank, 0) + 1
    
    if rank_counts:
        print("Rank distribution:")
        for rank in ['Kingdom', 'Phylum', 'Class', 'Order', 'Family']:
            count = rank_counts.get(rank, 0)
            if count > 0:
                print(f"  {rank}: {count}")
    
    # Save
    output_path = Path(__file__).parent.parent / 'data' / 'tetrapods' / 'hypothesis.json'
    print(f"\nSaving to {output_path}...")
    save_hypothesis(hypothesis, output_path)
    
    print("✓ Enrichment applied and saved")
    return 0


if __name__ == '__main__':
    sys.exit(main())
