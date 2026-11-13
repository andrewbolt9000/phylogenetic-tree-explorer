/**
 * Display Name Resolver Tests
 */

import test from 'node:test';
import assert from 'node:assert';
import { resolveDisplayName } from './displayNameResolver.js';

const mockTaxonomy = {
  'tax_ott542509': {
    id: 'tax_ott542509',
    scientificName: 'Mus musculus',
    commonName: 'House mouse',
    rank: 'species'
  },
  'tax_ott247341': {
    id: 'tax_ott247341',
    scientificName: 'Canis lupus',
    commonName: 'Gray wolf',
    rank: 'species'
  },
  'tax_scientific_only': {
    id: 'tax_scientific_only',
    scientificName: 'Panthera leo',
    rank: 'species'
  },
  'tax_common_only': {
    id: 'tax_common_only',
    commonName: 'African elephant',
    rank: 'species'
  }
};

test('Display Name Resolver', async (t) => {
  await t.test('Scientific name preferred by default', () => {
    const node = {
      id: 'tax_ott542509',
      type: 'terminal',
      taxonId: 'tax_ott542509'
    };

    const name = resolveDisplayName(node, mockTaxonomy);
    assert.strictEqual(name, 'Mus musculus', 'Should use scientific name by default');
  });

  await t.test('Common name preferred when preferCommonName is true', () => {
    const node = {
      id: 'tax_ott542509',
      type: 'terminal',
      taxonId: 'tax_ott542509'
    };

    const name = resolveDisplayName(node, mockTaxonomy, { preferCommonName: true });
    assert.strictEqual(name, 'House mouse', 'Should use common name when preferred');
  });

  await t.test('Scientific name fallback when no common name exists', () => {
    const node = {
      id: 'tax_scientific_only',
      type: 'terminal',
      taxonId: 'tax_scientific_only'
    };

    const name = resolveDisplayName(node, mockTaxonomy, { preferCommonName: true });
    assert.strictEqual(name, 'Panthera leo', 'Should fall back to scientific name when common name missing');
  });

  await t.test('Common name fallback when no scientific name exists', () => {
    const node = {
      id: 'tax_common_only',
      type: 'terminal',
      taxonId: 'tax_common_only'
    };

    const name = resolveDisplayName(node, mockTaxonomy);
    assert.strictEqual(name, 'African elephant', 'Should fall back to common name when scientific name missing');
  });

  await t.test('sourceLabel fallback for nodes without taxonomy record', () => {
    const node = {
      id: 'ancestor_n1',
      type: 'internal',
      taxonId: 'unknown_taxon',
      sourceLabel: 'Ancestral primate'
    };

    const name = resolveDisplayName(node, mockTaxonomy);
    assert.strictEqual(name, 'Ancestral primate', 'Should use sourceLabel when taxonomy record missing');
  });

  await t.test('TaxonId diagnostic fallback when taxonomy record missing and no sourceLabel', () => {
    const node = {
      id: 'ancestor_n2',
      type: 'internal',
      taxonId: 'unknown_taxon'
    };

    const name = resolveDisplayName(node, mockTaxonomy);
    assert.strictEqual(name, 'unknown_taxon', 'Should use taxonId as diagnostic when no other info available');
  });

  await t.test('sourceLabel used for nodes without taxonId', () => {
    const node = {
      id: 'ancestor_n3',
      type: 'internal',
      sourceLabel: 'Generic ancestor'
    };

    const name = resolveDisplayName(node, mockTaxonomy);
    assert.strictEqual(name, 'Generic ancestor', 'Should use sourceLabel when no taxonId present');
  });

  await t.test('Unidentified node when no information available', () => {
    const node = {
      id: 'ancestor_n4',
      type: 'internal'
    };

    const name = resolveDisplayName(node, mockTaxonomy);
    assert.strictEqual(name, 'Unidentified node', 'Should return default label when no info available');
  });

  await t.test('Null or undefined node returns unidentified', () => {
    assert.strictEqual(resolveDisplayName(null, mockTaxonomy), 'Unidentified node', 'Should handle null node');
    assert.strictEqual(resolveDisplayName(undefined, mockTaxonomy), 'Unidentified node', 'Should handle undefined node');
  });

  await t.test('Empty taxonomy map', () => {
    const node = {
      id: 'tax_ott542509',
      type: 'terminal',
      taxonId: 'tax_ott542509'
    };

    const name = resolveDisplayName(node, {});
    assert.strictEqual(name, 'tax_ott542509', 'Should use taxonId when taxonomy is empty');
  });

  await t.test('Inputs are not mutated', () => {
    const node = {
      id: 'tax_ott542509',
      type: 'terminal',
      taxonId: 'tax_ott542509'
    };

    const nodeCopy = JSON.parse(JSON.stringify(node));
    const taxonomyCopy = JSON.parse(JSON.stringify(mockTaxonomy));

    resolveDisplayName(node, mockTaxonomy);

    assert.deepStrictEqual(node, nodeCopy, 'Node should not be mutated');
    assert.deepStrictEqual(mockTaxonomy, taxonomyCopy, 'Taxonomy should not be mutated');
  });

  await t.test('Internal node with taxonId resolves correctly', () => {
    const node = {
      id: 'ancestor_otl_000360',
      type: 'internal',
      parentId: 'ancestor_otl_000359',
      taxonId: 'tax_ott247341'
    };

    const name = resolveDisplayName(node, mockTaxonomy);
    assert.strictEqual(name, 'Canis lupus', 'Should resolve internal node with taxonId');
  });

  await t.test('Options defaults to preferCommonName false', () => {
    const node = {
      id: 'tax_ott542509',
      type: 'terminal',
      taxonId: 'tax_ott542509'
    };

    // Passing empty options object should default to preferCommonName: false
    const name = resolveDisplayName(node, mockTaxonomy, {});
    assert.strictEqual(name, 'Mus musculus', 'Should default to scientific name preference');
  });

  await t.test('No taxonomy parameter (defaults to empty map)', () => {
    const node = {
      id: 'ancestor_n5',
      type: 'internal',
      taxonId: 'unknown_taxon',
      sourceLabel: 'Fallback label'
    };

    // Call without taxonomy parameter
    const name = resolveDisplayName(node);
    assert.strictEqual(name, 'Fallback label', 'Should use sourceLabel fallback when taxonomy not provided');
  });
});
