# VORTEX AUTOMATION PLAYGROUND
## Master Development Specification — Version 1.0 — Web and API scope

This copy removes the separate mobile application scope. Technology choices below are preserved from the submitted specification; see SPEC_REVIEW.md before implementation.

You are a senior full-stack software architect, UI/UX designer and QA automation architect.

Build a complete, production-quality-in-structure automation testing playground called **Vortex Automation Playground**.

The platform must consist of:

1. Vortex Automation Playground Web
2. A REST API backend
3. A deterministic test-data and seeded-defect engine
4. A documented automation testing laboratory

This application will be used to develop, demonstrate, benchmark and validate automated testing tools, particularly Vortex Web Recorder.

The applications must function without any AI service.

## PRINCIPLE 1 — REAL APPLICATION FIRST

Do not build a collection of disconnected static UI examples.

Build a cohesive, realistic business application with functional navigation, state management, validation, persistence and meaningful workflows.

All major screens must be usable manually and testable through automation.

Do not use fake buttons that only display notifications instead of performing their intended operations.

All features must have realistic success, validation and error states.

## PRINCIPLE 2 — WEB ARCHITECTURE

Technology:

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- React Router
- TanStack Query
- Node.js
- Express
- SQLite
- Zod for validation
- OpenAPI for backend contracts

Use a modular architecture:

- Authentication
- Dashboard
- Products
- Orders
- Cart
- Suppliers
- Enquiries
- User Management
- Testing Laboratory
- Settings

Implement reusable components, strict TypeScript typing, error boundaries, loading states and accessible navigation.

Prefer lightweight dependencies and avoid unnecessary abstraction.

## PRINCIPLE 3 — VISUAL DESIGN

Create a polished premium SaaS-style design.

Style direction:

- Professional dashboard appearance
- Dark and light themes
- Responsive layouts
- Modern typography
- Consistent spacing
- Accessible contrast
- Smooth but restrained animations
- Useful empty, loading and error states
- Desktop, tablet and mobile browser support

Create an original identity for Vortex.

Primary branding:
VORTEX

Secondary branding:
AUTOMATION PLAYGROUND

Tagline:
"Built to Break. Designed to Test."

Provide a collapsible sidebar with:

- Overview
- Authentication
- Forms
- Tables
- Marketplace
- Suppliers
- Orders
- UI Testing Lab
- API Testing Lab
- Defect Lab
- Settings

Do not prioritize visuals over working functionality.

## MODULE 1 — AUTHENTICATION

Implement:

1. Login
2. Registration
3. Logout
4. Forgot password
5. Password reset
6. Simulated multi-factor authentication
7. Remember me
8. Password visibility
9. Session expiration
10. Role-based access

Create seeded accounts:

- Standard user
- Administrator
- Locked user
- Slow-response user
- MFA user
- Read-only user

Store password hashes, not plaintext passwords.

Use development-only reset tokens and simulated OTP delivery. Do not send real SMS or emails.

Provide documented demo credentials through development seed configuration.

Test scenarios:

- Valid login
- Invalid credentials
- Empty fields
- Account lockout
- Session expiration
- MFA success/failure
- Unauthorized access
- Role restrictions

## MODULE 2 — DASHBOARD

Implement a functional dashboard containing:

- User profile
- Product counts
- Order counts
- Enquiry counts
- Activity feed
- Interactive charts
- Notification center
- Date filtering
- Search
- Responsive widgets

Populate metrics using actual database records rather than arbitrary frontend values.

## MODULE 3 — FORMS LAB

Implement individual form scenarios covering:

- Text inputs
- Number inputs
- Email and password inputs
- Textareas
- Radio buttons
- Checkboxes
- Single-select dropdowns
- Multi-select dropdowns
- Autocomplete
- Date and time pickers
- File uploads
- Image previews
- Sliders
- Toggle switches
- Address forms
- Dependent dropdowns
- Dynamic repeatable fields
- Multi-step wizard forms

Include:

- Required-field validation
- Boundary validation
- Format validation
- Cross-field validation
- Submission confirmation
- Persistence after refresh

Each form must have a reset button and a predictable result state.

Provide stable data-testid attributes.

## MODULE 4 — TABLES AND DATA GRID

Implement:

- Sorting
- Pagination
- Server-side pagination
- Search
- Filtering
- Column visibility
- Row selection
- Bulk actions
- Inline editing
- CSV export
- Row detail views
- Empty results
- Loading indicators
- Permission-based actions

Seed at least 100 deterministic records.

## MODULE 5 — ECOMMERCE MARKETPLACE

Build realistic shopping workflows:

- Product listing
- Category browsing
- Search
- Sorting
- Filtering
- Product detail page
- Variants
- Wishlist
- Cart
- Quantity changes
- Stock handling
- Coupon validation
- Checkout
- Simulated payments
- Order creation
- Order history
- Cancellation
- Returns

Payments must be simulated. Never process real card information.

Store orders persistently.

Include stock consistency and order-total validation.

## MODULE 6 — B2B SUPPLIER WORKFLOWS

Implement India-style B2B marketplace functionality:

- Supplier listings
- Supplier profiles
- Product enquiries
- Request for quotation
- Buyer-supplier conversations
- Quote submission
- Quote comparison
- Enquiry status
- Supplier lead dashboard
- Attachment support

