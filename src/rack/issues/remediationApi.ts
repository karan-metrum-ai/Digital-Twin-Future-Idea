// Remediation API for the digital twin: the operator's slide-to-confirm on the top bar calls this, and only once
// the response comes back does the scene act it out (the RJ45 gets reseated). When VITE_REMEDIATION_URL is set the
// request is a real POST to that endpoint; otherwise a mocked response is returned after a realistic round trip,
// so the whole flow can be demonstrated without a backend.
export interface RemediationRequest { rackId: string; issueId: string; action: 'reseat_patch_cable'; device: string; port: number }
export interface RemediationResponse { ok: boolean; ticket: string; action: string; performedBy: string; completedAt: string; linkState: 'up' | 'down'; message: string }

const ENDPOINT: string | undefined = (import.meta as any).env?.VITE_REMEDIATION_URL;

export async function requestRemediation(req: RemediationRequest): Promise<RemediationResponse> {
  if (ENDPOINT) {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req) });
    if (!res.ok) throw new Error(`remediation API ${res.status}`);
    return (await res.json()) as RemediationResponse;
  }
  // Mock: a dispatch + hands-on-hardware round trip.
  await new Promise((r) => setTimeout(r, 1400 + Math.random() * 600));
  return {
    ok: true, ticket: req.issueId, action: req.action, performedBy: 'dc-tech-07',
    completedAt: new Date().toISOString(), linkState: 'up',
    message: `Reseated patch cable on ${req.device} port ${req.port}; link negotiated 10GbE full-duplex.`,
  };
}
