export type MaterialFileDraft = {
  title: string;
  category: string;
  tags: string[];
  sourcePath: string;
};

export function createMaterialFileDraft(path: string): MaterialFileDraft {
  const sourcePath = path.trim();
  const fileName = sourcePath.split(/[\\/]/).filter(Boolean).at(-1) ?? sourcePath;
  const extension = fileName.includes(".") ? fileName.split(".").at(-1)?.toLowerCase() || "file" : "file";

  return {
    title: fileName || "未命名资料",
    category: extension.toUpperCase(),
    tags: [extension],
    sourcePath
  };
}
