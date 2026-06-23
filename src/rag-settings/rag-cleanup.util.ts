export function buildChunkCleanupQuery(input: {
  knowledgeEntryId: string;
  attachmentId?: string;
}): string {
  const params = new URLSearchParams({ knowledgeEntryId: input.knowledgeEntryId });
  if (input.attachmentId) {
    params.set('attachmentId', input.attachmentId);
  }
  return `/chunks/by-source?${params.toString()}`;
}

export function buildChunkDeletePath(chunkId: string): string {
  return `/chunks/${chunkId}`;
}

if (require.main === module) {
  const entryOnly = buildChunkCleanupQuery({
    knowledgeEntryId: 'entry-1',
  });
  console.assert(
    entryOnly === '/chunks/by-source?knowledgeEntryId=entry-1',
    `entry cleanup path mismatch: ${entryOnly}`,
  );

  const attachment = buildChunkCleanupQuery({
    knowledgeEntryId: 'entry-1',
    attachmentId: 'file-1',
  });
  console.assert(
    attachment.includes('knowledgeEntryId=entry-1'),
    'attachment cleanup missing entry id',
  );
  console.assert(
    attachment.includes('attachmentId=file-1'),
    'attachment cleanup missing attachment id',
  );

  console.assert(
    buildChunkDeletePath('chunk-1') === '/chunks/chunk-1',
    'chunk delete path mismatch',
  );

  console.log('rag-cleanup.util self-check passed');
}
