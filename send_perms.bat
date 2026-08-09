@echo off
set /p SECRET=<c:\Users\giris\Desktop\vocablles\secret.txt
set URL=https://tnpbzdizermlvqxpyqrh.hasura.ap-south-1.nhost.run/v1/metadata

echo workflow_steps select...
curl -s -X POST "%URL%" -H "Content-Type: application/json" -H "x-hasura-admin-secret: %SECRET%" -d "@c:/Users/giris/Desktop/vocablles/p1.json"
echo.

echo workflow_steps insert...
curl -s -X POST "%URL%" -H "Content-Type: application/json" -H "x-hasura-admin-secret: %SECRET%" -d "@c:/Users/giris/Desktop/vocablles/p2.json"
echo.

echo workflow_triggers select...
curl -s -X POST "%URL%" -H "Content-Type: application/json" -H "x-hasura-admin-secret: %SECRET%" -d "@c:/Users/giris/Desktop/vocablles/p3.json"
echo.

echo workflow_triggers insert...
curl -s -X POST "%URL%" -H "Content-Type: application/json" -H "x-hasura-admin-secret: %SECRET%" -d "@c:/Users/giris/Desktop/vocablles/p4.json"
echo.

echo workflow_runs select...
curl -s -X POST "%URL%" -H "Content-Type: application/json" -H "x-hasura-admin-secret: %SECRET%" -d "@c:/Users/giris/Desktop/vocablles/p5.json"
echo.

echo step_runs select...
curl -s -X POST "%URL%" -H "Content-Type: application/json" -H "x-hasura-admin-secret: %SECRET%" -d "@c:/Users/giris/Desktop/vocablles/p6.json"
echo.

echo ALL DONE
pause
