# B2B Marketplace

Open `/marketplace` in PostgreSQL mode. Create a buyer or seller account from the marketplace sign-in page. Use a separate browser profile or private window for the second role.

1. As the seller, upload a photo in **Photos & Docs**, then save a draft in **My Products**. Select the saved photo, enter your price and minimum order quantity, and publish the listing.
2. As the buyer, use **Find suppliers** to search by product name or category. Open **Request Quote**, enter a quantity at or above the minimum and add a message.
3. As the seller, open **Enquiry Inbox** and send a quote with quantity, USD unit price and delivery days. The entry changes from **New** to **Replied**.
4. Sign back in as the buyer and open **My Enquiries** to see the quote. Deactivating a listing removes it from search and preserves its enquiries.

Users can enable authenticator MFA under **Account → Security**. Vortex checks the account role, record ownership and session expiry on the server. Sellers can attach photos from their own library. Published listing photos are visible in buyer search.

Photos & Docs accepts JPEG, PNG, WebP, PDF, CSV and XLSX. Limits are 2 MiB per file and 30 files per seller. Photo downloads are WebP. PDFs open in the browser viewer, CSV previews show the first 4 KiB and XLSX previews display up to 20 rows and 12 cells per row from one worksheet.

## API

Paths are relative to `/api/v2/marketplace`. Use the bearer session from the existing `/api/v2/login` and `/api/v2/login/mfa` endpoints for role-protected operations.

| Operation | Method and path | Access |
| --- | --- | --- |
| Browse published listings | `GET /catalog?q=&category=&page=` | Public |
| Read categories and published photos | `GET /categories`, `GET /catalog/:id/photo` | Public |
| List my products | `GET /listings?q=&category=&status=&page=` | Seller |
| Create or edit a listing | `POST /listings`, `PATCH /listings/:id` | Seller |
| Publish or deactivate | `PATCH /listings/:id/status` | Listing owner |
| Request a quote | `POST /catalog/:id/enquiries` | Buyer |
| Read my enquiries | `GET /enquiries?status=&page=` | Participating seller or buyer |
| Reply to an enquiry | `POST /enquiries/:id/reply` | Listing owner |
| Manage files | `GET /files`, `POST /files?name=`, `GET /files/:id/content`, `GET /files/:id/workbook-preview`, `DELETE /files/:id` | Seller or file owner |

Listings accept `name`, `description`, `category`, a decimal-string `unitPrice`, an integer `minimumQuantity` and optional `photoId`. Publish with `{"status":"PUBLISHED"}`, deactivate with `{"status":"INACTIVE"}`. Quote requests accept `quantity`, `message` and an optional UUID `requestId` for safe retries. Seller replies accept `quoteQuantity`, a decimal-string `quoteUnitPrice` and integer `deliveryDays`. Each file upload uses an `application/octet-stream` body and a URL-encoded filename in the query.

## StockPilot native integration

Configure the HTTPS origin and publishable key separately for each APK build variant.

- Staging origin is `https://vortex-qa-staging.vercel.app`.
- Production origin is `https://vortex-qa.vercel.app`.
- Send `X-Vortex-Api-Key: <environment publishable key>` on the two native catalogue requests below. A missing or invalid key returns `401`.

Build a category picker with `GET /api/v2/marketplace/native/categories`. Build a searchable, paginated list with `GET /api/v2/marketplace/native/catalog` and its optional `q`, `category` and `page` query parameters. The list returns `items`, `total`, `page` and `pageSize`. Use the product's `photoUrl` relative to the same origin. A product without a photo has `photoUrl: null`. Prices are decimal strings in USD.

For **Request Quote** and **My Enquiries**, sign the user in with `POST /api/v2/login` using `username` and `password`. If the response has `mfaRequired: true`, send `mfaToken` and the user's `code` to `POST /api/v2/login/mfa`. Use the returned token as `Authorization: Bearer <token>` to request a quote and list enquiries. Keep the session token in memory or in app-private storage encrypted with an Android Keystore key. On `401` prompt the user to sign in again. Sign out with `POST /api/v2/logout` and clear the local token.

The publishable key identifies a client on read-only catalogue endpoints. Quote requests, enquiry history, seller operations, and private files require the signed-in user's authorisation. On the Vortex server, `VORTEX_STOCKPILOT_PUBLIC_KEYS` accepts a comma-separated list of publishable keys. During rotation, configure both keys until the updated APK has shipped.

## Local and CI tests

Use a disposable local PostgreSQL database named `vortex_marketplace_test` or `vortex_test`, with schema `orvilo`. Create empty `anon` and `authenticated` roles on vanilla PostgreSQL, as in the CI workflow. Set `DATABASE_URL`, `DIRECT_URL` and a development `ORVILO_MFA_KEY`, then run the following commands.

```sh
npm run db:migrate
npx playwright install chromium
npm run test:marketplace:db
```

The tests provision prefixed buyer and seller fixtures and remove them when they finish. For manual practice, run `npm run build` followed by `node scripts/vortex-marketplace-fixtures.cjs seed`. Sign in as `vortex_test_seller` or `vortex_test_buyer` with the fixture password `VortexFixture9!`. Generate a test authenticator code with the following command.

```sh
node -e "const m=require('./scripts/vortex-marketplace-fixtures.cjs'); m.testOtp(m.fixtures.otpSecret).then(console.log)"
```

Run `node scripts/vortex-marketplace-fixtures.cjs reset` to delete these fixture users and their records. The command is scoped to the fixture identities and rejects remote connections and production mode. The GitHub Playwright workflow runs the marketplace specs in its disposable PostgreSQL job on pull requests.

## Staging smoke

Use a separate HTTPS deployment and isolated PostgreSQL database. Apply the repository migrations there and set `VORTEX_MARKETPLACE_STAGING_HOST` to its exact hostname in the staging runtime. Create two dedicated accounts there, one buyer and one seller, and enable authenticator MFA on both. Store their credentials only in the GitHub `marketplace-staging` environment.

Set `VORTEX_MARKETPLACE_STAGING_URL` as an environment variable in GitHub. For each role, set the three secrets `VORTEX_MARKETPLACE_<ROLE>_USERNAME`, `VORTEX_MARKETPLACE_<ROLE>_PASSWORD` and `VORTEX_MARKETPLACE_<ROLE>_OTP_SECRET`, where `<ROLE>` is `SELLER` or `BUYER`. Run **Marketplace staging smoke** from GitHub Actions. The smoke verifies the target's staging marker before signing in and deactivates the test listing and deletes its photo after the run.
