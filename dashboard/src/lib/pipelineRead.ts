import type { AuthenticatedSession } from './tenantContext';
import type { PipelineRow } from './pipelineQuery';

export interface PipelineReadResponse {
  status: number;
  body: { columns: Record<string, PipelineRow[]> } | { error: string };
}

export interface PipelineReadDependencies {
  getSession: () => Promise<AuthenticatedSession | null>;
  resolveTenant: (session: AuthenticatedSession | null) => string;
  readPipeline: (tenantId: string) => Promise<PipelineRow[]>;
}

const COLUMN_NAMES = ['discovered_incomplete', 'evaluado', 'creativos_listos', 'publicado', 'en_campana', 'pausado'];

export function readPipelineRequest(dependencies: PipelineReadDependencies) {
  return async (_callerInput: unknown): Promise<PipelineReadResponse> => {
    const session = await dependencies.getSession();
    if (!session) return { status: 401, body: { error: 'Authentication required' } };

    try {
      const tenantId = dependencies.resolveTenant(session);
      const rows = await dependencies.readPipeline(tenantId);
      const columns = Object.fromEntries(COLUMN_NAMES.map((name) => [name, [] as PipelineRow[]]));

      for (const row of rows) {
        if (row.campaign_status === 'paused' || row.is_flagged_saturated) columns.pausado.push(row);
        else if (row.campaign_status === 'active') columns.en_campana.push(row);
        else if (row.shopify_status === 'draft' || row.shopify_status === 'active') columns.publicado.push(row);
        else if (row.has_copy && row.has_image) columns.creativos_listos.push(row);
        else if (row.evaluation_status === 'evaluated') columns.evaluado.push(row);
        else columns.discovered_incomplete.push(row);
      }

      return { status: 200, body: { columns } };
    } catch {
      return { status: 500, body: { error: 'Pipeline unavailable' } };
    }
  };
}
