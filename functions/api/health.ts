export const onRequestGet = () => new Response(JSON.stringify({
  status: 'ok',
  generationConfigured: true,
  provider: 'Kilo Auto Free',
  model: 'kilo-auto/free',
  authenticationRequired: false,
  databaseRequired: false
}), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
