$ErrorActionPreference = 'Stop'
Write-Output '--- Checking Java ---'
if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
  Write-Output 'Java not found. Attempting to install Temurin JDK via winget...'
  winget install --accept-package-agreements --accept-source-agreements Eclipse.Temurin.JDK -e
} else { java -version }

Write-Output '--- Checking Graphviz (dot) ---'
if (-not (Get-Command dot -ErrorAction SilentlyContinue)) {
  Write-Output 'Graphviz not found. Attempting to install Graphviz via winget...'
  winget install --accept-package-agreements --accept-source-agreements Graphviz.Graphviz -e
} else { & dot -V }

$dir = 'd:\GITHUB\Dormitory_Graduation\\.plantuml'
New-Item -Path $dir -ItemType Directory -Force | Out-Null
$jar = Join-Path $dir 'plantuml.jar'
if (-not (Test-Path $jar)) {
  Write-Output 'Downloading plantuml.jar...'
  Invoke-WebRequest -Uri 'https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar' -UseBasicParsing -OutFile $jar
} else {
  Write-Output 'plantuml.jar already exists.'
}

$puml = 'd:\GITHUB\Dormitory_Graduation\DATN_WRITE\diagrams\usecase_registration.puml'
$outDir = 'd:\GITHUB\Dormitory_Graduation\DATN_WRITE\diagrams'
if (-not (Test-Path $puml)) {
  Write-Error "PUML file not found: $puml"
  exit 1
}

Write-Output "Rendering $puml to PNG..."
java -jar $jar -tpng -charset UTF-8 $puml -o $outDir
Write-Output 'Rendering complete.'
Write-Output "Output directory: $outDir"
