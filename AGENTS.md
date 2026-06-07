# AGENTS.md

## Owner Context

The project owner is a User Experience Engineering student.

The owner often builds:
- App UI/UX
- Mobile-first product prototypes
- Fullstack web apps
- AI-powered products
- Portfolio and hackathon projects

The owner does not want only static frontend pages.

The owner wants products that can become real apps with:
- Frontend
- Backend
- Database
- Knowledge base
- AI workflow
- Public deploy link
- Future mobile packaging path

## Default Product Standard

When building an app, always consider:

1. Product problem
2. Target users
3. User journey
4. Information architecture
5. UI/UX design
6. Frontend implementation
7. Backend API plan
8. Database schema
9. AI logic if needed
10. Knowledge base if needed
11. Bad case collection if needed
12. Deployment plan
13. Mobile packaging path

## Design Standard

The UI should look like a premium international app.

Prefer:
- Clean layout
- Mobile-first design
- Clear hierarchy
- Strong spacing
- Rounded cards
- Large readable text
- Accessible contrast
- Realistic product flow
- Professional dashboard layout when needed

Avoid:
- Rough demo style
- Default template styling
- Dense pages
- Too many buttons
- Unclear navigation
- Only static frontend pages
- Fake product logic

## Development Standard

Use React / Next.js unless the user asks otherwise.

For database and auth, prefer Supabase.

For AI features, use backend routes. Do not put API keys in frontend code.

For deployment:
- Vite apps: Netlify or Vercel
- Next.js apps: Vercel
- Fullstack apps: Vercel + Supabase

For mobile packaging:
- Expo React Native for real mobile apps
- Capacitor for quickly wrapping a web app

## AI Product Standard

If AI is used:
- Define AI input
- Define AI processing
- Define AI output
- Define safety boundaries
- Clearly say what is mocked and what is real
- Use backend routes for OpenAI API calls
- Store API keys in environment variables
- Never expose API keys in frontend code

For RAG or knowledge-base apps:
- Separate knowledge storage from model reasoning
- Store documents and chunks
- Track retrieval logs
- Show answer sources when useful
- Collect user feedback
- Collect bad cases
- Classify failure reasons
- Provide an optimization loop

## Ecommerce AI Customer Service Standard

For ecommerce AI customer service projects, build the system as:

1. Buyer Chat
   - User asks questions
   - AI answers with grounded knowledge
   - Show sources or evidence
   - Allow feedback: helpful / not helpful
   - Allow transfer to human support

2. Knowledge Base Admin
   - Add knowledge
   - Edit knowledge
   - Enable / disable knowledge
   - Track category, version, update time
   - Prepare content for retrieval

3. RAG Retrieval Layer
   - User query is embedded
   - Relevant knowledge chunks are retrieved
   - AI answers based on retrieved context
   - If context is weak, AI should say it is unsure or suggest human support

4. Bad Case Loop
   - Record bad answers
   - Record user feedback
   - Record retrieved chunks
   - Classify error type
   - Add correct answer
   - Suggest knowledge or prompt improvements

5. Evaluation Dashboard
   - Show bad case count
   - Show unanswered questions
   - Show low-confidence answers
   - Show transfer-to-human rate
   - Show knowledge gap suggestions

## Instruction

Before changing code, read this file first.

Build like a real product, not only a frontend demo.

If a project needs to be presented or shared, always include:
- How to run locally
- How to create a public link
- How to deploy
- What is mocked
- What would be real in production
- What database schema is needed
- How the product can evolve into a production system
