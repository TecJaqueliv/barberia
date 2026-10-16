/** Errores de dominio que los servicios lanzan y `handleError` traduce a HTTP. */

export class NotFoundError extends Error {
  constructor(message = "Recurso no encontrado") {
    super(message);
    this.name = "NotFoundError";
  }
}

export type ConflictCode =
  | "CORREO_DUPLICADO"
  | "FRANJA_NO_DISPONIBLE"
  | "LIMITE_CITAS_ALCANZADO"
  | "CITA_YA_CANCELADA";

export class ConflictError extends Error {
  readonly code: ConflictCode;
  constructor(code: ConflictCode, message: string) {
    super(message);
    this.name = "ConflictError";
    this.code = code;
  }
}

export class ValidationError extends Error {
  readonly field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.name = "ValidationError";
    this.field = field;
  }
}
