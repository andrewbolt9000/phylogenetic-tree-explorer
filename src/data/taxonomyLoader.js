/**
 * Taxonomy Loader
 * Loads and validates taxonomic data, ensuring hierarchy integrity.
 * Browser-compatible: uses fetch() for data loading in browser, fs in Node.js tests.
 */

import { SchemaValidator, ValidationError } from './schemaValidator.js';

let fs = null;

// Initialize fs in Node.js using dynamic import
// Tests must await this promise before using sync load() method
export const fsReadyPromise = (async () => {
  try {
    const moduleImport = await import('module');
    const require = moduleImport.createRequire(import.meta.url);
    fs = require('fs');
  } catch (e) {
    // Browser context or error - fs stays null
  }
})();



class TaxonomyLoader {
  constructor(schemaPath) {
    this.schemaPath = schemaPath;
    this.validator = null;
    this._schemaPromise = null;
  }

  async _ensureSchema() {
    if (this.validator) return;
    if (this._schemaPromise) return this._schemaPromise;

    this._schemaPromise = (async () => {
      let schemaJson;
      try {
        // Try to use fetch (browser and modern Node)
        const response = await fetch(this.schemaPath);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        schemaJson = await response.text();
      } catch (error) {
        // Fallback to fs for Node.js
        if (!fs) {
          throw new Error(`Failed to load schema from ${this.schemaPath}: ${error.message}`);
        }
        try {
          schemaJson = fs.readFileSync(this.schemaPath, 'utf-8');
        } catch (fsError) {
          throw new Error(`Failed to load schema from ${this.schemaPath}: ${fsError.message}`);
        }
      }

      try {
        const schema = JSON.parse(schemaJson);
        this.validator = new SchemaValidator(schema);
      } catch (error) {
        throw new Error(`Invalid JSON in schema ${this.schemaPath}: ${error.message}`);
      }
    })();

    return this._schemaPromise;
  }

  load(dataPath) {
    // Synchronous load for Node.js tests
    // Note: fs initialization is async but scheduled in microtasks
    // This method should only be called after module imports complete
    if (!fs) {
      throw new Error('Synchronous load() requires Node.js fs module; use loadAsync() in browser context');
    }
    try {
      if (!this.validator) {
        const schemaJson = fs.readFileSync(this.schemaPath, 'utf-8');
        const schema = JSON.parse(schemaJson);
        this.validator = new SchemaValidator(schema);
      }
      const json = fs.readFileSync(dataPath, 'utf-8');
      const data = JSON.parse(json);
      this.validator.validate(data);
      return this._processTaxonomy(data);
    } catch (error) {
      throw new Error(`Failed to load taxonomy from ${dataPath}: ${error.message}`);
    }
  }

  async loadAsync(dataPath) {
    try {
      await this._ensureSchema();

      let json;
      try {
        // Try fetch first (browser)
        const response = await fetch(dataPath);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        json = await response.text();
      } catch (fetchError) {
        // Fallback to fs for Node.js
        if (!fs) {
          throw new Error(`Failed to load taxonomy from ${dataPath}: ${fetchError.message}`);
        }
        try {
          json = fs.readFileSync(dataPath, 'utf-8');
        } catch (fsError) {
          throw new Error(`Failed to load taxonomy from ${dataPath}: ${fsError.message}`);
        }
      }

      let data;
      try {
        data = JSON.parse(json);
      } catch (error) {
        throw new Error(`Invalid JSON in taxonomy data ${dataPath}: ${error.message}`);
      }

      this.validator.validate(data);
      return this._processTaxonomy(data);
    } catch (error) {
      throw new Error(`Failed to load taxonomy from ${dataPath}: ${error.message}`);
    }
  }

  _processTaxonomy(data) {
    const taxonomy = {};
    const idSet = new Set();

    // Build ID map
    for (const taxon of data.taxonomy) {
      if (idSet.has(taxon.id)) {
        throw new ValidationError(`Duplicate taxon ID: ${taxon.id}`);
      }
      idSet.add(taxon.id);
      taxonomy[taxon.id] = taxon;
    }

    // Validate parent-child relationships
    for (const taxon of data.taxonomy) {
      if (taxon.parent !== null && taxon.parent !== undefined) {
        if (!idSet.has(taxon.parent)) {
          throw new ValidationError(
            `Taxon '${taxon.id}' references non-existent parent '${taxon.parent}'`
          );
        }
      }
    }

    // Check for cycles
    for (const taxon of data.taxonomy) {
      this._detectCycle(taxon.id, taxonomy);
    }

    return {
      taxa: taxonomy,
      metadata: data.metadata
    };
  }

  _detectCycle(taxonId, taxonomy, visited = new Set()) {
    if (visited.has(taxonId)) {
      throw new ValidationError(`Cycle detected in taxonomy hierarchy involving '${taxonId}'`);
    }

    const taxon = taxonomy[taxonId];
    if (!taxon || !taxon.parent) {
      return;
    }

    visited.add(taxonId);
    this._detectCycle(taxon.parent, taxonomy, visited);
  }
}

export { TaxonomyLoader };
