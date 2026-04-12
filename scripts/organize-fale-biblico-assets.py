#!/usr/bin/env python3
from __future__ import annotations

import json
import shutil
import unicodedata
from collections import Counter, deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DESKTOP = Path.home() / "Desktop"
PUBLIC_ROOT = ROOT / "apps" / "web-next" / "public"
OUTPUT_ROOT = PUBLIC_ROOT / "branding" / "fale-biblico"


def normalize(value: str) -> str:
    return "".join(ch for ch in unicodedata.normalize("NFKD", value) if not unicodedata.combining(ch)).lower()


def find_visual_dir() -> Path:
    for path in DESKTOP.iterdir():
        if path.is_dir() and "visial" in normalize(path.name):
            return path
    raise FileNotFoundError("Pasta 'VISIAL GROOT IA' nao encontrada na Area de Trabalho.")


def find_by_pattern(base: Path, pattern: str) -> Path:
    match = next((path for path in base.iterdir() if path.is_file() and normalize(pattern) in normalize(path.name)), None)
    if not match:
        raise FileNotFoundError(f"Arquivo nao encontrado para o padrao: {pattern}")
    return match


def color_distance(left: tuple[int, int, int], right: tuple[int, int, int]) -> float:
    return ((left[0] - right[0]) ** 2 + (left[1] - right[1]) ** 2 + (left[2] - right[2]) ** 2) ** 0.5


def web_path(relative_path: str) -> str:
    return f"/branding/fale-biblico/{relative_path.replace(chr(92), '/')}"


def copy_source(src: Path, target_name: str) -> Path:
    destination = OUTPUT_ROOT / "source-sheets" / target_name
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, destination)
    return destination


def lighten_background_to_alpha(image: Image.Image, min_channel: int = 245, neutral_spread: int = 10) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a and min(r, g, b) >= min_channel and max(r, g, b) - min(r, g, b) <= neutral_spread:
                pixels[x, y] = (255, 255, 255, 0)
    return rgba


