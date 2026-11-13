# Phase 1 comparison runs of the Node and Rust alliance workers on Windows.
# Order: warm-up (Node, not measured), then Node->Rust, Rust->Node, Node->Rust.
# Method matches the Linux pre-comparison: start the worker, sample 15 s idle,
# queue:alliances, time from queueing to the first "queue completed" minus 5 s.
$ErrorActionPreference = 'Stop'
$Out     = 'C:\Users\EVE\killreport-spike'
$Backend = 'C:\Users\EVE\Projects\killreport\backend'
$RsExe   = 'C:\Users\EVE\Projects\killreport\backend-rs\target\release\worker-info-alliances.exe'
$Psql    = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
$Auth    = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes('guest:guest'))

$DbUrl = ((Get-Content "$Backend\.env" | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1) -replace '^DATABASE_URL=', '').Trim('"', "'")

# Progress goes to stdout only; the caller redirects it. A second writer on a
# file someone is tailing fails on Windows (the first attempt died that way).
function Say($m) { Write-Output "$(Get-Date -Format o) $m" }
function Queue($name) {
  $q = Invoke-RestMethod -Headers @{ Authorization = $Auth } "http://localhost:15672/api/queues/%2F/$name"
  [pscustomobject]@{ messages = [int]$q.messages; consumers = [int]$q.consumers }
}
function Descendants($rootId) {
  $all = Get-CimInstance Win32_Process
  $ids = @($rootId); $found = @()
  while ($ids.Count) {
    $kids = @($all | Where-Object { $ids -contains $_.ParentProcessId })
    $found += $kids; $ids = @($kids | ForEach-Object { $_.ProcessId })
  }
  $found
}

function Run($worker, $tag) {
  $log = "$Out\$tag.log"; $mem = "$Out\mem-$tag.csv"
  $main = Queue 'esi_alliance_info_queue'
  if ($main.messages -ne 0 -or $main.consumers -ne 0) { throw "[$tag] queue not empty or has consumers: $($main | ConvertTo-Json -Compress)" }

  Say "[$tag] starting $worker worker"
  $cmd = if ($worker -eq 'node') { 'yarn worker:info:alliances' } else { "`"$RsExe`"" }
  # Outer quotes: cmd /c strips the first and last quote of a line that starts
  # with one, which broke the quoted Rust path on the first attempt.
  $root = Start-Process cmd.exe -ArgumentList '/c', "`"$cmd > `"$log`" 2>&1`"" -WorkingDirectory $Backend -WindowStyle Hidden -PassThru
  $t = 0
  while (-not ((Test-Path $log) -and (Select-String -Path $log -SimpleMatch 'waiting for alliances' -Quiet))) {
    Start-Sleep 1; $t++; if ($t -gt 120) { throw "[$tag] worker did not become ready" }
  }
  $tree = Descendants $root.Id
  $mainProc = if ($worker -eq 'node') {
    $tree | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'preflight' -and $_.CommandLine -match 'worker-info-alliances' } | Select-Object -First 1
  } else {
    $tree | Where-Object { $_.Name -eq 'worker-info-alliances.exe' } | Select-Object -First 1
  }
  if (-not $mainProc) { throw "[$tag] worker process not found" }
  $mainId = $mainProc.ProcessId
  $treeIds = @($tree | ForEach-Object { $_.ProcessId })
  Say "[$tag] ready after ${t}s; worker pid $mainId; tree: $(($tree | ForEach-Object { "$($_.Name):$($_.ProcessId)" }) -join ' ')"

  $sampler = Start-Job -ArgumentList $mainId, $treeIds, $mem -ScriptBlock {
    param($mainId, $treeIds, $mem)
    'phase_t,t,ws_bytes,private_bytes,tree_ws_bytes,tree_private_bytes,tree_procs' | Set-Content $mem
    $start = Get-Date
    while (Get-Process -Id $mainId -ErrorAction SilentlyContinue) {
      $m = Get-Process -Id $mainId -ErrorAction SilentlyContinue
      $g = @(Get-Process -Id $treeIds -ErrorAction SilentlyContinue)
      $ws = ($g | Measure-Object WorkingSet64 -Sum).Sum; $pm = ($g | Measure-Object PrivateMemorySize64 -Sum).Sum
      "{0},{1},{2},{3},{4},{5},{6}" -f [int]((Get-Date) - $start).TotalSeconds, (Get-Date -Format o), $m.WorkingSet64, $m.PrivateMemorySize64, $ws, $pm, $g.Count | Add-Content $mem
      Start-Sleep 5
    }
  }
  Start-Sleep 15   # idle samples

  Say "[$tag] queueing alliances"
  $t0 = Get-Date
  Push-Location $Backend
  cmd.exe /c "yarn queue:alliances > `"$Out\queue-$tag.log`" 2>&1"
  Pop-Location
  Say "[$tag] queued in $([int]((Get-Date) - $t0).TotalSeconds)s"

  $deadline = (Get-Date).AddMinutes(40)
  while (-not (Select-String -Path $log -SimpleMatch 'queue completed' -Quiet)) {
    Start-Sleep 1; if ((Get-Date) -gt $deadline) { throw "[$tag] did not drain in 40 min" }
  }
  $secs = [math]::Round(((Get-Date) - $t0).TotalSeconds - 5, 1)
  $final = (Select-String -Path $log -SimpleMatch 'final:' | Select-Object -First 1).Line
  Say "[$tag] drained after $secs s (minus the 5 s quiet window) | $final"

  Start-Sleep 6   # one more memory sample after the drain
  & taskkill.exe /T /F /PID $root.Id | Out-Null
  Stop-Job $sampler -ErrorAction SilentlyContinue; Remove-Job $sampler -Force -ErrorAction SilentlyContinue

  & $Psql $DbUrl -qc "\copy (SELECT id, name, ticker, date_founded, creator_corporation_id, creator_id, executor_corporation_id, faction_id FROM alliances ORDER BY id) TO '$Out\alliances-$tag.csv' WITH CSV HEADER"
  $rows = (Get-Content "$Out\alliances-$tag.csv").Count - 1
  $m = Queue 'esi_alliance_info_queue'; $w = Queue 'killreport.wait'; $p = Queue 'killreport.parking'
  Say "[$tag] rows $rows; queues after: main $($m.messages)/$($m.consumers)c, wait $($w.messages), parking $($p.messages)"
  Add-Content "$Out\durations.csv" "$tag,$secs"
  Start-Sleep 10
}

# Optional first argument: the tag to resume from (e.g. rs-1).
$plan = @('warmup-node', 'node-1', 'rs-1', 'rs-2', 'node-2', 'node-3', 'rs-3')
$from = if ($args.Count) { [array]::IndexOf($plan, $args[0]) } else { 0 }
if ($from -lt 0) { throw "unknown tag $($args[0])" }
if ($from -eq 0) { 'tag,seconds' | Set-Content "$Out\durations.csv" }
Say "=== start at $($plan[$from])"
foreach ($tag in $plan[$from..($plan.Count - 1)]) { Run ($tag -replace '-.*$', '' -replace 'warmup', 'node') $tag }
Say "=== DONE"
