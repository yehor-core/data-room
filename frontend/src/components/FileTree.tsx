/**
 * ============================================
 * FILE TREE COMPONENT - Hierarchical File Browser
 * ============================================
 * 
 * This component displays files and folders in a tree structure, similar to:
 * - Windows Explorer
 * - VS Code file explorer
 * - Finder on macOS
 * 
 * Features:
 * 1. Hierarchical folder structure with expand/collapse
 * 2. Click chevron to expand/collapse folders
 * 3. Click folder name to navigate into folder
 * 4. Click file name to open file
 * 5. Auto-expands folders when navigating
 * 6. Shows current location with highlighting
 * 
 * For junior developers:
 * - This is a recursive component that builds a tree from flat data
 * - We use React.memo to prevent unnecessary re-renders
 * - The tree structure is built from folders and files arrays
 * - Each folder can contain other folders and files
 */

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, FileText } from 'lucide-react';
import { Folder as FolderType, File as FileType } from '../types';

/**
 * PROPS INTERFACE
 * 
 * This defines what data the FileTree component expects to receive.
 */
interface FileTreeProps {
  folders: FolderType[];                    // Array of all folders
  files: FileType[];                       // Array of all files
  onFolderClick: (folderId: string) => void; // Function called when folder is clicked
  onFileClick: (fileId: string) => void;   // Function called when file is clicked
  currentPath?: string;                     // ID of currently selected folder
}

/**
 * TREE NODE INTERFACE
 * 
 * This represents a single item in the tree (folder or file).
 * Used internally to build the tree structure.
 */
interface TreeNode {
  id: string;                               // Unique identifier
  name: string;                             // Display name
  type: 'folder' | 'file';                  // Whether it's a folder or file
  children?: TreeNode[];                     // Sub-items (for folders)
  expanded?: boolean;                        // Whether folder is expanded
}

/**
 * FILE TREE COMPONENT
 * 
 * This is the main component that renders the file tree.
 * It's wrapped in React.memo for performance optimization.
 */
export const FileTree: React.FC<FileTreeProps> = memo(({
  folders,
  files,
  onFolderClick,
  onFileClick,
  currentPath
}) => {
  // STATE MANAGEMENT
  // Track which folders are expanded (showing their contents)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  // Auto-expand all folders on initial load
  useEffect(() => {
    if (folders.length > 0 && expandedFolders.size === 0) {
      const allFolderIds = new Set(folders.map(f => f.id));
      setExpandedFolders(allFolderIds);
    }
  }, [folders, expandedFolders.size]);

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

  // Keep only folders that still exist when folders list changes
  useEffect(() => {
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
        >
          {node.type === 'folder' && (
            <div className="flex items-center gap-1">
              {hasChildren && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpanded(node.id);
                  }}
                  className="hover:bg-gray-200 rounded p-0.5"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              )}
              {!hasChildren && <div className="w-4 h-4" />}
              <div
                className="flex items-center gap-2 flex-1"
                onClick={() => onFolderClick(node.id)}
              >
                {isActive ? (
                  <FolderOpen className="h-4 w-4 text-blue-500" />
                ) : (
                  <Folder className="h-4 w-4 text-blue-500" />
                )}
                <span className="text-sm truncate">{node.name}</span>
              </div>
            </div>
          )}
          {node.type === 'file' && (
            <div
              className="flex items-center gap-2 flex-1"
              onClick={() => onFileClick(node.id)}
            >
              <div className="w-4 h-4" />
              <FileText className="h-4 w-4 text-gray-500" />
              <span className="text-sm truncate">{node.name}</span>
            </div>
          )}
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
