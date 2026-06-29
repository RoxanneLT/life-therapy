/**
 * Format a client's name for public display: first name + last initial.
 * "Sarah Mokoena" -> "Sarah M." Falls back to the first name when there is
 * no last name.
 */
export function shortClientName(firstName: string, lastName: string): string {
  const first = firstName.trim();
  const initial = lastName.trim().charAt(0).toUpperCase();
  return initial ? `${first} ${initial}.` : first;
}
