param([int]$Limit=8,[string]$Stores='',[switch]$IndexOnly,[switch]$KnownOnly)
$ErrorActionPreference='Stop'
$taskRoot=Split-Path $PSScriptRoot -Parent
Set-Location -LiteralPath $taskRoot
$secretPath=Join-Path $taskRoot 'work/catalogue-b/ingest-secret.dpapi'
if(Test-Path -LiteralPath $secretPath){
 $protected=(Get-Content -LiteralPath $secretPath -Raw).Trim() | ConvertTo-SecureString
 $credential=New-Object System.Management.Automation.PSCredential('collector',$protected)
 $env:CATALOG_INGEST_SECRET=$credential.GetNetworkCredential().Password
}
try{
 $argsList=@('node_modules/tsx/dist/cli.mjs','scripts/catalogue-b.ts',"--limit=$Limit")
 if(!$IndexOnly){$argsList+='--collect'}
 if($Stores){$argsList+="--stores=$Stores"}
 if($KnownOnly){$argsList+='--known-only'}
 & node @argsList
 if($LASTEXITCODE -ne 0){throw 'Fiyat toplayıcı tamamlanamadı; kayıtlar korunuyor.'}
}finally{Remove-Item Env:\CATALOG_INGEST_SECRET -ErrorAction SilentlyContinue}
