; Custom NSIS include for electron-builder (generated from src/config/app.ts via config:sync)
; Adds an uninstall choice: full uninstall (remove user data) or just uninstall (keep user data).

!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to completely remove all Deskapp data and settings as well?$\r$\n$\r$\nYes = Full uninstall (remove app data)$\r$\nNo = Just uninstall (keep your data/settings)" /SD IDNO IDNO keepData
    ; Full uninstall: remove Electron user data and common app data locations
    RMDir /r "$APPDATA\Deskapp"
    RMDir /r "$LOCALAPPDATA\Deskapp"
    RMDir /r "$APPDATA\deskapp"
    RMDir /r "$LOCALAPPDATA\deskapp"
    RMDir /r "$APPDATA\com.deskapp.app"
    RMDir /r "$LOCALAPPDATA\com.deskapp.app"
  keepData:
!macroend
