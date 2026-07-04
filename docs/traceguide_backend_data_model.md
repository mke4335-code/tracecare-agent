# TraceGuide Agent backend data model

## Purpose

TraceGuide is a functional research prototype for testing whether verifiable AI advice interactions support user decision-making in ecommerce service agent tasks.

The prototype should not behave like a static UI shell. The agent response is grounded in a structured commerce context:

- customer context
- product record
- order record
- evidence state
- policy / knowledge documents
- experiment task ground truth
- simulated service action state

## What is real in the prototype

- Public Next.js/Vercel deployment
- Server-side API routes
- Supabase `knowledge_docs` retrieval
- Supabase research commerce tables for demo customer, products, orders, evidence records, experiment tasks and agent run logs
- Server-side commerce fixture data as a fallback if the database context is unavailable
- LLM generation through the backend
- Source ranking and answer grounding
- User-edited AI-understanding variables affecting the next answer
- Study-event logging and agent-run logging
- Simulated support-action progress

## What is intentionally simulated

- Real payment processing
- Real refund execution
- Real order modification
- Real fulfilment or warehouse system writes
- Real customer identity/authentication

These are simulated because the UX study evaluates decision support and action authorisation, not live ecommerce operations.

## Core records

### Customer

Used for personal context that can affect support advice, such as saved allergens or preferred resolution.

Example fields:

- `id`
- `display_name`
- `segment`
- `saved_allergens`
- `preferred_resolution`

### Product

Used to determine product category, return class and relevant policy constraints.

Example fields:

- `id`
- `name`
- `category`
- `return_class`
- `price_gbp`
- `allergens`
- `policy_tags`

### Order

Used to determine delivery timing, order status and whether a service action is currently possible.

Example fields:

- `id`
- `customer_id`
- `product_id`
- `status`
- `delivered_days_ago`
- `cold_chain_ok`
- `included_items`

### Evidence record

Used to decide whether an agent can prepare a support request, should ask for photos, or should hand off to human support.

Example fields:

- `id`
- `order_id`
- `status`
- `description`

### Experiment task

Used to connect the UX study task to the correct order, product and ground-truth decision.

Example fields:

- `id`
- `scenario_key`
- `customer_id`
- `order_id`
- `issue_type`
- `request_type`
- `reason`
- `default_evidence_status`
- `correct_decision`

## Confidence calculation

The displayed percentage is not a model-internal confidence score and not a refund-success probability.

It is an `answer confidence` / `decision support confidence` score calculated from:

1. matched-source strength;
2. coverage of policy/source evidence;
3. coverage of order or product record;
4. supporting store guidance;
5. completeness of task variables;
6. whether LLM output passed safety checks or fallback was used;
7. execution blockers such as missing evidence or human-review requirement.

The score is capped when:

- evidence is missing;
- human review is recommended;
- the task is unknown.

This prevents the interface from displaying a misleading high-confidence number when the agent cannot safely prepare an action.

## Runtime data flow

For each `/api/traceguide-chat` request, the backend now:

1. detects the requested experiment scenario or task ID;
2. reads the matching task, order, product, customer and evidence records from Supabase `traceguide_*` tables;
3. falls back to the server-side fixture only if Supabase context is unavailable;
4. converts the commerce context into source-like records;
5. merges these records with active Supabase `knowledge_docs`;
6. ranks sources against the question and current AI-understanding variables;
7. calls the LLM when safe, otherwise uses a grounded fallback answer;
8. calculates the displayed confidence from evidence coverage, source coverage and variable completeness;
9. writes a `traceguide_agent_runs` log row.

## Data migration

The SQL file `supabase/traceguide_research_commerce_seed.sql` defines the database version of this data model with RLS enabled and demo-safe policies. This migration has been applied to the current Supabase project for the research prototype.
