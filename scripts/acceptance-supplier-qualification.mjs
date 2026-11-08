import assert from 'node:assert/strict';

// Create explicit synthetic evidence in the caller's isolated acceptance environment.
export async function createAcceptanceQualification(base, token, api, runId) {
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname)
    && new URL(base).port !== '8080' && process.env.ACCEPTANCE_LOCAL_WRITES === '1');
  const fileName = `acceptance-${runId}.pdf`;
  const ticket = await api('supplier/qualifications/upload-ticket', token, { fileName });
  const response = await fetch(`${base}${ticket.uploadUrl}&contentType=application%2Fpdf`, {
    method: 'POST', signal: AbortSignal.timeout(30000),
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
    body: Buffer.from(`%PDF-1.4\nSYNTHETIC ACCEPTANCE ONLY ${runId}\n%%EOF`),
  });
  assert.ok(response.ok, `Qualification upload failed: ${response.status}`);
  return api('supplier/qualifications', token, {
    qualificationType: '营业执照', certificateNo: `QA-${runId}`,
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
    fileName, storageKey: ticket.storageKey,
  });
}
