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


def validate_graph_structure(hypothesis, nodes_by_id, root_id):
    """
    Validate graph structure before age calculation.

    Checks:
    - Node IDs are unique
    - Every parentId references an existing node (except root, which must be None)
    - Every child ID references an existing node
    - Parent-child relationships are reciprocal
    - Root has no parent
    - Every non-root node has exactly one parent
    - Every node is reachable from root
    - No cycles exist
    """
    print("\nValidating graph structure...")

    # Check 1: Unique node IDs
    node_ids = [n['id'] for n in hypothesis['nodes']]
    if len(node_ids) != len(set(node_ids)):
        duplicates = [nid for nid in set(node_ids) if node_ids.count(nid) > 1]
        raise ValidationError(f"Duplicate node IDs found: {duplicates}")
    print("  ✓ Node IDs are unique")

    # Check 2: Parent references are valid
    for node in hypothesis['nodes']:
        parent_id = node.get('parentId')

        if node['id'] == root_id:
            if parent_id is not None:
                raise ValidationError(f"Root node {root_id} has non-null parentId: {parent_id}")
        else:
            if parent_id is None:
                raise ValidationError(f"Non-root node {node['id']} has null parentId")
            if parent_id not in nodes_by_id:
                raise ValidationError(f"Node {node['id']} references missing parent {parent_id}")
    print("  ✓ All parentId references are valid")

    # Check 3: Child references are valid
    for node in hypothesis['nodes']:
        for child_id in node.get('children', []):
            if child_id not in nodes_by_id:
                raise ValidationError(f"Node {node['id']} references missing child {child_id}")
    print("  ✓ All child references are valid")

    # Check 4: Parent-child relationships are reciprocal
    for node in hypothesis['nodes']:
        node_id = node['id']
        for child_id in node.get('children', []):
            child = nodes_by_id[child_id]
            if child.get('parentId') != node_id:
                raise ValidationError(
                    f"Parent-child reciprocity broken: {node_id} has child {child_id}, "
                    f"but child's parentId is {child.get('parentId')}"
                )
    print("  ✓ All parent-child relationships are reciprocal")

    # Check 5: Every non-root node has exactly one parent
    for node in hypothesis['nodes']:
        if node['id'] != root_id:
            parent_id = node.get('parentId')
            if parent_id is None:
                raise ValidationError(f"Non-root node {node['id']} has no parent")
            parent = nodes_by_id[parent_id]
            if node['id'] not in parent.get('children', []):
                raise ValidationError(
                    f"Node {node['id']} claims parent {parent_id}, "
                    f"but parent does not list it as a child"
                )
    print("  ✓ Every non-root node has exactly one parent")

    # Check 6: All nodes reachable from root (forward traversal)
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
    print(f"  ✓ All {len(reachable)} nodes reachable from root")

    # Check 7: No cycles (backward traversal - trace each node to root)
    print("  Checking for cycles...")
    for node in hypothesis['nodes']:
        visited = set()
        current = node
        iterations = 0
        max_iterations = len(nodes_by_id) + 1

        while current.get('parentId') is not None:
            if current['id'] in visited:
                raise ValidationError(f"Cycle detected: {current['id']} is its own ancestor")

            visited.add(current['id'])
            parent_id = current['parentId']
            current = nodes_by_id[parent_id]

            iterations += 1
            if iterations > max_iterations:
                raise ValidationError(
                    f"Path from {node['id']} to root exceeds max iterations "
                    f"(cycle or very long path)"
                )
    print("  ✓ No cycles detected")

    print("✓ Graph structure validation passed")


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

    # ========== PRE-CALCULATION VALIDATION ==========
    # Validate graph structure BEFORE calculating ages
    validate_graph_structure(hypothesis, nodes_by_id, root_id)

    # Calculate age for each node by traversing from root
    def calculate_node_ages(node_id, parent_accumulated_distance=0.0):
        """
        Recursively calculate ages by traversing tree.

        Root age is ALWAYS 352.08192 Ma. The root's own branch_length is NOT
        included in the root-to-node distances because it is not an edge from
        a parent node—the root IS the reference point.

        For non-root nodes: accumulated distance includes that node's
        branch_length and all non-root ancestors' branch lengths.
        """
        node = nodes_by_id[node_id]

        # Accumulate branch length from parent
        # For the root: parent_accumulated_distance is 0.0, and we do NOT add
        # the root's own branch_length to this sum.
        accumulated_distance = parent_accumulated_distance

        # Only add this node's branch_length if it's not the root
        if node_id != root_id and node['branch_length'] is not None:
            accumulated_distance += node['branch_length']

        # Age is root age minus accumulated distance
        node_age = TIMETREE_ROOT_AGE - accumulated_distance
        node['age_ma'] = round(node_age, 5)

        # Process children
        for child_id in node.get('children', []):
            calculate_node_ages(child_id, accumulated_distance)

    # Start from root
    print(f"\nCalculating ages from root {root_id}...")
    print("  Root branch_length is NOT included in root-to-node distances")
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
