# Automated MongoDB Installer and GlideChat Startup Script

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "GlideChat - Auto Database Installer & Startup System" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

# 1. Wait for BITS download to complete
$job = Get-BitsTransfer | Where-Object { $_.DisplayName -eq "BITS Transfer" -or $_.DisplayName -eq "BITS Transfer" }
if ($job) {
    Write-Host "Active MongoDB download job found (Progress: $([math]::Round(($job.BytesTransferred / $job.BytesTotal) * 100))%)." -ForegroundColor Yellow
    Write-Host "Waiting for download to finish in background..." -ForegroundColor Yellow
    try {
        $job | Wait-BitsTransfer
        $job | Complete-BitsTransfer
        Write-Host "Download complete!" -ForegroundColor Green
    } catch {
        Write-Host "BITS transfer encountered an issue or completed already." -ForegroundColor Red
    }
}

# 2. Silently install MongoDB
if (Test-Path "E:\mongodb-installer.msi") {
    Write-Host "MongoDB Installer found. Starting silent installation (Please click 'Yes' if UAC prompt appears)..." -ForegroundColor Yellow
    
    $installArgs = '/i "E:\mongodb-installer.msi" /quiet /qn /norestart'
    $process = Start-Process msiexec.exe -ArgumentList $installArgs -Wait -PassThru -NoNewWindow
    
    if ($process.ExitCode -eq 0 -or $process.ExitCode -eq 3010) {
        Write-Host "MongoDB installed successfully!" -ForegroundColor Green
    } else {
        Write-Host "Installation completed with exit code: $($process.ExitCode). Trying to configure service..." -ForegroundColor Yellow
    }
    
    # 3. Create database folder if running manually, start service
    New-Item -Path "C:\data\db" -ItemType Directory -Force -ErrorAction SilentlyContinue | Out-Null
    
    Write-Host "Checking MongoDB service status..." -ForegroundColor Yellow
    $service = Get-Service -Name MongoDB -ErrorAction SilentlyContinue
    if ($service) {
        if ($service.Status -ne 'Running') {
            Start-Service -Name MongoDB
            Write-Host "MongoDB service started!" -ForegroundColor Green
        } else {
            Write-Host "MongoDB service is already running." -ForegroundColor Green
        }
    } else {
        Write-Host "Service not found. Attempting to start MongoDB process directly..." -ForegroundColor Yellow
        $mongodPath = "C:\Program Files\MongoDB\Server\7.0\bin\mongod.exe"
        if (Test-Path $mongodPath) {
            Start-Process $mongodPath -ArgumentList "--dbpath C:\data\db" -NoNewWindow
            Write-Host "MongoDB daemon started manually!" -ForegroundColor Green
        } else {
            Write-Host "Could not locate mongod.exe. Please start MongoDB manually." -ForegroundColor Red
        }
    }
    
    # 4. Verify connection and start server
    Start-Sleep -Seconds 5
    Write-Host "Verifying database connection..." -ForegroundColor Yellow
    node test_mongo.js
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Database verified! Starting GlideChat Server..." -ForegroundColor Green
        npm start
    } else {
        Write-Host "Database verification failed. Please check if MongoDB is running." -ForegroundColor Red
    }
} else {
    Write-Host "Error: MongoDB installer 'E:\mongodb-installer.msi' not found. Please verify the download completed." -ForegroundColor Red
}
