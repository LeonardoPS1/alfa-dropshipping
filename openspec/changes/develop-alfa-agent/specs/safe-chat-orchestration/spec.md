# Safe Chat Orchestration Specification

## Purpose

Define the safe, tenant-bound chat contract for product discovery and evaluation. The chat journey may read an external product catalog and persist product/evaluation results internally; it does not authorize unrelated or external mutations.

## Requirements

### Requirement: Requests MUST use trusted tenant context

The system MUST derive tenant authority from a trusted server-side context and MUST NOT treat a caller-supplied tenant identifier as authority. A missing, invalid, or untrusted tenant context MUST be rejected before any tool dispatch or tenant data access. Every downstream read, write, and audit event for the request MUST remain bound to that tenant.

#### Scenario: Trusted tenant request enters discovery

- GIVEN an authenticated request resolves to tenant A through the trusted request context
- WHEN the chat request is accepted
- THEN every dispatched discovery/evaluation operation and resulting internal record is scoped to tenant A
- AND the audit trail identifies tenant A and the request

#### Scenario: Missing or spoofed tenant is rejected

- GIVEN a request has no trusted tenant context or supplies tenant B while its trusted context resolves to tenant A
- WHEN the chat request is submitted
- THEN the system rejects it before dispatching a tool or reading/writing tenant product data
- AND no operation is performed under tenant B on the caller's behalf

### Requirement: Tool-call transcripts MUST preserve protocol linkage

For each accepted provider tool-call response, the system MUST preserve the assistant message and its complete tool-call identifiers, names, and arguments in the conversation transcript. Each tool result MUST reference the matching call identifier exactly once before a subsequent provider turn is requested. The system MUST NOT fabricate, omit, duplicate, or mismatch a tool-call/result link.

#### Scenario: Valid discovery tool call completes a provider turn

- GIVEN the provider returns an assistant message with a valid discovery tool call and unique call identifier
- WHEN the tool completes successfully
- THEN the transcript contains the assistant tool-call message and one result linked to that exact identifier
- AND the provider receives the linked transcript for its next turn

#### Scenario: Duplicate or unmatched tool result is not continued

- GIVEN a tool result has a missing, unknown, or already-consumed call identifier
- WHEN the orchestrator validates the transcript
- THEN it rejects the invalid continuation
- AND records an attributable protocol failure without requesting another provider turn

### Requirement: Tool dispatch MUST be validated, allowlisted, and bounded

The system MUST dispatch only explicitly allowlisted product-discovery and evaluation tools whose arguments satisfy their declared input contract. It MUST enforce a finite configured or otherwise explicit maximum number of provider/tool handoffs for one request. It MUST NOT dispatch publishing, Shopify write/order/inventory, social posting, paid advertising, campaign optimization/pause, or n8n workflow mutation actions as part of this journey.

#### Scenario: Valid allowlisted calls remain within the handoff limit

- GIVEN a tenant-bound request and a provider sequence containing only valid allowlisted discovery/evaluation calls
- WHEN the sequence completes before the maximum handoff count
- THEN the calls execute and the journey may return its discovery/evaluation result
- AND no non-allowlisted action is dispatched

#### Scenario: Invalid input, forbidden tool, or exhausted bound stops the loop

- GIVEN a provider call names a forbidden tool, contains invalid arguments, or exceeds the maximum handoff count
- WHEN the call is considered for dispatch
- THEN the system does not execute that call and stops the journey with an explicit bounded failure
- AND it does not continue by substituting a different tool or silently dropping the error

### Requirement: Tool and provider failures MUST fail closed

The system MUST expose a clear failure outcome when provider output is malformed, a tool rejects its input, a discovery source is unavailable, or a dispatched tool fails. A failed or incomplete operation MUST NOT be represented as a successful completed discovery/evaluation, and the system MUST NOT continue with unsafe or unvalidated calls.

#### Scenario: Provider or tool failure is visible

- GIVEN a provider response is malformed or an allowlisted tool returns an error
- WHEN the chat journey processes the failure
- THEN it returns or records an explicit failure state associated with the request and affected call
- AND it does not claim successful discovery for the failed operation

#### Scenario: Partial result is distinguished from complete result

- GIVEN one allowed discovery source succeeds and another source fails
- WHEN the journey produces an outcome
- THEN the outcome distinguishes available results from the failed or unavailable source
- AND it does not label the overall evidence as complete

### Requirement: Chat-mediated actions MUST retain audit continuity

The system MUST produce attributable audit records linking the tenant, request/conversation, provider tool call, tool outcome, and any internal product/evaluation records created or updated. Success and failure outcomes MUST be distinguishable. Audit data MUST NOT contain credentials or provider secrets.

#### Scenario: Successful product evaluation is traceable

- GIVEN an allowlisted tool call creates or updates a product evaluation
- WHEN the chat journey completes
- THEN audit records link the request, tenant, tool-call identifier, outcome, and resulting record identity
- AND a reviewer can distinguish this action from a different request

#### Scenario: Rejected request or failed call remains auditable

- GIVEN a request is rejected for tenant/protocol validation or a tool call fails
- WHEN the failure is returned
- THEN an audit outcome records the rejection/failure and its request context where that context is trusted
- AND no secret credential value is written to the audit trail
