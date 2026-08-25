// app/lib/copilot/planning/tools.ts
import type Anthropic from '@anthropic-ai/sdk';

export const SAVE_TRIP_TOOL: Anthropic.Tool = {
  name: 'save_trip',
  description:
    'Save a trip once you have gathered the minimum required info: a trip name, a start date, and an end date. Only call this when you have all three. Include destinations and budget if known. Do NOT include travellers here — after saving, you will handle travellers with save_travelers.',
  input_schema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'A short, descriptive trip name, e.g. "Family trip to Japan".' },
      description: { type: 'string' },
      startDate: { type: 'string', description: 'ISO date YYYY-MM-DD.' },
      endDate: { type: 'string', description: 'ISO date YYYY-MM-DD.' },
      budget: { type: 'number', description: 'Total budget amount, if known.' },
      budgetCurrency: { type: 'string', description: 'ISO currency code, e.g. USD, EUR.' },
      destinations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            country: { type: 'string' },
            city: { type: 'string' },
            countryCode: { type: 'string', description: 'ISO country code if known, e.g. JP.' },
          },
          required: ['country'],
        },
      },
    },
    required: ['name', 'startDate', 'endDate'],
  },
};

export const SAVE_TRAVELERS_TOOL: Anthropic.Tool = {
  name: 'save_travelers',
  description:
    "Add co-travellers to a trip already saved with save_trip. Do NOT include the primary traveller (the logged-in user) — they are added automatically.",
  input_schema: {
    type: 'object',
    properties: {
      trip_id: { type: 'number', description: 'The trip_id from the saved trip context.' },
      travelers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            traveler_name: { type: 'string' },
            relationship: { type: 'number', description: 'Relationship code: 2=Spouse, 3=Child, 4=Friend, 5=Family, 6=Colleague. Never 1 (Self).' },
            is_cost_sharer: { type: 'boolean', description: 'true if this person shares trip costs, false if not (e.g. a child).' },
            is_active: { type: 'boolean', description: 'false if the user is unsure / will confirm later. Default true.' },
            traveler_email: { type: ['string', 'null'] },
          },
          required: ['traveler_name', 'relationship', 'is_cost_sharer'],
        },
      },
    },
    required: ['trip_id', 'travelers'],
  },
};

export const UPDATE_TRIP_TOOL: Anthropic.Tool = {
  name: 'update_trip',
  description:
    'Update fields on an ALREADY-SAVED trip (budget, dates, name, description). Use this — never save_trip again — whenever the user changes or adds details after the trip was first saved, e.g. gives a budget, shifts dates, or renames the trip.',
  input_schema: {
    type: 'object',
    properties: {
      trip_id: { type: 'number', description: 'The trip_id of the already-saved trip.' },
      name: { type: 'string' },
      description: { type: 'string' },
      startDate: { type: 'string', description: 'ISO date YYYY-MM-DD.' },
      endDate: { type: 'string', description: 'ISO date YYYY-MM-DD.' },
      budget: { type: 'number', description: 'Total budget amount.' },
      budgetCurrency: { type: 'string', description: 'ISO currency code, e.g. AUD.' },
    },
    required: ['trip_id'],
  },
};

export const UPDATE_TRAVELER_TOOL: Anthropic.Tool = {
  name: 'update_traveler',
  description:
    "Correct details of an existing co-traveller on the current trip — e.g. fix a name's spelling, change relationship, or change whether they share costs. Use the traveler_id from the CURRENT TRIP STATE. Never target the primary traveller (the logged-in user).",
  input_schema: {
    type: 'object',
    properties: {
      traveler_id: { type: 'number', description: "The co-traveller's id from CURRENT TRIP STATE." },
      traveler_name: { type: 'string' },
      relationship: { type: 'number', description: '2=Spouse, 3=Child, 4=Friend, 5=Family, 6=Colleague. Never 1 (Self).' },
      is_cost_sharer: { type: 'boolean' },
      is_active: { type: 'boolean', description: 'false = tentative/unconfirmed.' },
    },
    required: ['traveler_id'],
  },
};

export const REMOVE_TRAVELER_TOOL: Anthropic.Tool = {
  name: 'remove_traveler',
  description:
    'Remove a co-traveller from the current trip. Use the traveler_id from CURRENT TRIP STATE. Never remove the primary traveller (the logged-in user).',
  input_schema: {
    type: 'object',
    properties: { traveler_id: { type: 'number' } },
    required: ['traveler_id'],
  },
};

export const ADD_DESTINATION_TOOL: Anthropic.Tool = {
  name: 'add_destination',
  description: 'Add a destination (a place/city) to the current trip.',
  input_schema: {
    type: 'object',
    properties: {
      country: { type: 'string' },
      city: { type: 'string' },
      countryCode: { type: 'string', description: 'ISO code if known, e.g. JP.' },
    },
    required: ['country'],
  },
};

export const UPDATE_DESTINATION_TOOL: Anthropic.Tool = {
  name: 'update_destination',
  description: 'Correct a destination on the current trip — e.g. fix a city/country spelling. Use the destination_id from CURRENT TRIP STATE.',
  input_schema: {
    type: 'object',
    properties: {
      destination_id: { type: 'number' },
      country: { type: 'string' },
      city: { type: 'string' },
      countryCode: { type: 'string' },
    },
    required: ['destination_id'],
  },
};

export const REMOVE_DESTINATION_TOOL: Anthropic.Tool = {
  name: 'remove_destination',
  description: 'Remove a destination from the current trip. Use the destination_id from CURRENT TRIP STATE.',
  input_schema: {
    type: 'object',
    properties: { destination_id: { type: 'number' } },
    required: ['destination_id'],
  },
};

export const PLANNING_TOOLS = [
  SAVE_TRIP_TOOL, SAVE_TRAVELERS_TOOL, UPDATE_TRIP_TOOL,
  UPDATE_TRAVELER_TOOL, REMOVE_TRAVELER_TOOL,
  ADD_DESTINATION_TOOL, UPDATE_DESTINATION_TOOL, REMOVE_DESTINATION_TOOL,
];