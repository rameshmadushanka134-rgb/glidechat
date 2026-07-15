# Portable MongoDB Runner and GlideChat Startup Script (No Admin Privileges Required)

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "GlideChat - Portable Database Startup System (Non-Admin)" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green

# 1. Wait for BITS download to complete
$job = Get-BitsTransfer | Where-Object { $_.DisplayName -eq "BITS Transfer" }
if ($job) {
    Write-Host "Active MongoDB ZIP download job found (Progress: $([math]::Round(($job.BytesTransferred / $job.BytesTotal) * 100))%)." -ForegroundColor Yellow
    Write-Host "Waiting for download to finish..." -ForegroundColor Yellow
    while ($job -and ($job.JobState -eq "Transferring" -or $job.JobState -eq "Connecting" -or $job.JobState -eq "Queued")) {
        Start-Sleep -Seconds 5
        $job = Get-BitsTransfer | Where-Object { $_.DisplayName -eq "BITS Transfer" }
        if ($job) {
            Write-Host "Downloading... $([math]::Round(($job.BytesTransferred / $job.BytesTotal) * 100))% ($([math]::Round($job.BytesTransferred / 1MB))MB / $([math]::Round($job.BytesTotal / 1MB))MB)" -ForegroundColor Yellow
        }
    }
    if ($job -and $job.JobState -eq "Transferred") {
        $job | Complete-BitsTransfer
        Write-Host "Download complete!" -ForegroundColor Green
    }
}

# 2. Extract ZIP Archive
$zipPath = "E:\mongodb.zip"
$extractPath = "E:\mongodb-portable"
$dataPath = "E:\mongodb-data"

if (Test-Path $zipPath) {
    if (-not (Test-Path $extractPath)) {
        Write-Host "Extracting MongoDB ZIP to $extractPath (This may take 1-2 minutes)..." -ForegroundColor Yellow
        New-Item -ItemType Directory -Force -Path $extractPath | Out-Null
        Expand-Archive -Path $zipPath -DestinationPath $extractPath -Force
        Write-Host "Extraction complete!" -ForegroundColor Green
    } else {
        Write-Host "MongoDB is already extracted." -ForegroundColor Green
    }
} else {
    Write-Host "Error: ZIP file not found at $zipPath" -ForegroundColor Red
    exit 1
}

# 3. Create database folder and launch mongod
New-Item -ItemType Directory -Force -Path $dataPath | Out-Null

$mongodPath = Get-ChildItem -Path "$extractPath" -Filter "mongod.exe" -Recurse | Select-Object -First 1 -ExpandProperty FullName

if ($mongodPath) {
    Write-Host "Starting portable MongoDB database engine from: $mongodPath" -ForegroundColor Yellow
    
    # Check if mongod is already running
    $existing = Get-Process -Name "mongod" -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "MongoDB database engine is already running." -ForegroundColor Green
    } else {
        Start-Process $mongodPath -ArgumentList "--dbpath `"$dataPath`"" -NoNewWindow
        Write-Host "MongoDB launched successfully!" -ForegroundColor Green
    }
    
    # 4. Verify connection and start server
    Start-Sleep -Seconds 5
    Write-Host "Verifying database connection..." -ForegroundColor Yellow
    node test_mongo.js
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Database verified! Starting GlideChat Server..." -ForegroundColor Green
        npm start
    } else {
        Write-Host "Database verification failed. Please check logs." -ForegroundColor Red
    }
} else {
    Write-Host "Error: Could not locate mongod.exe in the extracted folder." -ForegroundColor Red
}
