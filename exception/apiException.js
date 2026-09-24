export class ApiException extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = "ApiException";
    this.status = status;
  }
}

export function handleApiError(error) {
  console.error("Butterflix API error:", error);
  if (error instanceof ApiException) return error;
  if (error?.name === "ValidationException") return error;
  return new ApiException(error?.message || "The cinema library is temporarily unavailable.");
}
