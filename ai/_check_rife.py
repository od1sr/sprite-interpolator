
import sys
from pathlib import Path
sys.path.insert(0, str(Path("weights/rife").resolve()))

from interpolation_model import IFNet
from safetensors.torch import load_file

model = IFNet()
sd = load_file("weights/rife/flownet.safetensors")

model_keys = set(model.state_dict().keys())
file_keys = set(sd.keys())

missing = model_keys - file_keys
extra = file_keys - model_keys

print(f"В модели: {len(model_keys)} ключей")
print(f"В файле:  {len(file_keys)} ключей")
print(f"Отсутствует в файле: {len(missing)}")
print(f"Лишних в файле:      {len(extra)}")

if missing:
    print("Примеры отсутствующих:", list(missing)[:5])
if extra:
    print("Примеры лишних:", list(extra)[:5])

if not missing and not extra:
    print("СОВМЕСТИМО - можно загружать")
else:
    print("НЕСОВМЕСТИМО - веса из другого репозитория/версии")
