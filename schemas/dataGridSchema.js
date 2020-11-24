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
    chart_id: { type: 'string' },
    section: { type: 'string' },
    month: { type: 'string', pattern: '^\\d\\d\\d\\d-\\d\\d$' },
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
    footer: {
      type: 'array',
      items: { $ref: '#/definitions/translation' }
    }
  },
  required: ['title', 'chart_id', 'section', 'month', 'columns', 'rows'],
  additionalProperties: false
}
