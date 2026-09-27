import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendChatMessage } from '@/lib/orchestratorClient';
import { DEFAULT_TENANT_ID } from '@/lib/db';

// Proxy hacia el orquestador ALFA. El tenant_id se fija server-side según la
// sesión autenticada — nunca se confía en un tenant_id que mande el cliente.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'no autenticado' }, { status: 401 });
  }

  const { message } = await req.json();
  if (!message) {
    return NextResponse.json({ error: 'message es requerido' }, { status: 400 });
  }

  try {
    const result = await sendChatMessage(DEFAULT_TENANT_ID, message);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'error interno' }, { status: 500 });
  }
}
