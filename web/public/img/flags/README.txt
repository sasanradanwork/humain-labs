Country flags, rasterised at 80x60 from the flag-icons SVG set
(https://github.com/lipis/flag-icons), MIT licence, (c) 2013 Panayiotis Lipiridis.

They are drawn at 15-20px beside a country's name, so a small raster is sharp enough
on a 2x screen and far lighter than the source SVGs: the Mexican and Spanish flags
alone were 165 KB of coat-of-arms path data.

ir.png is the exception: it is the Lion and Sun flag (the state flag until 1980),
supplied by HumAIn Labs rather than taken from flag-icons, which carries the
current Islamic Republic flag under IR.

To add a country: add its name and ISO 3166-1 alpha-2 code to COUNTRY_CODES in
api/src/lib/lists.js and web/src/lib/lists.js, then drop <code>.png in here.
