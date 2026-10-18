# setup.ps1 - Автоматическая установка окружения для AI-сервиса
# Запуск: .\setup.ps1
# При необходимости обойти политику выполнения:
#   powershell -ExecutionPolicy Bypass -File .\setup.ps1

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

function Step($n, $t, $msg) { Write-Host "`n[$n/$t] $msg" -ForegroundColor Cyan }
function Ok($msg)           { Write-Host "  OK: $msg" -ForegroundColor Green }
function Warn($msg)         { Write-Host "  WARN: $msg" -ForegroundColor Yellow }
function Fail($msg)         { Write-Host "  FAIL: $msg" -ForegroundColor Red }

Write-Host "=== AI Service Setup ===" -ForegroundColor Magenta

# =====================================================================
# 1/7 Очистка конфигурации pip (убираем pypi.ngc.nvidia.com)
# =====================================================================
Step 1 7 "Очистка конфигурации pip"

foreach ($path in @("$env:APPDATA\pip\pip.ini", "$env:LOCALAPPDATA\pip\pip.ini", "C:\ProgramData\pip\pip.ini")) {
    if (Test-Path $path) {
        $content = Get-Content $path -Raw -ErrorAction SilentlyContinue
        if ($content -match 'ngc\.nvidia\.com') {
            Write-Host "  Удаляю: $path"
            Remove-Item $path -Force
        }
    }
}
foreach ($var in @('PIP_EXTRA_INDEX_URL', 'PIP_INDEX_URL', 'PIP_TRUSTED_HOST')) {
    foreach ($scope in @('User', 'Machine')) {
        $val = [System.Environment]::GetEnvironmentVariable($var, $scope)
        if ($val -match 'ngc\.nvidia\.com') {
            Write-Host "  Удаляю env var ($scope): $var"
            [System.Environment]::SetEnvironmentVariable($var, $null, $scope)
        }
    }
    Remove-Item "Env:$var" -ErrorAction SilentlyContinue
}
Ok "pip конфигурация очищена"

# =====================================================================
# 2/7 PyTorch с CUDA 12.8
# =====================================================================
Step 2 7 "PyTorch (CUDA 12.8)"

$torchCheck = poetry run python -c "import torch; print(torch.__version__)" 2>&1
if ($LASTEXITCODE -eq 0 -and "$torchCheck" -match 'cu128') {
    Ok "уже установлен: $torchCheck"
} else {
    Write-Host "  Устанавливаю torch 2.9.1+cu128 ..."
    poetry run pip install torch==2.9.1+cu128 torchvision==0.24.1+cu128 torchaudio==2.9.1+cu128 --index-url https://download.pytorch.org/whl/cu128
    if ($LASTEXITCODE -ne 0) { throw "PyTorch: установка провалилась" }
    Ok "PyTorch установлен"
}

$cudaOK = poetry run python -c "import torch; print(torch.cuda.is_available())"
if ("$cudaOK".Trim() -eq "True") {
    $dev = poetry run python -c "import torch; print(torch.cuda.get_device_name(0))"
    Ok "CUDA доступен. Устройство: $dev"
} else {
    Warn "CUDA недоступен. Проверьте драйвер NVIDIA (нужен 570+)."
}

# =====================================================================
# 3/7 safetensors
# =====================================================================
Step 3 7 "safetensors"

$stCheck = poetry run python -c "import safetensors; print(safetensors.__version__)" 2>&1
if ($LASTEXITCODE -eq 0) {
    Ok "уже установлен: $stCheck"
} else {
    poetry run pip install "safetensors>=0.6.2" --upgrade
    if ($LASTEXITCODE -ne 0) { throw "safetensors: установка провалилась" }
    Ok "safetensors установлен"
}

# =====================================================================
# 4/7 basicsr с патчами (проблемы Python 3.13+ и torchvision 0.17+)
# =====================================================================
Step 4 7 "basicsr (с патчами)"

$bsrCheck = poetry run python -c "import basicsr; print(basicsr.__version__)" 2>&1
if ($LASTEXITCODE -eq 0) {
    Ok "уже установлен: $bsrCheck"
} else {
    $srcDir = Join-Path $ProjectRoot "BasicSR-src"
    if (-not (Test-Path $srcDir)) {
        Write-Host "  Клонирую BasicSR ..."
        git clone --depth 1 https://github.com/XPixelGroup/BasicSR.git $srcDir
        if ($LASTEXITCODE -ne 0) { throw "git clone провалился. Установлен ли git?" }
    }

    # Патч 1: setup.py — KeyError: '__version__' (PEP 667 в Python 3.13+)
    $setupPy = Join-Path $srcDir "setup.py"
    $setupContent = Get-Content $setupPy -Raw
    if ($setupContent -notmatch 'version_ns') {
        Write-Host "  Патчу setup.py (совместимость с Python 3.13+) ..."
        $setupContent = $setupContent -replace `
            "exec\(compile\(f\.read\(\), version_file, 'exec'\)\)", `
            "version_ns = {}`n        exec(compile(f.read(), version_file, 'exec'), version_ns)"
        $setupContent = $setupContent -replace `
            "return locals\(\)\['__version__'\]", `
            "return version_ns['__version__']"
        Set-Content $setupPy $setupContent -NoNewline
        Ok "setup.py пропатчен"
    } else {
        Ok "setup.py уже пропатчен"
    }

    # Установка без C++ расширений
    $env:BASICSR_EXT = "False"
    Push-Location $srcDir
    try {
        poetry run pip install . --no-build-isolation
        if ($LASTEXITCODE -ne 0) { throw "basicsr: установка провалилась" }
    } finally {
        Pop-Location
        Remove-Item Env:BASICSR_EXT -ErrorAction SilentlyContinue
    }
    Ok "basicsr установлен"
}

