# PLAYWRIGHT_RULES

## Purpose

These rules define the standard for writing and maintaining Playwright tests in this project. The goal is to keep tests stable, readable, maintainable, and aligned with real user behavior and Playwright best practices.

## Core Principles

- Test user-visible behavior, not implementation details.
- Focus on critical user paths and meaningful end-to-end coverage.
- Keep tests deterministic, isolated, and safe to run in parallel.
- Prefer readability and reliability over clever abstractions.
- Keep the suite easy to debug and cheap to maintain.

## Test Structure

- Use `@playwright/test` as the standard test runner for browser end-to-end tests.
- Use Playwright fixtures such as `test`, `page`, `context`, `browser`, and `expect`.
- Write descriptive test names that clearly state the expected behavior.
- Keep each test independently runnable and free from hidden dependencies on other tests.
- Ensure tests do not rely on execution order.
- Keep each test focused on a single behavior or user outcome.
- Group related tests with `test.describe` where it improves readability.

## Isolation and State Management

- Every test must run in an isolated state.
- Do not share browser state, local storage, cookies, or mutable test data across tests unless explicitly managed through Playwright-supported mechanisms.
- Ensure tests run reliably in parallel without shared state conflicts.
- Use separate test accounts or data sets for tests that mutate server-side state.
- Avoid dependencies on third-party systems or unstable external data when possible.

## Setup and Teardown

- Use `test.beforeEach` for light per-test setup only when it improves clarity and consistency.
- Use `test.afterEach` for necessary cleanup only when cleanup is required.
- Keep hooks small, predictable, and easy to understand.
- Prefer reusable fixtures over large or repetitive hook logic.
- Do not hide important test behavior inside complex hooks.

## Configuration

- Use `playwright.config.ts` for global configuration and environment setup.
- Define and maintain shared settings such as:
  - `baseURL`
  - `use`
  - `expect`
  - `reporter`
  - `retries`
  - `workers`
  - `projects`
  - `webServer`
  - `testIdAttribute`
- Keep configuration centralized and avoid repeating configuration inside individual tests unless necessary.

## Locators

- Prefer built-in user-facing locators over brittle selectors.
- Use locators in this order when practical:
  - `page.getByRole`
  - `page.getByLabel`
  - `page.getByPlaceholder`
  - `page.getByText`
  - `page.getByAltText`
  - `page.getByTitle`
  - `page.getByTestId`
- Use `page.getByTestId` when `data-testid` is intentionally provided as a stable testing contract.
- Reuse locators by assigning them to variables, constants, page objects, or helper abstractions when doing so improves readability.
- Use `page.locator()` only when built-in locators are not sufficient or when advanced composition is required.
- Avoid brittle CSS or XPath chains.
- Avoid using `first()`, `last()`, and `nth()` unless there is no stable unique locator available.

## Assertions

- Use Playwright `expect` matchers for all assertions.
- Prefer web-first assertions whenever possible, including:
  - `toBeVisible`
  - `toBeHidden`
  - `toHaveText`
  - `toContainText`
  - `toHaveValue`
  - `toBeChecked`
  - `toHaveURL`
  - `toHaveTitle`
  - `toHaveCount`
- Use generic `expect` matchers such as `toEqual`, `toContain`, `toBeTruthy`, and `toHaveLength` for non-UI values.
- Do not use Node.js `assert` statements in tests.
- Do not manually check UI state when a built-in retrying Playwright assertion already exists.

## Waiting and Synchronization

- Do not use hardcoded sleeps or `page.waitForTimeout()`.
- Avoid hardcoded timeouts unless there is a clear and justified reason.
- Rely on Playwright auto-waiting for interactions whenever possible.
- Prefer web-first assertions to wait for UI state changes.
- Use targeted waits only when explicit synchronization is required, such as:
  - `locator.waitFor()`
  - `page.waitForURL()`
  - `page.waitForResponse()`
  - `page.waitForEvent()`
