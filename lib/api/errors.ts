/** Errores de dominio que los servicios lanzan y `handleError` traduce a HTTP. */

export class NotFoundError extends Error {
  constructor(message = "Recurso no encontrado") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  readonly code: "CORREO_DUPLICADO";
  constructor(code: "CORREO_DUPLICADO", message: string) {
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
