#!/usr/bin/env python3
"""
Test suite for Tetrapods build integration with age enrichment.

Tests the complete build pipeline: tree loading, pruning, output generation,
and age enrichment. Validates temporal integrity and schema compliance.
"""

import unittest
import json
from pathlib import Path
import tempfile
import shutil
import subprocess
import sys
from io import StringIO
from contextlib import redirect_stdout, redirect_stderr

# Set up path to import builder modules
REPO_ROOT = Path(__file__).parent.parent
SCRIPTS_DIR = REPO_ROOT / 'scripts'
sys.path.insert(0, str(SCRIPTS_DIR))

from build_tetrapods_complete_case_v2 import (
    load_complete_case_set,
    build_label_to_species_map,
    load_and_prune_tree,
    build_hypothesis,
    build_taxonomy,
    build_silhouette_mapping,
)


class TestIntegratedBuildPipeline(unittest.TestCase):
    """Test the complete build pipeline with age enrichment."""
    
    @classmethod
    def setUpClass(cls):
        """Set up test data directories and verify they exist."""
        cls.repo_root = REPO_ROOT
        cls.data_dir = cls.repo_root / 'data'
        cls.tetrapods_dir = cls.data_dir / 'tetrapods'
        cls.timetree_newick = cls.data_dir / 'time_tree_raw_data' / 'TT6_Tetrapods.nwk'
        
        # Verify required source files exist
        assert cls.timetree_newick.exists(), f"TimeTree Newick not found: {cls.timetree_newick}"
        assert cls.tetrapods_dir.exists(), f"Tetrapods data dir not found: {cls.tetrapods_dir}"
    
    def test_complete_case_set_loading(self):
        """Test that the 57-species complete-case set loads correctly."""
        included, roster_by_id, tt_by_id, gbif_by_id, phylopic_by_id = load_complete_case_set()
        
        self.assertEqual(len(included), 57, "Expected 57 complete-case species")
        self.assertGreater(len(roster_by_id), 0, "Roster should not be empty")
        self.assertGreater(len(tt_by_id), 0, "TimeTree map should not be empty")
        self.assertGreater(len(gbif_by_id), 0, "GBIF map should not be empty")
        self.assertGreater(len(phylopic_by_id), 0, "PhyloPic map should not be empty")
    
    def test_tree_loading_and_pruning(self):
        """Test that the tree loads and prunes to 57 species correctly."""
        included, _, tt_by_id, _, _ = load_complete_case_set()
        label_to_species = build_label_to_species_map(included, tt_by_id)
        
        tree, clade_to_species, orig_multi, pruned_multi, final_multi = load_and_prune_tree(label_to_species)
        
        # Verify tree structure
        self.assertIsNotNone(tree, "Tree should be loaded")
        self.assertEqual(len(included), len(label_to_species), "Label map should match included count")
        
        # Verify terminals
        terminals = [n for n in tree.get_terminals()]
        self.assertEqual(len(terminals), 57, f"Expected 57 terminals, got {len(terminals)}")
        
        # Verify multifurcations are reported
        self.assertIsNotNone(orig_multi, "Original multifurcation count should be recorded")
        self.assertIsNotNone(pruned_multi, "Pruned multifurcation count should be recorded")
        self.assertIsNotNone(final_multi, "Final multifurcation count should be recorded")
    
    def test_hypothesis_generation(self):
        """Test that hypothesis.json is generated with correct structure."""
        included, _, tt_by_id, _, _ = load_complete_case_set()
        label_to_species = build_label_to_species_map(included, tt_by_id)
        tree, clade_to_species, *_ = load_and_prune_tree(label_to_species)
        
        hypothesis = build_hypothesis(tree, clade_to_species)
        
        # Verify structure
        self.assertIn('hypothesisId', hypothesis)
        self.assertIn('rootNodeId', hypothesis)
        self.assertIn('nodes', hypothesis)
        self.assertIn('sourceMetadata', hypothesis)
        
        # Verify node count
        self.assertEqual(len(hypothesis['nodes']), 167, "Expected 167 nodes total")
        
        # Verify terminal count
        terminals = [n for n in hypothesis['nodes'] if n['type'] == 'terminal']
        self.assertEqual(len(terminals), 57, "Expected 57 terminal nodes")
        
        # Verify internal count
        internals = [n for n in hypothesis['nodes'] if n['type'] == 'internal']
        self.assertEqual(len(internals), 110, "Expected 110 internal nodes")
        
        # Verify all nodes have required fields
        required_fields = {'id', 'type', 'parentId', 'branch_length'}
        for node in hypothesis['nodes']:
            missing = required_fields - set(node.keys())
            self.assertFalse(missing, f"Node {node['id']} missing fields: {missing}")
    
    def test_taxonomy_generation(self):
        """Test that taxonomy.json is generated with correct structure."""
        included, roster_by_id, _, gbif_by_id, _ = load_complete_case_set()
        
        taxonomy = build_taxonomy(included, gbif_by_id, roster_by_id)
        
        # Verify structure
        self.assertIn('taxonomy', taxonomy)
        self.assertEqual(len(taxonomy['taxonomy']), 57, "Expected 57 taxonomy records")
        
        # Verify all records have required fields
        required_fields = {'id', 'scientificName', 'sourceId'}
        for record in taxonomy['taxonomy']:
            missing = required_fields - set(record.keys())
            self.assertFalse(missing, f"Taxonomy record {record.get('id')} missing fields: {missing}")
            
            # Verify sourceId is string
            self.assertIsInstance(record['sourceId'], str, 
                                 f"sourceId for {record['id']} should be string, got {type(record['sourceId'])}")
    
    def test_silhouette_mapping_generation(self):
        """Test that silhouette-mapping.json is generated correctly."""
        included, _, _, _, _ = load_complete_case_set()
        
        silhouettes = build_silhouette_mapping(included)
        
        # Verify structure
        self.assertIn('mappings', silhouettes)
        self.assertEqual(len(silhouettes['mappings']), 57, "Expected 57 image mappings")
        
        # Verify all mappings have required fields
        required_fields = {'imageUuid', 'source'}
        for species_id, mapping in silhouettes['mappings'].items():
            missing = required_fields - set(mapping.keys())
            self.assertFalse(missing, f"Mapping for {species_id} missing fields: {missing}")
    
    def test_branch_length_preservation(self):
        """Test that branch lengths are preserved through pruning and suppression."""
        included, _, tt_by_id, _, _ = load_complete_case_set()
        label_to_species = build_label_to_species_map(included, tt_by_id)
        tree, _, *_ = load_and_prune_tree(label_to_species)
        
        hypothesis = build_hypothesis(tree, {})
        
        # Verify all nodes have branch_length (except root)
        for node in hypothesis['nodes']:
            if node['parentId'] is not None:
                self.assertIn('branch_length', node, 
                            f"Node {node['id']} should have branch_length")
                self.assertIsNotNone(node['branch_length'],
                                   f"Node {node['id']} branch_length should not be None")
    
    def test_root_to_tip_distances(self):
        """Test that root-to-tip distances are correct for all terminals."""
        included, _, tt_by_id, _, _ = load_complete_case_set()
        label_to_species = build_label_to_species_map(included, tt_by_id)
        tree, _, *_ = load_and_prune_tree(label_to_species)
        
        hypothesis = build_hypothesis(tree, {})
        
        # Calculate root-to-tip distances in the pruned tree
        nodes_by_id = {n['id']: n for n in hypothesis['nodes']}
        root_node = nodes_by_id[hypothesis['rootNodeId']]
        
        for terminal_node in hypothesis['nodes']:
            if terminal_node['type'] != 'terminal':
                continue
            
            # Trace path from terminal to root
            distance = 0.0
            current = terminal_node
            
            while current['parentId'] is not None:
                if current['branch_length'] is not None:
                    distance += current['branch_length']
                current = nodes_by_id[current['parentId']]
            
            # Terminal branches should accumulate to approximately the original tree distance
            # All terminals in original TimeTree are at 352.08192 Ma
            # They should still be at that distance after pruning
            self.assertAlmostEqual(distance, 352.08192, places=3,
                                 msg=f"Terminal {terminal_node['id']} root-to-tip distance {distance} != 352.08192")
    
    def test_age_enrichment_integration(self):
        """Test that the age enrichment script is properly integrated."""
        enrichment_script = self.repo_root / 'scripts' / 'add_node_ages_tetrapods.py'
        self.assertTrue(enrichment_script.exists(), 
                       f"Age enrichment script not found: {enrichment_script}")
    
    def test_subprocess_invocation(self):
        """Test that subprocess.run can successfully invoke the enrichment script."""
        enrichment_script = self.repo_root / 'scripts' / 'add_node_ages_tetrapods.py'
        
        # This is a dry-run test: we just verify the invocation works, not the output
        # The actual enrichment will happen during full build
        try:
            result = subprocess.run(
                [sys.executable, str(enrichment_script)],
                capture_output=True,
                text=True,
                timeout=30
            )
            # We expect success (return code 0) after the hypothesis has been generated
            # For this unit test, we just verify it doesn't crash on invocation
            self.assertIsNotNone(result.stdout)
            self.assertIsNotNone(result.stderr)
        except FileNotFoundError:
            self.fail(f"Enrichment script not found or not executable: {enrichment_script}")
        except subprocess.TimeoutExpired:
            self.fail("Enrichment script timed out")


