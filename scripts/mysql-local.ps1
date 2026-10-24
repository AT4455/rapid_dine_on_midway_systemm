# Rapid Dine — isolated local MySQL 8 helper (Windows / PowerShell)
#
# Creates a project-local MySQL data directory on port 3307 so you can run the
# demo without touching an existing MySQL service or knowing its root password.
#
# Usage:
#   npm run db:local:init     # first run: initialise + start + create schema
#   npm run db:local:start
#   npm run db:local:stop
#
# Override the MySQL install or port:
#   $env:MYSQL_HOME="C:\Program Files\MySQL\MySQL Server 8.0"; $env:MYSQL_PORT="3307"

param(
  [Parameter(Position = 0)]
  [ValidateSet("init", "start", "stop", "status")]
  [string]$Action = "start"
)

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$DataRoot = Join-Path $ProjectRoot ".mysql"
$DataDir = Join-Path $DataRoot "data"
$LogFile = Join-Path $DataRoot "mysqld.log"
$PidFile = Join-Path $DataRoot "mysqld.pid"
$ConfigFile = Join-Path $DataRoot "my.ini"

$Port = if ($env:MYSQL_PORT) { [int]$env:MYSQL_PORT } else { 3307 }

function Find-MySqlHome {
  if ($env:MYSQL_HOME -and (Test-Path (Join-Path $env:MYSQL_HOME "bin\mysqld.exe"))) {
    return $env:MYSQL_HOME
  }
  $candidates = @(
    "C:\Program Files\MySQL\MySQL Server 8.0",
    "C:\Program Files\MySQL\MySQL Server 8.4",
    "C:\Program Files\MySQL\MySQL Server 9.0",
    "C:\Program Files\MariaDB 11.4"
  )
  foreach ($candidate in $candidates) {
    if (Test-Path (Join-Path $candidate "bin\mysqld.exe")) { return $candidate }
  }
  $cmd = Get-Command mysqld -ErrorAction SilentlyContinue
  if ($cmd) { return (Split-Path -Parent (Split-Path -Parent $cmd.Source)) }
  throw "MySQL/MariaDB server not found. Install MySQL 8 or set MYSQL_HOME."
}

$MySqlHome = Find-MySqlHome
$MySqld = Join-Path $MySqlHome "bin\mysqld.exe"
$MySql = Join-Path $MySqlHome "bin\mysql.exe"
$MySqlAdmin = Join-Path $MySqlHome "bin\mysqladmin.exe"

function Test-Port {
  param([int]$PortNumber)
  try {
    $client = New-Object System.Net.Sockets.TcpClient
    $client.Connect("127.0.0.1", $PortNumber)
    $client.Close()
    return $true
  } catch {
    return $false
  }
}

function Write-Config {
  $dataDirIni = $DataDir.Replace("\", "/")
  $baseDirIni = $MySqlHome.Replace("\", "/")
  @"
[mysqld]
port=$Port
bind-address=127.0.0.1
datadir=$dataDirIni
basedir=$baseDirIni
mysqlx=0
character-set-server=utf8mb4
collation-server=utf8mb4_unicode_ci
log-error=$($LogFile.Replace("\", "/"))
pid-file=$($PidFile.Replace("\", "/"))
[client]
port=$Port
host=127.0.0.1
"@ | Set-Content -Path $ConfigFile -Encoding ASCII
}

function Initialize-Data {
  if (Test-Path (Join-Path $DataDir "mysql")) {
    Write-Host "MySQL data directory already initialised: $DataDir"
    return
  }
  New-Item -ItemType Directory -Force -Path $DataRoot | Out-Null
  New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
  Write-Host "Initialising MySQL data directory at $DataDir ..."
  & $MySqld --defaults-file=$ConfigFile --initialize-insecure
  if ($LASTEXITCODE -ne 0) { throw "mysqld --initialize-insecure failed. See $LogFile" }
  Write-Host "Initialised. Local root user has no password (port $Port, loopback only)."
}

function Start-Local {
  if (Test-Port $Port) {
    Write-Host "A server is already listening on 127.0.0.1:$Port."
    return
  }
  if (-not (Test-Path $ConfigFile)) { Write-Config }
  if (-not (Test-Path (Join-Path $DataDir "mysql"))) { Initialize-Data }
  Write-Host "Starting local MySQL on 127.0.0.1:$Port ..."
  $quotedConfig = '"' + $ConfigFile + '"'
  $proc = Start-Process -FilePath $MySqld -ArgumentList "--defaults-file=$quotedConfig" -WindowStyle Hidden -PassThru
  $proc.Id | Set-Content $PidFile
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    if (Test-Port $Port) {
      Write-Host "MySQL is ready. DATABASE_URL=`"mysql://root@127.0.0.1:$Port/rapiddine`""
      return
    }
  }
  throw "MySQL did not start in time. Check $LogFile"
}

function Ensure-Database {
  & $MySql -u root -h 127.0.0.1 -P $Port -e "CREATE DATABASE IF NOT EXISTS rapiddine CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not create the rapiddine database. Is the server running on port $Port?" }
  Write-Host "Database 'rapiddine' is ready."
}

function Stop-Local {
  if (-not (Test-Port $Port)) {
    Write-Host "No server is listening on port $Port."
    return
  }
  Write-Host "Stopping local MySQL on port $Port ..."
  & $MySqlAdmin -u root -h 127.0.0.1 -P $Port shutdown 2>&1 | Out-Null
  Start-Sleep -Seconds 2
  Write-Host "Stopped."
}

switch ($Action) {
  "init" {
    if (-not (Test-Path $ConfigFile)) {
      New-Item -ItemType Directory -Force -Path $DataRoot | Out-Null
      Write-Config
    }
    Initialize-Data
    Start-Local
    Ensure-Database
  }
  "start" {
    Start-Local
    Ensure-Database
  }
  "stop" { Stop-Local }
  "status" {
    if (Test-Port $Port) { Write-Host "MySQL is running on 127.0.0.1:$Port." } else { Write-Host "MySQL is not running on port $Port." }
  }
}
