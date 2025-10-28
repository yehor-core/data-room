import { Folder as FolderType, File as FileType } from '@/types';
import { toast } from '@/lib/toast';

/**
 * Get current folder's contents (folders and files)
 */
export const getCurrentFolderContents = (
  folderId: string | undefined,
  folderData: any,
  foldersData: any
): { folders: FolderType[]; files: FileType[] } => {
  if (folderId) {
    // Show contents of specific folder ONLY (not subfolders)
    const currentFolderFiles = folderData?.data?.files || [];
    
    // Debug: Log which files belong to this folder
    console.log('📂 Current folder files:', {
      folderId,
      folderName: folderData?.data?.name,
      fileCount: currentFolderFiles.length,
      files: currentFolderFiles.map((f: any) => ({ name: f.name, folderId: f.folderId }))
    });
    
    return {
      folders: folderData?.data?.children || [],
      files: currentFolderFiles
    };
  } else {
    // Show root level contents (only folders with no parent, NO FILES at root level)
    const allFolders = Array.isArray(foldersData?.data) 
      ? foldersData.data 
      : (foldersData?.data?.folders || []);
    
    // Filter to only show root-level folders (no parentId)
    const rootFolders = allFolders.filter((folder: any) => !folder.parentId);
    
    return {
      folders: rootFolders,
      files: [] // No files at data room root level
    };
  }
};

/**
 * Get all folders and files for FileTree (needed for proper tree structure)
 */
export const getAllFoldersAndFiles = (
  foldersData: any,
  allFilesData: any
): { folders: FolderType[]; files: FileType[] } => {
  const allFolders = Array.isArray(foldersData?.data) 
    ? foldersData.data 
    : (foldersData?.data?.folders || []);
  
  // Use allFilesData which contains ALL files from entire data room
  const allFiles = Array.isArray(allFilesData?.data) 
    ? allFilesData.data 
    : (allFilesData?.data?.files || []);
  
  return {
    folders: allFolders,
    files: allFiles
  };
};

/**
 * Search across entire data room (folders and files)
 */
export const searchAllContent = (
  searchQuery: string,
  folders: FolderType[],
  files: FileType[],
  foldersData: any,
  allFilesData: any
): { folders: FolderType[]; files: FileType[] } => {
  if (!searchQuery.trim()) {
    return { folders, files };
  }

  const query = searchQuery.toLowerCase();
  
  // Get ALL folders from data room
  const allFolders = Array.isArray(foldersData?.data) 
    ? foldersData.data 
    : (foldersData?.data?.folders || []);
  
  // Recursively search through all folders
  const searchInFolders = (foldersList: any[]): any[] => {
    let results: any[] = [];
    foldersList.forEach((folder: any) => {
      if (folder.name.toLowerCase().includes(query)) {
        results.push(folder);
      }
      if (folder.children && folder.children.length > 0) {
        results = results.concat(searchInFolders(folder.children));
      }
    });
    return results;
  };
  
  // Search in current view AND all subfolders
  const matchingFolders = searchInFolders(allFolders);
  
  // Get ALL files from the entire data room (including all subfolders)
  const allFiles = Array.isArray(allFilesData?.data) 
    ? allFilesData.data 
    : (allFilesData?.data?.files || []);
  
  // Search globally across ALL files in the data room
  const matchingFiles = allFiles.filter((file: FileType) => 
    file.name.toLowerCase().includes(query)
  );

  return { folders: matchingFolders, files: matchingFiles };
};

/**
 * Handle file viewing/downloading
 */
export const handleFileView = (
  fileId: string,
  allFiles: FileType[]
) => {
  console.log('🔍 Attempting to view file:', fileId);
  
  const file = allFiles.find((f: FileType) => f.id === fileId);
  
  if (!file) {
    console.error('❌ File not found in any files list:', fileId);
    toast.error('File not found. Please refresh the page.');
    return;
  }

  // Map database fields to expected frontend fields
  const blobUrl = file.filePath || file.blobUrl;
  const fileType = file.mimeType || file.fileType;
  const size = file.fileSize || file.size;

  console.log('📄 File details:', {
    id: file.id,
    name: file.name,
    blobUrl,
    fileType,
    size,
    originalFile: file
  });

  // Open file in new tab using the blobUrl from the database
  if (blobUrl) {
    try {
      if (fileType === 'application/pdf') {
        // Open PDF in new tab with proper viewer
        const pdfWindow = window.open('', '_blank');
        if (pdfWindow) {
          pdfWindow.document.write(`
            <html>
              <head>
                <title>${file.name}</title>
                <style>
                  body { margin: 0; padding: 0; background: #f5f5f5; }
                  .container { width: 100%; height: 100vh; display: flex; flex-direction: column; }
                  .header { background: white; padding: 10px; border-bottom: 1px solid #ddd; }
                  .viewer { flex: 1; background: white; }
                  iframe { width: 100%; height: 100%; border: none; }
                </style>
              </head>
              <body>
                <div class="container">
                  <div class="header">
                    <h3>${file.name}</h3>
                  </div>
                  <div class="viewer">
                    <iframe src="${blobUrl}" type="application/pdf"></iframe>
                  </div>
                </div>
              </body>
            </html>
          `);
          pdfWindow.document.close();
          console.log('✅ PDF opened successfully');
        } else {
          console.error('❌ Failed to open PDF window - popup blocked?');
          toast.error('Failed to open PDF. Please check if popups are blocked.');
        }
      } else {
        // For other file types, create a download link
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = file.name;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log('✅ File download initiated');
      }
    } catch (error) {
      console.error('❌ Error opening file:', error);
      toast.error(`Error opening file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  } else {
    console.error('❌ File has no blobUrl:', file);
    toast.error(`File "${file.name}" not found. It may have been deleted. Please re-upload.`);
  }
};

