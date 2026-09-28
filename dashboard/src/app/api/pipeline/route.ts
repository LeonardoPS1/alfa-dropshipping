import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions, resolveTenantId } from '@/lib/auth';
import { queryPipeline } from '@/lib/pipelineQuery';
import { readPipelineRequest } from '@/lib/pipelineRead';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await readPipelineRequest({
    getSession: () => getServerSession(authOptions),
    resolveTenant: (session) => resolveTenantId(session),
    readPipeline: queryPipeline,
  })(undefined);
  return NextResponse.json(result.body, { status: result.status });
}
