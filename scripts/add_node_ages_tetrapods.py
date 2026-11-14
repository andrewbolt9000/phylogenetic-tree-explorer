#!/usr/bin/env python3
"""
Add explicit node ages (age_ma) to the Tetrapods hypothesis with strict validation.

Reads the existing hypothesis.json, calculates age for each node based on:
  - Root age: 352.08192 Ma (from TimeTree 6 ultrametric tree)
  - Node age = root age - (accumulated branch lengths from root)

Validates:
  - Root node has exact age 352.08192 Ma (±1e-5)
  - All 57 terminals have age ~0 Ma (±1e-5)
  - All 167 nodes have age_ma property
  - All ages match accumulated root-to-node branch lengths
  - All parent ages >= child ages (with floating-point tolerance)
  - Graph structure is valid (no cycles, all nodes reachable from root)

Exits nonzero on any validation failure.
"""

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
DATA_DIR = REPO_ROOT / 'data'
TETRAPODS_DIR = DATA_DIR / 'tetrapods'

# TimeTree 6 root age, verified as ultrametric
TIMETREE_ROOT_AGE = 352.08192
TOLERANCE = 1e-5

class ValidationError(Exception):
    """Raised when validation fails."""
    pass


def add_node_ages():
    """Add age_ma to all nodes in hypothesis with strict validation."""
    print("Adding node ages to Tetrapods hypothesis...")
    
    # Load existing hypothesis
    try:
        with open(TETRAPODS_DIR / 'hypothesis.json') as f:
            hypothesis = json.load(f)
    except FileNotFoundError:
        raise ValidationError(f"hypothesis.json not found at {TETRAPODS_DIR / 'hypothesis.json'}")
    except json.JSONDecodeError as e:
        raise ValidationError(f"Invalid JSON in hypothesis.json: {e}")
    
    # Build parent-to-children map and node lookup
    nodes_by_id = {n['id']: n for n in hypothesis['nodes']}
    root_id = hypothesis.get('rootNodeId')
    
    if not root_id:
        raise ValidationError("hypothesis.json missing rootNodeId")
    
    if root_id not in nodes_by_id:
        raise ValidationError(f"Root node {root_id} not found in nodes array")
    
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
    print(f"\nCalculating ages from root {root_id}...")
    calculate_node_ages(root_id, 0.0)
    
    # ========== STRICT VALIDATION ==========
    print("\n" + "=" * 80)
    print("STRICT VALIDATION")
    print("=" * 80)
    
    # Check 1: Node counts
    print("\n1. Node count validation:")
    total_nodes = len(hypothesis['nodes'])
    terminals = [n for n in hypothesis['nodes'] if n['type'] == 'terminal']
    internals = [n for n in hypothesis['nodes'] if n['type'] == 'internal']
    
    expected_total = 167
    expected_terminals = 57
    expected_internals = 110
    
    print(f"   Total nodes: {total_nodes} (expected {expected_total})")
    if total_nodes != expected_total:
        raise ValidationError(f"Node count mismatch: {total_nodes} != {expected_total}")
    
    print(f"   Terminals: {len(terminals)} (expected {expected_terminals})")
    if len(terminals) != expected_terminals:
        raise ValidationError(f"Terminal count mismatch: {len(terminals)} != {expected_terminals}")
    
    print(f"   Internals: {len(internals)} (expected {expected_internals})")
    if len(internals) != expected_internals:
        raise ValidationError(f"Internal node count mismatch: {len(internals)} != {expected_internals}")
    
    # Check 2: All nodes have age_ma
    print("\n2. All nodes have age_ma property:")
    nodes_without_ages = [n['id'] for n in hypothesis['nodes'] if 'age_ma' not in n]
    if nodes_without_ages:
        raise ValidationError(f"Nodes missing age_ma: {nodes_without_ages[:10]}")
    print(f"   ✓ All {total_nodes} nodes have age_ma")
    
    # Check 3: Root age
    print("\n3. Root node age validation:")
    root_node = nodes_by_id[root_id]
    root_age = root_node['age_ma']
    root_error = abs(root_age - TIMETREE_ROOT_AGE)
    print(f"   Root age: {root_age:.5f} Ma")
    print(f"   Expected: {TIMETREE_ROOT_AGE:.5f} Ma")
    print(f"   Error: {root_error:.8f} Ma")
    
    if root_error > TOLERANCE:
        raise ValidationError(f"Root age mismatch: {root_age} != {TIMETREE_ROOT_AGE} (error: {root_error})")
    print(f"   ✓ Root age within tolerance")
    
    # Check 4: Terminal ages
    print("\n4. Terminal node age validation:")
    terminal_ages = [n['age_ma'] for n in terminals]
    min_terminal_age = min(terminal_ages)
    max_terminal_age = max(terminal_ages)
    mean_terminal_age = sum(terminal_ages) / len(terminal_ages)
    
    print(f"   Min terminal age: {min_terminal_age:.8f} Ma")
    print(f"   Max terminal age: {max_terminal_age:.8f} Ma")
    print(f"   Mean terminal age: {mean_terminal_age:.8f} Ma")
    
    if max_terminal_age > TOLERANCE:
        raise ValidationError(f"Terminal age too high: {max_terminal_age} > {TOLERANCE}")
    if min_terminal_age < -TOLERANCE:
        raise ValidationError(f"Terminal age too low: {min_terminal_age} < {-TOLERANCE}")
    print(f"   ✓ All terminal ages within tolerance")
    
    # Check 5: Accumulated branch lengths match ages
    print("\n5. Branch length consistency (age = root_age - accumulated_distance):")
    branch_mismatches = []
    
    for node in hypothesis['nodes']:
        node_id = node['id']
        stored_age = node['age_ma']
        
        # Calculate accumulated distance
        accumulated_distance = 0.0
        current = node
        
        while current['parentId'] is not None:
            parent = nodes_by_id[current['parentId']]
            
            # Add this node's branch length to accumulated
            if current['branch_length'] is not None:
                accumulated_distance += current['branch_length']
            
            current = parent
        
        # Calculated age from accumulated distance
        calculated_age = TIMETREE_ROOT_AGE - accumulated_distance
        calculated_age_rounded = round(calculated_age, 5)
        
        # Compare
        age_error = abs(stored_age - calculated_age_rounded)
        if age_error > TOLERANCE:
            branch_mismatches.append({
                'node': node_id,
                'stored_age': stored_age,
                'calculated_age': calculated_age_rounded,
                'error': age_error
            })
    
    if branch_mismatches:
        print(f"   ✗ Found {len(branch_mismatches)} branch length mismatches:")
        for mismatch in branch_mismatches[:5]:
            print(f"     {mismatch['node']}: stored={mismatch['stored_age']}, calculated={mismatch['calculated_age']}, error={mismatch['error']:.8f}")
        raise ValidationError(f"Branch length consistency check failed: {len(branch_mismatches)} nodes")
    
    print(f"   ✓ All {total_nodes} nodes pass branch length consistency check")
    
    # Check 6: Parent ages >= child ages (temporal consistency)
    print("\n6. Parent-child temporal consistency (parent_age >= child_age):")
    temporal_violations = []
    
    for node in hypothesis['nodes']:
        if node['parentId'] is not None:
            parent = nodes_by_id[node['parentId']]
            parent_age = parent['age_ma']
            child_age = node['age_ma']
            
            # Allow small floating-point difference
            if parent_age < child_age - TOLERANCE:
                temporal_violations.append({
                    'child': node['id'],
                    'child_age': child_age,
                    'parent': parent['id'],
                    'parent_age': parent_age,
                    'error': child_age - parent_age
                })
    
    if temporal_violations:
        print(f"   ✗ Found {len(temporal_violations)} temporal violations:")
        for violation in temporal_violations[:5]:
            print(f"     {violation['child']} ({violation['child_age']}) > {violation['parent']} ({violation['parent_age']})")
        raise ValidationError(f"Temporal consistency check failed: {len(temporal_violations)} parent-child inversions")
    
    print(f"   ✓ All parent-child ages are temporally consistent")
    
    # Check 7: Graph structure (no cycles, all reachable from root)
    print("\n7. Graph structure validation:")
    
    # Check all nodes reachable from root (forward traversal)
    reachable = set()
    def mark_reachable(node_id):
        if node_id in reachable:
            return
        reachable.add(node_id)
        node = nodes_by_id[node_id]
        for child_id in node.get('children', []):
            mark_reachable(child_id)
    
    mark_reachable(root_id)
    unreachable = set(nodes_by_id.keys()) - reachable
    
    if unreachable:
        raise ValidationError(f"Unreachable nodes from root: {unreachable}")
    print(f"   ✓ All {total_nodes} nodes reachable from root")
    
    # Check no cycles (backward traversal - trace to root)
    print("   Checking for parent cycles...")
    for node in hypothesis['nodes']:
        visited = set()
        current = node
        
        while current['parentId'] is not None:
            if current['id'] in visited:
                raise ValidationError(f"Cycle detected: node {current['id']} is its own ancestor")
            
            visited.add(current['id'])
            current = nodes_by_id[current['parentId']]
            
            if len(visited) > total_nodes:
                raise ValidationError(f"Cycle or path too long from {node['id']}")
    
    print(f"   ✓ No cycles detected")
    
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
    
    # ========== COMPLETION SUMMARY ==========
    print("\n" + "=" * 80)
    print("✓ VALIDATION COMPLETE - ALL CHECKS PASSED")
    print("=" * 80)
    print(f"\n✓ Updated hypothesis.json with {len(hypothesis['nodes'])} node ages")
    print(f"  Root age: {TIMETREE_ROOT_AGE} Ma")
    print(f"  Terminal count: {len(terminals)}")
    print(f"  Internal count: {len(internals)}")
    
    return hypothesis


if __name__ == '__main__':
    try:
        hypothesis = add_node_ages()
        sys.exit(0)
    except ValidationError as e:
        print(f"\n✗ VALIDATION FAILED: {e}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ UNEXPECTED ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)
