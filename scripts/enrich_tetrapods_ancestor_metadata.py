#!/usr/bin/env python3
"""
Enrich Tetrapods ancestor nodes with taxonomic metadata.

For each internal node, calculates:
- taxonomic_summary: deepest shared GBIF classification of descendants
- descendant_species_count: total terminal descendants
- descendant_composition: count by group (mammals, birds, reptiles, amphibians)
- immediate_child_count: number of direct children
- child_branch_species_counts: array of terminal descendant counts per child

Does not modify topology, node IDs, branch lengths, ages, terminals, or silhouette mappings.
"""

import json
import sys
import re
from pathlib import Path


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


def extract_canonical_name(scientific_name):
    """
    Extract canonical binomial name (genus species) from a scientific name.
    
    Handles formats like:
    - "Genus species (Author, year)"
    - "Genus species Author, year"
    - "Genus species"
    
    Returns the first two words (genus and species), or None if not found.
    """
    if not scientific_name:
        return None
    
    # Match genus (capitalized) and species (lowercase): first two words
    match = re.match(r'^([A-Z][a-z]+\s+[a-z]+)', scientific_name)
    return match.group(1) if match else None


def build_taxon_id_to_gbif_lookup(taxonomy_file, gbif_check):
    """
    Build lookup from terminal taxon ID to GBIF classification.
    
    Maps by canonical scientific name (genus species) between:
    - taxonomy.json: terminal species records with IDs like tax_amphibian_001
    - taxonomy_check_gbif.json: GBIF results with species_ids like amphibian_001
    """
    lookup = {}
    
    # Build GBIF lookup by canonical name
    gbif_by_canonical = {}
    for result in gbif_check.get('results', []):
        gbif_match = result.get('gbif_match', {})
        canonical = gbif_match.get('canonicalName', '')
        if canonical and gbif_match:
            gbif_by_canonical[canonical] = gbif_match
    
    # Map taxonomy entries to GBIF by canonical name
    for tax in taxonomy_file.get('taxonomy', []):
        tax_id = tax.get('id')
        scientific_name = tax.get('scientificName', '')
        
        if not tax_id or not scientific_name:
            continue
        
        # Extract canonical name (genus species)
        base_name = extract_canonical_name(scientific_name)
        
        if base_name and base_name in gbif_by_canonical:
            lookup[tax_id] = gbif_by_canonical[base_name]
    
    return lookup


def build_group_lookup(taxonomy_file, gbif_check):
    """
    Build lookup from terminal taxon ID to group.
    
    Maps by canonical scientific name between taxonomy and GBIF results.
    """
    lookup = {}
    
    # Build GBIF lookup by canonical name
    gbif_by_canonical = {}
    for result in gbif_check.get('results', []):
        gbif_match = result.get('gbif_match', {})
        canonical = gbif_match.get('canonicalName', '')
        group = result.get('group')
        if canonical and group:
            gbif_by_canonical[canonical] = group
    
    # Map taxonomy entries to groups by canonical name
    for tax in taxonomy_file.get('taxonomy', []):
        tax_id = tax.get('id')
        scientific_name = tax.get('scientificName', '')
        
        if not tax_id or not scientific_name:
            continue
        
        # Extract canonical name (genus species)
        base_name = extract_canonical_name(scientific_name)
        
        if base_name and base_name in gbif_by_canonical:
            lookup[tax_id] = gbif_by_canonical[base_name]
    
    return lookup


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
    """
    Find the deepest shared classification among terminal descendants.
    
    Returns a classification level (kingdom, phylum, class, order, family)
    shared by at least 2 descendants.
    
    Returns None if fewer than 2 descendants or no shared classification.
    """
    if len(terminal_node_ids) < 2:
        return None
    
    # Get GBIF classifications for all terminals
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
    # Only check kingdom, phylum, class, order, family (exclude genus/species)
    levels = ['family', 'order', 'class', 'phylum', 'kingdom']
    
    for level in levels:
        # Get values for this level from all classifications
        values = set()
        for gbif in classifications:
            val = gbif.get(level)
            if val:
                values.add(val)
        
        # If exactly one value is shared by all classifications with this level,
        # that's our deepest shared classification
        if len(values) == 1:
            shared_value = list(values)[0]
            # Verify at least 2 descendants actually have this classification
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
    """
    Enrich an internal node with metadata.
    
    Returns a dict of metadata to add to the node.
    """
    node = nodes_by_id.get(node_id)
    if not node or node['type'] != 'internal':
        return {}
    
    # Get all terminal descendants
    terminal_descendants = get_all_descendants(node_id, nodes_by_id)
    descendant_count = len(terminal_descendants)
    
    metadata = {
        'descendant_species_count': descendant_count,
        'immediate_child_count': len(node.get('children', [])),
    }
    
    # Get descendant composition
    composition = get_descendant_composition(terminal_descendants, nodes_by_id, group_lookup)
    metadata['descendant_composition'] = composition
    
    # Calculate child branch species counts (in order of children)
    child_counts = []
    for child_id in node.get('children', []):
        child_descendants = get_all_descendants(child_id, nodes_by_id)
        child_counts.append(len(child_descendants))
    metadata['child_branch_species_counts'] = child_counts
    
    # Get taxonomic summary if conditions are met
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


