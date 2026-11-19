interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
}

/**
 * The path from the top-level folder down to `folderId`, built from all folders of one data room.
 * A repeated id means corrupt data (a cycle); the chain stops there instead of looping.
 */
export function buildBreadcrumb(folders: FolderNode[], folderId: string) {
  const byId = new Map(folders.map((folder) => [folder.id, folder]));
  const chain: { id: string; name: string }[] = [];
  const seen = new Set<string>();
  for (let folder = byId.get(folderId); folder && !seen.has(folder.id); folder = byId.get(folder.parentId ?? '')) {
    seen.add(folder.id);
    chain.unshift({ id: folder.id, name: folder.name });
  }
  return chain;
}

/** `folderId` and every folder nested under it, at any depth. */
export function subtreeIds(folders: Omit<FolderNode, 'name'>[], folderId: string) {
  const childrenOf = new Map<string, string[]>();
  for (const { id, parentId } of folders) {
    if (parentId) childrenOf.set(parentId, [...(childrenOf.get(parentId) ?? []), id]);
  }
  const ids = new Set([folderId]);
  for (const id of ids) for (const child of childrenOf.get(id) ?? []) ids.add(child);
  return [...ids];
}
