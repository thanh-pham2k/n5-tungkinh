# n5-tungkinh

Japanese-Vietnamese vocabulary audio generator for N5 study.

## Folder structure

```text
extractor/
  input/
    17.txt                 # Vocabulary source file
  output/
    17/
      17_group_01.mp3      # Audio for group 1 in input/17.txt
      17_group_02.mp3
      17_group_03.mp3
      17_group_04.mp3
    _cache/                # Downloaded Sound of Text MP3 cache
    _silence/              # Reusable silent MP3 clips
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

Generated MP3 files, TTS cache, and silence clips are ignored by Git by default.
