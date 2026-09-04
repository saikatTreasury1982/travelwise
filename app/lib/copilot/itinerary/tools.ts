// app/lib/copilot/itinerary/tools.ts
import type Anthropic from '@anthropic-ai/sdk';

// One activity as drafted by the AI.
const activitySchema = {
  type: 'object',
  properties: {
    activity_name: { type: 'string' },
    start_time: { type: 'string', description: 'HH:MM, optional.' },
    end_time: { type: 'string', description: 'HH:MM, optional.' },
    estimated_cost: { type: 'number', description: `Estimated cost in the trip's base currency; omit/null if free.` },
    cost_type: { type: 'string', enum: ['total', 'per_person'], description: 'Default "total".' },
    headcount: { type: 'number', description: 'Only when cost_type is per_person.' },
    notes: { type: 'string' },
  },
  required: ['activity_name'],
} as const;

const categorySchema = {
  type: 'object',
  properties: {
    category_name: { type: 'string' },
    activities: { type: 'array', items: activitySchema },
  },
  required: ['category_name', 'activities'],
} as const;

/** The whole itinerary in one structured call. mode drives which of days[]/ranges[] is used. */
export const DRAFT_ITINERARY_TOOL: Anthropic.Tool = {
  name: 'draft_itinerary',
  description: 'Return the complete drafted itinerary in one call. Use days[] for day mode, ranges[] for range mode (match the top-level mode).',
  input_schema: {
    type: 'object',
    properties: {
      mode: { type: 'string', enum: ['day', 'range'] },
      days: {
        type: 'array',
        description: 'Day mode: one entry per calendar day (day_number 1..N).',
        items: {
          type: 'object',
          properties: {
            day_number: { type: 'number' },
            title: { type: 'string', description: 'Short headline for the day.' },
            categories: { type: 'array', items: categorySchema },
            ungrouped_activities: { type: 'array', items: activitySchema },
          },
          required: ['day_number'],
        },
      },
      ranges: {
        type: 'array',
        description: 'Range mode: named stretches spanning start_day..end_day.',
        items: {
          type: 'object',
          properties: {
            start_day: { type: 'number' },
            end_day: { type: 'number' },
            range_name: { type: 'string' },
            description: { type: 'string' },
            categories: { type: 'array', items: categorySchema },
            ungrouped_activities: { type: 'array', items: activitySchema },
          },
          required: ['start_day', 'end_day'],
        },
      },
    },
    required: ['mode'],
  },
};