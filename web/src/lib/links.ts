/** Where a badge leads: the documentation of the event it was given for. */
export function badgeHref(eventPostId: number): string {
  return `/posts/${eventPostId}#documentation`;
}
