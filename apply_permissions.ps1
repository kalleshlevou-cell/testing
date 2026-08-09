[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$secret = 'oD:Vs!yDpYbb07(KVf_-j:yzbCoW!G$d'
$metaUrl = 'https://tnpbzdizermlvqxpyqrh.hasura.ap-south-1.nhost.run/v1/metadata'
$headers = @{ 'x-hasura-admin-secret' = $secret; 'Content-Type' = 'application/json' }

$bulk = @'
{
  "type": "bulk",
  "args": [
    {"type":"pg_create_select_permission","args":{"source":"default","table":{"schema":"public","name":"organizations"},"role":"user","permission":{"columns":["id","name","quota_calls_used","quota_calls_allowed","quota_period_start","created_at","updated_at"],"filter":{"id":{"_in":{"_select":{"table":{"schema":"public","name":"org_members"},"columns":["org_id"],"where":{"user_id":{"_eq":"X-Hasura-User-Id"}}}}}}}}},
    {"type":"pg_create_select_permission","args":{"source":"default","table":{"schema":"public","name":"org_members"},"role":"user","permission":{"columns":["id","org_id","user_id","role","created_at"],"filter":{"user_id":{"_eq":"X-Hasura-User-Id"}}}}},
    {"type":"pg_create_select_permission","args":{"source":"default","table":{"schema":"public","name":"workflows"},"role":"user","permission":{"columns":["id","org_id","name","description","is_active","created_by","created_at","updated_at"],"filter":{"org_id":{"_in":{"_select":{"table":{"schema":"public","name":"org_members"},"columns":["org_id"],"where":{"user_id":{"_eq":"X-Hasura-User-Id"}}}}}}}}},
    {"type":"pg_create_insert_permission","args":{"source":"default","table":{"schema":"public","name":"workflows"},"role":"user","permission":{"columns":["org_id","name","description","is_active","created_by"],"check":{"org_id":{"_in":{"_select":{"table":{"schema":"public","name":"org_members"},"columns":["org_id"],"where":{"_and":[{"user_id":{"_eq":"X-Hasura-User-Id"}},{"role":{"_in":["owner","editor"]}}]}}}}},"set":{"created_by":"X-Hasura-User-Id"}}}},
    {"type":"pg_create_update_permission","args":{"source":"default","table":{"schema":"public","name":"workflows"},"role":"user","permission":{"columns":["name","description","is_active"],"filter":{"org_id":{"_in":{"_select":{"table":{"schema":"public","name":"org_members"},"columns":["org_id"],"where":{"_and":[{"user_id":{"_eq":"X-Hasura-User-Id"}},{"role":{"_in":["owner","editor"]}}]}}}}},"check":{}}}},
    {"type":"pg_create_delete_permission","args":{"source":"default","table":{"schema":"public","name":"workflows"},"role":"user","permission":{"filter":{"org_id":{"_in":{"_select":{"table":{"schema":"public","name":"org_members"},"columns":["org_id"],"where":{"_and":[{"user_id":{"_eq":"X-Hasura-User-Id"}},{"role":{"_in":["owner"]}}]}}}}}}}},
    {"type":"pg_create_select_permission","args":{"source":"default","table":{"schema":"public","name":"workflow_steps"},"role":"user","permission":{"columns":["id","workflow_id","step_order","step_type","name","config","created_at","updated_at"],"filter":{"workflow":{"org_id":{"_in":{"_select":{"table":{"schema":"public","name":"org_members"},"columns":["org_id"],"where":{"user_id":{"_eq":"X-Hasura-User-Id"}}}}}}}}},
    {"type":"pg_create_insert_permission","args":{"source":"default","table":{"schema":"public","name":"workflow_steps"},"role":"user","permission":{"columns":["workflow_id","step_order","step_type","name","config"],"check":{"workflow":{"org_id":{"_in":{"_select":{"table":{"schema":"public","name":"org_members"},"columns":["org_id"],"where":{"_and":[{"user_id":{"_eq":"X-Hasura-User-Id"}},{"role":{"_in":["owner","editor"]}}]}}}}}}}}},
    {"type":"pg_create_update_permission","args":{"source":"default","table":{"schema":"public","name":"workflow_steps"},"role":"user","permission":{"columns":["step_order","step_type","name","config"],"filter":{"workflow":{"org_id":{"_in":{"_select":{"table":{"schema":"public","name":"org_members"},"columns":["org_id"],"where":{"_and":[{"user_id":{"_eq":"X-Hasura-User-Id"}},{"role":{"_in":["owner","editor"]}}]}}}}}},"check":{}}}},
    {"type":"pg_create_delete_permission","args":{"source":"default","table":{"schema":"public","name":"workflow_steps"},"role":"user","permission":{"filter":{"workflow":{"org_id":{"_in":{"_select":{"table":{"schema":"public","name":"org_members"},"columns":["org_id"],"where":{"_and":[{"user_id":{"_eq":"X-Hasura-User-Id"}},{"role":{"_in":["owner","editor"]}}]}}}}}}}}},
    {"type":"pg_create_select_permission","args":{"source":"default","table":{"schema":"public","name":"workflow_triggers"},"role":"user","permission":{"columns":["id","workflow_id","trigger_type","config","is_active","created_at"],"filter":{"workflow":{"org_id":{"_in":{"_select":{"table":{"schema":"public","name":"org_members"},"columns":["org_id"],"where":{"user_id":{"_eq":"X-Hasura-User-Id"}}}}}}}}},
    {"type":"pg_create_insert_permission","args":{"source":"default","table":{"schema":"public","name":"workflow_triggers"},"role":"user","permission":{"columns":["workflow_id","trigger_type","config","is_active"],"check":{"workflow":{"org_id":{"_in":{"_select":{"table":{"schema":"public","name":"org_members"},"columns":["org_id"],"where":{"_and":[{"user_id":{"_eq":"X-Hasura-User-Id"}},{"role":{"_in":["owner","editor"]}}]}}}}}}}}},
    {"type":"pg_create_update_permission","args":{"source":"default","table":{"schema":"public","name":"workflow_triggers"},"role":"user","permission":{"columns":["trigger_type","config","is_active"],"filter":{"workflow":{"org_id":{"_in":{"_select":{"table":{"schema":"public","name":"org_members"},"columns":["org_id"],"where":{"_and":[{"user_id":{"_eq":"X-Hasura-User-Id"}},{"role":{"_in":["owner","editor"]}}]}}}}}},"check":{}}}},
    {"type":"pg_create_delete_permission","args":{"source":"default","table":{"schema":"public","name":"workflow_triggers"},"role":"user","permission":{"filter":{"workflow":{"org_id":{"_in":{"_select":{"table":{"schema":"public","name":"org_members"},"columns":["org_id"],"where":{"_and":[{"user_id":{"_eq":"X-Hasura-User-Id"}},{"role":{"_in":["owner","editor"]}}]}}}}}}}}},
    {"type":"pg_create_select_permission","args":{"source":"default","table":{"schema":"public","name":"workflow_runs"},"role":"user","permission":{"columns":["id","workflow_id","triggered_by","trigger_type","status","started_at","completed_at","error","created_at"],"filter":{"workflow":{"org_id":{"_in":{"_select":{"table":{"schema":"public","name":"org_members"},"columns":["org_id"],"where":{"user_id":{"_eq":"X-Hasura-User-Id"}}}}}}}}},
    {"type":"pg_create_select_permission","args":{"source":"default","table":{"schema":"public","name":"step_runs"},"role":"user","permission":{"columns":["id","workflow_run_id","step_id","status","input","output","error","attempt_count","approved_by","approved_at","started_at","completed_at","created_at","updated_at"],"filter":{"workflow_run":{"workflow":{"org_id":{"_in":{"_select":{"table":{"schema":"public","name":"org_members"},"columns":["org_id"],"where":{"user_id":{"_eq":"X-Hasura-User-Id"}}}}}}}}}},
    {"type":"pg_create_select_permission","args":{"source":"default","table":{"schema":"public","name":"workflow_results"},"role":"user","permission":{"columns":["id","workflow_run_id","step_run_id","data","created_at"],"filter":{"workflow_run":{"workflow":{"org_id":{"_in":{"_select":{"table":{"schema":"public","name":"org_members"},"columns":["org_id"],"where":{"user_id":{"_eq":"X-Hasura-User-Id"}}}}}}}}}},
    {"type":"pg_create_insert_permission","args":{"source":"default","table":{"schema":"public","name":"org_members"},"role":"user","permission":{"columns":["org_id","user_id","role"],"check":{"org_id":{"_in":{"_select":{"table":{"schema":"public","name":"org_members"},"columns":["org_id"],"where":{"_and":[{"user_id":{"_eq":"X-Hasura-User-Id"}},{"role":{"_in":["owner"]}}]}}}}}}}},
    {"type":"pg_create_delete_permission","args":{"source":"default","table":{"schema":"public","name":"org_members"},"role":"user","permission":{"filter":{"org_id":{"_in":{"_select":{"table":{"schema":"public","name":"org_members"},"columns":["org_id"],"where":{"_and":[{"user_id":{"_eq":"X-Hasura-User-Id"}},{"role":{"_in":["owner"]}}]}}}}}}}}
  ]
}
'@

Write-Host "Sending bulk permissions request..."
$bytes = [System.Text.Encoding]::UTF8.GetBytes($bulk)
$req = [System.Net.WebRequest]::Create($metaUrl)
$req.Method = "POST"
$req.ContentType = "application/json"
$req.Headers.Add("x-hasura-admin-secret", $secret)
$req.ContentLength = $bytes.Length
$req.Timeout = 30000

$stream = $req.GetRequestStream()
$stream.Write($bytes, 0, $bytes.Length)
$stream.Close()

try {
  $resp = $req.GetResponse()
  $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
  $result = $reader.ReadToEnd()
  Write-Host "RESULT: $result"
} catch [System.Net.WebException] {
  if ($_.Exception.Response) {
    $errStream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($errStream)
    Write-Host "HTTP ERROR: $($reader.ReadToEnd())"
  } else {
    Write-Host "NET ERROR: $($_.Exception.Message)"
  }
} catch {
  Write-Host "ERROR: $($_.Exception.Message)"
}
