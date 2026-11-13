/**
 * Hypothesis Loader
 * Loads and validates phylogenetic hypothesis data, ensuring tree structure and terminal-taxonomy bindings.
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

class HypothesisLoader {
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

  load(dataPath, taxonomy = {}) {
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
      return this._processHypothesis(data, taxonomy);
    } catch (error) {
      throw new Error(`Failed to load hypothesis from ${dataPath}: ${error.message}`);
    }
  }

  async loadAsync(dataPath, taxonomy = {}) {
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
          throw new Error(`Failed to load hypothesis from ${dataPath}: ${fetchError.message}`);
        }
        try {
          json = fs.readFileSync(dataPath, 'utf-8');
        } catch (fsError) {
          throw new Error(`Failed to load hypothesis from ${dataPath}: ${fsError.message}`);
        }
      }

      let data;
      try {
        data = JSON.parse(json);
      } catch (error) {
        throw new Error(`Invalid JSON in hypothesis data ${dataPath}: ${error.message}`);
      }

      this.validator.validate(data);
      return this._processHypothesis(data, taxonomy);
    } catch (error) {
      throw new Error(`Failed to load hypothesis from ${dataPath}: ${error.message}`);
    }
  }

  _processHypothesis(data, taxonomy) {
    const hypothesis = {
      hypothesisId: data.hypothesisId,
      hypothesisName: data.hypothesisName,
      source: data.source,
      sourceMetadata: data.sourceMetadata || {},
      rootNodeId: data.rootNodeId,
      terminalIdPrefix: data.terminalIdPrefix,
      internalIdPrefix: data.internalIdPrefix,
      nodeMap: {},
      edgeMap: {} // nodeId -> [childIds]
    };

    const idSet = new Set();
    const parentMap = {};
    const childrenMap = {};

    // First pass: collect all nodes and validate structure
    for (const node of data.nodes) {
      if (idSet.has(node.id)) {
        throw new ValidationError(`Duplicate node ID in hypothesis: ${node.id}`);
      }
      idSet.add(node.id);
      hypothesis.nodeMap[node.id] = node;
      parentMap[node.id] = node.parentId;
      childrenMap[node.id] = node.children;
    }

    // Validate tree structure
    this._validateTreeStructure(hypothesis, data.nodes, taxonomy);

    // Build edge map
    for (const nodeId in childrenMap) {
      hypothesis.edgeMap[nodeId] = childrenMap[nodeId];
    }

    // Store nodes array for external use
    hypothesis.nodes = data.nodes;

    return hypothesis;
  }

  _validateTreeStructure(hypothesis, nodes, taxonomy) {
    const hypothesisId = hypothesis.hypothesisId;
    const nodeMap = hypothesis.nodeMap;
    const terminalPrefix = hypothesis.terminalIdPrefix;
    const internalPrefix = hypothesis.internalIdPrefix;

    // Validate root
    if (!nodeMap[hypothesis.rootNodeId]) {
      throw new ValidationError(`Root node '${hypothesis.rootNodeId}' does not exist`);
    }

    // Validate each node
    for (const node of nodes) {
      // Type must be valid
      if (!['terminal', 'internal'].includes(node.type)) {
        throw new ValidationError(`Invalid node type '${node.type}' for node '${node.id}'`);
      }

      // Terminal vs internal prefix convention
      if (node.type === 'terminal') {
        if (!node.id.startsWith(terminalPrefix)) {
          throw new ValidationError(
            `Terminal node '${node.id}' does not start with terminal prefix '${terminalPrefix}'`
          );
        }
      } else {
        if (!node.id.startsWith(internalPrefix)) {
          throw new ValidationError(
            `Internal node '${node.id}' does not start with internal prefix '${internalPrefix}'`
          );
        }
      }

      // Parent validation
      if (node.id === hypothesis.rootNodeId) {
        if (node.parentId !== null && node.parentId !== undefined) {
          throw new ValidationError(`Root node '${node.id}' must have parentId=null`);
        }
      } else {
        if (node.parentId === null || node.parentId === undefined) {
          throw new ValidationError(`Non-root node '${node.id}' must have a parent`);
        }
        if (!nodeMap[node.parentId]) {
          throw new ValidationError(
            `Node '${node.id}' references non-existent parent '${node.parentId}'`
          );
        }
      }

      // Children validation
      if (node.type === 'terminal') {
        if (!Array.isArray(node.children) || node.children.length !== 0) {
          throw new ValidationError(`Terminal node '${node.id}' must have empty children array`);
        }
        // Terminal must have taxonId
        if (!node.taxonId) {
          throw new ValidationError(`Terminal node '${node.id}' must have taxonId`);
        }
        // Taxon must exist
        if (Object.keys(taxonomy).length > 0 && !taxonomy[node.taxonId]) {
          throw new ValidationError(
            `Terminal node '${node.id}' references non-existent taxon '${node.taxonId}'`
          );
        }
      } else {
        // Internal nodes may be unary to preserve the original OTL topology.
        if (!Array.isArray(node.children)) {
          throw new ValidationError(
            `Internal node '${node.id}' must have a children array`
          );
        }
        // All children must exist
        for (const childId of node.children) {
          if (!nodeMap[childId]) {
            throw new ValidationError(
              `Node '${node.id}' references non-existent child '${childId}'`
            );
          }
        }
        // If internal node has a taxonId, validate that it exists in taxonomy
        if (node.taxonId) {
          if (Object.keys(taxonomy).length > 0 && !taxonomy[node.taxonId]) {
            throw new ValidationError(
              `Internal node '${node.id}' references non-existent taxon '${node.taxonId}'`
            );
          }
        }
      }
    }

    // Detect cycles
    this._detectTreeCycles(hypothesis);
  }

  _detectTreeCycles(hypothesis) {
    const visited = new Set();
    const recursionStack = new Set();

    const dfs = (nodeId) => {
      if (recursionStack.has(nodeId)) {
        throw new ValidationError(`Cycle detected in tree: ${nodeId}`);
      }
      if (visited.has(nodeId)) {
        return;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const node = hypothesis.nodeMap[nodeId];
      if (node.parentId) {
        dfs(node.parentId);
      }

      recursionStack.delete(nodeId);
    };

    for (const nodeId of Object.keys(hypothesis.nodeMap)) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }
  }
}

export { HypothesisLoader };
