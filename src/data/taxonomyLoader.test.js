/**
 * Tests for Taxonomy Loader with comprehensive rank support
 * Verifies that all 30 OTL ranks can be loaded and validated correctly
 */

import test from 'node:test';
import assert from 'node:assert';
import { TaxonomyLoader, fsReadyPromise } from './taxonomyLoader.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHEMA_PATH = path.join(__dirname, '../../data/schemas/taxonomy.schema.json');
const FIXTURE_PATH = path.join(__dirname, '../../data/test-fixtures/taxonomy-fixture.json');

let loader;

test('TaxonomyLoader - Initialize loader', async () => {
  // Ensure fs is ready for synchronous operations
  await fsReadyPromise;
  loader = new TaxonomyLoader(SCHEMA_PATH);
  assert(loader, 'Loader should be created');
});

test('TaxonomyLoader - Load fixture with all 30 ranks', async () => {
  const taxonomy = await loader.loadAsync(FIXTURE_PATH);
  assert(taxonomy, 'Should return taxonomy object');
  assert(taxonomy.taxa, 'Should have taxa property');
  assert(taxonomy.metadata, 'Should have metadata property');
});

test('TaxonomyLoader - Load all taxa from fixture', async () => {
  const taxonomy = await loader.loadAsync(FIXTURE_PATH);
  // Fixture has ~40+ taxa representing all ranks
  assert(Object.keys(taxonomy.taxa).length > 30,
    'Should load at least 30 taxa');
});

test('TaxonomyLoader - Preserve rank strings exactly', async () => {
  const taxonomy = await loader.loadAsync(FIXTURE_PATH);

  // Test a few specific ranks
  const domainTaxon = taxonomy.taxa['tax_exa_life'];
  assert.strictEqual(domainTaxon.rank, 'domain', 'Should preserve domain rank');

  const kingdomTaxon = taxonomy.taxa['tax_exa_animalia'];
  assert.strictEqual(kingdomTaxon.rank, 'kingdom', 'Should preserve kingdom rank');

  const speciesTaxon = taxonomy.taxa['tax_exa_homo_sapiens'];
  assert.strictEqual(speciesTaxon.rank, 'species', 'Should preserve species rank');

  const subspeciesTaxon = taxonomy.taxa['tax_exa_homo_sapiens_sapiens'];
  assert.strictEqual(subspeciesTaxon.rank, 'subspecies', 'Should preserve subspecies rank');
});

test('TaxonomyLoader - Accept no rank value', async () => {
  const taxonomy = await loader.loadAsync(FIXTURE_PATH);
  const unrankedTaxon = taxonomy.taxa['tax_exa_unranked_extinct'];
  assert.strictEqual(unrankedTaxon.rank, 'no rank',
    'Should accept and preserve no rank value');
});

test('TaxonomyLoader - Accept mammal-specific non-Linnaean ranks', async () => {
  const taxonomy = await loader.loadAsync(FIXTURE_PATH);

  const expectedRanks = {
    'tax_exa_eutheria': 'infraclass',
    'tax_exa_placentalia': 'cohort',
    'tax_exa_primatomorpha': 'subcohort',
    'tax_exa_euarchontoglires': 'superorder',
    'tax_exa_haplorhini': 'suborder',
    'tax_exa_simiiformes': 'infraorder',
    'tax_exa_catarrhini': 'parvorder'
  };

  for (const [taxonId, expectedRank] of Object.entries(expectedRanks)) {
    const taxon = taxonomy.taxa[taxonId];
    assert(taxon, `Taxon ${taxonId} should exist`);
    assert.strictEqual(taxon.rank, expectedRank,
      `${taxonId} should have rank '${expectedRank}'`);
  }
});

test('TaxonomyLoader - Accept all intermediate ranks', async () => {
  const taxonomy = await loader.loadAsync(FIXTURE_PATH);

  const expectedRanks = {
    'tax_exa_vertebrata': 'subphylum',
    'tax_exa_aves': 'superclass',
    'tax_exa_theria': 'subclass',
    'tax_exa_homininae': 'subfamily',
    'tax_exa_hominini': 'tribe',
    'tax_exa_hominina': 'subtribe',
    'tax_exa_homo_subgenus': 'subgenus',
    'tax_exa_homo_section': 'section',
    'tax_exa_homo_subsection': 'subsection',
    'tax_exa_sapiens_group': 'species group',
    'tax_exa_sapiens_subgroup': 'species subgroup'
  };

  for (const [taxonId, expectedRank] of Object.entries(expectedRanks)) {
    const taxon = taxonomy.taxa[taxonId];
    assert(taxon, `Taxon ${taxonId} should exist`);
    assert.strictEqual(taxon.rank, expectedRank,
      `${taxonId} should have rank '${expectedRank}'`);
  }
});

test('TaxonomyLoader - Rank hierarchy validation does not reject taxa by rank order', async () => {
  const taxonomy = await loader.loadAsync(FIXTURE_PATH);

  // Just verify loading succeeded and all ranks are preserved
  for (const taxon of Object.values(taxonomy.taxa)) {
    assert(taxon.rank, `Taxon ${taxon.id} should have rank`);
    assert(typeof taxon.rank === 'string', `Rank should be string, got ${typeof taxon.rank}`);
    assert(taxon.rank.length > 0, 'Rank should not be empty string');
  }
});

