import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText } from 'lucide-react';
import { Folder as FolderType, File as FileType } from '../types';

interface FileTreeProps {
  folders: FolderType[];
  files: FileType[];
  onFolderClick: (folderId: string) => void;
  onFileClick: (fileId: string) => void;
  currentPath?: string;
}

interface TreeNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  children?: TreeNode[];
  expanded?: boolean;
}

export const FileTree: React.FC<FileTreeProps> = memo(({
  folders,
  files,
  onFolderClick,
  onFileClick,
  currentPath
}) => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Auto-expand/collapse folder when navigating
  useEffect(() => {
    if (currentPath) {
      // When navigating to a folder, expand it and keep parent folders expanded
      setExpandedFolders(prev => {
        const newSet = new Set(prev);
        newSet.add(currentPath);
        return newSet;
      });
    }
  }, [currentPath]);

  // Clear expansion state when folders list changes significantly
  useEffect(() => {
    // Keep only folders that still exist
    const folderIds = new Set(folders.map(f => f.id));
    setExpandedFolders(prev => {
      const newSet = new Set<string>();
      prev.forEach(id => {
        if (folderIds.has(id) || id === currentPath) {
          newSet.add(id);
        }
      });
      return newSet;
    });
  }, [folders, currentPath]);

  const toggleExpanded = useCallback((folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  }, [expandedFolders]);

  const buildTree = useMemo((): TreeNode[] => {
    // Safety check: ensure folders and files are arrays
    if (!Array.isArray(folders) || !Array.isArray(files)) {
      console.warn('FileTree: folders or files is not an array', { folders, files });
      return [];
    }

    // Build tree structure recursively
    const buildNode = (folder: any): TreeNode => {
      const node: TreeNode = {
        id: folder.id,
        name: folder.name,
        type: 'folder',
        children: []
      };
      
      // Add subfolders
      const subfolders = folders.filter(f => f.parentId === folder.id);
      subfolders.forEach(subfolder => {
        node.children!.push(buildNode(subfolder));
      });
      
      // Add files in this folder
      const folderFiles = files.filter(file => file.folderId === folder.id);
      folderFiles.forEach(file => {
        node.children!.push({
          id: file.id,
          name: file.name,
          type: 'file'
        });
      });
      
      return node;
    };
    
    // Start with root folders (folders with no parent)
    const rootFolders = folders.filter(folder => !folder.parentId);
    return rootFolders.map(folder => buildNode(folder));
  }, [folders, files]);

  const renderTreeNode = useCallback((node: TreeNode, level: number = 0) => {
    const isExpanded = expandedFolders.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isActive = currentPath === node.id;

    return (
      <div key={node.id}>
        <div
          className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer hover:bg-gray-100 ${
            isActive ? 'bg-blue-100 text-blue-700' : ''
          }`}
          style={{ paddingLeft: `${level * 16 + 8}px` }}
          onClick={() => {
            if (node.type === 'folder') {
              onFolderClick(node.id);
            } else {
              onFileClick(node.id);
            }
          }}
        >
          {node.type === 'folder' && (
            <div className="flex items-center gap-1">
              {hasChildren && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpanded(node.id);
                  }}
                  className="hover:bg-gray-200 rounded"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              )}
              {!hasChildren && <div className="w-4 h-4" />}
              {isActive ? (
                <FolderOpen className="h-4 w-4 text-blue-500" />
              ) : (
                <Folder className="h-4 w-4 text-blue-500" />
              )}
            </div>
          )}
          {node.type === 'file' && (
            <>
              <div className="w-4 h-4" />
              <FileText className="h-4 w-4 text-gray-500" />
            </>
          )}
          <span className="text-sm truncate">{node.name}</span>
        </div>
        
        {node.type === 'folder' && isExpanded && hasChildren && (
          <div>
            {node.children!.map(child => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  }, [expandedFolders, currentPath, onFolderClick, onFileClick, toggleExpanded]);

  return (
    <div className="w-full md:w-64 bg-white border-r border-gray-200 p-4 overflow-y-auto max-h-[300px] md:max-h-none">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">File Tree</h3>
      <div className="space-y-1">
        {buildTree.length > 0 ? (
          buildTree.map(node => renderTreeNode(node))
        ) : (
          <div className="text-sm text-gray-500 text-center py-4">
            No folders or files yet
          </div>
        )}
      </div>
    </div>
  );
});
