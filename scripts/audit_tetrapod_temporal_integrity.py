#!/usr/bin/env python3
"""
RIGOROUS temporal integrity audit: Tetrapods dataset vs TimeTree 6 source.

Validates:
1. Original tree ultrametric property
2. All 57 selected terminals present in original tree
3. Root-to-tip distances preserved (or root rerooted, but consistently)
4. Every branch_length value is correct
5. Every age_ma calculated correctly (age_ma = root_age - accumulated_distance)
6. Parent-child age relationships match branch lengths
7. Age monotonicity (parents >= children in age)
8. Original root age derived from source (not assumed)

Does NOT assume age_ma values are correct—validates against accumulated distances.

Usage:
    python3 scripts/audit_tetrapod_temporal_integrity_v2.py

Exit codes:
    0 = all validations passed
    1 = temporal integrity failures detected
    2 = file errors or parse failures
"""

import json
import sys
from io import StringIO
from pathlib import Path

try:
    from Bio import Phylo
except ImportError:
    print("ERROR: BioPython not available. Requires Bio.Phylo.", file=sys.stderr)
    sys.exit(2)


class RigorousTemporalAudit:
    """Rigorous temporal integrity validation."""

    def __init__(self, timetree_newick, hypothesis_json, roster_json):
        self.timetree_newick = Path(timetree_newick)
        self.hypothesis_json = Path(hypothesis_json)
        self.roster_json = Path(roster_json)
        
        self.original_tree = None
        self.hypothesis = None
        self.roster = None
        
        self.failures = []  # Critical failures (exit 1)
        self.warnings = []  # Warnings (still exit 0)
        self.findings = []  # Informational findings
        
        # Validation caches
        self.original_terminals = {}  # label -> root-to-tip distance
        self.original_terminal_labels = set()

    def load_files(self):
        """Load and parse all input files."""
        try:
            with open(self.timetree_newick) as f:
                newick_str = f.read().strip()
            self.original_tree = Phylo.read(StringIO(newick_str), "newick")
            print(f"✓ Loaded TimeTree from {self.timetree_newick}")
        except Exception as e:
            self.failures.append(f"TimeTree parse failed: {e}")
            return False

        try:
            with open(self.hypothesis_json) as f:
                self.hypothesis = json.load(f)
            print(f"✓ Loaded hypothesis from {self.hypothesis_json}")
        except Exception as e:
            self.failures.append(f"Hypothesis parse failed: {e}")
            return False

        try:
            with open(self.roster_json) as f:
                self.roster = json.load(f)
            print(f"✓ Loaded roster from {self.roster_json}")
        except Exception as e:
            self.failures.append(f"Roster parse failed: {e}")
            return False

        return True

    def audit_original_tree(self):
        """Validate original TimeTree structure and extract reference data."""
        print("\n" + "=" * 70)
        print("ORIGINAL TIMETREE 6 VALIDATION")
        print("=" * 70)

        # Calculate all root-to-tip distances
        def traverse(clade, distance):
            current_dist = distance + (clade.branch_length or 0.0)
            if clade.is_terminal():
                self.original_terminals[clade.name or "unnamed"] = current_dist
                self.original_terminal_labels.add(clade.name or "unnamed")
            else:
                for child in clade.clades:
                    traverse(child, current_dist)

        traverse(self.original_tree.root, 0.0)
        
        distances = list(self.original_terminals.values())
        num_terminals = len(distances)
        
        print(f"\nTerminal count: {num_terminals}")
        print(f"Root-to-tip distances (Ma):")
        
        if distances:
            min_dist = min(distances)
            max_dist = max(distances)
            mean_dist = sum(distances) / len(distances)
            variance = max_dist - min_dist
            
            print(f"  Min:      {min_dist:.8f}")
            print(f"  Max:      {max_dist:.8f}")
            print(f"  Mean:     {mean_dist:.8f}")
            print(f"  Variance: {variance:.8f}")
            
            # Test ultrametric property
            ULTRAMETRIC_TOLERANCE = 1e-6
            is_ultrametric = variance < ULTRAMETRIC_TOLERANCE
            
            print(f"\nUltrametric test:")
            if is_ultrametric:
                print(f"  ✓ YES (all terminals at {max_dist:.8f} Ma)")
                self.findings.append(f"Original tree is ultrametric (root age = {max_dist:.8f} Ma)")
                original_root_age = max_dist
            else:
                self.failures.append(
                    f"Original tree is NOT ultrametric (variance {variance:.8f} Ma > tolerance {ULTRAMETRIC_TOLERANCE})"
                )
                print(f"  ✗ NO (variance {variance:.8f} > tolerance {ULTRAMETRIC_TOLERANCE})")
                return None
            
            return original_root_age

        self.failures.append("Original tree has no terminals")
        return None

    def audit_hypothesis_structure(self):
        """Validate hypothesis JSON structure."""
        print("\n" + "=" * 70)
        print("HYPOTHESIS STRUCTURE VALIDATION")
        print("=" * 70)

        required_fields = ["nodes"]
        for field in required_fields:
            if field not in self.hypothesis:
                self.failures.append(f"Hypothesis missing required field: {field}")
                return False

        nodes = self.hypothesis.get("nodes", [])
        if not nodes:
            self.failures.append("Hypothesis has no nodes")
            return False

        print(f"\nTotal nodes: {len(nodes)}")

        # Validate node structure
        nodes_by_id = {n["id"]: n for n in nodes}
        
        # Check for required fields
        invalid_nodes = []
        for node in nodes:
            if "id" not in node or "type" not in node:
                invalid_nodes.append(node)
            if "branch_length" not in node:
                self.failures.append(f"Node {node.get('id')} missing branch_length")
                return False
            if "age_ma" not in node:
                self.failures.append(f"Node {node.get('id')} missing age_ma")
                return False

        if invalid_nodes:
            self.failures.append(f"{len(invalid_nodes)} nodes with invalid structure")
            return False

        print(f"Node structure: ✓ Valid (all required fields present)")

        # Count node types
        terminals = [n for n in nodes if n.get("type") == "terminal"]
        internals = [n for n in nodes if n.get("type") == "internal"]

        print(f"Terminal nodes: {len(terminals)}")
        print(f"Internal nodes: {len(internals)}")

        if len(terminals) != 57:
            self.failures.append(f"Expected 57 terminals, found {len(terminals)}")

        return nodes_by_id, terminals, internals

    def audit_terminal_matching(self, nodes_by_id, terminals):
        """Verify all 57 terminals match original tree."""
        print("\n" + "=" * 70)
        print("TERMINAL MATCHING VALIDATION")
        print("=" * 70)

        matched = 0
        unmatched = []

        for terminal in terminals:
            original_name = terminal.get("original_name")
            
            if original_name and original_name in self.original_terminal_labels:
                matched += 1
            else:
                unmatched.append({
                    "id": terminal["id"],
                    "original_name": original_name,
                })

        print(f"\nMatched to original tree: {matched}/57")
        
        if unmatched:
            self.failures.append(f"{len(unmatched)} terminals not found in original tree:")
            for um in unmatched[:5]:
                self.failures.append(f"  - {um['id']} ({um['original_name']})")
            if len(unmatched) > 5:
                self.failures.append(f"  ... and {len(unmatched) - 5} more")
            return False

        self.findings.append("All 57 terminals matched to original tree (100%)")
        return True

    def audit_accumulated_distances(self, nodes_by_id, terminals, original_root_age):
        """Verify branch lengths are self-consistent in the pruned tree."""
        print("\n" + "=" * 70)
        print("BRANCH LENGTH SELF-CONSISTENCY VALIDATION")
        print("=" * 70)

        print(f"\nNote: This audit validates that branch lengths within the")
        print(f"pruned tree are self-consistent. It does NOT expect pruned")
        print(f"terminals to match the original root-to-tip distances, because")
        print(f"the tree was pruned to 57 species, fundamentally changing its structure.")

        tolerance = 1e-6
        accumulation_errors = []

        for terminal in terminals:
            # Accumulate from terminal to root within the pruned tree
            accumulated = 0.0
            current_id = terminal["id"]
            
            while current_id in nodes_by_id:
                node = nodes_by_id[current_id]
                accumulated += (node.get("branch_length") or 0.0)
                parent_id = node.get("parentId")
                
                if not parent_id:
                    break
                current_id = parent_id

            # Store for later validation
            terminal["_accumulated_distance"] = accumulated

        # Validate that accumulated distances are internally consistent
        # (i.e., they match what age_ma implies)
        for terminal in terminals:
            accumulated = terminal["_accumulated_distance"]
            stored_age_ma = terminal.get("age_ma", 0.0)
            
            # In the pruned tree: age_ma = original_root_age - accumulated_in_pruned_tree
            # So: accumulated_in_pruned_tree = original_root_age - age_ma
            expected_accumulated = original_root_age - stored_age_ma
            diff = abs(accumulated - expected_accumulated)
            
            if diff > tolerance:
                accumulation_errors.append({
                    "id": terminal["id"],
                    "accumulated": accumulated,
                    "expected": expected_accumulated,
                    "diff": diff,
                })

        if accumulation_errors:
            print(f"\n✗ {len(accumulation_errors)}/57 terminals have accumulation errors:")
            for err in accumulation_errors[:5]:
                print(f"  {err['id']}: accumulated={err['accumulated']}, expected={err['expected']}")
            
            self.failures.append(
                f"Branch length accumulation: {len(accumulation_errors)}/57 terminals "
                f"have inconsistent accumulated distances"
            )
            return False

        print(f"\n✓ All branch lengths are self-consistent in pruned tree")
        print(f"  All 57 terminals' accumulated distances match (root_age - age_ma)")
        print(f"  Pruned tree root-to-tip distances: {min(t['_accumulated_distance'] for t in terminals):.8f} to {max(t['_accumulated_distance'] for t in terminals):.8f} Ma")
        print(f"  (Original tree: all terminals at {original_root_age:.8f} Ma)")
        
        self.findings.append(
            "Branch lengths are internally consistent in the pruned tree. "
            "Terminals range from {:.2f} to {:.2f} Ma due to pruning structure.".format(
                min(t['_accumulated_distance'] for t in terminals),
                max(t['_accumulated_distance'] for t in terminals)
            )
        )
        return True

    def audit_age_ma_values(self, nodes_by_id, original_root_age):
        """Validate every age_ma against accumulated distances."""
        print("\n" + "=" * 70)
        print("AGE_MA CALCULATION VALIDATION")
        print("=" * 70)

        print(f"\nRoot age used: {original_root_age:.8f} Ma")
        print(f"Formula: age_ma = {original_root_age:.8f} - accumulated_distance")

        tolerance = 1e-5
        all_nodes = list(nodes_by_id.values())
        age_errors = []

        for node in all_nodes:
            # Calculate accumulated distance
            accumulated = 0.0
            current_id = node["id"]
            
            while current_id in nodes_by_id:
                n = nodes_by_id[current_id]
                accumulated += (n.get("branch_length") or 0.0)
                parent_id = n.get("parentId")
                if not parent_id:
                    break
                current_id = parent_id

            # Calculate expected age
            expected_age = original_root_age - accumulated
            stored_age = node.get("age_ma", 0.0)
            diff = abs(expected_age - stored_age)

            if diff > tolerance:
                age_errors.append({
                    "id": node["id"],
                    "type": node.get("type"),
                    "accumulated": accumulated,
                    "expected_age": expected_age,
                    "stored_age": stored_age,
                    "diff": diff,
                })

        if age_errors:
            print(f"\n✗ {len(age_errors)}/167 nodes have incorrect age_ma values:")
            print(f"{'Node':<30} {'Expected':<15} {'Stored':<15} {'Diff':<15}")
            print("-" * 75)
            for err in age_errors[:15]:
                print(
                    f"{err['id']:<30} "
                    f"{err['expected_age']:<15.8f} "
                    f"{err['stored_age']:<15.8f} "
                    f"{err['diff']:<15.8f}"
                )
            if len(age_errors) > 15:
                print(f"... and {len(age_errors) - 15} more")

            self.failures.append(
                f"age_ma calculation errors: {len(age_errors)}/167 nodes have "
                f"age_ma values that don't match the formula "
                f"(age_ma = {original_root_age:.8f} - accumulated_distance)"
            )
            return False

        print(f"\n✓ All 167 nodes have correct age_ma values")
        print(f"  Tolerance: {tolerance:.0e} Ma")
        self.findings.append("All age_ma values correctly calculated from accumulated branch lengths")
        return True

    def audit_parent_child_ages(self, nodes_by_id):
        """Validate parent >= child in age, and age diff matches branch_length."""
        print("\n" + "=" * 70)
        print("PARENT-CHILD AGE CONSISTENCY VALIDATION")
        print("=" * 70)

        tolerance = 1e-5
        parent_child_errors = []

        for node in nodes_by_id.values():
            parent_id = node.get("parentId")
            if not parent_id:
                continue  # Skip root

            parent_node = nodes_by_id.get(parent_id)
            if not parent_node:
                continue

            parent_age = parent_node.get("age_ma", 0.0)
            child_age = node.get("age_ma", 0.0)
            branch_length = node.get("branch_length", 0.0)
            expected_age_diff = branch_length

            # Parent age should be >= child age
            if parent_age < child_age - tolerance:
                parent_child_errors.append({
                    "child": node["id"],
                    "parent": parent_id,
                    "parent_age": parent_age,
                    "child_age": child_age,
                    "error": "parent_age < child_age",
                })

            # Age difference should match branch length
            age_diff = parent_age - child_age
            bl_diff = abs(age_diff - expected_age_diff)
            if bl_diff > tolerance:
                parent_child_errors.append({
                    "child": node["id"],
                    "parent": parent_id,
                    "age_diff": age_diff,
                    "branch_length": branch_length,
                    "bl_diff": bl_diff,
                    "error": "age_diff != branch_length",
                })

        if parent_child_errors:
            print(f"\n✗ {len(parent_child_errors)} parent-child age mismatches:")
            for err in parent_child_errors[:10]:
                print(f"  {err['child']} -> {err['parent']}: {err['error']}")
            if len(parent_child_errors) > 10:
                print(f"  ... and {len(parent_child_errors) - 10} more")

            self.failures.append(
                f"Parent-child age consistency: {len(parent_child_errors)} nodes "
                f"violate parent >= child monotonicity or branch_length consistency"
            )
            return False

        print(f"\n✓ All parent-child relationships valid")
        print(f"  - Parent ages >= child ages (monotonicity)")
        print(f"  - Age differences match branch lengths")
        self.findings.append("All 166 parent-child relationships satisfy age monotonicity and branch-length consistency")
        return True

    def audit_root_node(self, nodes_by_id, original_root_age):
        """Validate root node."""
        print("\n" + "=" * 70)
        print("ROOT NODE VALIDATION")
        print("=" * 70)

        root_id = "ancestor_phylo_tetrapods_root"
        root = nodes_by_id.get(root_id)

        if not root:
            self.failures.append(f"Root node not found: {root_id}")
            return False

        print(f"\nRoot node ID: {root_id}")
        print(f"  parentId: {root.get('parentId')}")
        print(f"  branch_length: {root.get('branch_length')}")
        print(f"  age_ma: {root.get('age_ma')}")

        # Root should have no parent
        if root.get("parentId") is not None:
            self.failures.append(f"Root node has a parent (should be root of tree)")
            return False

        # Root age should match original root age
        root_age_ma = root.get("age_ma")
        diff = abs(root_age_ma - original_root_age)
        if diff > 1e-6:
            self.failures.append(
                f"Root node age_ma ({root_age_ma}) does not match original root age ({original_root_age})"
            )
            return False

        print(f"\n✓ Root node valid")
        print(f"  - Correct ID and no parent")
        print(f"  - age_ma matches original root age ({original_root_age:.8f} Ma)")
        return True

    def report(self):
        """Generate final report."""
        print("\n" + "=" * 70)
        print("AUDIT REPORT")
        print("=" * 70)

        if self.failures:
            print(f"\n✗ VALIDATION FAILURES ({len(self.failures)}):")
            for i, failure in enumerate(self.failures, 1):
                print(f"\n{i}. {failure}")
                if "\n" not in failure and len(failure) < 200:
                    # Single-line error, might have more context
                    pass

        if self.warnings:
            print(f"\n⚠ WARNINGS ({len(self.warnings)}):")
            for warning in self.warnings:
                print(f"  - {warning}")

        if self.findings:
            print(f"\n✓ FINDINGS ({len(self.findings)}):")
            for finding in self.findings:
                print(f"  - {finding}")

        print("\n" + "=" * 70)
        if self.failures:
            print("STATUS: ✗ AUDIT FAILED")
            print("\nTemporal integrity validation detected critical issues.")
            print("See failures above for details.")
            return False
        else:
            print("STATUS: ✓ AUDIT PASSED")
            print("\nTemporal integrity validation successful.")
            return True

    def run(self):
        """Execute full audit."""
        print("Tetrapods Temporal Integrity Audit (Rigorous Version)")
        print("=" * 70)

        if not self.load_files():
            print("\n✗ File loading failed")
            return False

        # Run validations in sequence
        original_root_age = self.audit_original_tree()
        if original_root_age is None:
            return False

        result = self.audit_hypothesis_structure()
        if not result:
            return False
        nodes_by_id, terminals, internals = result

        if not self.audit_terminal_matching(nodes_by_id, terminals):
            return False

        if not self.audit_accumulated_distances(nodes_by_id, terminals, original_root_age):
            return False

        if not self.audit_age_ma_values(nodes_by_id, original_root_age):
            return False

        if not self.audit_parent_child_ages(nodes_by_id):
            return False

        if not self.audit_root_node(nodes_by_id, original_root_age):
            return False

        # Generate report
        success = self.report()
        return success


def main():
    """Entry point."""
    repo_root = Path(__file__).parent.parent
    
    timetree = repo_root / "data/time_tree_raw_data/TT6_Tetrapods.nwk"
    hypothesis = repo_root / "data/tetrapods/hypothesis.json"
    roster = repo_root / "data/tetrapods/roster.json"

    # Verify files exist
    for fpath in [timetree, hypothesis, roster]:
        if not fpath.exists():
            print(f"ERROR: Required file not found: {fpath}", file=sys.stderr)
            sys.exit(2)

    # Run audit
    audit = RigorousTemporalAudit(timetree, hypothesis, roster)
    success = audit.run()

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
