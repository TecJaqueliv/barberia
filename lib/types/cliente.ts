/** Fila de public.clientes (ver supabase/migrations/20261016120000_create_clientes.sql). */
export type Cliente = {
  id: string;
  nombre: string;
  correo: string | null;
  telefono: string | null;
  detalle: string | null;
  created_at: string;
  updated_at: string;
};

export type ClientesListResult = {
  data: Cliente[];
  total: number;
};
