export interface Evidence {
  status?: 'observed' | 'estimated' | 'unavailable' | string;
  value?: number | string | null;
  source?: string | null;
  source_id?: string | null;
  reason?: string | null;
}

export interface EvidenceDescription {
  label: string;
  status: string;
  provenance: string;
}

export function describeEvidence(evidence: Evidence | null | undefined): EvidenceDescription {
  if (!evidence || evidence.status === 'unavailable' || evidence.value == null) {
    return {
      label: 'Unavailable',
      status: 'unavailable',
      provenance: [evidence?.source, evidence?.reason].filter(Boolean).join(' · ') || 'No persisted observation',
    };
  }

  return {
    label: String(evidence.value),
    status: evidence.status ?? 'unknown',
    provenance: [evidence.source, evidence.source_id].filter(Boolean).join(' · ') || 'Source not recorded',
  };
}
