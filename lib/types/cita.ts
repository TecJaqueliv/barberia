/** Valores del enum public.cita_estado. */
export const CITA_ESTADOS = ["confirmada", "cancelada"] as const;
export type CitaEstado = (typeof CITA_ESTADOS)[number];

/** Fila de public.citas (ver migración 20261016130000). Instantes en ISO 8601. */
export type Cita = {
  id: string;
  servicio_id: string;
  inicio: string;
  fin: string;
  duracion_min: number;
  precio: number;
  nombre: string;
  telefono: string;
  email: string | null;
  notas: string | null;
  estado: CitaEstado;
  cancelada_en: string | null;
  created_at: string;
  updated_at: string;
};

export type CitaConServicio = Cita & { servicio: { id: string; nombre: string } };

/** Franja del calendario: `hora` local "HH:MM"; `inicio`/`fin` en ISO UTC. */
export type Franja = {
  hora: string;
  inicio: string;
  fin: string;
  disponible: boolean;
};

/** Respuesta de GET /api/citas/disponibilidad. */
export type Disponibilidad = {
  fecha: string;
  zona_horaria: string;
  cerrado: boolean;
  horario: { apertura: string; cierre: string } | null;
  servicio: { id: string; nombre: string; duracion_min: number; precio: number };
  franjas: Franja[];
};

export type CitasListResult = {
  data: CitaConServicio[];
  total: number;
};
