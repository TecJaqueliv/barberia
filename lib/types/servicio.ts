/** Servicio activo expuesto por la API (ver migración 20261016130000). */
export type Servicio = {
  id: string;
  slug: string;
  nombre: string;
  descripcion: string | null;
  duracion_min: number;
  precio: number;
  orden: number;
};

export type DiaSemana = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Un día del horario semanal (horas "HH:MM" locales). */
export type HorarioDia = {
  dia_semana: DiaSemana;
  cerrado: boolean;
  apertura: string | null;
  cierre: string | null;
};

/** Respuesta de GET /api/horario. */
export type Horario = {
  zona_horaria: string;
  intervalo_min: number;
  hoy: string;
  fecha_max: string;
  dias: HorarioDia[];
};
