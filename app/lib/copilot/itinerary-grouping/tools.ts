// app/lib/copilot/itinerary-grouping/tools.ts
import type Anthropic from '@anthropic-ai/sdk';

export const SUGGEST_GROUPING_TOOL: Anthropic.Tool = {
  name: 'suggest_grouping',
  description: 'Propose display groupings for the given activities. Empty categories = leave the list flat.',
  input_schema: {
    type: 'object',
    properties: {
      categories: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            category_name: { type: 'string', description: 'Short heading, e.g. "Morning", "Dining".' },
            activity_ids: { type: 'array', items: { type: 'number' }, description: 'activity_ids from the given list that belong here.' },
          },
          required: ['category_name', 'activity_ids'],
        },
      },
    },
    required: ['categories'],
  },
};