# Pipeline Observation Specification

## Purpose

Define a tenant-scoped dashboard read that exposes persisted discovery and evaluation state using the declared database schema.

## Requirements

### Requirement: Pipeline reads MUST be schema-compatible

The system MUST read product and evaluation fields that exist in the declared PostgreSQL schema or are supplied by an explicitly established compatible schema change. A query that references absent fields MUST NOT be treated as a successful pipeline read. The response MUST distinguish an empty result from a query or data error.

#### Scenario: Persisted products are returned using declared fields

- GIVEN tenant A has persisted products and evaluation data represented by the declared schema
- WHEN the dashboard requests its pipeline
- THEN the response includes the available persisted product/evaluation fields
- AND the read completes without referencing an undeclared field

#### Scenario: Query encounters an incompatible field or database error

- GIVEN a pipeline query cannot execute against the declared schema
- WHEN the dashboard requests the pipeline
- THEN the system returns an explicit error outcome rather than a fabricated empty success
- AND the failure is distinguishable from a valid empty pipeline

### Requirement: Pipeline reads MUST enforce tenant isolation across joined data

The system MUST derive the pipeline tenant from trusted request context and constrain every returned product and related evaluation record to that tenant. Caller-supplied tenant identifiers MUST NOT authorize a read, and joins MUST NOT expose related records owned by another tenant.

#### Scenario: Tenant sees only its own persisted pipeline

- GIVEN tenant A and tenant B each have persisted discovery/evaluation data
- WHEN a trusted tenant A request reads the pipeline
- THEN every returned product and related evaluation belongs to tenant A
- AND no tenant B identity, attributes, or evaluation data is returned

#### Scenario: Missing or spoofed tenant cannot select another pipeline

- GIVEN the request has no trusted tenant context or submits tenant B while authenticated as tenant A
- WHEN the pipeline endpoint is called
- THEN the system rejects the request or uses only the trusted tenant A scope
- AND it never returns tenant B data because of the supplied identifier

### Requirement: Pipeline results MUST reflect persisted state and evidence status

The pipeline MUST display only persisted discovery/evaluation state and MUST preserve the distinction between observed, estimated, and unavailable evidence. It MUST NOT imply that a product was discovered, evaluated, or externally published when the corresponding persisted state does not support that claim.

#### Scenario: Pipeline displays available evidence provenance

- GIVEN a persisted evaluation contains observed, estimated, and unavailable inputs
- WHEN the dashboard reads the pipeline
- THEN the response retains each input's evidence status and provenance
- AND it does not relabel an estimate as an observation

#### Scenario: No persisted result exists

- GIVEN tenant A has no persisted discovery/evaluation records
- WHEN the dashboard reads the pipeline
- THEN it returns a valid empty result for tenant A
- AND it does not infer records from provider output that was not persisted

### Requirement: Pipeline observation MUST remain non-mutating

The pipeline read MUST NOT trigger product discovery, evaluation persistence, publishing, Shopify writes, paid advertising actions, social posting, or n8n workflow changes. Its outcome MUST be observational only.

#### Scenario: Dashboard observes an existing product

- GIVEN a product/evaluation record already exists for the trusted tenant
- WHEN the dashboard requests the pipeline
- THEN it returns the persisted state without initiating an external or internal mutation
- AND product, commerce, advertising, and workflow state remains unchanged

#### Scenario: Empty pipeline read does not initiate discovery

- GIVEN no product records exist for the trusted tenant
- WHEN the dashboard requests the pipeline
- THEN it returns an empty observation
- AND it does not launch a discovery call or any publishing, Shopify, Ads, or n8n action
