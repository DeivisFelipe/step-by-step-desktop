import { getIconForFile, getIconForFolder } from 'vscode-material-icons';
import { useState, useEffect } from 'react';
import clsx from 'clsx';

// We need to manage how to load the specific SVG. 
// vscode-material-icons provides names like 'javascript', 'typescript'.
// The SVGs are in 'vscode-material-icons/icons'.
// We might need to copy them to public/assets or import dynamically.
// For Electron/Vite, dynamic import of assets might vary.
// A simpler approach for now is mapping common ones, or setting up a copy script.
// But `vscode-material-icons` suggests: "You can use the icons in your web app by copying..."

// Wait, I installed the package, but I need the SVGs accessible.
// Since I can't easily modify build config to copy 100s of icons right now without risk,
// I will check if I can lazy load them from node_modules if Vite allows, or if I should implementing a mapping for common extensions manually using `lucide-react` as a fallback or `vscode-material-icons` name to URL.

// Actually, `vscode-material-icons` exports `getIconForFile`. Does it return a path or a name?
// It returns the icon name (e.g. "javascript").
// The SVGs are in `node_modules/vscode-material-icons/icons/*.svg`.

// Strategy:
// 1. Create a helper that maps key extensions to Lucide icons (safe fallback).
// 2. OR, try to dynamically import specific icons if possible.
// Given the constraints and desire for "vscode style", maybe the best bet is to map manually to colored Lucide icons or simple generic ones, UNLESS I can get the SVGs.

// User said "instale e use alguma lib".
// If I use `vscode-material-icons`, I need to serve the icons.
// I'll try to use a simplified version for now or check if there's a React wrapper.
// `material-icon-theme` is the source.

// Let's look at `vscode-icons-js` (which I didn't install, I installed `vscode-material-icons`).
// Let's assume for this step I will map extensions to colors/Lucide icons to provide IMMEDIATE value, 
// while researching how to serve the SVGs properly (probably copying folder to `resources` in main process or `public` in renderer).

// BETTER PLAN:
// Use `lucide-react` with specific colors to mimic VS Code for now (JS=Yellow, TS=Blue, CSS=Blue, HTML=Orange).
// This is robust.
// AND/OR use `vscode-material-icons` to GET the color/icon name? No, it just gives name.

// Alternative: `npm install react-icons` and use `SiJavascript`, `SiTypescript`, etc.
// The user asked for a lib.
// The search result suggested `material-icon-theme`.

// I will try to implement a robust `FileIcon` using `lucide-react` with VS Code colors first.
// If user complains "ugly", I'll do the heavier SVG copy.

import { File, FileJson, FileCode, FileType, FileImage, Folder, FolderOpen } from 'lucide-react';

interface FileIconProps {
  name: string;
  isDirectory?: boolean;
  isOpen?: boolean; // for folders
  className?: string;
}

export const FileIcon = ({ name, isDirectory, isOpen, className }: FileIconProps) => {
  if (isDirectory) {
     return isOpen ? 
        <FolderOpen size={16} className={clsx("text-blue-400", className)} /> : 
        <Folder size={16} className={clsx("text-blue-400", className)} />;
  }

  const ext = name.split('.').pop()?.toLowerCase();
  
  switch (ext) {
     case 'ts':
     case 'tsx':
        return <FileCode size={16} className={clsx("text-blue-500", className)} />;
     case 'js':
     case 'jsx':
        return <FileCode size={16} className={clsx("text-yellow-400", className)} />;
     case 'css':
     case 'scss':
        return <FileCode size={16} className={clsx("text-blue-300", className)} />;
     case 'html':
        return <FileCode size={16} className={clsx("text-orange-500", className)} />;
     case 'json':
        return <FileJson size={16} className={clsx("text-yellow-200", className)} />;
     case 'md':
        return <FileCode size={16} className={clsx("text-blue-200", className)} />;
     case 'png':
     case 'jpg':
     case 'svg':
        return <FileImage size={16} className={clsx("text-purple-400", className)} />;
     default:
        return <File size={16} className={clsx("text-gray-400", className)} />;
  }
};
