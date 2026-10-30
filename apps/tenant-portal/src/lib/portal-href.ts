// Keep the active solution, but never carry another record's detail parameters.
export function portalHref(params: Record<string, string>, search = window.location.search) {
  const target = new URLSearchParams(params);
  const solution = new URLSearchParams(search).get('solution');
  if (solution) target.set('solution', solution);
  return `/?${target.toString()}`;
}
