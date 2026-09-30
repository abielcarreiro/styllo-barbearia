/* =========================================================
   STYLLO BARBEARIA — config.js
   Conexão com o banco de dados (Supabase), usada pelo agendamento e pelo painel admin.

   SUBSTITUIR: no Supabase, abra Project Settings > API e copie:
     - Project URL            → supabaseUrl
     - Project API keys: anon → supabaseAnonKey

   A chave "anon" é pública por natureza: ela só permite o que as regras de
   segurança do banco (supabase/schema.sql) autorizam.
   NUNCA coloque aqui a chave "service_role".
   ========================================================= */
window.STYLLO = {
  supabaseUrl: "https://whnhockwlwzupnnijmye.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndobmhvY2t3bHd6dXBubmlqbXllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3Mjg1OTQsImV4cCI6MjEwNjMwNDU5NH0.pSndzKJSp4n8InI5pBIQPzUQ9mNjhme16Q7Nhar1lE8",
  fuso: "America/Fortaleza"
};

window.STYLLO.db =
  window.STYLLO.supabaseUrl && window.STYLLO.supabaseAnonKey && window.supabase
    ? window.supabase.createClient(window.STYLLO.supabaseUrl, window.STYLLO.supabaseAnonKey)
    : null;
