# n5-tungkinh

Japanese-Vietnamese vocabulary audio generator for N5 study.

## Web player

After GitHub Pages deploys, open:

```text
https://thanh-pham2k.github.io/n5-tungkinh/
```

On mobile, open the page, choose a local MP3 file from the phone, then use Play, Pause, Restart, and speed control.
You can also choose the public lesson audio directly from the page without downloading it first.

## Folder structure

```text
extractor/
  input/
    17.txt                 # Vocabulary source file
  output/
    16/
      16_group_01.mp3
      16_group_02.mp3
      16_group_03.mp3
      16_group_04.mp3
      16_group_05.mp3
    17/
      17_group_01.mp3      # Audio for group 1 in input/17.txt
      17_group_02.mp3
      17_group_03.mp3
      17_group_04.mp3
    _cache/                # Downloaded Sound of Text MP3 cache
    _silence/              # Reusable silent MP3 clips
  index.html               # Static mobile-friendly audio looper
  docs/                    # GitHub Pages copy of the static web player
  make_vocab_audio.py
```

## Usage

Create audio from the default input file:

```powershell
python .\make_vocab_audio.py
```

Preview parsing without calling the API:

```powershell
python .\make_vocab_audio.py --dry-run
```

Create audio for a different input file:

```powershell
python .\make_vocab_audio.py --input .\input\18.txt
```

Each group separated by `---` becomes one audio file in `output\<input-file-name>\`.

Generated lesson MP3 files are committed so they can be downloaded on another device. TTS cache and silence clips are ignored by Git.

## Deployment without GitHub Actions

This repo is a static site and does not need GitHub Actions. Enable GitHub Pages from the branch instead:

```text
Settings -> Pages -> Build and deployment
Source: Deploy from a branch
Branch: main
Folder: /docs
```
