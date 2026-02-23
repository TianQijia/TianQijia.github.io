#!/usr/bin/env python3
import argparse
import datetime as dt
import html
import json
import os
from pathlib import Path
from typing import Any, Dict, List, Tuple


ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "cv-data" / "base-cv.json"
PROFILES_DIR = ROOT / "cv-profiles"


def load_json(path: Path) -> Dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def get_lang_text(item: Dict[str, Any], field_base: str, lang: str, default: str = "") -> str:
    return item.get(f"{field_base}_{lang}", item.get(f"{field_base}_en", default))


def tag_score(item: Dict[str, Any], focus_tags: List[str]) -> int:
    tags = set(item.get("tags", []))
    return len(tags.intersection(set(focus_tags)))


def select_items(
    section_id: str,
    section_items: List[Dict[str, Any]],
    focus_tags: List[str],
    max_items_per_section: Dict[str, int],
) -> List[Dict[str, Any]]:
    if not section_items:
        return []
    scored: List[Tuple[int, int, Dict[str, Any]]] = []
    for idx, item in enumerate(section_items):
        scored.append((tag_score(item, focus_tags), idx, item))

    # Stable ranking: high score first, preserve original order for ties.
    scored.sort(key=lambda x: (-x[0], x[1]))
    selected = [it for _, _, it in scored]

    limit = max_items_per_section.get(section_id)
    if isinstance(limit, int) and limit > 0:
        selected = selected[:limit]
    return selected


def render_item_experience(item: Dict[str, Any], lang: str, max_bullets: int) -> str:
    heading = html.escape(get_lang_text(item, "heading", lang))
    date_text = html.escape(get_lang_text(item, "date", lang))
    role = html.escape(get_lang_text(item, "role", lang))
    bullets = item.get(f"bullets_{lang}", item.get("bullets_en", []))[:max_bullets]
    bullets_html = "".join(f"<li>{html.escape(b)}</li>" for b in bullets)
    role_html = f'<p class="cvp-role">{role}</p>' if role else ""
    return (
        '<article class="cvp-item">'
        '<div class="cvp-item-head">'
        f"<h3>{heading}</h3>"
        f'<span class="cvp-date">{date_text}</span>'
        "</div>"
        f"{role_html}"
        f"<ul>{bullets_html}</ul>"
        "</article>"
    )


def render_section(section: Dict[str, Any], lang: str, max_bullets: int) -> str:
    title = html.escape(get_lang_text(section, "title", lang))
    rows = []
    has_table = all(it.get("kind") == "table" for it in section.get("items", []))
    has_bullet_group = any(it.get("kind") == "bullet_group" for it in section.get("items", []))

    if has_table:
        for it in section.get("items", []):
            left = html.escape(get_lang_text(it, "left", lang))
            right = html.escape(get_lang_text(it, "right", lang))
            rows.append(f"<tr><td>{left}</td><td class=\"cvp-meta\">{right}</td></tr>")
        body = f'<table class="cvp-two-col-table"><tbody>{"".join(rows)}</tbody></table>'
        return f'<section class="cvp-section" id="{section["id"]}"><h2>{title}</h2>{body}</section>'

    if has_bullet_group:
        bullets: List[str] = []
        for it in section.get("items", []):
            bullets.extend(it.get(f"bullets_{lang}", it.get("bullets_en", [])))
        bullets_html = "".join(f"<li>{html.escape(b)}</li>" for b in bullets)
        body = f"<ul>{bullets_html}</ul>"
        return f'<section class="cvp-section" id="{section["id"]}"><h2>{title}</h2>{body}</section>'

    for it in section.get("items", []):
        rows.append(render_item_experience(it, lang, max_bullets))
    return f'<section class="cvp-section" id="{section["id"]}"><h2>{title}</h2>{"".join(rows)}</section>'


def render_application_meta(profile: Dict[str, Any], lang: str) -> str:
    app = profile.get("application_requirements", {})
    if lang == "zh":
        heading = "岗位申请信息"
        pref_label = "方向偏好（最多三个）"
        salary_label = "期望薪资"
        date_label = "可入职日期"
        prefs = app.get("stream_preferences_zh", [])
        salary = app.get("expected_salary_zh", "")
        avail = app.get("date_of_availability_zh", "")
    else:
        heading = "APPLICATION DETAILS"
        pref_label = "Preference of Streams (up to three)"
        salary_label = "Expected Salary"
        date_label = "Date of Availability"
        prefs = app.get("stream_preferences_en", [])
        salary = app.get("expected_salary_en", "")
        avail = app.get("date_of_availability_en", "")

    pref_html = "".join(f"<li>{html.escape(x)}</li>" for x in prefs)
    return (
        '<section class="cvp-section" id="application-meta">'
        f"<h2>{html.escape(heading)}</h2>"
        f"<ul><li><strong>{html.escape(pref_label)}:</strong><ul>{pref_html}</ul></li>"
        f"<li><strong>{html.escape(salary_label)}:</strong> {html.escape(salary)}</li>"
        f"<li><strong>{html.escape(date_label)}:</strong> {html.escape(avail)}</li></ul>"
        "</section>"
    )


