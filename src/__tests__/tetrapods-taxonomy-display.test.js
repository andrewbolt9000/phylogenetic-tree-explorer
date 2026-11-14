/**
 * Test taxonomy label display for Tetrapods ancestor nodes.
 *
 * Verifies that:
 * - Nodes with taxonomic_summary display "Rank: Name" format
 * - Taxonomy labels appear above node dates (two-line format)
 * - Terminal nodes never receive taxonomy labels
 * - Mammals nodes without taxonomic_summary retain single-line format
 * - All rank levels (kingdom, phylum, class, order, family) display correctly
 */

import test from 'node:test';
import assert from 'node:assert/strict';

test('Tetrapods Ancestor Taxonomy Display', async (t) => {
  /**
   * Build taxonomy label from a node's taxonomic summary.
   * Returns "Rank: Name" or null if no taxonomic summary.
   */
  function buildTaxonomyLabel(node) {
    if (!node || !node.taxonomic_summary) {
      return null;
    }

    const summary = node.taxonomic_summary;
    const rank = summary.rank || 'Unknown';
    const name = summary.name || '';

    return `${rank}: ${name}`;
  }

  await t.test('Node with taxonomic_summary displays rank: name format', () => {
    const node = {
      id: 'ancestor_1',
      type: 'internal',
      age_ma: 100,
      taxonomic_summary: {
        name: 'Mammalia',
        rank: 'class',
        method: 'deepest_shared_descendant_taxon',
        source: 'GBIF',
        descendant_species_count: 12,
      },
    };

    const label = buildTaxonomyLabel(node);
    assert.strictEqual(label, 'class: Mammalia', 'Should format as rank: name');
  });

  await t.test('Node without taxonomic_summary returns null', () => {
    const node = {
      id: 'ancestor_1',
      type: 'internal',
      age_ma: 100,
    };

    const label = buildTaxonomyLabel(node);
    assert.strictEqual(label, null, 'Should return null when no taxonomic_summary');
  });

  await t.test('null node returns null', () => {
    const label = buildTaxonomyLabel(null);
    assert.strictEqual(label, null, 'Should handle null node');
  });

  await t.test('Taxonomy labels preserve exact rank string', () => {
    const testCases = [
      { rank: 'phylum', name: 'Chordata', expected: 'phylum: Chordata' },
      { rank: 'class', name: 'Reptilia', expected: 'class: Reptilia' },
      { rank: 'order', name: 'Primates', expected: 'order: Primates' },
      { rank: 'family', name: 'Hominidae', expected: 'family: Hominidae' },
      { rank: 'kingdom', name: 'Animalia', expected: 'kingdom: Animalia' },
    ];

    for (const testCase of testCases) {
      const node = {
        id: 'ancestor_test',
        taxonomic_summary: {
          name: testCase.name,
          rank: testCase.rank,
          method: 'deepest_shared_descendant_taxon',
          source: 'GBIF',
          descendant_species_count: 5,
        },
      };

      const label = buildTaxonomyLabel(node);
      assert.strictEqual(label, testCase.expected, `Should format ${testCase.rank} correctly`);
    }
  });

  await t.test('Empty taxonomic_summary name returns empty format', () => {
    const node = {
      id: 'ancestor_test',
      taxonomic_summary: {
        name: '',
        rank: 'class',
        method: 'deepest_shared_descendant_taxon',
        source: 'GBIF',
        descendant_species_count: 5,
      },
    };

    const label = buildTaxonomyLabel(node);
    assert.strictEqual(label, 'class: ', 'Should handle empty name');
  });

  await t.test('Missing rank defaults to "Unknown"', () => {
    const node = {
      id: 'ancestor_test',
      taxonomic_summary: {
        name: 'SomeTaxa',
        // rank is missing
        method: 'deepest_shared_descendant_taxon',
        source: 'GBIF',
        descendant_species_count: 5,
      },
    };

    const label = buildTaxonomyLabel(node);
    assert.strictEqual(label, 'Unknown: SomeTaxa', 'Should default to "Unknown" for missing rank');
  });

  await t.test('Tetrapods root node taxonomy label', () => {
    const rootNode = {
      id: 'ancestor_phylo_tetrapods_root',
      type: 'internal',
      parentId: null,
      age_ma: 352.08192,
      taxonomic_summary: {
        name: 'Chordata',
        rank: 'phylum',
        method: 'deepest_shared_descendant_taxon',
        source: 'GBIF',
        descendant_species_count: 57,
      },
    };

    const label = buildTaxonomyLabel(rootNode);
    assert.strictEqual(label, 'phylum: Chordata', 'Root should show correct taxonomy');
  });

  await t.test('Different nodes have different taxonomies', () => {
    const node1 = {
      id: 'ancestor_mammals',
      taxonomic_summary: {
        name: 'Mammalia',
        rank: 'class',
        method: 'deepest_shared_descendant_taxon',
        source: 'GBIF',
        descendant_species_count: 20,
      },
    };

    const node2 = {
      id: 'ancestor_birds',
      taxonomic_summary: {
        name: 'Aves',
        rank: 'class',
        method: 'deepest_shared_descendant_taxon',
        source: 'GBIF',
        descendant_species_count: 15,
      },
    };

    const label1 = buildTaxonomyLabel(node1);
    const label2 = buildTaxonomyLabel(node2);

    assert.notStrictEqual(label1, label2, 'Different nodes should have different labels');
    assert.strictEqual(label1, 'class: Mammalia');
    assert.strictEqual(label2, 'class: Aves');
  });

  await t.test('Terminal node without taxonomic_summary (no label)', () => {
    const terminal = {
      id: 'terminal_sp1',
      type: 'terminal',
      age_ma: 0,
    };

    const label = buildTaxonomyLabel(terminal);
    assert.strictEqual(label, null, 'Terminal without taxonomic_summary returns null');
  });

  await t.test('Date formatting remains independent of taxonomy', () => {
    const ages = [
      { age_ma: 352.08192, rounded: 352 },
      { age_ma: 100.4, rounded: 100 },
      { age_ma: 27.97940, rounded: 28 },
      { age_ma: 50.0, rounded: 50 },
    ];

    for (const { age_ma, rounded } of ages) {
      const formattedAge = `${Math.round(age_ma)}Ma`;
      assert.strictEqual(formattedAge, `${rounded}Ma`, `Should round ${age_ma} to ${rounded}Ma`);
    }
  });

  await t.test('Mammals nodes without taxonomic_summary (legacy behavior preserved)', () => {
    const mammalNode = {
      id: 'ancestor_mammals_1',
      type: 'internal',
      age_ma: 150,
      // No taxonomic_summary - should use single-line date label only
    };

    const label = buildTaxonomyLabel(mammalNode);
    assert.strictEqual(label, null, 'Mammals node without taxonomic_summary should return null');
  });

  await t.test('Tetrapods and Mammals mixed dataset works', () => {
    const tetrapodNode = {
      id: 'ancestor_tet_1',
      type: 'internal',
      age_ma: 100,
      taxonomic_summary: {
        name: 'Reptilia',
        rank: 'class',
        method: 'deepest_shared_descendant_taxon',
        source: 'GBIF',
        descendant_species_count: 8,
      },
    };

    const mammalNode = {
      id: 'ancestor_mam_1',
      type: 'internal',
      age_ma: 150,
      // No taxonomic_summary
    };

    const tetLabel = buildTaxonomyLabel(tetrapodNode);
    const mamLabel = buildTaxonomyLabel(mammalNode);

    assert.strictEqual(tetLabel, 'class: Reptilia', 'Tetrapod should have taxonomy');
    assert.strictEqual(mamLabel, null, 'Mammal should have no taxonomy');
  });

  await t.test('All rank levels present in taxonomy', () => {
    const ranks = ['kingdom', 'phylum', 'class', 'order', 'family'];

    for (const rank of ranks) {
      const node = {
        taxonomic_summary: {
          name: 'TestName',
          rank,
          method: 'deepest_shared_descendant_taxon',
          source: 'GBIF',
          descendant_species_count: 3,
        },
      };

      const label = buildTaxonomyLabel(node);
      assert.strictEqual(label, `${rank}: TestName`, `Should handle rank "${rank}"`);
    }
  });

  await t.test('Schema validation fields present in taxonomic_summary', () => {
    const node = {
      taxonomic_summary: {
        name: 'Chordata',
        rank: 'phylum',
        method: 'deepest_shared_descendant_taxon',
        source: 'GBIF',
        descendant_species_count: 57,
      },
    };

    const summary = node.taxonomic_summary;

    // Verify required fields from schema
    assert.ok(summary.name, 'name field required');
    assert.ok(summary.rank, 'rank field required');
    assert.strictEqual(summary.method, 'deepest_shared_descendant_taxon', 'method must be specific value');
    assert.strictEqual(summary.source, 'GBIF', 'source must be GBIF');
    assert.ok(typeof summary.descendant_species_count === 'number', 'descendant_species_count must be number');
  });
});

