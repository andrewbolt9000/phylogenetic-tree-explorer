/**
 * Tests for SchemaValidator
 */

import test from 'node:test';
import assert from 'node:assert';
import { SchemaValidator, ValidationError } from './schemaValidator.js';

test('SchemaValidator - validates objects', () => {
  const schema = {
    type: 'object',
    required: ['name', 'age'],
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
      email: { type: 'string' }
    },
    additionalProperties: false
  };

  const validator = new SchemaValidator(schema);

  // Valid
  assert.doesNotThrow(() => {
    validator.validate({ name: 'John', age: 30 });
  });

  // Missing required
  assert.throws(() => {
    validator.validate({ name: 'John' });
  }, ValidationError);

  // Wrong type
  assert.throws(() => {
    validator.validate({ name: 'John', age: 'thirty' });
  }, ValidationError);

  // Additional properties
  assert.throws(() => {
    validator.validate({ name: 'John', age: 30, extra: true });
  }, ValidationError);
});

test('SchemaValidator - validates arrays', () => {
  const schema = {
    type: 'array',
    items: { type: 'string' },
    minItems: 1
  };

  const validator = new SchemaValidator(schema);

  assert.doesNotThrow(() => validator.validate(['a', 'b']));
  assert.throws(() => validator.validate([]), ValidationError);
  assert.throws(() => validator.validate(['a', 1]), ValidationError);
});

test('SchemaValidator - validates strings with pattern', () => {
  const schema = {
    type: 'string',
    pattern: '^tax_'
  };

  const validator = new SchemaValidator(schema);

  assert.doesNotThrow(() => validator.validate('tax_homo_sapiens'));
  assert.throws(() => validator.validate('homo_sapiens'), ValidationError);
});

test('SchemaValidator - validates enums', () => {
  const schema = {
    type: 'string',
    enum: ['species', 'genus', 'family']
  };

  const validator = new SchemaValidator(schema);

  assert.doesNotThrow(() => validator.validate('species'));
  assert.throws(() => validator.validate('order'), ValidationError);
});

test('SchemaValidator - validates dates', () => {
  const schema = {
    type: 'string',
    format: 'date'
  };

  const validator = new SchemaValidator(schema);

  assert.doesNotThrow(() => validator.validate('2024-11-01'));
  assert.throws(() => validator.validate('2024-13-01'), ValidationError);
  assert.throws(() => validator.validate('invalid'), ValidationError);
});

test('SchemaValidator - validates URIs', () => {
  const schema = {
    type: 'string',
    format: 'uri'
  };

  const validator = new SchemaValidator(schema);

  assert.doesNotThrow(() => validator.validate('https://example.com'));
  assert.throws(() => validator.validate('not a uri'), ValidationError);
});

test('SchemaValidator - validates nullable types', () => {
  const schema = {
    type: ['string', 'null']
  };

  const validator = new SchemaValidator(schema);

  assert.doesNotThrow(() => validator.validate('hello'));
  assert.doesNotThrow(() => validator.validate(null));
  assert.throws(() => validator.validate(123), ValidationError);
});

test('SchemaValidator - validates nested objects', () => {
  const schema = {
    type: 'object',
    properties: {
      person: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          age: { type: 'number' }
        },
        additionalProperties: false
      }
    }
  };

  const validator = new SchemaValidator(schema);

  assert.doesNotThrow(() => validator.validate({ person: { name: 'John' } }));
  assert.throws(() => validator.validate({ person: { age: 30 } }), ValidationError);
});

test('SchemaValidator - error messages include path', () => {
  const schema = {
    type: 'object',
    properties: {
      data: {
        type: 'array',
        items: { type: 'number' }
      }
    }
  };

  const validator = new SchemaValidator(schema);

  try {
    validator.validate({ data: ['not a number'] });
    assert.fail('Should have thrown');
  } catch (err) {
    assert(err.message.includes('data[0]'));
  }
});
