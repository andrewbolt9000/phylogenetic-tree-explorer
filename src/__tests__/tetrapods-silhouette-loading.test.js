import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

const MAPPING_PATH = './data/tetrapods/silhouette-mapping.json';
const INVENTORY_PATH = './data/tetrapods/phylopic_inventory.json';
const IMAGES_DIR = './data/tetrapods/phylopic_images';

test('Tetrapods Silhouette Loading', async (t) => {
  const mappingData = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));
  const inventoryData = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8'));

  await t.test('Silhouette mapping has correct structure', () => {
    assert(mappingData.mappings, 'Mapping should have mappings property');
    assert(typeof mappingData.mappings === 'object', 'Mappings should be an object');

    // Check first mapping entry
    const firstTaxonId = Object.keys(mappingData.mappings)[0];
    assert(firstTaxonId, 'Should have at least one mapping');

    const firstMapping = mappingData.mappings[firstTaxonId];
    assert(firstMapping.imageUuid, 'Mapping should have imageUuid');
    assert(firstMapping.license, 'Mapping should have license');
    assert(firstMapping.contributor, 'Mapping should have contributor');
  });

  await t.test('Inventory has correct structure', () => {
    assert(inventoryData.species, 'Inventory should have species array');
    assert(Array.isArray(inventoryData.species), 'Species should be an array');
    assert(inventoryData.species.length > 0, 'Should have at least one species');

    // Check first species entry
    const firstSpecies = inventoryData.species[0];
    assert(firstSpecies.species_id, 'Species should have species_id');
    assert(firstSpecies.images, 'Species should have images array');
    assert(Array.isArray(firstSpecies.images), 'Images should be an array');

    // Check first image
    const firstImage = firstSpecies.images[0];
    assert(firstImage.image_uuid, 'Image should have image_uuid');
    assert(firstImage.local_file, 'Image should have local_file');
  });

  await t.test('All 57 mapping entries resolve to existing local files', () => {
    // Build UUID-to-file lookup
    const uuidToFile = {};
    for (const species of inventoryData.species) {
      for (const image of species.images) {
        const uuid = image.image_uuid;
        const localFile = image.local_file;
        if (uuid && localFile) {
          uuidToFile[uuid] = localFile;
        }
      }
    }

    let resolvedCount = 0;
    const unresolvedMappings = [];

    for (const [taxonId, imageData] of Object.entries(mappingData.mappings)) {
      const imageUuid = imageData.imageUuid;
      const resolvedFile = uuidToFile[imageUuid];

      if (resolvedFile) {
        resolvedCount++;

        // Verify the file exists
        assert(fs.existsSync(resolvedFile),
          `Local file should exist for ${taxonId}: ${resolvedFile}`);
      } else {
        unresolvedMappings.push({ taxonId, imageUuid });
      }
    }

    assert.equal(resolvedCount, 57, 'All 57 mappings should resolve to local files');
    assert.equal(unresolvedMappings.length, 0,
      `All mappings should resolve; ${unresolvedMappings.length} unresolved`);
  });

  await t.test('Resolved silhouettes are valid SVG files', () => {
    // Build UUID-to-file lookup
    const uuidToFile = {};
    for (const species of inventoryData.species) {
      for (const image of species.images) {
        const uuid = image.image_uuid;
        const localFile = image.local_file;
        if (uuid && localFile) {
          uuidToFile[uuid] = localFile;
        }
      }
    }

    let svgCount = 0;
    let nonSvgCount = 0;
    const nonSvgFiles = [];

    for (const [taxonId, imageData] of Object.entries(mappingData.mappings)) {
      const imageUuid = imageData.imageUuid;
      const localFile = uuidToFile[imageUuid];

      if (localFile) {
        if (localFile.endsWith('.svg')) {
          svgCount++;
        } else {
          nonSvgCount++;
          nonSvgFiles.push(localFile);
        }
      }
    }

    assert.equal(svgCount, 57, 'All 57 resolved files should be SVG');
    assert.equal(nonSvgCount, 0,
      `No non-SVG files should be in resolved mappings; found ${nonSvgCount}`);
  });

  await t.test('Browser-relative paths start with data/tetrapods/phylopic_images/', () => {
    // Build UUID-to-file lookup
    const uuidToFile = {};
    for (const species of inventoryData.species) {
      for (const image of species.images) {
        const uuid = image.image_uuid;
        const localFile = image.local_file;
        if (uuid && localFile) {
          uuidToFile[uuid] = localFile;
        }
      }
    }

    const expectedPrefix = 'data/tetrapods/phylopic_images/';
    let correctPathCount = 0;
    const incorrectPaths = [];

    for (const [taxonId, imageData] of Object.entries(mappingData.mappings)) {
      const imageUuid = imageData.imageUuid;
      const localFile = uuidToFile[imageUuid];

      if (localFile) {
        if (localFile.startsWith(expectedPrefix)) {
          correctPathCount++;
        } else {
          incorrectPaths.push({ taxonId, path: localFile });
        }
      }
    }

    assert.equal(correctPathCount, 57,
      'All paths should start with data/tetrapods/phylopic_images/');
    assert.equal(incorrectPaths.length, 0,
      `All paths should have correct prefix; ${incorrectPaths.length} incorrect`);
  });

  await t.test('Silhouette metadata preserves all required fields', () => {
    // Build UUID-to-file lookup
    const uuidToFile = {};
    for (const species of inventoryData.species) {
      for (const image of species.images) {
        const uuid = image.image_uuid;
        const localFile = image.local_file;
        if (uuid && localFile) {
          uuidToFile[uuid] = localFile;
        }
      }
    }

    // Check that all mappings have required metadata fields
    const requiredFields = ['imageUuid', 'license', 'contributor', 'source', 'sourceUrl'];
    let completeCount = 0;
    const incomplete = [];

    for (const [taxonId, imageData] of Object.entries(mappingData.mappings)) {
      const hasAllFields = requiredFields.every(field => field in imageData);
      if (hasAllFields) {
        completeCount++;
      } else {
        const missingFields = requiredFields.filter(field => !(field in imageData));
        incomplete.push({ taxonId, missingFields });
      }
    }

    assert.equal(completeCount, 57, 'All mappings should have complete metadata');
    assert.equal(incomplete.length, 0, 'No incomplete metadata');
  });

  await t.test('Tetrapods images directory structure is correct', () => {
    assert(fs.existsSync(IMAGES_DIR), `Images directory should exist: ${IMAGES_DIR}`);

    // Count actual SVG files in the directory
    const svgFiles = [];

    function walkDir(dirPath) {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.name.endsWith('.svg')) {
          svgFiles.push(fullPath);
        }
      }
    }

    walkDir(IMAGES_DIR);
    assert(svgFiles.length > 0, `Should have downloaded SVG files in ${IMAGES_DIR}`);
  });

  await t.test('UUID mapping is consistent: no duplicate UUIDs with different files', () => {
    // Build UUID-to-file mapping and check for duplicates with different files
    const uuidToFiles = {};

    for (const species of inventoryData.species) {
      for (const image of species.images) {
        const uuid = image.image_uuid;
        const localFile = image.local_file;

        if (uuid && localFile) {
          if (!uuidToFiles[uuid]) {
            uuidToFiles[uuid] = [];
          }
          if (!uuidToFiles[uuid].includes(localFile)) {
            uuidToFiles[uuid].push(localFile);
          }
        }
      }
    }

    // Check that each UUID maps to exactly one file
    let inconsistentCount = 0;
    const inconsistent = [];

    for (const [uuid, files] of Object.entries(uuidToFiles)) {
      if (files.length > 1) {
        inconsistentCount++;
        inconsistent.push({ uuid, files });
      }
    }

    assert.equal(inconsistentCount, 0,
      `Each UUID should map to exactly one file; ${inconsistentCount} inconsistencies found`);
  });
});
