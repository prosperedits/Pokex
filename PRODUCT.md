# Product

## Register

brand

## Users

Pokémon TCG collectors and fans browsing the Phantasmal Flames set for pleasure and market awareness. Desktop-first, evening-browsing context: they came to look at cards, linger on the chase rares, and check what they're worth. Touch must work; the showpiece target is a desktop with a scroll wheel.

## Product Purpose

A single-page gallery of all 130 Phantasmal Flames cards, browsed through one luxurious momentum-wheel interaction (reference: aristidebenoist.com, but front-facing). The top minimap doubles as a market-price heatmap so value spikes are visible before you reach them. Success: a visitor flings through the set, stops on the $874 Charizard, opens the zoom, and feels like they're holding the card.

## Brand Personality

Cinematic, reverent, precise. A gallery in the dark, not a database. The set's own identity (phantom magenta-violet, spectral ice-blue, ember fire) provides all the color; the site itself stays near-black and lets card art be the only saturated thing at rest.

## Anti-references

- pokemon.com's playful primary-color franchise styling: this is the premium register, not the kids' one.
- Card-database utility sites (TCGplayer, pkmn.gg): no tables, filters, or dashboard chrome on the main surface.
- SaaS landing-page grammar: no hero metrics, no eyebrow kickers, no card grids.

## Design Principles

1. **Gallery in the dark** — card art is the only saturated thing at rest; UI recedes; brand color appears at moments of meaning.
2. **The wheel is the site** — one interaction made luxurious; nothing competes with the spin.
3. **Price is light** — market value renders as heat; ember glow marks the chase cards.
4. **Honest data** — a timestamped, sourced snapshot; EUR never wears a USD tier.

## Accessibility & Inclusion

Keyboard-complete (arrows, Enter, Esc, Home/End, PageUp/Down on the rail). Single ARIA slider for the minimap with per-card valuetext. prefers-reduced-motion collapses physics to instant steps and disables tilt/holo-shine (?motion=full opts back in). WCAG AA contrast on all readable text against the near-black stage.
