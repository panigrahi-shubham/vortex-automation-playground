# Orvilo design screens

22 static screens for Orvilo, the demo store used for test-automation practice
(the new name for ShopLab): 20 pages plus 2 isometric 3D flow diagrams. Open
`index.html` in any browser and click through. Everything works offline: no
CDN, no tracking, and the font is bundled.

| Screen | File | Size it was designed at |
| --- | --- | --- |
| 01 Shop — catalogue | `index.html` | 1440 × 1560 |
| 02 Product detail | `product.html` | 1440 × 1380 |
| 03 Cart | `cart.html` | 1440 × 1000 |
| 04 Checkout — payment step | `checkout.html` | 1440 × 1180 |
| 05 Order placed | `confirmation.html` | 1440 × 940 |
| 06 Sign in | `signin.html` | 1440 × 900 |
| 07 Two-step verification | `verify.html` | 1440 × 900 |
| 08 Orders | `orders.html` | 1440 × 1000 |
| 09 Order detail — live status | `orderdetail.html` | 1440 × 1120 |
| 10 Account | `account.html` | 1440 × 1000 |
| 11 Admin — products | `admin.html` | 1440 × 1040 |
| 12 UI Lab | `lab.html` | 1440 × 1240 |
| 13 Test inbox | `inbox.html` | 1440 × 900 |
| 14 API docs | `docs.html` | 1440 × 1100 |
| 15 Shop on a phone | `mobileshop.html` | 390 × 844 |
| 16 Seller — add product | `selleradd.html` | 1440 × 1300 |
| 17 Seller — delete product | `sellerdelete.html` | 1440 × 1000 |
| 18 Message center — buyer, bot and support | `messages.html` | 1440 × 1000 |
| 19 Settings | `settings.html` | 1440 × 1240 |
| 20 My profile | `profile.html` | 1440 × 1160 |
| 21 3D flow — order journey | `flow3d.html` | 1440 × 1000 |
| 22 3D flow — system architecture | `architecture3d.html` | 1440 × 1000 |

`screenshots/` has a PNG of each screen.

## Using them in the real app

- These are design references. Buttons and forms don't do anything, and the
  data is sample data.
- Styles are written inline so each page stands on its own. When you build
  the real pages, move the repeated values into shared tokens:
  - accent `#2747F5`, text `#111318`, muted text `#5A6170`
  - borders `#E3E6EB`, page background `#F4F5F7`
  - success `#0F7A4A`, error `#B42318`
  - corner radius 10–20 px
- Keep the accessibility details: labels on every input, `aria-current` on
  the active navigation link, `role="alert"` and `role="status"` on messages,
  `role="alertdialog"` on the delete confirmation, and at least 44 px touch
  targets.
- The 3D diagrams are plain SVG (isometric drawing, no WebGL), so they scale
  cleanly and can go straight into docs or a README.

## Licence

The designs are CC0, so they are free to use with no credit needed. The font
is SIL OFL 1.1. See `LICENSE.txt`.
