"""
Phylogenetic tree pruning utilities for Tetrapods dataset.

Handles:
- Pruning tree to selected terminals
- Removing redundant unary internal nodes
- Preserving branch lengths (sum incoming + outgoing for suppressed nodes)
- Detecting multifurcations
- Assigning deterministic node IDs
"""

import logging
from Bio import Phylo
from Bio.Phylo.BaseTree import Clade, Tree
from collections import defaultdict

log = logging.getLogger(__name__)

def prune_tree_to_selection(tree, selected_terminal_names):
    """
    Prune tree to selected terminals, removing unselected branches.
    
    Args:
        tree: BioPython Tree object
        selected_terminal_names: set of terminal node names to keep
    
    Returns:
        Pruned tree with only selected terminals and their ancestors
    """
    log.info(f"Pruning tree to {len(selected_terminal_names)} selected terminals")
    
    # Mark which terminals to keep
    selected_set = set(selected_terminal_names)
    
    def has_selected_descendant(clade):
        """Check if clade has any selected terminal descendants."""
        if clade.is_terminal():
            return clade.name in selected_set
        return any(has_selected_descendant(child) for child in clade.clades)
    
    def prune_clade(clade):
        """
        Recursively prune clade.
        Returns the pruned clade, or None if it should be removed.
        """
        if clade.is_terminal():
            # Keep terminal only if selected
            return clade if clade.name in selected_set else None
        
        # Prune all children
        pruned_children = []
        for child in clade.clades:
            pruned_child = prune_clade(child)
            if pruned_child is not None:
                pruned_children.append(pruned_child)
        
        if not pruned_children:
            return None  # No descendants kept, remove this clade
        
        # Create new clade with pruned children
        new_clade = Clade(name=clade.name)
        new_clade.clades = pruned_children
        new_clade.branch_length = clade.branch_length
        new_clade.confidence = clade.confidence
        
        return new_clade
    
    # Prune from root
    new_root = prune_clade(tree.root)
    if new_root is None:
        raise ValueError("No terminals selected - result would be empty tree")
    
    pruned_tree = Tree(root=new_root)
    retained = len(pruned_tree.get_terminals())
    log.info(f"✓ Pruned tree: {retained} terminals retained")
    
    return pruned_tree

def suppress_unary_nodes(tree):
    """
    Remove unary (single-child) internal nodes while preserving branch lengths.
    
    When a unary node is removed, its branch length is combined with the child's
    branch length so root-to-tip distances are preserved.
    
    Returns:
        Simplified tree, count of suppressed nodes
    """
    log.info("Suppressing redundant unary nodes...")
    
    suppressed_count = 0
    
    def compress_unary(clade, parent_length=0):
        """Recursively compress unary chains."""
        nonlocal suppressed_count
        
        # Base case: terminal node
        if clade.is_terminal():
            # Update branch length with accumulated parent length
            if clade.branch_length is None:
                clade.branch_length = parent_length
            else:
                clade.branch_length = (clade.branch_length or 0) + parent_length
            return clade
        
        # Recursive case: internal node
        # First, recursively process all children
        new_children = []
        for child in clade.clades:
            new_child = compress_unary(child, 0)
            new_children.append(new_child)
        
        # Now check if this node is unary
        if len(new_children) == 1:
            # Unary node: propagate upward with accumulated branch length
            suppressed_count += 1
            child = new_children[0]
            accumulated_length = (clade.branch_length or 0) + (child.branch_length or 0)
            child.branch_length = accumulated_length
            return child
        else:
            # Multi-child node: keep it with compressed children
            new_clade = Clade(name=clade.name)
            new_clade.clades = new_children
            new_clade.branch_length = (clade.branch_length or 0) + parent_length
            new_clade.confidence = clade.confidence
            return new_clade
    
    new_root = compress_unary(tree.root)
    result_tree = Tree(root=new_root)
    
    log.info(f"✓ Suppressed {suppressed_count} unary nodes")
    
    return result_tree, suppressed_count

def analyze_branching_structure(tree):
    """
    Analyze branching structure of tree.
    
    Returns dict with:
    - total_internal_nodes
    - binary_nodes
    - multifurcation_nodes
    - multifurcation_degrees (dict of degree -> count)
    """
    internal_nodes = [c for c in tree.find_clades() if not c.is_terminal()]
    
    binary = 0
    multi_deg = defaultdict(int)
    
    for node in internal_nodes:
        num_children = len(node.clades)
        if num_children == 2:
            binary += 1
        elif num_children > 2:
            multi_deg[num_children] += 1
    
    result = {
        "total_internal": len(internal_nodes),
        "binary": binary,
        "multifurcations": len(multi_deg) if multi_deg else 0,
        "multifurcation_degrees": dict(sorted(multi_deg.items()))
    }
    
    log.info(f"Branching analysis:")
    log.info(f"  Internal nodes: {result['total_internal']}")
    log.info(f"  Binary branching: {result['binary']}")
    if multi_deg:
        log.info(f"  Multifurcations: {result['multifurcations']}")
        for deg, count in sorted(multi_deg.items()):
            log.info(f"    Degree {deg}: {count} nodes")
    else:
        log.info(f"  Multifurcations: None (strictly bifurcating)")
    
    return result

