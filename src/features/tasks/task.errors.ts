export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Task "${taskId}" was not found`);
    this.name = "TaskNotFoundError";
  }
}

export class TaskValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskValidationError";
  }
}