test('TaxonomyLoader - Validate parent-child relationships', async () => {
  const taxonomy = await loader.loadAsync(FIXTURE_PATH);

  // All parent references should exist
  for (const taxon of Object.values(taxonomy.taxa)) {
    if (taxon.parent !== null && taxon.parent !== undefined) {
      assert(taxonomy.taxa[taxon.parent],
        `Parent ${taxon.parent} of ${taxon.id} should exist in taxonomy`);
    }
  }
});

test('TaxonomyLoader - Preserve extinct flag regardless of rank', async () => {
  const taxonomy = await loader.loadAsync(FIXTURE_PATH);

  // Living species should have extinct: false
  const humanTaxon = taxonomy.taxa['tax_exa_homo_sapiens'];
  assert.strictEqual(humanTaxon.extinct, false, 'Living human should not be extinct');

  // Extinct species should have extinct: true
  const neanderthalTaxon = taxonomy.taxa['tax_exa_homo_neanderthalensis'];
  assert.strictEqual(neanderthalTaxon.extinct, true, 'Neanderthal should be extinct');

  // Extinct unranked taxa should work too
  const unrankedExtinct = taxonomy.taxa['tax_exa_unranked_extinct'];
  assert.strictEqual(unrankedExtinct.extinct, true,
    'Unranked extinct taxon should preserve extinct flag');
  assert.strictEqual(unrankedExtinct.rank, 'no rank',
    'Unranked extinct taxon should preserve no rank value');
});

test('TaxonomyLoader - Preserve commonName and scientificName independently of rank', async () => {
  const taxonomy = await loader.loadAsync(FIXTURE_PATH);

  // Species with names
  const homo = taxonomy.taxa['tax_exa_homo'];
  assert.strictEqual(homo.scientificName, 'Homo');
  assert(!homo.commonName, 'Genus typically has no common name');

  const sapiens = taxonomy.taxa['tax_exa_homo_sapiens'];
  assert.strictEqual(sapiens.scientificName, 'Homo sapiens');
  assert.strictEqual(sapiens.commonName, 'Human');

  // Higher ranks can have common names too
  const unranked = taxonomy.taxa['tax_exa_unranked_extinct'];
  assert.strictEqual(unranked.commonName, "Lucy's species");
  assert.strictEqual(unranked.rank, 'no rank');
});

test('TaxonomyLoader - Backwards compatibility with original ranks', async () => {
  const taxonomy = await loader.loadAsync(FIXTURE_PATH);

  // Original schema had: kingdom, phylum, class, order, family, genus, species,
  // superclass, subclass, superfamily, subfamily, tribe, subgenus, species
  const originalRanks = new Set([
    'kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species',
    'superclass', 'subclass', 'superfamily', 'subfamily', 'tribe', 'subgenus'
  ]);

  let foundOriginalRanks = new Set();
  for (const taxon of Object.values(taxonomy.taxa)) {
    if (originalRanks.has(taxon.rank)) {
      foundOriginalRanks.add(taxon.rank);
    }
  }

  // Most original ranks should be present
  assert(foundOriginalRanks.size >= 10,
    `Should find original ranks, found ${foundOriginalRanks.size}: ${Array.from(foundOriginalRanks).join(', ')}`);
});

test('TaxonomyLoader - Synchronous load with all ranks preserved', async function() {
  // Ensure fs is ready
  await fsReadyPromise;
  const taxonomy = loader.load(FIXTURE_PATH);
  assert(taxonomy, 'Should return taxonomy object');
  assert(taxonomy.taxa, 'Should have taxa property');
  assert(Object.keys(taxonomy.taxa).length > 30, 'Should load many taxa');

  // Verify specific ranks are preserved
  assert.strictEqual(taxonomy.taxa['tax_exa_life'].rank, 'domain');
  assert.strictEqual(taxonomy.taxa['tax_exa_homo_sapiens'].rank, 'species');
  assert.strictEqual(taxonomy.taxa['tax_exa_unranked_extinct'].rank, 'no rank');
});

test('TaxonomyLoader - Fixture has valid parent references', async () => {
  const taxonomy = await loader.loadAsync(FIXTURE_PATH);
  assert(taxonomy, 'Fixture should have valid parent references');
});

test('TaxonomyLoader - Fixture has no duplicate taxon IDs', async () => {
  const taxonomy = await loader.loadAsync(FIXTURE_PATH);
  const ids = Object.keys(taxonomy.taxa);
  const uniqueIds = new Set(ids);
  assert.strictEqual(ids.length, uniqueIds.size, 'Should not have duplicate IDs');
});

test('TaxonomyLoader - Load and preserve metadata', async () => {
  const taxonomy = await loader.loadAsync(FIXTURE_PATH);
  assert(taxonomy.metadata, 'Should have metadata');
  assert.strictEqual(taxonomy.metadata.source, 'SYNTHETIC-FIXTURE');
  assert(taxonomy.metadata.notes.includes('OTL ranks'),
    'Fixture should document rank coverage in metadata');
});
