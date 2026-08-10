@echo off
set /p SECRET=<c:\Users\giris\Desktop\vocablles\secret.txt
curl -s -X POST "https://tnpbzdizermlvqxpyqrh.hasura.ap-south-1.nhost.run/v1/graphql" -H "Content-Type: application/json" -H "x-hasura-admin-secret: %SECRET%" -d "@c:\Users\giris\Desktop\vocablles\graphql_run_query.json"
