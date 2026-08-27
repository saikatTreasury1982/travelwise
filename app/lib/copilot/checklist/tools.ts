// app/lib/copilot/checklist/tools.ts
import type Anthropic from '@anthropic-ai/sdk';

export const GENERATE_CHECKLIST_TOOL: Anthropic.Tool = {
  name: 'generate_checklist',
  description: 'Return a structured, trip-tailored checklist of categories and items.',
  input_schema: {
    type: 'object',
    properties: {
      categories: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            category: { type: 'string', description: 'Category name, e.g. "Documents", "Clothing", "Pre-trip Tasks".' },
            kind: { type: 'string', enum: ['packing', 'task'], description: 'packing for things to bring; task for things to do before leaving.' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  priority: { type: 'string', enum: ['high', 'normal', 'low'], description: 'high for critical items (passport, visa, meds, tickets).' },
                },
                required: ['name'],
              },
            },
          },
          required: ['category', 'items'],
        },
      },
    },
    required: ['categories'],
  },
};

export const CHECKLIST_TOOLS = [GENERATE_CHECKLIST_TOOL];