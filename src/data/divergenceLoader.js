/**
 * Divergence Estimates Loader
 * Loads and validates divergence time estimates, linking them to hypothesis nodes.
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

class DivergenceLoader {
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

  load(dataPath, hypotheses = {}) {
    // Synchronous load for Node.js tests
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
      return this._processDivergences(data, hypotheses);
    } catch (error) {
      throw new Error(`Failed to load divergence estimates from ${dataPath}: ${error.message}`);
    }
  }

  async loadAsync(dataPath, hypotheses = {}) {
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
          throw new Error(`Failed to load divergence estimates from ${dataPath}: ${fetchError.message}`);
        }
        try {
          json = fs.readFileSync(dataPath, 'utf-8');
        } catch (fsError) {
          throw new Error(`Failed to load divergence estimates from ${dataPath}: ${fsError.message}`);
        }
      }

      let data;
      try {
        data = JSON.parse(json);
      } catch (error) {
        throw new Error(`Invalid JSON in divergence data ${dataPath}: ${error.message}`);
      }

      this.validator.validate(data);
      return this._processDivergences(data, hypotheses);
    } catch (error) {
      throw new Error(`Failed to load divergence estimates from ${dataPath}: ${error.message}`);
    }
  }

  _processDivergences(data, hypotheses) {
    const estimates = {};
    const rawMetadata = data.metadata || {};

    // Convert sources array to a map keyed by sourceId if needed
    let sourceMetadata = {};
    if (Array.isArray(rawMetadata.sources)) {
      for (const source of rawMetadata.sources) {
        sourceMetadata[source.sourceId] = source;
      }
    } else {
      // If metadata is already a map, use it as-is
      sourceMetadata = rawMetadata;
    }

    // Process divergenceEstimates object structured as:
    // divergenceEstimates -> hypothesisId -> nodeId -> [estimates array]
    const divergenceEstimates = data.divergenceEstimates || {};

    for (const hypothesisId of Object.keys(divergenceEstimates)) {
      const hypothesisEstimates = divergenceEstimates[hypothesisId];

      // Validate that hypothesis exists
      if (Object.keys(hypotheses).length > 0 && !hypotheses[hypothesisId]) {
        throw new ValidationError(`Estimate references non-existent hypothesis '${hypothesisId}'`);
      }

      for (const nodeId of Object.keys(hypothesisEstimates)) {
        const nodeEstimates = hypothesisEstimates[nodeId];

        // Validate that node exists in hypothesis (if hypothesis loaded)
        if (hypotheses[hypothesisId] && !hypotheses[hypothesisId].nodeMap[nodeId]) {
          throw new ValidationError(
            `Estimate references non-existent node '${nodeId}' in hypothesis '${hypothesisId}'`
          );
        }

        // Validate that node is internal (not terminal)
        if (hypotheses[hypothesisId]) {
          const node = hypotheses[hypothesisId].nodeMap[nodeId];
          if (node.type === 'terminal') {
            throw new ValidationError(
              `Divergence estimate cannot apply to terminal node '${nodeId}'`
            );
          }
        }

        // Process individual estimates
        this._validateEstimateValues(nodeEstimates, sourceMetadata);

        // Store by (hypothesisId, nodeId) key
        const key = `${hypothesisId}:${nodeId}`;
        estimates[key] = {
          hypothesisId,
          nodeId,
          estimates: nodeEstimates
        };
      }
    }

    return {
      estimates,
      sourceMetadata: sourceMetadata,
      estimatesByHypothesis: this._indexByHypothesis(estimates)
    };
  }

  _validateEstimateValues(estimateList, sourceMetadata) {
    for (const est of estimateList) {
      // Validate central estimate
      if (typeof est.centralEstimate !== 'number' || est.centralEstimate < 0) {
        throw new ValidationError(`Invalid centralEstimate: ${est.centralEstimate}`);
      }

      // Validate uncertainty bounds
      if (est.uncertaintyLower !== null && est.uncertaintyLower !== undefined) {
        if (typeof est.uncertaintyLower !== 'number' || est.uncertaintyLower < 0) {
          throw new ValidationError(`Invalid uncertaintyLower: ${est.uncertaintyLower}`);
        }
        if (est.uncertaintyLower > est.centralEstimate) {
          throw new ValidationError(
            `uncertaintyLower (${est.uncertaintyLower}) > centralEstimate (${est.centralEstimate})`
          );
        }
      }

      if (est.uncertaintyUpper !== null && est.uncertaintyUpper !== undefined) {
        if (typeof est.uncertaintyUpper !== 'number' || est.uncertaintyUpper < 0) {
          throw new ValidationError(`Invalid uncertaintyUpper: ${est.uncertaintyUpper}`);
        }
        if (est.uncertaintyUpper < est.centralEstimate) {
          throw new ValidationError(
            `uncertaintyUpper (${est.uncertaintyUpper}) < centralEstimate (${est.centralEstimate})`
          );
        }
      }

      // Validate uncertainty type is specified if bounds are provided
      if ((est.uncertaintyLower != null || est.uncertaintyUpper != null) && !est.uncertaintyType) {
        throw new ValidationError(
          `uncertaintyType is required when uncertainty bounds are provided`
        );
      }

      // Validate source metadata exists
      if (est.sourceId && Object.keys(sourceMetadata).length > 0) {
        if (!sourceMetadata[est.sourceId]) {
          throw new ValidationError(`Estimate references non-existent source '${est.sourceId}'`);
        }
      }
    }
  }

  _indexByHypothesis(estimates) {
    const byHypothesis = {};
    for (const [key, estimate] of Object.entries(estimates)) {
      const hypId = estimate.hypothesisId;
      if (!byHypothesis[hypId]) {
        byHypothesis[hypId] = {};
      }
      byHypothesis[hypId][estimate.nodeId] = estimate;
    }
    return byHypothesis;
  }
}

export { DivergenceLoader };