def enrich_hypothesis(hypothesis, taxon_id_to_gbif, group_lookup):
    """Enrich all internal nodes in the hypothesis."""
    # Build lookup by ID for quick access
    nodes_by_id = {node['id']: node for node in hypothesis['nodes']}
    
    enriched_count = 0
    for node in hypothesis['nodes']:
        if node['type'] != 'internal':
            continue
        
        metadata = enrich_internal_node(node['id'], nodes_by_id, taxon_id_to_gbif, group_lookup)
        
        # Add metadata to node (don't overwrite existing)
        for key, value in metadata.items():
            if key not in node:
                node[key] = value
        
        enriched_count += 1
    
    return enriched_count


def validate_enriched_hypothesis(hypothesis):
    """Validate enriched hypothesis structure."""
    errors = []
    
    internal_nodes = [n for n in hypothesis['nodes'] if n['type'] == 'internal']
    
    for node in internal_nodes:
        node_id = node.get('id')
        
        # Check descendant_species_count exists and is valid
        desc_count = node.get('descendant_species_count')
        if desc_count is None:
            errors.append(f"{node_id}: missing descendant_species_count")
        elif not isinstance(desc_count, int) or desc_count < 0:
            errors.append(f"{node_id}: invalid descendant_species_count: {desc_count}")
        
        # Check descendant_composition
        composition = node.get('descendant_composition')
        if not composition:
            errors.append(f"{node_id}: missing descendant_composition")
        else:
            if not isinstance(composition, dict):
                errors.append(f"{node_id}: descendant_composition not a dict")
            else:
                for group in ['mammals', 'birds', 'reptiles', 'amphibians']:
                    if group not in composition:
                        errors.append(f"{node_id}: missing group '{group}' in descendant_composition")
                    elif not isinstance(composition[group], int) or composition[group] < 0:
                        errors.append(f"{node_id}: invalid count for {group}: {composition[group]}")
                
                # Verify counts sum to descendant_species_count
                total = sum(composition.values())
                if desc_count is not None and total != desc_count:
                    errors.append(
                        f"{node_id}: descendant_composition sum ({total}) != "
                        f"descendant_species_count ({desc_count})"
                    )
        
        # Check immediate_child_count
        child_count = node.get('immediate_child_count')
        if child_count is None:
            errors.append(f"{node_id}: missing immediate_child_count")
        elif not isinstance(child_count, int) or child_count < 0:
            errors.append(f"{node_id}: invalid immediate_child_count: {child_count}")
        elif len(node.get('children', [])) != child_count:
            errors.append(
                f"{node_id}: immediate_child_count ({child_count}) != "
                f"actual children count ({len(node.get('children', []))})"
            )
        
        # Check child_branch_species_counts
        branch_counts = node.get('child_branch_species_counts')
        if not isinstance(branch_counts, list):
            errors.append(f"{node_id}: child_branch_species_counts not a list")
        elif len(branch_counts) != len(node.get('children', [])):
            errors.append(
                f"{node_id}: child_branch_species_counts length ({len(branch_counts)}) != "
                f"children count ({len(node.get('children', []))})"
            )
        else:
            branch_sum = sum(branch_counts)
            if desc_count is not None and branch_sum != desc_count:
                errors.append(
                    f"{node_id}: child_branch_species_counts sum ({branch_sum}) != "
                    f"descendant_species_count ({desc_count})"
                )
        
        # Check taxonomic_summary if present
        tax_summary = node.get('taxonomic_summary')
        if tax_summary:
            if not isinstance(tax_summary, dict):
                errors.append(f"{node_id}: taxonomic_summary not a dict")
            else:
                required_fields = ['name', 'rank', 'method', 'source', 'descendant_species_count']
                for field in required_fields:
                    if field not in tax_summary:
                        errors.append(f"{node_id}: taxonomic_summary missing '{field}'")
                
                if tax_summary.get('method') != 'deepest_shared_descendant_taxon':
                    errors.append(
                        f"{node_id}: taxonomic_summary method should be "
                        f"'deepest_shared_descendant_taxon', got '{tax_summary.get('method')}'"
                    )
                
                if tax_summary.get('source') != 'GBIF':
                    errors.append(
                        f"{node_id}: taxonomic_summary source should be 'GBIF', "
                        f"got '{tax_summary.get('source')}'"
                    )
    
    return errors


