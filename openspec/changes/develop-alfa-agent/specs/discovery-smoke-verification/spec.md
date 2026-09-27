# Discovery Smoke Verification Specification

## Purpose

Specify deterministic contract verification for the complete chat-to-pipeline discovery journey using controlled provider and catalog behavior, without live platform mutations.

## Requirements

### Requirement: Automated contract tests MUST cover the journey boundaries

The system MUST provide automated contract checks for trusted tenant binding, tool-call linkage and validation, bounded dispatch, stable identity/deduplication, evidence provenance, persistence, schema-compatible pipeline reads, and tenant isolation. Tests MUST include success, edge, and failure cases sufficient to detect violations of the corresponding capabilities.

#### Scenario: Contract suite verifies successful journey

- GIVEN controlled provider and catalog responses describe one valid product for tenant A
- WHEN the contract suite exercises chat through pipeline observation
- THEN it verifies linked tool-call/result messages and a bounded allowlisted discovery/evaluation flow
- AND it verifies one persisted tenant A product with evidence state visible in the pipeline

#### Scenario: Contract suite rejects isolation, protocol, and provenance regressions

- GIVEN tests include a spoofed tenant, an invalid tool call, repeated identity, and unavailable evidence
- WHEN the automated checks run
- THEN they assert rejection or stable deduplication as applicable
- AND they assert no cross-tenant access and no unavailable/estimated input is mislabeled as observed

### Requirement: Smoke journey MUST use controlled providers

The smoke journey MUST use deterministic controlled provider and catalog responses or fixtures, and MUST NOT require live provider credentials, live catalog reliability, or production platform credentials to establish the contract. Smoke output MUST identify the controlled nature of the run and any skipped live integration checks.

#### Scenario: Controlled smoke run completes the journey

- GIVEN deterministic controlled provider and catalog fixtures are configured
- WHEN the smoke journey is run for a trusted test tenant
- THEN it exercises the chat-to-pipeline contract reproducibly
- AND its result identifies the provider/catalog behavior as controlled rather than live production evidence

#### Scenario: Required controlled dependency is missing

- GIVEN the smoke journey cannot establish a controlled provider or catalog response
- WHEN the smoke command is run
- THEN it fails explicitly as incomplete or blocked
- AND it does not silently fall back to live credentials or claim a successful smoke result

### Requirement: Verification evidence MUST be attributable and bounded

The smoke journey MUST report which contract journey ran and whether it completed, failed, or was skipped. Its evidence MUST be attributable to the test run and fixture/provider mode, and MUST NOT expose credentials or secrets. A skipped live integration MUST NOT be reported as verified.

#### Scenario: Successful run reports bounded verification evidence

- GIVEN the controlled smoke journey passes
- WHEN its result is reported
- THEN the result identifies the journey outcome and controlled mode
- AND any unrun live integration is explicitly marked unverified or skipped

#### Scenario: Failure preserves failure status and safe diagnostics

- GIVEN a tenant, protocol, persistence, or pipeline contract check fails
- WHEN the smoke result is produced
- THEN it identifies the failed contract area and a safe diagnostic outcome
- AND it does not reveal secrets or convert the failure into a pass

### Requirement: Verification MUST prove absence of external mutations

The automated contract and smoke journeys MUST NOT publish content, write to Shopify, reconcile orders or inventory, create or optimize paid campaigns, post to social platforms, or mutate/optimize n8n workflows. Such operations MUST be excluded or positively guarded from the tested journey, and verification MUST fail if the journey attempts one.

#### Scenario: Valid smoke run has no external mutation

- GIVEN a controlled discovery smoke run executes successfully
- WHEN the run completes
- THEN no publishing, Shopify, Ads, social, or n8n mutation has been invoked
- AND the run's controlled dependencies provide evidence that the journey remained within its read-only boundary

#### Scenario: Mutation-capable action is requested during verification

- GIVEN a provider or test fixture attempts to request a forbidden mutation-capable tool
- WHEN the journey is exercised
- THEN the action is blocked before invocation
- AND the verification records a failure or rejected-call outcome without performing the mutation
