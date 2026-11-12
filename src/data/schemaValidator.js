/**
 * JSON Schema Validator
 * Validates data against JSON schemas using Ajv-like pattern matching.
 * This implementation provides basic schema validation without external dependencies.
 */

class ValidationError extends Error {
  constructor(message, path = '', value = null) {
    super(message);
    this.name = 'ValidationError';
    this.path = path;
    this.value = value;
  }
}

class SchemaValidator {
  constructor(schema) {
    this.schema = schema;
  }

  validate(data) {
    const errors = [];
    this._validateValue(data, this.schema, '', errors);
    if (errors.length > 0) {
      throw new ValidationError(`Validation failed with ${errors.length} error(s):\n${errors.join('\n')}`);
    }
    return data;
  }

  _validateValue(value, schema, path, errors) {
    // Handle null
    if (value === null) {
      if (schema.type === 'null' || (Array.isArray(schema.type) && schema.type.includes('null'))) {
        return;
      }
      if (schema.type !== null) {
        errors.push(`${path}: expected non-null value`);
      }
      return;
    }

    // Type validation (but handle array separately since typeof array === 'object')
    if (schema.type) {
      let actualType;
      if (Array.isArray(value)) {
        actualType = 'array';
      } else {
        actualType = value === null ? 'null' : typeof value;
      }

      if (Array.isArray(schema.type)) {
        // Special case: integer is a subtype of number in JSON Schema
        // A JavaScript number with no fractional part is valid for integer type
        let typeMatch = schema.type.includes(actualType);
        if (!typeMatch && actualType === 'number' && schema.type.includes('integer')) {
          if (Number.isInteger(value)) {
            typeMatch = true;
          }
        }
        if (!typeMatch) {
          errors.push(`${path}: expected type ${schema.type.join(' or ')}, got ${actualType}`);
          return;
        }
      } else {
        const expectedType = schema.type;
        // Special case: integer is a subtype of number in JSON Schema
        if (expectedType === 'integer' && actualType === 'number') {
          if (!Number.isInteger(value)) {
            errors.push(`${path}: expected integer, got non-integer number`);
            return;
          }
        } else if (expectedType !== actualType) {
          errors.push(`${path}: expected type ${expectedType}, got ${actualType}`);
          return;
        }
      }
    }

    // Object validation
    if (schema.type === 'object') {
      if (typeof value !== 'object' || Array.isArray(value)) {
        errors.push(`${path}: expected object, got ${typeof value}`);
        return;
      }

      // Check required properties
      if (schema.required) {
        for (const key of schema.required) {
          if (!(key in value)) {
            errors.push(`${path}: missing required property '${key}'`);
          }
        }
      }

      // Validate properties
      if (schema.properties) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          if (key in value) {
            const newPath = path ? `${path}.${key}` : key;
            this._validateValue(value[key], propSchema, newPath, errors);
          }
        }
      }

      // Check for additional properties
      if (schema.additionalProperties === false) {
        const allowedKeys = new Set(Object.keys(schema.properties || {}));
        for (const key of Object.keys(value)) {
          if (!allowedKeys.has(key)) {
            errors.push(`${path}: unexpected property '${key}'`);
          }
        }
      } else if (typeof schema.additionalProperties === 'object') {
        const allowedKeys = new Set(Object.keys(schema.properties || {}));
        for (const [key, val] of Object.entries(value)) {
          if (!allowedKeys.has(key)) {
            const newPath = path ? `${path}.${key}` : key;
            this._validateValue(val, schema.additionalProperties, newPath, errors);
          }
        }
      }
    }

    // Array validation
    if (schema.type === 'array') {
      if (!Array.isArray(value)) {
        errors.push(`${path}: expected array, got ${typeof value}`);
        return;
      }

      if (schema.minItems !== undefined && value.length < schema.minItems) {
        errors.push(`${path}: array must have at least ${schema.minItems} items, got ${value.length}`);
      }

      if (schema.maxItems !== undefined && value.length > schema.maxItems) {
        errors.push(`${path}: array must have at most ${schema.maxItems} items, got ${value.length}`);
      }

      if (schema.items) {
        for (let i = 0; i < value.length; i++) {
          const newPath = `${path}[${i}]`;
          this._validateValue(value[i], schema.items, newPath, errors);
        }
      }
    }

    // String validation
    if (schema.type === 'string') {
      if (schema.pattern) {
        try {
          // JSON Schema patterns should match the full string
          // However, if a pattern starts with ^ but doesn't end with $,
          // treat it as a prefix pattern (matches strings starting with that prefix)
          const pattern = schema.pattern;
          let wrappedPattern = pattern;
          
          // Only add anchors if they're not already present
          // If the pattern starts with ^ but not end with $, it's a prefix pattern
          // Don't add $ in that case
          if (!pattern.startsWith('^')) {
            wrappedPattern = '^' + wrappedPattern;
          }
          if (!pattern.endsWith('$') && !pattern.startsWith('^')) {
            // Only add $ if it doesn't start with ^ (i.e., no anchor specified)
            wrappedPattern = wrappedPattern + '$';
          }
          
          const regex = new RegExp(wrappedPattern);
          if (!regex.test(value)) {
            errors.push(`${path}: string '${value}' does not match pattern '${schema.pattern}'`);
          }
        } catch (e) {
          errors.push(`${path}: invalid pattern '${schema.pattern}': ${e.message}`);
        }
      }

      if (schema.enum) {
        if (!schema.enum.includes(value)) {
          errors.push(`${path}: value '${value}' is not one of ${JSON.stringify(schema.enum)}`);
        }
      }

      if (schema.format) {
        if (schema.format === 'uri') {
          try {
            new URL(value);
          } catch {
            errors.push(`${path}: value '${value}' is not a valid URI`);
          }
        } else if (schema.format === 'date') {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(Date.parse(value))) {
            errors.push(`${path}: value '${value}' is not a valid date (YYYY-MM-DD)`);
          }
        }
      }
    }

    // Number validation
    if (schema.type === 'number' || schema.type === 'integer') {
      if (typeof value !== 'number') {
        errors.push(`${path}: expected number, got ${typeof value}`);
        return;
      }

      if (schema.type === 'integer' && !Number.isInteger(value)) {
        errors.push(`${path}: expected integer, got ${value}`);
      }

      if (schema.minimum !== undefined && value < schema.minimum) {
        errors.push(`${path}: value ${value} is less than minimum ${schema.minimum}`);
      }

      if (schema.maximum !== undefined && value > schema.maximum) {
        errors.push(`${path}: value ${value} is greater than maximum ${schema.maximum}`);
      }
    }

    // Boolean validation
    if (schema.type === 'boolean' && typeof value !== 'boolean') {
      errors.push(`${path}: expected boolean, got ${typeof value}`);
    }

    // Enum validation (top-level)
    if (schema.enum && !Array.isArray(schema.type)) {
      if (!schema.enum.includes(value)) {
        errors.push(`${path}: value is not one of ${JSON.stringify(schema.enum)}`);
      }
    }
  }
}

export { SchemaValidator, ValidationError };
