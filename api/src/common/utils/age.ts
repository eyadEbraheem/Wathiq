/** Full years between `birthDate` and `on` (both compared as UTC calendar dates). */
export function ageOn(birthDate: Date, on: Date = new Date()): number {
  let age = on.getUTCFullYear() - birthDate.getUTCFullYear();
  const monthDiff = on.getUTCMonth() - birthDate.getUTCMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && on.getUTCDate() < birthDate.getUTCDate())
  ) {
    age -= 1;
  }
  return age;
}
