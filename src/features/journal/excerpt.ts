// Extracts "the sentence or two surrounding the verse reference" (spec 5.1)
// around a tag match, trimmed to word boundaries with ellipses when cut.
export function extractExcerpt(body: string, tagStart: number, tagEnd: number, radius = 60): string {
  const start = Math.max(0, tagStart - radius)
  const end = Math.min(body.length, tagEnd + radius)
  let excerpt = body.slice(start, end)
  if (start > 0) excerpt = excerpt.replace(/^\S*\s/, '…')
  if (end < body.length) excerpt = excerpt.replace(/\s\S*$/, '') + '…'
  return excerpt.trim()
}
