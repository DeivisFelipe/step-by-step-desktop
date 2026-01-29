import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/logo.png?asset'
import * as fs from 'fs'
import { spawn } from 'child_process';
// import * as pty from 'node-pty' // Loaded dynamically
import os from 'os'

// Terminal map
const terminals: Record<string, any> = {};

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC Handlers
  setupIpcHandlers();

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function setupIpcHandlers() {
  // --- File System ---
  
  ipcMain.handle('file:open-folder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });
    if (canceled) return null;
    return filePaths[0];
  });

  ipcMain.handle('file:read-dir', async (_, path: string) => {
     try {
       const dirents = await fs.promises.readdir(path, { withFileTypes: true });
       return dirents.map(d => ({
         name: d.name,
         isDirectory: d.isDirectory(),
         path: join(path, d.name)
       }));
     } catch (e) {
       console.error(e);
       return [];
     }
  });

  ipcMain.handle('file:read', async (_, path: string) => {
    try {
      return await fs.promises.readFile(path, 'utf-8');
    } catch (e) {
      console.error(e);
      throw e;
    }
  });

  ipcMain.handle('file:write', async (_, path: string, content: string) => {
     try {
       await fs.promises.writeFile(path, content, 'utf-8');
     } catch (e) {
       console.error(e);
       throw e;
     }
  });

  ipcMain.handle('file:create-dir', async (_, path: string) => {
    await fs.promises.mkdir(path, { recursive: true });
  });

  ipcMain.handle('file:delete', async (_, path: string) => {
    await fs.promises.rm(path, { recursive: true, force: true });
  });

  ipcMain.handle('file:rename', async (_, oldPath: string, newPath: string) => {
    await fs.promises.rename(oldPath, newPath);
  });

  // --- Terminal ---
  
// (Removed nested import)

let pty: any;
try {
  pty = require('node-pty');
} catch (e) {
  console.warn('node-pty not found, falling back to child_process.spawn');
}

// ... (other handlers)

  ipcMain.handle('terminal:get-shells', async () => {
     const shells: string[] = [];
     if (os.platform() === 'win32') {
        const potentialShells = [
           'powershell.exe',
           'cmd.exe',
           'C:\\Program Files\\Git\\bin\\bash.exe',
           'C:\\Windows\\System32\\wsl.exe'
        ];
        
        for (const s of potentialShells) {
           // Simple check if it exists or is in path (for just filename)
           if (s.includes('\\')) {
              if (fs.existsSync(s)) shells.push(s);
           } else {
              shells.push(s); // Assume basics exist
           }
        }
     } else {
        shells.push('/bin/bash', '/bin/zsh');
     }
     return shells;
  });

  ipcMain.on('terminal:create', (event, options?: { shell?: string; cwd?: string }) => {
    let shell = options?.shell;
    
    if (!shell) {
        shell = os.platform() === 'win32' ? 'powershell.exe' : 'bash';
    }
    
    const cwd = options?.cwd || process.env.HOME || process.cwd();
    
    // Cleanup existing default
    if (terminals['default']) {
       try {
         // @ts-ignore
         const oldInfo = terminals['default'];
         if (typeof oldInfo.kill === 'function') oldInfo.kill();
         delete terminals['default'];
       } catch (e) {
          console.error("Failed to kill terminal", e);
       }
    }
    
    if (pty) {
        const ptyProcess = pty.spawn(shell, [], {
          name: 'xterm-color',
          cols: 80,
          rows: 30,
          cwd: cwd,
          env: process.env
        });

        terminals['default'] = ptyProcess;

        ptyProcess.onData((data: string) => {
           event.sender.send('terminal:data', data);
        });
        
        ptyProcess.onExit(({ exitCode, signal }) => {
            event.sender.send('terminal:data', `\r\n[Process exited with code ${exitCode}]`);
        });
    } else {
        // Fallback using simple spawn
        const cp = spawn(shell, [], {
            cwd: process.env.HOME || process.cwd(),
            env: process.env,
            shell: true
        });
        
        terminals['default'] = cp as any;
        
        cp.stdout?.on('data', (data) => {
             event.sender.send('terminal:data', data.toString());
        });
        cp.stderr?.on('data', (data) => {
             event.sender.send('terminal:data', data.toString());
        });
        
        cp.on('exit', (code) => {
            event.sender.send('terminal:data', `\r\n[Process exited with code ${code}]`);
            delete terminals['default'];
        });
    }
  });

  ipcMain.on('terminal:input', (_, data) => {
     const proc = terminals['default'];
     if (proc) {
        // pty write or stdin write
        if (typeof proc.write === 'function') {
            proc.write(data);
        } else {
            (proc as any).stdin?.write(data);
        }
     }
  });

  ipcMain.on('terminal:resize', (_, { cols, rows }) => {
    const proc = terminals['default'];
    if (proc && typeof proc.resize === 'function') {
       proc.resize(cols, rows);
    }
  });
}