def corner_background_average(image: Image.Image) -> tuple[int, int, int]:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    samples: list[tuple[int, int, int]] = []
    patch = max(8, min(width, height) // 18)
    corners = [
        (0, 0, patch, patch),
        (width - patch, 0, width, patch),
        (0, height - patch, patch, height),
        (width - patch, height - patch, width, height),
    ]
    for left, top, right, bottom in corners:
        for y in range(top, bottom):
            for x in range(left, right):
                r, g, b, _ = rgba.getpixel((x, y))
                samples.append((r, g, b))
    totals = [sum(channel[i] for channel in samples) for i in range(3)]
    return tuple(int(total / len(samples)) for total in totals)


def flood_remove_edge_background(image: Image.Image, threshold: int = 70) -> Image.Image:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    background = corner_background_average(rgba)
    queue: deque[tuple[int, int]] = deque()
    seen = set()
    pixels = rgba.load()

    def maybe_enqueue(x: int, y: int) -> None:
        if x < 0 or y < 0 or x >= width or y >= height or (x, y) in seen:
            return
        r, g, b, a = pixels[x, y]
        if a == 0:
            seen.add((x, y))
            return
        if color_distance((r, g, b), background) <= threshold:
            seen.add((x, y))
            queue.append((x, y))

    for x in range(width):
        maybe_enqueue(x, 0)
        maybe_enqueue(x, height - 1)
    for y in range(height):
        maybe_enqueue(0, y)
        maybe_enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        pixels[x, y] = (255, 255, 255, 0)
        maybe_enqueue(x + 1, y)
        maybe_enqueue(x - 1, y)
        maybe_enqueue(x, y + 1)
        maybe_enqueue(x, y - 1)

    return rgba


def trim_to_content(image: Image.Image, pad: int = 16) -> Image.Image:
    rgba = image.convert("RGBA")
    alpha = rgba.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return rgba
    left, top, right, bottom = bbox
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(rgba.size[0], right + pad)
    bottom = min(rgba.size[1], bottom + pad)
    return rgba.crop((left, top, right, bottom))


def keep_primary_component_cluster(image: Image.Image, max_gap: int = 90) -> Image.Image:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    visited = set()
    components: list[dict[str, object]] = []

    for y in range(height):
        for x in range(width):
            if (x, y) in visited:
                continue
            if pixels[x, y][3] == 0:
                visited.add((x, y))
                continue
            queue: deque[tuple[int, int]] = deque([(x, y)])
            visited.add((x, y))
            members: list[tuple[int, int]] = []
            min_x = max_x = x
            min_y = max_y = y
            while queue:
                cx, cy = queue.popleft()
                members.append((cx, cy))
                min_x = min(min_x, cx)
                min_y = min(min_y, cy)
                max_x = max(max_x, cx)
                max_y = max(max_y, cy)
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height or (nx, ny) in visited:
                        continue
                    visited.add((nx, ny))
                    if pixels[nx, ny][3] != 0:
                        queue.append((nx, ny))
            components.append(
                {
                    "members": members,
                    "bbox": (min_x, min_y, max_x, max_y),
                    "area": len(members),
                }
            )

    if not components:
        return rgba

    primary = max(components, key=lambda component: int(component["area"]))
    left, top, right, bottom = primary["bbox"]  # type: ignore[assignment]
    keep: list[dict[str, object]] = []
    for component in components:
        c_left, c_top, c_right, c_bottom = component["bbox"]  # type: ignore[assignment]
        overlaps_x = c_right >= left - max_gap and c_left <= right + max_gap
        overlaps_y = c_bottom >= top - max_gap and c_top <= bottom + max_gap
        if component is primary or (overlaps_x and overlaps_y):
            keep.append(component)

    keep_pixels = {pixel for component in keep for pixel in component["members"]}  # type: ignore[index]
    for y in range(height):
        for x in range(width):
            if pixels[x, y][3] != 0 and (x, y) not in keep_pixels:
                pixels[x, y] = (255, 255, 255, 0)

    return rgba


def export_sprite(
    sheet: Image.Image,
    box: tuple[int, int, int, int],
    output_relative_path: str,
    cleanup: str = "light",
    pad: int = 16,
) -> tuple[str, tuple[int, int]]:
    crop = sheet.crop(box)
    if cleanup == "light":
        crop = lighten_background_to_alpha(crop)
    elif cleanup == "edge":
        crop = flood_remove_edge_background(crop)
        crop = lighten_background_to_alpha(crop)
        crop = keep_primary_component_cluster(crop)
    crop = trim_to_content(crop, pad=pad)
    output_path = OUTPUT_ROOT / output_relative_path
    output_path.parent.mkdir(parents=True, exist_ok=True)
    crop.save(output_path)
    return web_path(output_relative_path), crop.size


def add_entry(
    manifest: list[dict[str, object]],
    *,
    asset_id: str,
    category: str,
    label: str,
    source_sheet: str,
    output_relative_path: str,
    size: tuple[int, int],
    tags: list[str],
) -> None:
    manifest.append(
        {
            "id": asset_id,
            "category": category,
            "label": label,
            "sourceSheet": source_sheet,
            "path": web_path(output_relative_path),
            "size": {"width": size[0], "height": size[1]},
            "tags": tags,
        }
    )


def main() -> None:
    visual_dir = find_visual_dir()

    source_patterns = {
        "alphabet-board.png": "alfabeto egipcio animado em estilo cartoon",
        "emotion-viseme-board.png": "fonoaudiologia em ilustracoes divertidas",
        "pose-board.png": "mascote de aprendizado de lingua animado",
        "hero-scribe.png": "padre escriba com pergaminho antigo",
        "viseme-board-extended.png": "tutor linguistico animado em ilustracoes",
    }
    owned_sources = {name: find_by_pattern(visual_dir, pattern) for name, pattern in source_patterns.items()}

    copied_sources = {name: copy_source(src, name) for name, src in owned_sources.items()}

    manifest: list[dict[str, object]] = []

    alphabet_sheet = Image.open(owned_sources["alphabet-board.png"]).convert("RGBA")
    alphabet_labels = [
        ["a", "b", "c", "d", "e"],
        ["f", "g", "h", "i", "j"],
        ["k", "l", "m", "n", "o"],
        ["u", "v", "w", "x", "y"],
    ]
    alphabet_width, alphabet_height = alphabet_sheet.size
    col_edges = [round(index * alphabet_width / 5) for index in range(6)]
    row_edges = [round(index * alphabet_height / 4) for index in range(5)]
    for row_index, row in enumerate(alphabet_labels):
        for col_index, label in enumerate(row):
            box = (
                col_edges[col_index],
                row_edges[row_index],
                col_edges[col_index + 1],
                row_edges[row_index + 1],
            )
            relative_path = f"sprites/letters/{label}.png"
            _, size = export_sprite(alphabet_sheet, box, relative_path, cleanup="light", pad=24)
            add_entry(
                manifest,
                asset_id=f"letter-{label}",
                category="letters",
                label=label.upper(),
                source_sheet="alphabet-board.png",
                output_relative_path=relative_path,
                size=size,
                tags=["authorial", "alphabet", "lesson", "desktop-ui"],
            )

    emotion_viseme_sheet = Image.open(owned_sources["emotion-viseme-board.png"]).convert("RGBA")
    emotion_viseme_specs = [
        ("lipsync-ai-classic", "lipsync", "A,I", (20, 140, 210, 520), ["authorial", "viseme", "classic-set"]),
        ("lipsync-e-classic", "lipsync", "E", (220, 140, 410, 520), ["authorial", "viseme", "classic-set"]),
        ("lipsync-u-classic", "lipsync", "U", (420, 140, 610, 520), ["authorial", "viseme", "classic-set"]),
        ("lipsync-cdkns", "lipsync", "C,D,K,N,S", (610, 140, 815, 520), ["authorial", "viseme", "classic-set"]),
        ("lipsync-tlr", "lipsync", "T,L,R", (815, 140, 1015, 520), ["authorial", "viseme", "classic-set"]),
        ("emotion-laugh", "emotions", "Giggle / Laugh", (35, 560, 290, 1030), ["authorial", "emotion", "positive"]),
        ("emotion-angry", "emotions", "Angry", (285, 560, 525, 1030), ["authorial", "emotion", "negative"]),
        ("emotion-sad", "emotions", "Sad", (515, 560, 760, 1030), ["authorial", "emotion", "negative"]),
        ("emotion-worried", "emotions", "Worried", (750, 560, 995, 1030), ["authorial", "emotion", "negative"]),
        ("emotion-joy-question", "emotions", "Joy / Question", (45, 1010, 355, 1490), ["authorial", "emotion", "positive", "question"]),
        ("emotion-joy-wink", "emotions", "Joy / Wink", (355, 1010, 675, 1490), ["authorial", "emotion", "positive", "wink"]),
        ("emotion-relieved", "emotions", "Relieved", (665, 1010, 995, 1490), ["authorial", "emotion", "calm"]),
    ]
    for asset_id, category, label, box, tags in emotion_viseme_specs:
        folder = "lipsync" if category == "lipsync" else "emotions"
        file_name = asset_id.replace("lipsync-", "").replace("emotion-", "") + ".png"
        relative_path = f"sprites/{folder}/{file_name}"
        _, size = export_sprite(emotion_viseme_sheet, box, relative_path, cleanup="light", pad=20)
        add_entry(
            manifest,
            asset_id=asset_id,
            category=category,
            label=label,
            source_sheet="emotion-viseme-board.png",
            output_relative_path=relative_path,
            size=size,
            tags=tags,
        )

    extended_viseme_sheet = Image.open(owned_sources["viseme-board-extended.png"]).convert("RGBA")
    extended_specs = [
        ("lipsync-ai-extended", "lipsync", "A,I", (45, 145, 335, 560), ["authorial", "viseme", "extended-set"]),
        ("lipsync-e-extended", "lipsync", "E", (350, 145, 635, 560), ["authorial", "viseme", "extended-set"]),
        ("lipsync-u-extended", "lipsync", "U", (635, 145, 965, 560), ["authorial", "viseme", "extended-set"]),
        ("lipsync-fv", "lipsync", "F,V", (45, 535, 285, 1045), ["authorial", "viseme", "extended-set"]),
        ("lipsync-bmp", "lipsync", "B,M,P", (285, 535, 535, 1045), ["authorial", "viseme", "extended-set"]),
        ("lipsync-rest", "lipsync", "Rest", (530, 535, 775, 1045), ["authorial", "viseme", "extended-set", "idle"]),
        ("lipsync-uh-hh", "lipsync", "Uh-hh", (770, 535, 1000, 1045), ["authorial", "viseme", "extended-set"]),
        ("emotion-soft-sad", "emotions", "Soft Sad", (45, 1030, 340, 1510), ["authorial", "emotion", "negative"]),
        ("emotion-question-thumbs-up", "emotions", "Question / Thumbs Up", (340, 1030, 680, 1510), ["authorial", "emotion", "question", "positive"]),
        ("emotion-surprised", "emotions", "Surprised", (675, 1030, 1000, 1510), ["authorial", "emotion", "surprise"]),
    ]
    for asset_id, category, label, box, tags in extended_specs:
        folder = "lipsync" if category == "lipsync" else "emotions"
        file_name = asset_id.replace("lipsync-", "").replace("emotion-", "") + ".png"
        relative_path = f"sprites/{folder}/{file_name}"
        _, size = export_sprite(extended_viseme_sheet, box, relative_path, cleanup="light", pad=20)
        add_entry(
            manifest,
            asset_id=asset_id,
            category=category,
            label=label,
            source_sheet="viseme-board-extended.png",
            output_relative_path=relative_path,
            size=size,
            tags=tags,
        )

    pose_sheet = Image.open(owned_sources["pose-board.png"]).convert("RGBA")
    pose_specs = [
        ("pose-celebrate", "Celebrate", (45, 35, 250, 380), ["authorial", "pose", "celebration"]),
        ("pose-study-chat", "Study / Chat", (700, 25, 1005, 430), ["authorial", "pose", "learning", "dialogue"]),
        ("pose-confused", "Confused", (35, 345, 300, 720), ["authorial", "pose", "question"]),
        ("pose-scribe-main", "Scribe Main", (350, 250, 685, 980), ["authorial", "pose", "hero"]),
        ("pose-alert", "Alert", (745, 350, 995, 785), ["authorial", "pose", "warning"]),
        ("pose-idle", "Idle", (30, 760, 285, 1145), ["authorial", "pose", "idle"]),
        ("pose-sleeping", "Sleeping", (320, 930, 700, 1230), ["authorial", "pose", "rest"]),
        ("pose-thumbs-up", "Thumbs Up", (725, 785, 995, 1135), ["authorial", "pose", "positive"]),
        ("pose-tired", "Tired", (255, 1185, 625, 1515), ["authorial", "pose", "rest", "low-energy"]),
        ("pose-frustrated", "Frustrated", (675, 1160, 1000, 1515), ["authorial", "pose", "negative", "question"]),
    ]
    for asset_id, label, box, tags in pose_specs:
        relative_path = f"sprites/poses/{asset_id.replace('pose-', '')}.png"
        _, size = export_sprite(pose_sheet, box, relative_path, cleanup="edge", pad=12)
        add_entry(
            manifest,
            asset_id=asset_id,
            category="poses",
            label=label,
            source_sheet="pose-board.png",
            output_relative_path=relative_path,
            size=size,
            tags=tags,
        )

    hero_sheet = Image.open(owned_sources["hero-scribe.png"]).convert("RGBA")
    hero_box = (0, 0, hero_sheet.size[0], hero_sheet.size[1])
    hero_relative_path = "sprites/hero/scribe-default.png"
    _, hero_size = export_sprite(hero_sheet, hero_box, hero_relative_path, cleanup="light", pad=24)
    add_entry(
        manifest,
        asset_id="hero-scribe-default",
        category="hero",
        label="Scribe Default",
        source_sheet="hero-scribe.png",
        output_relative_path=hero_relative_path,
        size=hero_size,
        tags=["authorial", "hero", "fale-biblico", "primary-mascot"],
    )

    manifest.sort(key=lambda item: (str(item["category"]), str(item["id"])))
    category_counts = Counter(str(item["category"]) for item in manifest)
    manifest_payload = {
        "generatedAt": __import__("datetime").datetime.utcnow().isoformat(timespec="seconds") + "Z",
        "outputRoot": "/branding/fale-biblico",
        "sourceSheets": [
            {"name": name, "path": f"/branding/fale-biblico/source-sheets/{name}", "externalPattern": source_patterns[name]}
            for name in copied_sources
        ],
        "categoryCounts": dict(sorted(category_counts.items())),
        "assets": manifest,
    }

    manifest_path = OUTPUT_ROOT / "manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(json.dumps(manifest_payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print("Biblioteca Fale Biblico gerada com sucesso.")
    print(f"Raiz: {OUTPUT_ROOT}")
    for category, count in sorted(category_counts.items()):
        print(f"- {category}: {count}")
    print(f"- source-sheets: {len(copied_sources)}")
    print(f"- manifest: {manifest_path}")


if __name__ == "__main__":
    main()
