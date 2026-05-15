# Fonts

Sunvasi's spec calls for **Switzer** (body / UI) self-hosted from Fontshare.
Fontshare doesn't expose stable mirror URLs, so this scaffold uses **Manrope**
(via `next/font/google`) as a Switzer-shaped substitute. Manrope is the closest
modern grotesque on Google Fonts — geometric, slightly humanist, the same
proportions Switzer was designed around.

To restore Switzer:

1. Download the Switzer family zip from https://www.fontshare.com/fonts/switzer
2. Extract `Switzer-Variable.woff2` (or the static `.woff2` files for weights
   400 / 500 / 600 / 700) into this directory.
3. Update `app/layout.tsx`: swap the `Manrope` import for a `localFont` block
   pointing at the `.woff2` files.

Display (Fraunces) and mono (JetBrains Mono) are loaded via `next/font/google`
and need no local files.
