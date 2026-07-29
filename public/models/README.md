# Model Files

These binary files are excluded from git (see `.gitignore`) because they exceed GitHub's 100 MB file size limit.

## Required Files

| File | Size | Source |
|---|---|---|
| `rx_ocr_quantized.tflite` | ~545 MB | Kaggle training output — see instructions below |
| `tokenizer.json` | ~5 MB | HuggingFace: `naver-clova-ix/donut-base` |
| `special_tokens_map.json` | ~1 KB | HuggingFace: `naver-clova-ix/donut-base` |
| `tokenizer_config.json` | ~1 KB | HuggingFace: `naver-clova-ix/donut-base` |
| `drug_dictionary.json` | ~2–5 MB | Generated from Tata 1mg Kaggle dataset — see instructions below |

## Getting the TFLite Model

The Donut Vision Transformer was fine-tuned on the `chinmays18/medical-prescription-dataset` (1,000 prescription images) using the training script at `train.py`.

**From a Kaggle training run:**
1. Run `train.py` on Kaggle with a GPU accelerator
2. From `/kaggle/working/`, download `rx_vision_intermediate_float32.tflite`
3. Rename it to `rx_ocr_quantized.tflite` and place it here

## Getting the Tokenizer Files

Download directly from HuggingFace (these are the base Donut tokenizer files — no training required):

```bash
# Using huggingface_hub
python -c "
from huggingface_hub import hf_hub_download
import shutil

for f in ['tokenizer.json', 'special_tokens_map.json', 'tokenizer_config.json']:
    path = hf_hub_download('naver-clova-ix/donut-base', f)
    shutil.copy(path, f'public/models/{f}')
    print(f'Downloaded {f}')
"
```

Or download manually from: https://huggingface.co/naver-clova-ix/donut-base/tree/main

## Model Architecture

- **Base:** `naver-clova-ix/donut-base` (Donut Vision-Encoder-Decoder)
- **Fine-tuned for:** Structured prescription extraction (`<s_prescription><s_drug>...</s_drug></s_prescription>`)
- **Inference resolution:** 1280×960 (height × width)
- **Decoder start token:** ID `57524` (`<s_synthdog>`)
- **EOS token:** ID `2` (`</s>`)
- **Runtime:** TensorFlow.js TFLite + WebGL backend (runs entirely in the browser)

## Getting the Drug Dictionary

The fuzzy corrector snaps OCR output to real Indian medicine names using the
[India Medicines and Drug Info Dataset](https://www.kaggle.com/datasets/apkaayush/india-medicines-and-drug-info-dataset) by Apka_Ayush on Kaggle.

Run this script after downloading the dataset CSV:

```python
import pandas as pd, json

df = pd.read_csv('India Medicines and Drug Info Dataset.csv')
names = df['Medicine Name'].dropna().str.strip().unique().tolist()

with open('public/models/drug_dictionary.json', 'w', encoding='utf-8') as f:
    json.dump(names, f, ensure_ascii=False)

print(f"Written {len(names)} drug names to drug_dictionary.json")
```

Place the output at `public/models/drug_dictionary.json`.
The corrector is optional - the OCR pipeline degrades gracefully if the file is absent.
