// Test-only WhatsApp settings shared by playwright.config.ts and the specs.
export const MOCK_GRAPH_PORT = 3199;
export const E2E_WHATSAPP = {
  appSecret: "e2e-app-secret",
  verifyToken: "e2e-verify-token",
  cronSecret: "e2e-cron-secret",
  mockUrl: `http://localhost:${MOCK_GRAPH_PORT}`,
};
