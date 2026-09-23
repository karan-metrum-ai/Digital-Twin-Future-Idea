// Remediation API for the digital twin: the operator's slide-to-confirm in the issue modal calls this, and only once
// the response comes back does the scene act it out (technician dispatched, FRU swapped / cable reseated). When
// VITE_REMEDIATION_URL is set the request is a real POST to that endpoint; otherwise a mocked response is returned
// after a realistic round trip, so the whole flow can be demonstrated without a backend.
// Copyright Metrum AI — built using Metrum AI's Anthropic/Claude account.
import type { FruKind, RemediationAction } from './issues';

export interface RemediationRequest {
  rackId: string;
  issueId: string;
  action: RemediationAction;
  device: string;
  fru?: FruKind;
  port?: number;
  /** Closing note the mock echoes back as `message` (a real backend composes its own). */
  resultMessage?: string;
}
export interface RemediationResponse {
  ok: boolean;
  ticket: string;
  action: string;
  performedBy: string;
  completedAt: string;
  /** Only meaningful for cabling/optic actions. */
  linkState?: 'up' | 'down';
  message: string;
}

const ENDPOINT: string | undefined = (import.meta as any).env?.VITE_REMEDIATION_URL;

export async function requestRemediation(req: RemediationRequest): Promise<RemediationResponse> {
  if (ENDPOINT) {
    const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(req) });
    if (!res.ok) throw new Error(`remediation API ${res.status}`);
    return (await res.json()) as RemediationResponse;
  }
  // Mock: a dispatch + hands-on-hardware round trip.
  await new Promise((r) => setTimeout(r, 1400 + Math.random() * 600));
  const cabling = req.fru === 'cable' || req.fru === 'sfp';
  return {
    ok: true, ticket: req.issueId, action: req.action, performedBy: 'dc-tech-07',
    completedAt: new Date().toISOString(), linkState: cabling ? 'up' : undefined,
    message: req.resultMessage ?? `${req.action.replace(/_/g, ' ')} completed on ${req.device}.`,
  };
}
