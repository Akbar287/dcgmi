export class ForbiddenError extends Error {
  readonly permission: string;

  constructor(permission: string) {
    super(`Peran tidak memiliki izin: ${permission}`);
    this.name = "ForbiddenError";
    this.permission = permission;
  }
}
