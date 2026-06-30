import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: 'matic-platform',
      ts: new Date().toISOString(),
    },
    { status: 200 }
  )
}
