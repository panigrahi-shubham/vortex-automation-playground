# Deployment status — 30 October 2026

Project: `shoplabdemowebsite` (`prj_mBt6H3CdOXOBX3jndbAzhMOpWqKs`).
Account: user's selected personal account; Vercel identifies its default workspace
as `atlas-sphere` (`team_c54bSXdJBKkWRbG0Dk8dHefr`).
Runtime: Node 24.x; function region Mumbai (`bom1`).

## Current state

**Staging build READY; application verification and production promotion pending.**

Staging URL:
[shoplabdemowebsite-53qff4uj1-atlas-sphere.vercel.app](https://shoplabdemowebsite-53qff4uj1-atlas-sphere.vercel.app)

Deployment ID: `dpl_7zx3WNkjMptG9G4U9DHcwJVjWYj1`; target `staging`.

All 142 source files were uploaded by content hash. DATABASE_URL, DIRECT_URL and
the existing stable ORVILO_MFA_KEY were configured as sensitive environment values
for preview and production. Runtime uses the verified transaction pooler on 6543;
no real environment file or credential was uploaded as source. No test-inbox key,
legacy-storage flag, GitHub push, migration or seed was included.

## Host correction

The initial request omitted an explicit target, and Vercel classified its first
build as production. It failed with `STATIC_BUILD_NO_OUT_DIR`: the Other preset
expected a `public` output directory. It never reached READY. A cancel attempt
returned `deployment_not_canceled` because the build had already failed.

Set `outputDirectory: "web"` in vercel.json and project settings, preserving the
Express function/rewrite and private backend source. Uploaded the corrected config
and explicitly requested the staging target. That build reached READY.
The updated [snapshot manifest](RELEASE_SNAPSHOT.md) records the build-only change.

## Access blocker

Unauthenticated requests redirect to Vercel SSO. The authorized-preview/share-link
tool returns 403, and build-log access reports missing authorization to the
`atlas-sphere` scope. A single-use workspace authorization link was presented to
the user; user action is pending. Deployment Protection remains enabled.

Cloud build success is not business-flow verification. No deployed registration,
cart, checkout, cancellation or data-persistence check is claimed yet. No successful
production release is claimed.

## Resume after workspace authorization

1. Retry authorized access to this exact staging deployment using the same Vercel
   connection and known workspace/project IDs.
2. Verify health/config, production restrictions, static assets and database reads.
3. Run the prepared disposable-user browser journey and clean up its own records.
4. Promote only after deployed checks pass, then verify the production URL.

The user's approval to deploy the reviewed snapshot is already recorded. Another
deployment-approval question is unnecessary; only the external workspace access
step is outstanding.

## Production verification — 2026-10-30

Production is live at https://shoplabdemowebsite.vercel.app (deployment dpl_GbiiDzrLcBHvMPYB8MPBJ8BmyS7c). The public health endpoint, API safeguards, catalog, mobile layout, frames and shadow DOM passed. A disposable customer completed registration, wishlist, review, cart, coupon, checkout, invoice, cancellation, profile, password and MFA checks; test data was cleaned up. Password recovery remains unavailable; legacy and test-control endpoints are disabled. No GitHub push or database migration was performed for this deployment.

