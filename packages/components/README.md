# Shared Components

Hero · Services · About · Testimonials · Gallery · Hours · ContactForm · CTA · FAQ · Footer.

These are the `SECTION_RENDERERS` functions in `packages/site-builder/src/build.mjs` (`renderHero`,
`renderServices`, etc.) — plain JS template-literal functions, not framework components. This repo is
static HTML/CSS/JS by design (zero build step); an earlier `Hero.astro` file here was removed as dead code
(no Astro toolchain exists anywhere in the repo, nothing ever imported it) rather than kept as a misleading
"this is where components live" pointer.

Upgrade blocks (booking, ordering, chatbot, etc.) come from `packages/addons/` instead, via `/add-feature`.
