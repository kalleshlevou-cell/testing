@echo off
set /p SECRET=<c:\Users\giris\Desktop\vocablles\secret.txt
set URL=https://tnpbzdizermlvqxpyqrh.hasura.ap-south-1.nhost.run/v1/metadata

echo Applying Action Permissions...
curl -s -X POST "%URL%" -H "Content-Type: application/json" -H "x-hasura-admin-secret: %SECRET%" -d "@c:\Users\giris\Desktop\vocablles\apply_action_perms.json"
echo.
echo Done.
