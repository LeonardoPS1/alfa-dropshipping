# Product Discovery and Evaluation Specification

## Purpose

Specify read-only catalog discovery and tenant-safe internal product/evaluation persistence, with stable identity and explicit evidence quality.

## Requirements

### Requirement: Discovery MUST be read-only and preserve source provenance

The system MUST obtain catalog results through read-only discovery. Each discovered product MUST retain a stable source identifier when supplied by the source and enough source/provenance information to distinguish where its product attributes came from. The journey MUST NOT publish products or mutate any external catalog or commerce platform.

#### Scenario: Catalog product is discovered with source evidence

- GIVEN a catalog source returns a product with a stable source identifier and attributes
- WHEN the product is accepted for internal evaluation
- THEN its source identity and source provenance remain associated with the persisted product/evaluation
- AND discovery performs no external write

#### Scenario: Source identity is missing or unusable

- GIVEN a catalog result lacks a stable identifier or contains an unusable identity
- WHEN the result is evaluated for persistence
- THEN the system does not invent an identity from result order, time, or other transient values
- AND marks the result unavailable for stable deduplication or rejects it with an explicit reason

### Requirement: Product identity MUST be stable and tenant-scoped

The system MUST identify a product by its stable source identity within its source and tenant scope. Repeated results for the same tenant, source, and source identifier MUST resolve to the same internal product identity rather than create duplicate products. Identical source identifiers belonging to different tenants MUST remain isolated.

#### Scenario: Repeated search resolves to one internal product

- GIVEN tenant A has already persisted source S product identifier P
- WHEN a later discovery for tenant A returns source S product identifier P again
- THEN the result resolves to the existing tenant A product identity
- AND the journey does not create a duplicate product record

#### Scenario: Same source product is discovered by another tenant

- GIVEN tenant A and tenant B independently discover the same source S product identifier P
- WHEN each result is persisted
- THEN each tenant's data remains scoped to its own tenant context
- AND access to tenant A's internal product identity does not reveal or modify tenant B's record

### Requirement: Product and evaluation persistence MUST enforce tenant scope

The system MUST bind product/evaluation reads and writes to the trusted tenant context for the journey. A caller-provided tenant identifier MUST NOT select the persistence scope. A tenant-scoped operation MUST NOT read, update, or deduplicate against another tenant's records.

#### Scenario: Evaluation updates only its trusted tenant record

- GIVEN a request is trusted as tenant A and tenant B has a similar product record
- WHEN the request persists an evaluation for its discovered product
- THEN only the tenant A record is created or updated
- AND tenant B's record remains unchanged

#### Scenario: Untrusted tenant context prevents persistence

- GIVEN a discovery result is available but the request has missing or untrusted tenant context
- WHEN persistence is attempted
- THEN the system rejects the operation without creating or updating a product/evaluation record

### Requirement: Evaluation MUST distinguish observed, estimated, and unavailable evidence

The system MUST preserve the provenance and availability of evaluation inputs and MUST distinguish observed facts from estimates, heuristics, and unavailable data. A missing shipping or demand input MUST NOT be presented as an observed fact or silently replaced with a fixed estimate. Evaluation output MUST make unavailable inputs distinguishable from measured values.

#### Scenario: Observed and estimated inputs are both available

- GIVEN an evaluation has an observed catalog price and a heuristic demand signal
- WHEN the evaluation is persisted or returned
- THEN the price is identified as observed with its provenance
- AND the demand signal is identified as an estimate or heuristic, not as observed demand

#### Scenario: Shipping or demand evidence is unavailable

- GIVEN the source provides no shipping observation or demand evidence
- WHEN the product is evaluated
- THEN the missing input is marked unavailable or not observed
- AND the system does not represent a default shipping value or heuristic demand as a measured fact

### Requirement: Discovery failures MUST NOT create misleading product evidence

The system MUST preserve a failed or unavailable source outcome separately from a successful source result. It MUST NOT persist fabricated attributes or claim source verification when a source failed, returned invalid data, or supplied no corresponding observation.

#### Scenario: Catalog source is unavailable

- GIVEN a catalog source cannot be reached or reports an error
- WHEN discovery completes its attempt
- THEN the source outcome is recorded as failed or unavailable
- AND no product attributes are attributed to that source without a successful result

#### Scenario: Invalid result is rejected from evaluation

- GIVEN a source response lacks required product identity or contains invalid attributes
- WHEN the response is processed
- THEN the invalid result is rejected or explicitly marked incomplete
- AND it is not presented as a fully evaluated product
