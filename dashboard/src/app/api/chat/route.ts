import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { resolveTenantId } from '@/lib/tenantContext';
import { sendChatMessage } from '@/lib/orchestratorClient';
import { randomUUID } from 'node:crypto';
import { proxyChatRequest } from '@/lib/chatProxy';

// Proxy hacia el orquestador ALFA. El tenant_id se fija server-side según la
// sesión autenticada — nunca se confía en un tenant_id que mande el cliente.
export async function POST(req: NextRequest) {
  let input: unknown;
  try { input = await req.json(); } catch { return NextResponse.json({ error: 'Invalid request body' }, { status: 400 }); }
  const response = await proxyChatRequest({
    getSession: () => getServerSession(authOptions),
    resolveTenant: (session) => resolveTenantId(session),
    createRequestId: randomUUID,
    sendMessage: sendChatMessage,
  })(input);
  return NextResponse.json(response.body, { status: response.status });
}
