/** Native file listings keep a trailing separator on directory paths. */
export function displayName(path: string): string {
  return (
    path
      .replace(/[\\/]+$/g, "")
      .split(/[\\/]/)
      .pop() || path
  );
}
