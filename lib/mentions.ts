/**
 * Extracts tag names from markdown content.
 */
export function extractTagsFromContent(content: string): string[] {
  const tagRegex = /(?<![#\w])#([a-zA-Z0-9_-]+)/g;
  const matches = content.matchAll(tagRegex);

  const tagNames = new Set<string>();
  for (const match of matches) {
    if (match[1]) {
      tagNames.add(match[1]);
    }
  }

  return Array.from(tagNames);
}

/**
 * Extracts people/contact names from markdown content.
 */
export function extractPeopleFromContent(content: string): string[] {
  const mentionRegex = /@([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)*)/g;
  const matches = content.matchAll(mentionRegex);

  const personNames = new Set<string>();
  for (const match of matches) {
    if (match[1]) {
      personNames.add(match[1].trim());
    }
  }

  return Array.from(personNames);
}
