module.exports = {
  $schema: 'http://json-schema.org/draft-07/schema#',

  definitions: {
    translation: {
      type: 'object',
      properties: {
        es: { type: 'string' },
        ca: { type: 'string' },
        en: { type: 'string' },
        de: { type: 'string' }
      }
    }
  },

  type: 'object',
  properties: {
    title: { $ref: '#/definitions/translation' },
    description: { $ref: '#/definitions/translation' },
    columns: {
      type: 'array',
      items: { $ref: '#/definitions/translation' }
    },
    rows: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { $ref: '#/definitions/translation' },
          values: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: ['name', 'values']
      }
    },
    notes: {
      type: 'array',
      items: { $ref: '#/definitions/translation' }
    }
  },
  required: ['title', 'columns', 'rows'],
  additionalProperties: false
}
