@echo off
cd /d "C:\Users\arjus\Desktop\mom_data\client"
set VITE_API_TARGET=http://localhost:3007
node "node_modules\vite\bin\vite.js" --host >> "%TEMP%\magdrive-client.log" 2>&1
