# Storefront image sources

The hero and 40 seeded catalog photos were generated with the built-in imagegen tool on 11 November 2026. They depict conceptual practice products. No external image requests occur at runtime.

Images are saved in web/assets/products. The hero uses vortex-hero.webp. Product photos use vortex-product-1.webp through vortex-product-40.webp, mapped by exact product name in web/js/product-photos.js. Numeric asset names follow category groups, independently of database product IDs.

Each source sheet contains four columns and two rows of separate product photographs. The sheets were sliced into eight square assets, resized to 480 pixels, and encoded as WebP. Gallery detail views use different crops of the same photograph. A custom product with an unknown name uses the existing placeholder.

## Hero prompt

Photorealistic horizontal 3:2 editorial product photography for a modern online storefront. A compact premium seafoam green wireless speaker with a charcoal woven front, a pair of sculptural ivory over-ear headphones, and a small dark graphite ceramic object arranged as a cohesive still life on staggered off-white and soft mint studio plinths. Deep teal-green to near-black seamless background, refined directional sunlight from the upper right, clean crisp shadows, realistic tactile surface materials. Objects occupy the right two-thirds, centered vertically with some breathing room for a tight mobile crop. No text, logos, people, labels, or watermark. Refined catalog photography, clean warm off-white highlights.

## Catalog prompt template

Create a product photography contact sheet, precisely four columns and two rows of equal square tiles, 1536 by 768 wide aspect ratio. This will be cut by software into eight separate catalog photos. Each tile is a separate seamless warm ivory studio background, object fully inside its own tile with 15 percent empty padding. Soft directional studio shadows, photorealistic tactile materials, curated muted forest green, cream, warm sand, charcoal palette, bright premium ecommerce photography. No grid lines, no borders, no collage overlap. The eight tiles in row-major order must show only the individual subjects listed below. No text, labels, or logos for non-book products. No watermark. Keep every object isolated in the exact center of its tile. All eight tiles occupy exactly the same dimensions.

For books, each tile shows one different closed hardcover book at a subtle three-quarter angle, with the listed exact title readable on the cover in understated serif or sans typography.

## Subject lists

- Electronics uses wireless earbuds in an open case, a mechanical keyboard, a 4K webcam, a seven-port USB-C hub, a smart watch, a compact Bluetooth speaker, a portable external SSD, and noise-cancelling headphones.
- Books uses The Pragmatic Tester, Clean Automation, From Selenium to Playwright, API Testing Handbook, Agile QA Field Guide, Performance Testing 101, TypeScript for Testers, and Bug Hunting Notebook.
- Home uses a ceramic coffee mug, an LED desk lamp, a bamboo cutting board, a folded knitted throw, a round wall clock, three small plant pots, an aroma diffuser, and a woven basket.
- Toys uses a buildable robot, a jigsaw puzzle box and pieces, a wooden train, a remote-control car, a strategy board game, a plush panda, magnetic building tiles, and a rainbow kite.
- Fashion uses a folded hoodie, running shoes, a denim jacket, a folded T-shirt, a wool beanie, a coiled leather belt, a canvas backpack, and three pairs of socks.

The Three.js studio model is constructed in code from lathe and torus geometry. Its conceptual ceramic mug supports rotation and finish changes.