Create multi-role testing journeys.

Example:

Buyer submits enquiry -> Supplier receives lead -> Supplier quotes -> Buyer reviews -> Buyer accepts/rejects.

Persist status transitions and provide clear audit history.

## MODULE 7 — ADVANCED UI AUTOMATION LAB

Create isolated demonstrations for:

1. Dynamic DOM updates
2. Delayed element appearance
3. AJAX loading
4. Infinite scrolling
5. Virtualized lists
6. Nested iframes
7. Open shadow DOM
8. Closed shadow DOM limitations
9. Drag-and-drop
10. Hover interactions
11. Context menus
12. Modals
13. Toast notifications
14. Browser alerts
15. Confirm dialogs
16. Prompt dialogs
17. New tabs
18. Popups
19. File downloads
20. File uploads
21. Keyboard shortcuts
22. Contenteditable elements
23. Changing element IDs
24. Duplicate text and labels
25. Disabled-to-enabled transitions
26. Conditional fields
27. Debounced search
28. Network timeouts
29. Retryable server errors
30. Responsive element behavior

Each scenario must have:

- A description
- Expected behavior
- Reset control
- Deterministic configuration
- Automation hints
- Stable reference selectors where appropriate
- A visible result indicator

Provide both beginner-friendly and advanced scenarios.

## MODULE 8 — CONTROLLED DEFECT LAB

Implement a safe defect-injection engine.

Defect examples:

- Incorrect validation message
- Cart quantity not updated
- Incorrect sorting
- Missing field validation
- Duplicate submission
- Incorrect total calculation
- Button becomes unresponsive
- Incorrect status transition
- Delayed response
- UI rendering issue

Every defect must be disabled by default.

Each defect must have:

- Unique defect ID
- Description
- Activation toggle
- Expected correct behavior
- Faulty behavior
- Reproduction steps
- Severity
- Reset mechanism

Use the defect engine only in isolated test environments.

Never hide injected defects from testers.

## MODULE 9 — API TESTING LAB

Provide REST endpoints for:

- Authentication
- Users
- Products
- Orders
- Cart
- Suppliers
- Enquiries
- Test data
- Simulated failures

Support:

- GET
- POST
- PUT
- PATCH
- DELETE

Provide examples of:

- 200
- 201
- 204
- 400
- 401
- 403
- 404
- 409
- 422
- 429
- 500
- 503

Make error responses predictable and documented.

Generate an OpenAPI specification.

Provide deterministic endpoint behavior using explicit test parameters or controlled fault profiles.

Never randomly break normal business APIs.

## MODULE 10 — TEST DATA ENGINE

Create a deterministic seed and reset system.

Requirements:

- Known test accounts
- Known products
- Known orders
- Known suppliers
- Known enquiries
- Seeded fixtures
- Repeatable record IDs
- Test-state isolation
- Reset operation
- Test run identifiers

Use a fixed random seed where synthetic variation is required.

Prevent parallel tests from corrupting shared state.

Restrict destructive reset operations to development/test environments.

Do not expose privileged reset endpoints on public production deployments.

## MODULE 11 — AUTOMATION COMPATIBILITY

Ensure the applications can be tested using:

Web:
- Playwright TypeScript
- Playwright Python
- Selenium

API:
- Postman
- Playwright API testing
- Python requests

Do not require these tools to be installed for normal application operation.

Provide stable selectors, documented deep links and deterministic test fixtures.

## MODULE 12 — DOCUMENTATION

Create:

README.md
ARCHITECTURE.md
MODULES.md
API.md
TEST_DATA.md
DEFECT_LAB.md
AUTOMATION_GUIDE.md
VALIDATION.md

Document:

- Installation
- Development commands
- Configuration
- Environment variables
- Database initialization
- Test accounts
- Seed/reset behavior
- Browser requirements
- Automation examples
- Known limitations

## MODULE 13 — QUALITY REQUIREMENTS

Implement:

- TypeScript checks
- ESLint
- Unit tests
- API integration tests
- Playwright E2E smoke tests
- GitHub Actions CI

Ensure:

- No mandatory AI dependencies
- No paid APIs
- No real financial transactions
- No real OTP delivery
- No embedded production secrets
- No fabricated execution results
- No silent destructive operations

## IMPLEMENTATION STRATEGY

Build in independent milestones.

Milestone 1:
Repository, UI shell, backend, database, seed engine and working navigation.

Milestone 2:
Authentication, dashboard, forms and tables.

Milestone 3:
Marketplace, suppliers, enquiries, cart, checkout and orders.

Milestone 4:
UI automation laboratory, API laboratory and defect engine.

Milestone 5:
CI, documentation, cross-browser and API testing and benchmark scenarios.

At the end of each milestone:

1. Run available verification.
2. Report actual results.
3. Document incomplete work.
4. Preserve existing working features.
5. Do not claim a feature is completed unless implemented and verified.
6. Provide the next implementation steps.

## FIRST TASK

Begin by creating Milestone 1 as a working application.

Implement and verify the repository structure, shared architecture, functional backend, SQLite storage, seeded data, responsive website shell and navigation.

Do not attempt to implement all five milestones simultaneously.

The final platform must be sufficiently reliable, realistic and complex to serve as the primary testing environment for the Vortex automation recorder ecosystem.
