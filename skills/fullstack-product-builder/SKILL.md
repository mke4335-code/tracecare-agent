# Fullstack Product Builder Skill

## Description

Use this skill when building a real app product for UX engineering, portfolio, hackathon, startup, or product design projects.

The goal is not only to create a beautiful UI.

The goal is to build a product that has:
- Clear UX
- Working frontend
- Backend plan or backend implementation
- Database schema
- Knowledge base if needed
- AI logic if needed
- Public deploy link
- Future mobile app packaging path

## Core Rules

Do not stop at static frontend pages if the user wants a real product.

Always think about:
- Product goal
- User flow
- Information architecture
- Frontend
- Backend
- Database
- AI workflow
- Knowledge base
- Deployment
- Mobile packaging

## UX Rules

Before coding, define:
- Who is the user?
- What problem are we solving?
- What is the main user journey?
- What are the main pages?
- What data moves between pages?
- What is the admin workflow?
- What is the evaluation workflow?

The app should feel like a real product, not a collection of screens.

## UI Rules

The UI should look premium and modern.

Use:
- Mobile-first layout when user-facing
- Professional dashboard layout when admin-facing
- Clean spacing
- Large readable text
- Rounded cards
- Clear hierarchy
- Professional colors
- Consistent components

Avoid:
- Messy layout
- Default template styling
- Too much text
- Too many buttons
- Rough hackathon demo look
- Fake SaaS dashboards with no product logic

## Frontend Rules

Use:
- React or Next.js
- Reusable components
- Clean state logic
- Responsive layout
- Clear navigation

For serious projects, prefer:
- TypeScript
- Next.js
- Tailwind CSS
- App Router

## Backend Rules

If the app stores user data, design backend and database.

Prefer:
- Supabase for database and auth
- Next.js API routes for backend
- OpenAI API through backend routes for AI features

Never put secret API keys in frontend code.

Use environment variables for secrets.

## Database Rules

Always define tables when data is stored.

Include:
- Table names
- Fields
- Relationships
- Example records

Prefer Supabase Postgres.

For RAG apps, include:
- knowledge_docs
- knowledge_chunks
- conversations
- messages
- retrieval_logs
- feedback
- bad_cases
- optimization_tasks
- prompt_versions

## AI Rules

If AI is used, clearly define:

1. AI input
2. AI processing
3. AI output
4. Safety boundary
5. What is mocked
6. What would be real in production

AI should not make unsafe decisions.

If using OpenAI API:
- Call it from backend routes only
- Never expose API keys in frontend
- Store API keys in environment variables
- Add fallback mock data for demos

## RAG Product Rules

For a knowledge-base AI assistant:

1. Store knowledge documents
2. Split documents into chunks
3. Generate embeddings
4. Store chunks in a vector database
5. Retrieve relevant chunks for each user query
6. Generate answers grounded in retrieved chunks
7. Save retrieval logs
8. Let users rate answers
9. Collect bad cases
10. Classify failure reasons
11. Suggest knowledge base improvements

Do not treat RAG as just a chatbot prompt.

The product must show a continuous improvement loop.

## Bad Case Loop Rules

For bad cases, collect:

- User question
- AI answer
- Retrieved chunks
- Similarity scores if available
- User feedback
- Human correct answer
- Error type
- Root cause
- Suggested improvement

Common error types:
- knowledge missing
- retrieval failed
- answer not grounded
- user intent misunderstood
- answer too generic
- outdated policy
- should transfer to human
- needs order data

## Deployment Rules

Every project should have a way to share a public link.

For Vite:
- npm run build
- deploy dist to Netlify or Vercel

For Next.js:
- deploy to Vercel

For fullstack:
- frontend on Vercel
- database on Supabase
- environment variables configured in deployment platform

Always make sure:
- npm run dev works
- npm run build works
- deploy instructions are clear

## Mobile Packaging Rules

If the user wants an app-store-ready path:

Recommend:
- Expo React Native for a real mobile app
- Capacitor for wrapping a web app quickly

Explain the tradeoff.

Basic guidance:
- Use Expo if the app should feel like a real native mobile app
- Use Capacitor if the user already has a web app and wants a quick app-store path
- Prepare app icons, splash screen, privacy policy, screenshots, and store description before submission

## Output Checklist

When building a project, include:

- What was built
- Product structure
- User journey
- Main screens
- Tech stack
- How to run locally
- How to deploy
- Database schema if needed
- AI logic if needed
- Knowledge base workflow if needed
- Bad case workflow if needed
- Future fullstack path
- Future mobile packaging path

## Quality Bar

The final result should be good enough for:
- UX engineering coursework
- Portfolio presentation
- Hackathon demo
- Early startup prototype
- Public share link
- Future fullstack development

Do not create a shallow demo unless the user explicitly asks for a quick mockup.