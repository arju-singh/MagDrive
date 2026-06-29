@echo off
cd /d "C:\Users\arjus\Desktop\mom_data\server"
set PORT=3007
node src\index.js >> "%TEMP%\magdrive-3007.log" 2>&1
