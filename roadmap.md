# Requested updates
- [x] Try a compact left-side title with Yoda above the supplied particle chess-piece lineup; desktop and mobile render without overlap or overflow, and coach controls still work.
- [x] Update hero title and lowercase wordmark, remove footer attribution, separate Yoda above the title, and match particle styling and angular speed; checked desktop and mobile.
- [x] Match the supplied landing HTML using IBM Plex Mono; desktop, mobile, particle visuals, and all coach demonstration controls verified.
- [x] Fit both supplied particle visuals into the hero; checked desktop and mobile.
- [x] Create the black-background Yoda particle favicon.
- [x] Store DAILY_EXPLANATION_LIMIT = 300 in the existing server function; test passed.
- [ ] Security pass: secrets/history, owner RLS, durable quota/cache, validated Anthropic explanations, safe logs, dependencies, GPL/README/SECURITY; preserve presentation.
- [ ] Ignore all environment files and untrack .env: blocked because .gitignore is read-only and Git state changes are managed externally.
- [ ] Verify authenticated Anthropic explanation flow: requires user's key and requested model availability.