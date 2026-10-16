/**
 * Parámetros de la agenda de citas (BARB-5).
 * Único lugar donde se definen: ningún otro archivo debe repetir estos valores.
 */

/** Zona horaria IANA de la barbería (horario y fechas civiles se interpretan aquí). */
export const ZONA_HORARIA = "America/Bogota";

/** Separación entre inicios de franja, contada desde la apertura (minutos). */
export const INTERVALO_FRANJA_MIN = 30;

/** Se puede reservar/consultar desde hoy hasta hoy + N días (inclusive). */
export const DIAS_MAX_ANTICIPACION = 30;

/** No se puede reservar una franja que empieza en menos de N minutos. */
export const ANTELACION_MIN_MINUTOS = 30;

/** Máximo de citas confirmadas futuras por teléfono (antispam). */
export const MAX_CITAS_FUTURAS_POR_TELEFONO = 3;

/** Moneda de los precios (enteros, sin decimales). */
export const MONEDA = "COP";

/** Listado administrativo: días por defecto entre `desde` y `hasta`. */
export const LISTADO_DIAS_POR_DEFECTO = 7;

/** Listado administrativo: rango máximo permitido entre `desde` y `hasta` (días). */
export const LISTADO_RANGO_MAX_DIAS = 62;
