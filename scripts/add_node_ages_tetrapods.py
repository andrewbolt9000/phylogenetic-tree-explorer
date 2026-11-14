#!/usr/bin/env python3
"""
Add explicit node ages (age_ma) to the Tetrapods hypothesis.

Reads the existing hypothesis.json, calculates age for each node based on:
  - Root age: 352.08192 Ma (from TimeTree 6 ultrametric tree)
  - Node age = root age - (accumulated branch lengths from root)

Updates sourceMetadata with age provenance information.
"""

import json
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
DATA_DIR = REPO_ROOT / 'data'
TETRAPODS_DIR = DATA_DIR / 'tetrapods'

# TimeTree 6 root age, verified as ultrametric
TIMETREE_ROOT_AGE = 352.08192

def add_node_ages():
    """Add age_ma to all nodes in hypothesis."""
    print("Adding node ages to Tetrapods hypothesis...")
    
    # Load existing hypothesis
    with open(TETRAPODS_DIR / 'hypothesis.json') as f:
        hypothesis = json.load(f)
    
    # Build parent-to-children map and node lookup
    nodes_by_id = {n['id']: n for n in hypothesis['nodes']}
    
    # Calculate age for each node by traversing from root
    def calculate_node_ages(node_id, parent_accumulated_distance=0.0):
        """Recursively calculate ages by traversing tree."""
        node = nodes_by_id[node_id]
        
        # Accumulate branch length from parent
        accumulated_distance = parent_accumulated_distance
        if node['branch_length'] is not None:
            accumulated_distance += node['branch_length']
        
        # Age is root age minus accumulated distance
        node_age = TIMETREE_ROOT_AGE - accumulated_distance
        node['age_ma'] = round(node_age, 5)
        
        # Process children
        for child_id in node.get('children', []):
            calculate_node_ages(child_id, accumulated_distance)
    
    # Start from root
    root_id = hypothesis['rootNodeId']
    calculate_node_ages(root_id, 0.0)
    
    # Verify ages
    print("\nVerifying node ages...")
    
    # Check terminals are approximately at age 0
    terminals = [n for n in hypothesis['nodes'] if n['type'] == 'terminal']
    terminal_ages = [n.get('age_ma', 0) for n in terminals]
    
    print(f"Terminal ages (should be ~0 Ma):")
    print(f"  Min: {min(terminal_ages):.5f}")
    print(f"  Max: {max(terminal_ages):.5f}")
    print(f"  Mean: {sum(terminal_ages)/len(terminal_ages):.5f}")
    
    # Check root age
    root_node = nodes_by_id[root_id]
    root_age = root_node.get('age_ma', 0)
    print(f"\nRoot node age: {root_age:.5f} Ma")
    print(f"Expected root age: {TIMETREE_ROOT_AGE:.5f} Ma")
    print(f"Match: {abs(root_age - TIMETREE_ROOT_AGE) < 0.00001}")
    
    # Check that parent ages are older than children
    consistency_check = 0
    for node in hypothesis['nodes']:
        if node['parentId'] is not None:
            parent = nodes_by_id[node['parentId']]
            parent_age = parent.get('age_ma', 0)
            child_age = node.get('age_ma', 0)
            if parent_age < child_age:
                print(f"ERROR: Parent younger than child: {node['id']}")
            else:
                consistency_check += 1
    
    print(f"\nBranch consistency (parent older than child): {consistency_check}/{len([n for n in hypothesis['nodes'] if n['parentId']])} ✓")
    
    # Add age provenance to sourceMetadata
    if 'sourceMetadata' not in hypothesis:
        hypothesis['sourceMetadata'] = {}
    
    hypothesis['sourceMetadata']['ageData'] = {
        'source': 'TimeTree 6',
        'url': 'http://www.timetree.org/',
        'rootAge_ma': TIMETREE_ROOT_AGE,
        'rootAgeUnit': 'millions of years ago',
        'ultrametric': True,
        'ageCalculationMethod': 'Accumulated branch lengths from root (root_age - sum(branch_lengths))',
        'notes': 'All root-to-tip distances in original TimeTree are equal (352.08192 Ma). Age represents divergence time in millions of years before present (0 Ma).'
    }
    
    # Save updated hypothesis
    output_path = TETRAPODS_DIR / 'hypothesis.json'
    with open(output_path, 'w') as f:
        json.dump(hypothesis, f, indent=2)
    
    print(f"\n✓ Updated hypothesis.json with {len(hypothesis['nodes'])} node ages")
    print(f"  Root age: {TIMETREE_ROOT_AGE} Ma")
    print(f"  Terminal count: {len(terminals)}")
    print(f"  Internal count: {len([n for n in hypothesis['nodes'] if n['type'] == 'internal'])}")
    
    return hypothesis

if __name__ == '__main__':
    hypothesis = add_node_ages()