def assign_deterministic_ids(tree, label_to_species_id=None, hypothesis_prefix="phylo_tetrapods"):
    """
    Assign stable, deterministic IDs to all nodes.
    
    Terminal nodes get IDs like: tax_species_id (if mapping provided) or tax_newick_label
    Internal nodes get IDs like: ancestor_tetrapods_00001
    
    ID assignment is deterministic based on position in tree traversal.
    
    Args:
        tree: BioPython Tree object
        label_to_species_id: Optional dict mapping newick labels to species_id strings
        hypothesis_prefix: Prefix for internal node IDs
    """
    log.info(f"Assigning deterministic node IDs...")
    
    id_map = {}  # clade_ref -> id
    nodes_by_id = {}  # id -> node dict
    
    terminal_counter = 0
    internal_counter = 0
    
    def traverse_and_assign(clade, parent_id=None):
        nonlocal terminal_counter, internal_counter
        
        if clade.is_terminal():
            terminal_counter += 1
            # Use species_id if available, otherwise use newick label
            if label_to_species_id and clade.name in label_to_species_id:
                species_id = label_to_species_id[clade.name]
                node_id = f"tax_{species_id}"
            else:
                node_id = f"tax_{clade.name.replace('_', '_').lower()}"
            node_type = "terminal"
        else:
            internal_counter += 1
            node_id = f"ancestor_{hypothesis_prefix}_{internal_counter:05d}"
            node_type = "internal"
        
        id_map[id(clade)] = node_id
        
        # Recursively assign IDs to children and collect their IDs
        child_ids = []
        for child in clade.clades:
            child_id = traverse_and_assign(child, node_id)
            child_ids.append(child_id)
        
        # Create node record with correct parent reference
        node_record = {
            "id": node_id,
            "type": node_type,
            "original_name": clade.name,
            "parentId": parent_id,
            "children": child_ids,
            "branch_length": clade.branch_length,
            "confidence": clade.confidence
        }
        
        # Terminal nodes must have taxonId
        if node_type == "terminal":
            node_record["taxonId"] = node_id
        
        nodes_by_id[node_id] = node_record
        
        return node_id
    
    # Process root separately
    root_id = f"ancestor_{hypothesis_prefix}_root"
    id_map[id(tree.root)] = root_id
    
    # Assign IDs to all root's children
    root_children = []
    for child in tree.root.clades:
        child_id = traverse_and_assign(child, root_id)
        root_children.append(child_id)
    
    # Create root node record
    nodes_by_id[root_id] = {
        "id": root_id,
        "type": "internal",
        "original_name": tree.root.name,
        "parentId": None,
        "children": root_children,
        "branch_length": tree.root.branch_length,
        "confidence": tree.root.confidence
    }
    
    # Convert to list maintaining proper order for JSON output
    # Use pre-order traversal to get consistent ordering
    node_data = []
    visited = set()
    
    def collect_nodes(node_id):
        if node_id in visited:
            return
        visited.add(node_id)
        node_data.append(nodes_by_id[node_id])
        for child_id in nodes_by_id[node_id]["children"]:
            collect_nodes(child_id)
    
    collect_nodes(root_id)
    
    log.info(f"✓ Assigned IDs: {terminal_counter} terminals, {internal_counter} internal + 1 root")
    
    return id_map, node_data

def check_root_to_tip_distances(original_tree, pruned_tree):
    """
    Verify that root-to-tip distances are preserved in pruned tree.
    
    Returns dict with comparisons for shared terminals.
    """
    log.info("Verifying root-to-tip distances...")
    
    # Build distance maps
    def get_dist_to_tip(clade, dist=0):
        """Get distances from clade to all terminal descendants."""
        dists = {}
        if clade.is_terminal():
            dists[clade.name] = dist
        else:
            for child in clade.clades:
                child_dists = get_dist_to_tip(child, dist + (child.branch_length or 0))
                dists.update(child_dists)
        return dists
    
    orig_dists = get_dist_to_tip(original_tree.root)
    pruned_dists = get_dist_to_tip(pruned_tree.root)
    
    mismatches = 0
    for name in pruned_dists:
        if name in orig_dists:
            orig_dist = orig_dists[name]
            pruned_dist = pruned_dists[name]
            if abs(orig_dist - pruned_dist) > 1e-6:  # Allow small numerical error
                log.warning(f"  Distance mismatch for {name}: {orig_dist} vs {pruned_dist}")
                mismatches += 1
    
    if mismatches == 0:
        log.info(f"✓ All {len(pruned_dists)} retained terminals have preserved distances")
    else:
        log.warning(f"✗ {mismatches} terminals have distance mismatches")
    
    return {
        "retained_terminals": len(pruned_dists),
        "mismatches": mismatches,
        "distance_preserved": mismatches == 0
    }

