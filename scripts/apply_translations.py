#!/usr/bin/env python3
"""
Apply translations to all questions in docs/french/*.md
"""
import os
import sys
import glob

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "translations")))
from set_01 import SET_01
from set_02 import SET_02
from set_03 import SET_03
from set_04 import SET_04
from set_05 import SET_05
from set_06 import SET_06
from set_07 import SET_07
from set_08 import SET_08
from set_09 import SET_09
from set_10 import SET_10
from set_rev import SET_REV
from set_final import SET_FINAL

ALL_TRANS = {}
for s in [SET_01, SET_02, SET_03, SET_04, SET_05, SET_06, SET_07, SET_08, SET_09, SET_10, SET_REV, SET_FINAL]:
    ALL_TRANS.update(s)

print(f"Loaded {len(ALL_TRANS)} translations.")

FRENCH_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "docs", "french"))
md_files = sorted([f for f in glob.glob(os.path.join(FRENCH_DIR, "*.md")) if "README" not in f])

total_updated = 0

for fpath in md_files:
    fname = os.path.basename(fpath)
    with open(fpath, "r", encoding="utf-8") as f:
        lines = f.readlines()

    in_quiz_block = False
    new_lines = []
    file_updated_count = 0

    for line in lines:
        stripped = line.strip()
        if stripped.startswith("```quiz") or stripped.startswith("```quiz-deck"):
            in_quiz_block = True
            new_lines.append(line)
            continue
        elif stripped == "```" and in_quiz_block:
            in_quiz_block = False
            new_lines.append(line)
            continue

        if in_quiz_block and "|" in line:
            parts = [p.strip() for p in line.split("|")]
            qid = parts[0]
            if qid in ALL_TRANS:
                tr = ALL_TRANS[qid]
                old_expl = parts[-1]
                # If old_expl already has Dịch:, remove it to prevent duplicates
                if old_expl.startswith("Dịch:"):
                    # remove up to the first dash or dot
                    if " — " in old_expl:
                        old_expl = old_expl.split(" — ", 1)[1]
                    elif ". " in old_expl:
                        old_expl = old_expl.split(". ", 1)[1]

                if any(tr.startswith(prefix) for prefix in [
                    "Sửa ", "Employée ", "Moi là ", "Đại từ ", "Lược âm ", "Elle habite au Paris"
                ]) or "=" in tr:
                    new_expl = f"Dịch: {tr} — {old_expl}"
                else:
                    if tr.endswith(".") or tr.endswith("?") or tr.endswith("!"):
                        new_expl = f'Dịch: "{tr}" — {old_expl}'
                    else:
                        new_expl = f'Dịch: "{tr}." — {old_expl}'

                # Ensure no pipe characters exist in new_expl
                new_expl = new_expl.replace("|", "/")
                parts[-1] = new_expl
                new_line = " | ".join(parts) + "\n"
                new_lines.append(new_line)
                file_updated_count += 1
                total_updated += 1
                continue

        new_lines.append(line)

    with open(fpath, "w", encoding="utf-8") as f:
        f.writelines(new_lines)

    print(f"Updated {fname}: {file_updated_count} questions.")

print(f"\nTotal questions updated with translations: {total_updated}/{len(ALL_TRANS)}")