def main():
    """Main entry point."""
    print("Loading Tetrapods data...")
    hypothesis, taxonomy_file, gbif_check = load_data()
    
    print("Building lookups...")
    taxon_id_to_gbif = build_taxon_id_to_gbif_lookup(taxonomy_file, gbif_check)
    group_lookup = build_group_lookup(taxonomy_file, gbif_check)
    
    print(f"GBIF taxa: {len(taxon_id_to_gbif)}")
    print(f"Group mappings: {len(group_lookup)}")
    
    print("Enriching internal nodes...")
    enriched_count = enrich_hypothesis(hypothesis, taxon_id_to_gbif, group_lookup)
    print(f"Enriched {enriched_count} internal nodes")
    
    print("Validating enriched hypothesis...")
    errors = validate_enriched_hypothesis(hypothesis)
    
    if errors:
        print(f"\n❌ Validation errors ({len(errors)}):")
        for error in errors[:20]:  # Show first 20 errors
            print(f"  {error}")
        if len(errors) > 20:
            print(f"  ... and {len(errors) - 20} more errors")
        return 1
    
    print("✓ Validation passed")
    
    # Print summary statistics
    internal_nodes = [n for n in hypothesis['nodes'] if n['type'] == 'internal']
    
    # Count nodes with taxonomic_summary
    nodes_with_tax = sum(1 for n in internal_nodes if 'taxonomic_summary' in n)
    print(f"\nInternal nodes with taxonomic_summary: {nodes_with_tax}")
    
    # Count by rank
    rank_counts = {}
    for node in internal_nodes:
        tax_summary = node.get('taxonomic_summary')
        if tax_summary:
            rank = tax_summary.get('rank', 'Unknown')
            rank_counts[rank] = rank_counts.get(rank, 0) + 1
    
    if rank_counts:
        print("Taxonomic ranks distribution:")
        for rank in ['Kingdom', 'Phylum', 'Class', 'Order', 'Family']:
            count = rank_counts.get(rank, 0)
            if count > 0:
                print(f"  {rank}: {count}")
    
    print("\nEnrichment complete. Ready to save.")
    print("Note: Run the full builder validation before committing.")
    
    return 0


if __name__ == '__main__':
    sys.exit(main())