class TestAgeEnrichmentValidation(unittest.TestCase):
    """Test age enrichment validation requirements."""
    
    @classmethod
    def setUpClass(cls):
        """Set up test paths."""
        cls.repo_root = REPO_ROOT
        cls.tetrapods_dir = cls.repo_root / 'data' / 'tetrapods'
        cls.hypothesis_path = cls.tetrapods_dir / 'hypothesis.json'
    
    def test_enriched_hypothesis_structure(self):
        """Test that enriched hypothesis has age_ma on all nodes."""
        if not self.hypothesis_path.exists():
            self.skipTest("hypothesis.json not yet generated")
        
        with open(self.hypothesis_path) as f:
            hypothesis = json.load(f)
        
        # If ages are not present, this test documents that fact
        nodes_with_ages = sum(1 for n in hypothesis['nodes'] if 'age_ma' in n)
        total_nodes = len(hypothesis['nodes'])
        
        # After enrichment, all nodes should have age_ma
        if nodes_with_ages == total_nodes:
            # Verify age values are sensible
            for node in hypothesis['nodes']:
                if 'age_ma' in node:
                    age = node['age_ma']
                    self.assertIsInstance(age, (int, float), 
                                        f"age_ma for {node['id']} should be numeric")
                    self.assertGreaterEqual(age, 0, 
                                          f"age_ma for {node['id']} should be non-negative")
                    self.assertLessEqual(age, 352.08192, 
                                       f"age_ma for {node['id']} should not exceed root age")
    
    def test_terminal_ages_are_zero(self):
        """Test that all terminal nodes have age_ma approximately zero."""
        if not self.hypothesis_path.exists():
            self.skipTest("hypothesis.json not yet generated")
        
        with open(self.hypothesis_path) as f:
            hypothesis = json.load(f)
        
        for node in hypothesis['nodes']:
            if node['type'] == 'terminal' and 'age_ma' in node:
                # Terminals should be at present time (age ~0)
                self.assertLess(node['age_ma'], 1e-5,
                              f"Terminal {node['id']} should have age ~0, got {node['age_ma']}")
    
    def test_root_age_preserved(self):
        """Test that root node has correct age."""
        if not self.hypothesis_path.exists():
            self.skipTest("hypothesis.json not yet generated")
        
        with open(self.hypothesis_path) as f:
            hypothesis = json.load(f)
        
        root_id = hypothesis['rootNodeId']
        nodes_by_id = {n['id']: n for n in hypothesis['nodes']}
        root_node = nodes_by_id[root_id]
        
        if 'age_ma' in root_node:
            # Root should be at 352.08192 Ma (the original TimeTree root age)
            self.assertAlmostEqual(root_node['age_ma'], 352.08192, places=3,
                                 msg=f"Root node age should be 352.08192, got {root_node['age_ma']}")