def render_html(data: Dict[str, Any], profile: Dict[str, Any], lang: str, css_href: str) -> str:
    person = data["person"]
    include = set(profile.get("section_config", {}).get("include", []))
    max_bullets = profile.get("section_config", {}).get("max_bullets_per_item", 4)
    max_items_per_section = profile.get("section_config", {}).get("max_items_per_section", {})
    focus_tags = profile.get("focus_tags", [])
    title = profile.get(f"title_{lang}", profile.get("title_en", "CV"))
    output_base = profile.get("output_base_name", profile.get("id", "focus"))
    scale_storage_key = f"cvScale:{output_base}:{lang}"

    name = html.escape(person["name_zh"] if lang == "zh" else person["name_en"])
    contacts = person["contacts_zh"] if lang == "zh" else person["contacts_en"]
    contacts_html = "".join(f'<p class="cvp-contact">{html.escape(c)}</p>' for c in contacts)

    rendered_sections: List[str] = []
    for section in data.get("sections", []):
        if section["id"] not in include:
            continue
        section_copy = dict(section)
        items = section.get("items", [])
        if any(it.get("tags") for it in items):
            section_copy["items"] = select_items(
                section["id"], items, focus_tags, max_items_per_section
            )
        rendered_sections.append(render_section(section_copy, lang, max_bullets))

    if "application_meta" in include:
        rendered_sections.append(render_application_meta(profile, lang))

    ai_context = {
        "profile_id": profile.get("id"),
        "title_en": profile.get("title_en"),
        "title_zh": profile.get("title_zh"),
        "focus_tags": profile.get("focus_tags", []),
        "application_requirements": profile.get("application_requirements", {}),
        "ai_processing": profile.get("ai_processing", {}),
        "generated_at": dt.datetime.now().isoformat(timespec="seconds"),
    }
    ai_context_json = html.escape(json.dumps(ai_context, ensure_ascii=False))

    labels = {
        "en": {"reset": "Reset", "scale": "Scale", "aria": "CV scale percent"},
        "zh": {"reset": "重置", "scale": "缩放", "aria": "简历缩放百分比"},
    }[lang]

    return f"""<!DOCTYPE html>
<html lang="{('zh-CN' if lang == 'zh' else 'en')}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{html.escape(title)}</title>
  <link rel="stylesheet" href="{html.escape(css_href)}">
</head>
<body>
  <div class="cvp-font-controls" aria-label="Font size controls">
    <button type="button" id="cvp-font-decrease">A-</button>
    <button type="button" id="cvp-font-increase">A+</button>
    <button type="button" id="cvp-font-reset">{labels["reset"]}</button>
    <label for="cvp-font-range">{labels["scale"]}</label>
    <input id="cvp-font-range" type="range" min="80" max="260" step="1" value="110" aria-label="{labels["aria"]}">
    <span id="cvp-font-indicator">110%</span>
  </div>

  <main class="cvp-page">
    <header class="cvp-header">
      <h1>{name}</h1>
      {contacts_html}
    </header>
    {"".join(rendered_sections)}
  </main>

  <script type="application/json" id="cv-ai-context">{ai_context_json}</script>
  <script>
    (function () {{
      var root = document.documentElement;
      var key = "{scale_storage_key}";
      var minScale = 0.9;
      var maxScale = 2.6;
      var step = 0.02;
      var defaultScale = 1.1;
      var dec = document.getElementById("cvp-font-decrease");
      var inc = document.getElementById("cvp-font-increase");
      var reset = document.getElementById("cvp-font-reset");
      var range = document.getElementById("cvp-font-range");
      var indicator = document.getElementById("cvp-font-indicator");
      function clamp(value) {{ return Math.min(maxScale, Math.max(minScale, value)); }}
      function roundScale(value) {{ return Math.round(value * 100) / 100; }}
      function render(scale) {{
        root.style.setProperty("--cv-scale", String(scale));
        var percent = Math.round(scale * 100);
        indicator.textContent = percent + "%";
        range.value = String(percent);
      }}
      function readInitialScale() {{
        var stored = Number(localStorage.getItem(key));
        if (!Number.isFinite(stored)) return defaultScale;
        return clamp(roundScale(stored));
      }}
      function save(scale) {{ localStorage.setItem(key, String(scale)); }}
      var current = readInitialScale();
      render(current);
      dec.addEventListener("click", function () {{
        current = clamp(roundScale(current - step)); render(current); save(current);
      }});
      inc.addEventListener("click", function () {{
        current = clamp(roundScale(current + step)); render(current); save(current);
      }});
      reset.addEventListener("click", function () {{
        current = defaultScale; render(current); save(current);
      }});
      range.addEventListener("input", function () {{
        current = clamp(roundScale(Number(range.value) / 100)); render(current); save(current);
      }});
    }})();
  </script>
</body>
</html>
"""


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate focused CV pages from profile config.")
    parser.add_argument("profile", help="Profile file name under cv-profiles, e.g. asl-gt-2026.json")
    parser.add_argument(
        "--output-dir",
        help="Optional output directory (default: profile.output_dir or cv-output).",
    )
    args = parser.parse_args()

    profile_path = PROFILES_DIR / args.profile
    if not profile_path.exists():
        raise SystemExit(f"Profile not found: {profile_path}")

    data = load_json(DATA_PATH)
    profile = load_json(profile_path)
    output_base = profile.get("output_base_name", profile.get("id", "focus"))
    configured_output_dir = args.output_dir or profile.get("output_dir", "cv-output")
    output_dir = Path(configured_output_dir)
    if not output_dir.is_absolute():
        output_dir = ROOT / output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    css_path_config = profile.get("css_path", "cv-assets/cv-focus.css")
    css_target = Path(css_path_config)
    if not css_target.is_absolute():
        css_target = ROOT / css_target

    for lang in profile.get("target_languages", ["en"]):
        suffix = "-zh" if lang == "zh" else ""
        out_file = output_dir / f"{output_base}{suffix}.html"
        css_href = os.path.relpath(css_target, out_file.parent).replace("\\", "/")
        out_file.write_text(render_html(data, profile, lang, css_href), encoding="utf-8")
        print(f"Generated {out_file.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
