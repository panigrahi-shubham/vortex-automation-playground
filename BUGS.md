# Seeded bugs — answer key (instructors only)

Bugs are active when **any** of these is true:

- the user is `problem_user`
- global bug mode is on (Chaos panel checkbox or `POST /api/chaos {"bugMode": true}`)
- the request carries the header `x-shoplab-bugs: 1`

| ID | Area | Steps to reproduce | Expected | Actual | Where |
|---|---|---|---|---|---|
| BUG-01 | Catalog sort | Sort by **Price: low to high** | Cheapest first | Most expensive first | `server/api.js` GET /products |
| BUG-02 | Cart | Add any product whose id is a multiple of 5 (all Fashion items, e.g. Classic Hoodie, Running Shoes) | That product is in the cart | The *next* product is added (e.g. Mechanical Keyboard), but the toast still says the right name | POST /cart |
| BUG-03 | Checkout | Place any order | Total = subtotal − discount + shipping + tax | Tax is counted twice in the order total: the review page shows the right total, the confirmation page and order history do not | `placeOrder()` |
| BUG-04 | Search | Search `keyboard` (lower case) | 1 result | 0 results; search is case-sensitive | GET /products |
| BUG-05 | Coupons | Apply `SAVE10` | 10% discount | 1% discount | `cartView()` |
| BUG-06 | Cart | `PATCH /api/cart/:lineId {"qty": -5}` or `{"qty": 999}` | 422 / 409 | 200, and the cart accepts negative or over-stock quantities | PATCH /cart/:lineId |
| BUG-07 | Pagination | Compare page 1 and page 2 | No overlap | The first item on page 2 repeats the last item on page 1 | GET /products |
| BUG-08 | Profile | Save your name as `Rupesh Kumar` | `Rupesh Kumar` | `Rupesh Kuma`; the last character is dropped | PUT /me |

The suite in `tests/bugs/seeded-bugs.spec.ts` asserts the correct behaviour for each one and marks it `test.fail()`. Delete that line to watch it fail, then write the defect report.

## Exercise ideas

1. Find all eight using only the UI as `problem_user`, and log each one in your team's bug template.
2. Write one test per bug **without** looking at the reference suite.
3. Fix a bug in `server/api.js` and confirm the matching test now reports "expected to fail, but passed".
4. Add a ninth bug of your own and swap with a classmate.
