export class ValidationException extends Error {
  constructor(message, field = "") {
    super(message);
    this.name = "ValidationException";
    this.field = field;
  }
}

export function validateMovie(movie) {
  const required = ["title", "genre", "language", "director", "releaseDate", "duration", "rating", "description"];
  const missing = required.find((key) => !String(movie[key] ?? "").trim());
  if (missing) throw new ValidationException(`Please complete the ${missing} field.`, missing);
  if (Number(movie.rating) < 0 || Number(movie.rating) > 10) {
    throw new ValidationException("Rating must be between 0 and 10.", "rating");
  }
  return movie;
}