# Патч 2: degradations.py — удалённый functional_tensor в torchvision 0.17+
$degrPath = (poetry run python -c "import basicsr, os; print(os.path.join(os.path.dirname(basicsr.__file__), 'data', 'degradations.py'))" 2>&1) | Out-String
$degrPath = $degrPath.Trim()
if (Test-Path $degrPath) {
    $degrContent = Get-Content $degrPath -Raw
    if ($degrContent -match 'functional_tensor') {
        Write-Host "  Патчу degradations.py (torchvision 0.17+) ..."
        $degrContent = $degrContent -replace `
            'from torchvision\.transforms\.functional_tensor import rgb_to_grayscale', `
            'from torchvision.transforms.functional import rgb_to_grayscale'
        Set-Content $degrPath $degrContent -NoNewline
        Ok "degradations.py пропатчен"
    } else {
        Ok "degradations.py уже пропатчен"
    }
}

# =====================================================================
# 5/7 realesrgan
# =====================================================================
Step 5 7 "realesrgan"

$rerCheck = poetry run python -c "import realesrgan; print(realesrgan.__version__)" 2>&1
if ($LASTEXITCODE -eq 0) {
    Ok "уже установлен: $rerCheck"
} else {
    poetry run pip install realesrgan==0.3.0
    if ($LASTEXITCODE -ne 0) { throw "realesrgan: установка провалилась" }
    Ok "realesrgan установлен"
}

# =====================================================================
# 6/7 Веса моделей
# =====================================================================
Step 6 7 "Скачивание весов моделей"

$wRealesrgan = Join-Path $ProjectRoot "weights\realesrgan"
$wRife       = Join-Path $ProjectRoot "weights\rife"
New-Item -ItemType Directory -Force -Path $wRealesrgan | Out-Null
New-Item -ItemType Directory -Force -Path $wRife       | Out-Null

function Get-File($url, $path, $minBytes) {
    $name = Split-Path $path -Leaf
    if ((Test-Path $path) -and ((Get-Item $path).Length -ge $minBytes)) {
        Ok "$name уже скачан"
        return
    }
    Write-Host "  Скачиваю $name ..."
    try {
        Invoke-WebRequest -Uri $url -OutFile $path -UseBasicParsing
        $len = (Get-Item $path).Length
        if ($len -lt $minBytes) { throw "файл слишком мал ($len B) — вероятно, HTML-ошибка" }
        Ok "$name скачан ($([math]::Round($len/1MB,2)) MB)"
    } catch {
        Fail "$name : $_"
    }
}

# Real-ESRGAN (лёгкая модель для видео)
Get-File `
    "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-animevideov3.pth" `
    (Join-Path $wRealesrgan "realesr-animevideov3.pth") `
    1MB

# RIFE (safetensors + модель совместимы между собой)
Get-File `
    "https://huggingface.co/TensorForger/RIFE-safetensors/resolve/main/flownet.safetensors" `
    (Join-Path $wRife "flownet.safetensors") `
    5MB

Get-File `
    "https://huggingface.co/TensorForger/RIFE-safetensors/resolve/main/interpolation_model.py" `
    (Join-Path $wRife "interpolation_model.py") `
    1KB

# =====================================================================
# 7/7 Финальная проверка
# =====================================================================
Step 7 7 "Финальная проверка"

$verifyCode = @'
import sys
results = []
def check(name, fn):
    try:    results.append((name, True,  str(fn())))
    except Exception as e: results.append((name, False, str(e)))

import torch, torchvision, safetensors, basicsr, realesrgan
check("torch",               lambda: torch.__version__)
check("cuda",                lambda: torch.cuda.is_available())
check("device",              lambda: torch.cuda.get_device_name(0) if torch.cuda.is_available() else "CPU")
check("torchvision",         lambda: torchvision.__version__)
check("safetensors",         lambda: safetensors.__version__)
check("basicsr",             lambda: basicsr.__version__)
from importlib.metadata import version as _v
check("realesrgan",          lambda: _v("realesrgan"))
check("RealESRGANer",        lambda: realesrgan.RealESRGANer.__name__)
from basicsr.archs.rrdbnet_arch   import RRDBNet
from realesrgan.archs.srvgg_arch  import SRVGGNetCompact
check("RRDBNet",             lambda: RRDBNet.__name__)
check("SRVGGNetCompact",     lambda: SRVGGNetCompact.__name__)

fails = 0
for name, ok, info in results:
    print(f"  [{'OK  ' if ok else 'FAIL'}] {name}: {info}")
    if not ok: fails += 1
sys.exit(0 if fails == 0 else 1)
'@
Set-Content "$ProjectRoot\_verify.py" $verifyCode -Encoding UTF8
poetry run python "$ProjectRoot\_verify.py"
$exitCode = $LASTEXITCODE
Remove-Item "$ProjectRoot\_verify.py" -Force -ErrorAction SilentlyContinue

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "=== ВСЁ ГОТОВО ===" -ForegroundColor Green
    Write-Host "Запуск сервиса: poetry run uvicorn main:app --reload" -ForegroundColor Green
} else {
    Write-Host "=== ЗАВЕРШЕНО С ОШИБКАМИ ===" -ForegroundColor Red
    Write-Host "Проверьте FAIL-строки выше." -ForegroundColor Red
    exit 1
}