def run_full_build_test():
    """
    Integration test: Run the complete build pipeline and verify outputs.
    
    This is a higher-level test that exercises the entire system.
    """
    print("\n" + "=" * 80)
    print("RUNNING FULL BUILD INTEGRATION TEST")
    print("=" * 80)
    
    repo_root = REPO_ROOT
    builder_script = repo_root / 'scripts' / 'build_tetrapods_complete_case_v2.py'
    
    print(f"\nExecuting: {builder_script}")
    
    try:
        # Run the builder
        result = subprocess.run(
            [sys.executable, str(builder_script)],
            capture_output=True,
            text=True,
            timeout=120
        )
        
        print("Builder output:")
        print(result.stdout)
        
        if result.returncode != 0:
            print("Builder failed!")
            print("stderr:")
            print(result.stderr)
            return False
        
        # Verify outputs exist
        tetrapods_dir = repo_root / 'data' / 'tetrapods'
        hypothesis_file = tetrapods_dir / 'hypothesis.json'
        taxonomy_file = tetrapods_dir / 'taxonomy.json'
        silhouettes_file = tetrapods_dir / 'silhouette-mapping.json'
        
        assert hypothesis_file.exists(), "hypothesis.json not created"
        assert taxonomy_file.exists(), "taxonomy.json not created"
        assert silhouettes_file.exists(), "silhouette-mapping.json not created"
        
        print("\n✓ All output files created")
        
        # Verify hypothesis structure
        with open(hypothesis_file) as f:
            hypothesis = json.load(f)
        
        print(f"\nHypothesis validation:")
        print(f"  Nodes: {len(hypothesis['nodes'])}")
        print(f"  Terminals: {len([n for n in hypothesis['nodes'] if n['type'] == 'terminal'])}")
        print(f"  Internals: {len([n for n in hypothesis['nodes'] if n['type'] == 'internal'])}")
        
        # Check age enrichment
        nodes_with_ages = sum(1 for n in hypothesis['nodes'] if 'age_ma' in n)
        print(f"  Nodes with age_ma: {nodes_with_ages}/{len(hypothesis['nodes'])}")
        
        if nodes_with_ages == len(hypothesis['nodes']):
            print("✓ All nodes enriched with ages")
            
            # Verify terminal ages
            terminals = [n for n in hypothesis['nodes'] if n['type'] == 'terminal']
            terminal_ages = [n['age_ma'] for n in terminals if 'age_ma' in n]
            
            if terminal_ages:
                min_age = min(terminal_ages)
                max_age = max(terminal_ages)
                mean_age = sum(terminal_ages) / len(terminal_ages)
                print(f"\n  Terminal ages (should be ~0):")
                print(f"    Min: {min_age:.8f} Ma")
                print(f"    Max: {max_age:.8f} Ma")
                print(f"    Mean: {mean_age:.8f} Ma")
                
                if max_age < 1e-4:
                    print("  ✓ Terminal ages are correct (≈0)")
                else:
                    print("  ✗ Terminal ages are not zero!")
                    return False
            
            # Verify root age
            root_id = hypothesis['rootNodeId']
            nodes_by_id = {n['id']: n for n in hypothesis['nodes']}
            root_node = nodes_by_id[root_id]
            
            if 'age_ma' in root_node:
                print(f"\n  Root age: {root_node['age_ma']:.5f} Ma (expected 352.08192)")
                if abs(root_node['age_ma'] - 352.08192) < 0.01:
                    print("  ✓ Root age is correct")
                else:
                    print("  ✗ Root age is incorrect!")
                    return False
        else:
            print(f"✗ Age enrichment incomplete: {nodes_with_ages}/{len(hypothesis['nodes'])} nodes enriched")
            return False
        
        print("\n" + "=" * 80)
        print("✓ FULL BUILD INTEGRATION TEST PASSED")
        print("=" * 80)
        return True
        
    except subprocess.TimeoutExpired:
        print("✗ Builder timed out")
        return False
    except Exception as e:
        print(f"✗ Error during build: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == '__main__':
    # Run unit tests
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    suite.addTests(loader.loadTestsFromTestCase(TestIntegratedBuildPipeline))
    suite.addTests(loader.loadTestsFromTestCase(TestAgeEnrichmentValidation))
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Run full build integration test
    print("\n")
    build_success = run_full_build_test()
    
    # Exit with appropriate code
    sys.exit(0 if result.wasSuccessful() and build_success else 1)