- Use `page.waitForLoadState()` sparingly and only when needed.
- Do not introduce generic waits where a specific user-observable condition can be asserted instead.

## Reusability and DRY Principles

- Keep tests DRY by extracting reusable logic into helper functions, fixtures, or page objects when it improves maintainability.
- Avoid over-abstracting simple flows.
- Reuse common actions and selectors through well-named helpers or objects.
- Keep helpers focused, predictable, and easy to understand.
- Prefer simple abstractions that mirror user workflows.

## Helpers and Documentation

- Add JSDoc comments to helper functions and reusable logic to describe their purpose.
- Keep helper APIs small and intention-revealing.
- Do not add comments inside test code unless they provide necessary context that cannot be expressed through naming.
- Prefer clear naming over explanatory comments.

## Page Objects and Abstractions

- Use page objects or higher-level app helpers when they reduce duplication and centralize selectors and actions.
- Do not force page objects for very small or simple tests.
- Keep page objects focused on behavior and interaction, not assertions unrelated to the page’s responsibilities.
- Avoid building large, generic page objects that become difficult to maintain.

## Error Handling and Debuggability

- Write assertions and helper errors so failures are easy to understand.
- Implement logging only when it adds meaningful diagnostic value.
- Keep failure messages clear and actionable.
- Use Playwright tracing, screenshots, videos, and reporters through configuration rather than ad hoc debugging logic in tests.
- Make tests easy to diagnose locally and in CI.

## Authentication and Test Data

- Reuse authenticated state with `storageState` when it is safe to do so.
- Prefer a setup project for reusable authentication flows.
- Do not share a single mutable authenticated account across parallel tests that change backend state.
- Keep authentication artifacts out of version control when they contain sensitive data.
- Use controlled and predictable test data whenever possible.

## Network and External Dependencies

- Mock or route network calls when deterministic behavior is needed and the dependency is outside project control.
- Prefer controlled environments for backend-dependent tests.
- Avoid unnecessary reliance on third-party services in end-to-end tests.
- Make external dependencies explicit when they cannot be avoided.

## Cross-Browser and Device Coverage

- Use Playwright projects to run tests across supported browsers and devices.
- Prefer Playwright built-in `devices` config objects whenever possible.
- Cover the browsers and device profiles that matter most for the product.
- Keep browser coverage aligned with actual support requirements rather than running unnecessary combinations.

## Parallelism and CI

- Design tests to run safely in parallel.
- Avoid shared mutable state across workers.
- Configure retries intentionally and do not use retries to hide flaky tests.
- Run tests consistently in CI for pull requests and mainline changes.
- Treat flakiness as a defect to fix, not a normal condition to tolerate.

## Code Quality

- Keep test code consistent with project linting and formatting rules.
- Ensure async Playwright calls are always awaited.
- Keep test files readable and structurally consistent.
- Prefer explicit, descriptive naming for files, suites, tests, helpers, and fixtures.

## What to Avoid

- Do not use brittle selectors when a resilient locator is available.
- Do not use `page.waitForTimeout()`.
- Do not rely on test order.
- Do not share mutable state across tests.
- Do not overuse hooks for hidden setup.
- Do not over-abstract simple tests.
- Do not test implementation details that users cannot observe.
- Do not keep flaky tests in the suite without fixing the root cause.

## Standard of Quality

A good Playwright test in this project should:

- describe real user behavior
- be easy to read
- be reliable in local and CI environments
- be safe to run in parallel
- fail with clear diagnostics
- avoid unnecessary duplication
- use resilient locators and web-first assertions
- align with Playwright best practices

## Reference

Follow the official Playwright guidance and best practices:

- https://playwright.dev/docs/writing-tests
- https://playwright.dev/docs/best-practices
- https://playwright.dev/docs/locators
- https://playwright.dev/docs/test-assertions
- https://playwright.dev/docs/auth
- https://playwright.dev/docs/pom
- https://playwright.dev/docs/test-configuration