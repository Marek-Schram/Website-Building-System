// Thin fetch wrapper. Every call goes through here so 401s (session expired) are handled in one place.
class ApiError extends Error {}

let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

async function req(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { onUnauthorized(); throw new ApiError('Not signed in'); }
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  session: () => req('GET', '/session'),
  login: password => req('POST', '/login', { password }),
  logout: () => req('POST', '/logout'),

  listDeals: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return req('GET', '/deals' + (qs ? '?' + qs : ''));
  },
  createDeal: body => req('POST', '/deals', body),
  getDeal: id => req('GET', `/deals/${id}`),
  updateDeal: (id, body) => req('PATCH', `/deals/${id}`, body),
  deleteDeal: id => req('DELETE', `/deals/${id}`),
  addActivity: (id, body) => req('POST', `/deals/${id}/activity`, body),

  importLeads: body => req('POST', '/import/leads', body),
  importBookingLeads: body => req('POST', '/import/booking-leads', body),
  jobResult: id => req('GET', `/jobs/${id}/result`),

  scanOpportunities: id => req('POST', `/deals/${id}/scan-opportunities`),
  generateDemo: id => req('POST', `/deals/${id}/generate-demo`),
  generateBrief: id => req('POST', `/deals/${id}/generate-brief`),
  checkBookingPresence: id => req('POST', `/deals/${id}/check-booking-presence`),
  proposeLodging: (id, body) => req('POST', `/deals/${id}/propose-lodging`, body),
  listingKit: (id, body) => req('POST', `/deals/${id}/listing-kit`, body),

  startClient: id => req('POST', `/deals/${id}/start-client`),
  getBrand: id => req('GET', `/deals/${id}/brand`),
  putBrand: (id, body) => req('PUT', `/deals/${id}/brand`, body),
  getContent: (id, page) => req('GET', `/deals/${id}/content/${page}`),
  putContent: (id, page, body) => req('PUT', `/deals/${id}/content/${page}`, body),

  listAddons: industry => req('GET', '/addons' + (industry ? `?industry=${encodeURIComponent(industry)}` : '')),
  enableAddon: (id, addonId, config) => req('POST', `/deals/${id}/addons`, { id: addonId, config }),
  disableAddon: (id, addonId) => req('DELETE', `/deals/${id}/addons/${addonId}`),

  build: (id, force) => req('POST', `/deals/${id}/build`, { force: !!force }),
  test: id => req('POST', `/deals/${id}/test`),
  flagSecurityGate: id => req('POST', `/deals/${id}/security-gate/flag`),
  clearSecurityGate: id => req('POST', `/deals/${id}/security-gate/clear`),
  deploy: id => req('POST', `/deals/${id}/deploy`),
};

// Watches a job's SSE stream. onLine(text) for each line, onDone({status, code}) at the end.
export function watchJob(jobId, { onLine, onDone }) {
  const es = new EventSource(`/api/jobs/${jobId}/stream`);
  es.onmessage = evt => {
    const msg = JSON.parse(evt.data);
    if (msg.line !== undefined) onLine?.(msg.line);
    if (msg.done) { onDone?.(msg); es.close(); }
  };
  es.onerror = () => { onDone?.({ status: 'failed', code: null }); es.close(); };
  return () => es.close();
}
