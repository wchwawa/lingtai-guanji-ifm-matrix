// Runtime cloud configuration. The anon key is a PUBLIC client credential by design
// (row access is enforced by RLS on the server); the service_role key must NEVER appear here.
export const CLOUD_CONFIG = {
  url: 'https://yacbgtpivizpixaklwjx.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhY2JndHBpdml6cGl4YWtsd2p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMwNDM5NzEsImV4cCI6MjA5ODYxOTk3MX0.j1ieLzeMJYARuXHgsNM-PAuvOR5-hDnNwVmamXUSS4Y',
};
