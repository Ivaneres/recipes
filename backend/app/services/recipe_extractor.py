from typing import Optional, Dict, List, Tuple, Any
import html
import httpx
from bs4 import BeautifulSoup
import json
import re
from urllib.parse import urljoin
from recipe_scrapers import scrape_me
from app.schemas.recipe import RecipeCreate, Ingredient

# Browser-like headers so recipe sites (e.g. Michelin Guide, Serious Eats) don't return 403 Forbidden.
# Include Sec-Fetch-* and Accept-Encoding so the request resembles a normal browser navigation.
DEFAULT_HTTP_HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
}


# Phrases that indicate article prose rather than recipe steps (used to auto-trim instructions_raw for new sites)
_INSTRUCTIONS_ARTICLE_PHRASES = (
    "family dining table",
    "one MICHELIN star",
    "is a starring dish",
    "Written by",
    "Images are courtesy",
    "Share\n",
)


def _trim_instructions_raw_if_article(text: str, max_len_before_trim: int = 3500) -> str:
    """
    If text is long and contains article-like phrases, trim to the first numbered step (e.g. "1. ").
    Helps avoid sending full article content as instructions_raw for new sites with similar structure.
    """
    if not text or len(text) < max_len_before_trim:
        return text
    lower = text.lower()
    if not any(phrase.lower() in lower for phrase in _INSTRUCTIONS_ARTICLE_PHRASES):
        return text
    # Find first "1. " (start of method steps) and take from there
    m = re.search(r"(?:^|\n)\s*1\.\s+\w", text)
    if m:
        return text[m.start():].lstrip()
    return text


def _is_likely_form_or_ui_junk(text: str) -> bool:
    """True if text looks like form labels, validation messages, or newsletter UI rather than recipe description."""
    if not text or len(text.strip()) < 10:
        return True
    lower = text.lower()
    junk_phrases = [
        "for validation purposes",
        "should be left unchanged",
        "email(required)",
        "this field is for",
        "required)",
        "optional)",
        "your email",
        "subscribe to",
        "newsletter",
        "sign up",
    ]
    for phrase in junk_phrases:
        if phrase in lower:
            return True
    return False


async def extract_recipe_from_url(url: str) -> Optional[RecipeCreate]:
    """Extract recipe data from a URL with multiple fallback strategies"""
    async with httpx.AsyncClient(headers=DEFAULT_HTTP_HEADERS) as client:
        try:
            response = await client.get(url, timeout=15.0, follow_redirects=True)
            response.raise_for_status()
            html_content = response.text
            soup = BeautifulSoup(html_content, 'html.parser')
        except Exception as e:
            print(f"Error fetching URL: {e}")
            return None
    
    # Strategy 1: Try recipe-scrapers (works for known sites)
    try:
        scraper = scrape_me(url)
        if scraper:
            title = scraper.title() if hasattr(scraper, 'title') else None
            description = scraper.description() if hasattr(scraper, 'description') else None
            if description and _is_likely_form_or_ui_junk(description):
                description = None
            instructions = scraper.instructions() if hasattr(scraper, 'instructions') else None
            
            ingredients_list = []
            if hasattr(scraper, 'ingredients'):
                raw_ingredients = scraper.ingredients()
                for ing in raw_ingredients:
                    ingredients_list.append(Ingredient(name=str(ing)))
            
            prep_time = None
            cook_time = None
            if hasattr(scraper, 'total_time'):
                total_time = scraper.total_time()
                if total_time:
                    prep_time = total_time // 2
                    cook_time = total_time // 2
            
            servings = None
            if hasattr(scraper, 'yields'):
                yields = scraper.yields()
                if yields:
                    numbers = re.findall(r'\d+', str(yields))
                    if numbers:
                        servings = int(numbers[0])
            
            if title and (ingredients_list or instructions):
                return RecipeCreate(
                    title=title,
                    description=description,
                    ingredients=ingredients_list if ingredients_list else None,
                    instructions=instructions,
                    prep_time_minutes=prep_time,
                    cook_time_minutes=cook_time,
                    servings=servings,
                    source_url=url
                )
    except Exception as e:
        print(f"recipe-scrapers failed: {e}")
    
    # Strategy 2: Try structured data (JSON-LD, microdata, etc.)
    recipe_data = _extract_from_structured_data(soup, url)
    if recipe_data:
        return recipe_data
    
    # Strategy 3: Generic HTML parsing
    recipe_data = _extract_from_html(soup, url)
    if recipe_data:
        return recipe_data
    
    # Strategy 4: Last resort - extract all main text content
    recipe_data = _extract_all_text_fallback(soup, url)
    if recipe_data:
        return recipe_data
    
    return None


def _extract_from_structured_data(soup: BeautifulSoup, url: str) -> Optional[RecipeCreate]:
    recipe, _ = _extract_from_structured_data_with_raw(soup, url)
    return recipe


def _normalize_ld_json_to_recipe_candidates(data) -> List[dict]:
    """Turn parsed JSON-LD into a list of candidate Recipe objects (handles @graph, top-level list, or single object)."""
    if not data:
        return []
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        if data.get('@type') == 'Recipe' or 'Recipe' in str(data.get('@type', [])):
            return [data]
        graph = data.get('@graph')
        if isinstance(graph, list):
            return graph
        return []
    return []


def _normalize_structured_text(text: Optional[str]) -> str:
    """Unescape HTML entities in text from JSON-LD (e.g. &frac12; &amp;) so we store clean text."""
    if not text or not isinstance(text, str):
        return ""
    return html.unescape(text).strip()


def _ingredient_line_from_structured(ing: Any) -> Optional[str]:
    """Extract a single ingredient line from schema.org recipeIngredient (string or Ingredient object)."""
    if isinstance(ing, str):
        return _normalize_structured_text(ing) or None
    if isinstance(ing, dict):
        name = ing.get("name") or ing.get("text")
        if name:
            return _normalize_structured_text(str(name))
        # Fallback: join values that look like a line
        parts = [str(v) for k, v in ing.items() if k not in ("@type", "@context") and v]
        if parts:
            return _normalize_structured_text(" ".join(parts))
    return None


def _instruction_steps_from_structured(recipe_instructions: Any) -> List[str]:
    """
    Extract ordered list of instruction step strings from schema.org recipeInstructions.
    Handles: single string; list of strings; list of HowToStep (dict with 'text');
    HowToSection with hasPart / itemListElement / steps (flattened).
    """
    steps: List[str] = []

    def add_step(text: str) -> None:
        t = _normalize_structured_text(text)
        if t:
            steps.append(t)

    def process_item(item: Any) -> None:
        if isinstance(item, str):
            add_step(item)
            return
        if not isinstance(item, dict):
            return
        # HowToStep
        text = item.get("text")
        if text:
            add_step(text)
            return
        # HowToSection: flatten hasPart, itemListElement, or steps
        for key in ("hasPart", "itemListElement", "steps"):
            part_list = item.get(key)
            if isinstance(part_list, list):
                for sub in part_list:
                    process_item(sub)
                return
            if isinstance(part_list, dict) and part_list.get("text"):
                add_step(part_list["text"])
                return
        # ItemList with listItem
        list_items = item.get("itemListElement") or item.get("listItem")
        if isinstance(list_items, list):
            for li in list_items:
                if isinstance(li, dict) and "item" in li:
                    process_item(li["item"])
                else:
                    process_item(li)
            return

    if recipe_instructions is None:
        return steps
    if isinstance(recipe_instructions, str):
        # Single string: split by double newline or single newline and keep non-empty
        for block in re.split(r"\n\s*\n", recipe_instructions):
            block = _normalize_structured_text(block)
            if block:
                steps.append(block)
        if not steps and recipe_instructions.strip():
            steps.append(_normalize_structured_text(recipe_instructions))
        return steps
    if isinstance(recipe_instructions, dict):
        # Single HowToStep or HowToSection
        process_item(recipe_instructions)
        return steps
    if isinstance(recipe_instructions, list):
        for item in recipe_instructions:
            process_item(item)
        return steps
    return steps


def _extract_from_structured_data_with_raw(soup: BeautifulSoup, url: str) -> Tuple[Optional[RecipeCreate], List[str]]:
    """Extract recipe from JSON-LD structured data; returns (recipe, raw_ingredient_lines)."""
    try:
        json_scripts = soup.find_all('script', type='application/ld+json')
        for script in json_scripts:
            try:
                raw = json.loads(script.string)
                candidates = _normalize_ld_json_to_recipe_candidates(raw)
                for data in candidates:
                    if not isinstance(data, dict):
                        continue
                    if data.get('@type') != 'Recipe' and 'Recipe' not in str(data.get('@type', [])):
                        continue
                    title = _normalize_structured_text(data.get('name') or '')
                    description = _normalize_structured_text(data.get('description') or '')
                    if description and _is_likely_form_or_ui_junk(description):
                        description = ''
                    ingredients_list = []
                    raw_lines = []
                    recipe_ingredients = data.get('recipeIngredient')
                    if isinstance(recipe_ingredients, list):
                        for ing in recipe_ingredients:
                            line = _ingredient_line_from_structured(ing)
                            if line:
                                raw_lines.append(line)
                                ingredients_list.append(Ingredient(name=line))
                    elif isinstance(recipe_ingredients, str):
                        line = _ingredient_line_from_structured(recipe_ingredients)
                        if line:
                            raw_lines.append(line)
                            ingredients_list.append(Ingredient(name=line))
                    instruction_parts = _instruction_steps_from_structured(data.get('recipeInstructions'))
                    instructions = '\n'.join(f"{i+1}. {step}" for i, step in enumerate(instruction_parts)) if instruction_parts else None
                    prep_time = _parse_duration(data.get('prepTime'))
                    cook_time = _parse_duration(data.get('cookTime'))
                    servings = None
                    recipe_yield = data.get('recipeYield')
                    if recipe_yield is not None:
                        yield_str = recipe_yield
                        if isinstance(recipe_yield, list):
                            yield_str = str(recipe_yield[0]) if recipe_yield else ''
                        numbers = re.findall(r'\d+', str(yield_str))
                        if numbers:
                            servings = int(numbers[0])
                    if title:
                        return (RecipeCreate(
                            title=title,
                            description=description,
                            ingredients=ingredients_list if ingredients_list else None,
                            instructions=instructions,
                            prep_time_minutes=prep_time,
                            cook_time_minutes=cook_time,
                            servings=servings,
                            source_url=url
                        ), raw_lines)
            except (json.JSONDecodeError, KeyError, AttributeError):
                continue
    except Exception as e:
        print(f"Error extracting structured data: {e}")
    return (None, [])


# Heading levels for comparison (h1=1, h2=2, ...)
_HEADING_LEVEL = {'h1': 1, 'h2': 2, 'h3': 3, 'h4': 4, 'h5': 5, 'h6': 6}

# Strip leading symbols that recipe plugins use for checklist-style ingredients
_INGREDIENT_LINE_PREFIX = re.compile(r"^[\s▢•\-\*·◦]+", re.UNICODE)


def _extract_ingredients_from_recipe_plugins(soup: BeautifulSoup) -> Tuple[List[str], List[Ingredient]]:
    """
    Extract ingredients from known recipe plugin structures (e.g. WP Recipe Maker)
    where each ingredient is a single element with full line text. Returns (raw_lines, ingredients_list).
    """
    raw_lines: List[str] = []
    ingredients_list: List[Ingredient] = []
    seen: set = set()
    # WP Recipe Maker: .wprm-recipe-ingredient is the container (exact class; amount/unit/name use -amount etc.)
    for selector in [".wprm-recipe-ingredient"]:
        try:
            elements = soup.select(selector)
        except Exception:
            continue
        for elem in elements:
            if elem.name not in ("li", "div"):
                continue
            text = (elem.get_text(separator=" ", strip=True) or "").strip()
            text = _INGREDIENT_LINE_PREFIX.sub("", text).strip()
            if not text or len(text) < 3 or len(text) > 400:
                continue
            norm = re.sub(r"\s+", " ", text.lower())
            if norm in seen:
                continue
            seen.add(norm)
            raw_lines.append(text)
            ingredients_list.append(Ingredient(name=text))
        if len(raw_lines) >= 2:
            return (raw_lines, ingredients_list)
        raw_lines.clear()
        ingredients_list.clear()
        seen.clear()
    return ([], [])


def _extract_ingredients_from_heading_lists(container) -> Tuple[List[str], List[Ingredient]]:
    """
    Generic extraction: find headings that look like "Ingredients" (or "Ingredients for X")
    and collect list items (ul/ol li) or list-like lines (p that look like one ingredient)
    until the next same-level-or-higher heading. Used when class/table-based extraction finds nothing.
    Returns (raw_ingredient_lines, ingredients_list).
    """
    raw_lines: List[str] = []
    ingredients_list: List[Ingredient] = []
    seen_normalized: set = set()
    if not container:
        return (raw_lines, ingredients_list)

    def add_line(line: str) -> None:
        norm = re.sub(r'\s+', ' ', line.strip()).lower()
        if norm and norm not in seen_normalized and 2 <= len(line.strip()) <= 300:
            if line.strip() not in ('Instructions:', 'Method:'):
                seen_normalized.add(norm)
                raw_lines.append(line.strip())
                ingredients_list.append(Ingredient(name=line.strip()))

    heading_tag = re.compile(r'^h[2-6]$', re.IGNORECASE)
    ingredient_heading = re.compile(r'\bingredient', re.IGNORECASE)
    stop_heading = re.compile(r'\b(instruction|method|direction|step|preparation)\b', re.IGNORECASE)

    def collect_ul_ol_from_siblings(start, stop_at_heading=True, heading_level=None):
        """Collect li text from ul/ol in start.find_next_siblings(); optionally stop at same-or-higher heading."""
        for sib in start.find_next_siblings():
            if sib.name and heading_tag.match(sib.name):
                if stop_at_heading and heading_level is not None:
                    sib_level = _HEADING_LEVEL.get(sib.name, 6)
                    if sib_level <= heading_level:
                        break
                else:
                    break
            if sib.name in ('ul', 'ol'):
                for li in sib.find_all('li', recursive=False):
                    line = (li.get_text() or '').strip()
                    if line:
                        add_line(line)
            elif sib.name in ('p', 'div'):
                # Only treat as single ingredient line if it looks like one (avoid swallowing intro text)
                line = (sib.get_text() or '').strip()
                if not line:
                    continue
                line_clean = re.sub(r'^[\s\u2022\u2013\-–—•]+\s*', '', line)
                if 2 <= len(line_clean) <= 300:
                    if re.match(r'^[\d\u00BC-\u00BE\u2150-\u215E½¼¾]|^\d', line_clean) or ',' in line_clean[:50]:
                        if not re.match(r'^(instructions?|method|directions?|steps?):?\s*$', line_clean[:30], re.IGNORECASE):
                            add_line(line_clean)

    # Pass 1: ingredient sections that are <p> or <div> (e.g. <p><b>Ingredients for ...</b></p> then <ul>)
    # Require text to start with "Ingredients" so we don't match random paragraphs that mention the word
    ingredient_section_start = re.compile(r"^\s*Ingredients\b", re.IGNORECASE)
    for block in container.find_all(['p', 'div']):
        text = (block.get_text() or '').strip()
        if len(text) > 120 or not ingredient_section_start.search(text) or stop_heading.search(text):
            continue
        if block.find_parent(['li', 'ul', 'ol']):
            continue
        collect_ul_ol_from_siblings(block, stop_at_heading=True, heading_level=6)

    # Pass 2: headings h2–h6 with "ingredient" in text
    headings = container.find_all(heading_tag)
    for h in headings:
        text = (h.get_text() or '').strip()
        if not ingredient_heading.search(text) or stop_heading.search(text):
            continue
        level = _HEADING_LEVEL.get(h.name, 6)
        collect_ul_ol_from_siblings(h, stop_at_heading=True, heading_level=level)

    return (raw_lines, ingredients_list)


def _extract_ingredients_from_inline_prose(container) -> Tuple[List[str], List[Ingredient]]:
    """
    Extract ingredients when the recipe is in one or a few paragraphs (e.g. Michelin Guide):
    "Beef Rendang Serves 4 ... 500g beef short ribs ... Ingredients A: 60g shallots ... Method 1. Blend..."
    Returns (raw_ingredient_lines, ingredients_list).
    """
    raw_lines: List[str] = []
    ingredients_list: List[Ingredient] = []
    seen: set = set()
    if not container:
        return (raw_lines, ingredients_list)

    # Find blocks that look like a recipe block: contain "Ingredients" or "Serves" and quantity patterns
    ingredient_quantity = re.compile(
        r'\d+\s*(?:g|gr|kg|ml|tsp|tbsp|cup)s?\s+|\d+\s+(?:lemongrass|kaffir|turmeric|stick|cinnamon|star anise|leaf|leaves)\b',
        re.IGNORECASE
    )
    method_start = re.compile(r'\bMethod\s*\d*[.)]?|\bMethod\s*$', re.IGNORECASE)
    # Split points: number + unit (g, gr, kg, ml, ...) or number + ingredient word. Use (?<!\d) so we
    # split only at the start of a number (e.g. before "500g") not in the middle (e.g. before "0g" in "500g").
    split_before_ingredient = re.compile(
        r'(?<!\d)(?=\s*(?:\d+\s*(?:g|gr|kg|ml|tsp|tbsp|cup)s?|\d+\s+(?:lemongrass|kaffir|turmeric|stick|cinnamon|star anise|leaf|leaves)\b)\s*)',
        re.IGNORECASE
    )

    for block in container.find_all(['p', 'div']):
        if block.find_parent(['li', 'ul', 'ol']):
            continue
        text = (block.get_text() or '').strip()
        if len(text) < 80 or len(text) > 20000:
            continue
        if not ('Ingredients' in text or 'Serves' in text) or not ingredient_quantity.search(text):
            continue
        if not method_start.search(text):
            continue
        # Take only the part before "Method"
        method_match = re.search(r'\bMethod\s*\d*[.)]?\s*', text, re.IGNORECASE)
        if method_match:
            text = text[:method_match.start()].strip()
        if len(text) < 20:
            continue
        # Normalize section labels so we can split: "Ingredients A:" -> newline, same for B, C, D, "For ground dry spices:"
        text = re.sub(r'\s+Ingredients\s+[A-Z]\s*:\s*', '\n', text, flags=re.IGNORECASE)
        text = re.sub(r'\s+For\s+[^:]+:\s*', '\n', text, flags=re.IGNORECASE)
        text = re.sub(r'\s+Ingredients\s+[A-Z]\s+', '\n', text, flags=re.IGNORECASE)
        # Split into candidate lines (by lookahead for next quantity)
        parts = split_before_ingredient.split(text)
        for part in parts:
            part = part.strip()
            if not part or len(part) < 3:
                continue
            # Must look like an ingredient line: starts with number or fraction
            if not re.match(r'^[\d½¼¾\u00BC-\u00BE\u2150-\u215E]', part):
                continue
            if re.match(r'^(Ingredients|For\s|Method)\s*$', part, re.IGNORECASE):
                continue
            if len(part) > 300:
                continue
            norm = re.sub(r'\s+', ' ', part.lower())
            if norm in seen:
                continue
            seen.add(norm)
            raw_lines.append(part)
            ingredients_list.append(Ingredient(name=part))
        if len(raw_lines) >= 3:
            return (raw_lines, ingredients_list)
        raw_lines.clear()
        ingredients_list.clear()
        seen.clear()
    return ([], [])


def _extract_instructions_from_heading_lists(container) -> Tuple[Optional[str], Optional[str]]:
    """
    Find "Instructions" (or "Method" / "Steps" / "FULL RECIPE") and collect steps.
    When multiple sections exist (e.g. "ABBREVIATED RECIPE" and "FULL RECIPE"), prefer the one
    labeled "full" or "complete", else the longest. Returns (instructions, instructions_raw).
    instructions_raw is the concatenation of all instruction sections so the user can trim start/end.
    """
    if not container:
        return (None, None)
    heading_tag = re.compile(r'^h[2-6]$', re.IGNORECASE)
    instruction_section = re.compile(r'^\s*Instructions?\b', re.IGNORECASE)
    method_steps = re.compile(r'^\s*(Method|Steps?|Directions?|Procedure)\b', re.IGNORECASE)
    # RecipeTin Eats etc.: "ABBREVIATED RECIPE" vs "FULL RECIPE"
    recipe_section = re.compile(r'^\s*(ABBREVIATED\s+RECIPE|FULL\s+RECIPE|Recipe)\b', re.IGNORECASE)

    def split_numbered_steps(text: str) -> List[str]:
        parts = re.split(r'\s*(?=\d+[.)]\s+)', text)
        out = []
        for p in parts:
            p = (p or '').strip()
            if not p or len(p) < 5:
                continue
            p = re.sub(r'^\s*\d+[.)]\s+', '', p).strip()
            if p and len(p) > 5 and not re.match(r'^(RELATED|Written by|Images are)', p[:20], re.IGNORECASE):
                out.append(p)
        return out

    def _is_likely_recipe_step(step_text: str) -> bool:
        if not step_text or len(step_text) < 8:
            return False
        s = step_text.strip()[:100]
        lower = s.lower()
        if re.match(r'^(Share|Print|Subscribe|RELATED|Written by|Images? (are|courtesy)|Dining In)\b', s, re.IGNORECASE):
            return False
        if 'restaurant' in lower or 'michelin' in lower or 'family dining table' in lower:
            return False
        return True

    def collect_one_section_steps_and_raw(start_el) -> Tuple[List[str], str]:
        """Collect steps and raw text from start_el until next same-level heading. Returns (steps, raw_text)."""
        steps_list: List[str] = []
        raw_parts: List[str] = []
        start_level = _HEADING_LEVEL.get(start_el.name, 6) if start_el.name and heading_tag.match(start_el.name) else 6
        for sib in start_el.find_next_siblings():
            if sib.name and heading_tag.match(sib.name):
                sib_level = _HEADING_LEVEL.get(sib.name, 6)
                if sib_level <= start_level:
                    break
            if sib.name in ('ol', 'ul'):
                for li in sib.find_all('li', recursive=False):
                    text = (li.get_text() or '').strip()
                    if text and len(text) > 10:
                        text_clean = re.sub(r'^\s*\d+[.)]\s+', '', text).strip() or text
                        if _is_likely_recipe_step(text_clean):
                            steps_list.append(text_clean)
                    raw_parts.append((li.get_text() or '').strip())
            elif sib.name in ('p', 'div'):
                text = (sib.get_text() or '').strip()
                if text and len(text) > 15:
                    if re.match(r'^\s*\d+[.)]\s+', text):
                        one = re.sub(r'^\s*\d+[.)]\s+', '', text).strip() or text
                        if _is_likely_recipe_step(one):
                            steps_list.append(one)
                    elif re.search(r'\d+[.)]\s+', text):
                        for s in split_numbered_steps(text):
                            if _is_likely_recipe_step(s):
                                steps_list.append(s)
                    elif len(text) < 500 and not re.match(r'^(The chef|READ|RELEVANT|Written by)', text[:30], re.IGNORECASE):
                        if _is_likely_recipe_step(text):
                            steps_list.append(text)
                raw_parts.append(text)
        raw_text = '\n\n'.join(p for p in raw_parts if p)
        return (steps_list, raw_text)

    # Pass 1: Michelin-style single block "Method 1. ... 2. ..."
    steps: List[str] = []
    instructions_raw_blocks: List[str] = []
    procedure_pattern = re.compile(r'\b(Procedure|Method)\b.*?\d+[.)]\s+', re.IGNORECASE | re.DOTALL)
    for block in container.find_all(['p', 'div']):
        if block.find_parent(['li', 'ul', 'ol']):
            continue
        text = (block.get_text() or '').strip()
        if len(text) < 50 or len(text) > 15000:
            continue
        match = procedure_pattern.search(text)
        if match and re.search(r'\d+[.)]\s+\w+', text):
            after_label = re.search(r'\b(Procedure|Method)\s*.*?(\d+[.)]\s+)', text, re.IGNORECASE | re.DOTALL)
            text_from_first_step = text[after_label.start(2):] if after_label else text
            steps = split_numbered_steps(text_from_first_step)
            if steps:
                # Use method-only text for instructions_raw so the UI doesn't get article prose
                steps_joined = '\n\n'.join(f"{i+1}. {s}" for i, s in enumerate(steps))
                return (steps_joined, text_from_first_step)

    # Pass 2: Headings first (so we get multiple sections e.g. ABBREVIATED RECIPE + FULL RECIPE)
    sections: List[Tuple[str, List[str], str]] = []  # (heading_text, steps, raw_text)

    def add_section(heading_text: str, start_el) -> None:
        nonlocal sections
        st, raw = collect_one_section_steps_and_raw(start_el)
        if st or raw:
            sections.append((heading_text, st, raw))

    for h in container.find_all(heading_tag):
        text = (h.get_text() or '').strip()
        if instruction_section.search(text) or method_steps.search(text) or recipe_section.search(text):
            add_section(text, h)

    # Pass 3: Fallback – single "Instructions:" or "Method:" block then siblings
    if not sections:
        for block in container.find_all(['p', 'div']):
            text = (block.get_text() or '').strip()
            if len(text) > 50:
                continue
            if not (instruction_section.search(text) or method_steps.search(text)):
                continue
            if block.find_parent(['li', 'ul', 'ol']):
                continue
            add_section(text[:80], block)
            break

    if not sections:
        return (None, None)

    # Prefer section whose heading contains "full" or "complete"; else longest steps; else first
    def score_section(entry: Tuple[str, List[str], str]) -> Tuple[int, int]:
        heading, st, _ = entry
        lower = heading.lower()
        if 'full' in lower or 'complete' in lower:
            return (2, len(st))
        if 'abbreviated' in lower or 'short' in lower:
            return (0, len(st))
        return (1, len(st))

    best = max(sections, key=lambda e: score_section(e))
    best_heading, best_steps, best_raw = best
    chosen_instructions = '\n\n'.join(f"{i+1}. {s}" for i, s in enumerate(best_steps)) if best_steps else None
    all_raw = '\n\n---\n\n'.join(
        f"{h}\n\n{r}" for h, _, r in sections
    )
    return (chosen_instructions, all_raw if len(sections) > 1 or not chosen_instructions else (best_raw or all_raw))


def _extract_from_html_impl(soup: BeautifulSoup, url: str) -> Tuple[Optional[RecipeCreate], List[str], Optional[str]]:
    """Generic HTML parsing fallback; returns (recipe, raw_ingredient_lines, instructions_raw_override)."""
    try:
        # Try to find title
        title = None
        # Try h1 first (most common for recipe titles)
        h1 = soup.find('h1')
        if h1:
            title = h1.get_text(strip=True)
            if title and len(title) > 3 and len(title) < 200:
                pass  # Good title found
            else:
                title = None
        
        # Try other selectors
        if not title:
            for selector in ['[class*="title"]', '[class*="recipe-title"]', '[class*="post-title"]', 'article h1', 'main h1']:
                element = soup.select_one(selector)
                if element:
                    title = element.get_text(strip=True)
                    if title and len(title) > 3 and len(title) < 200:
                        break
        
        if not title:
            title_tag = soup.find('title')
            if title_tag:
                title = title_tag.get_text(strip=True)
                # Clean up title (remove site name, etc.)
                title = re.sub(r'\s*[-|]\s*.*$', '', title).strip()
                title = re.sub(r'\s*\|.*$', '', title).strip()
        
        if not title or len(title) < 3:
            title = "Imported Recipe"
        
        # Try to find description (prefer meta so form/UI text from class*="description" is skipped)
        description = None
        for selector in ['meta[name="description"]', '[class*="description"]', '[class*="summary"]']:
            element = soup.select_one(selector)
            if element:
                if element.name == 'meta':
                    description = element.get('content', '')
                else:
                    description = element.get_text(strip=True)
                if description and not _is_likely_form_or_ui_junk(description):
                    break
                description = None
        
        # Try to find ingredients (and raw lines for preview)
        ingredients_list = []
        raw_ingredient_lines = []
        tables = soup.find_all('table')
        for table in tables:
            rows = table.find_all('tr')
            start_idx = 0
            if rows and any(cell.get_text(strip=True).lower() in ['quantity', 'amount', 'ingredient', 'item'] for cell in rows[0].find_all(['td', 'th'])):
                start_idx = 1
            for row in rows[start_idx:]:
                cells = row.find_all(['td', 'th'])
                if len(cells) >= 2:
                    quantity = cells[0].get_text(strip=True)
                    ingredient_name = cells[1].get_text(strip=True)
                    if ingredient_name and len(ingredient_name) > 1:
                        raw_ingredient_lines.append(f"{quantity} {ingredient_name}".strip())
                        qty_match = re.search(r'([\d.]+)', quantity)
                        qty = float(qty_match.group(1)) if qty_match else None
                        unit_match = re.search(r'([a-zA-Z]+)', quantity)
                        unit = unit_match.group(1) if unit_match else None
                        ingredients_list.append(Ingredient(
                            name=ingredient_name,
                            quantity=qty,
                            unit=unit
                        ))
                elif len(cells) == 1:
                    text = cells[0].get_text(strip=True)
                    if text and len(text) > 2 and len(text) < 200:
                        raw_ingredient_lines.append(text)
                        ingredients_list.append(Ingredient(name=text))
            if ingredients_list:
                break
        if not ingredients_list:
            plugin_raw, plugin_ings = _extract_ingredients_from_recipe_plugins(soup)
            if plugin_ings:
                raw_ingredient_lines = plugin_raw
                ingredients_list = plugin_ings
        if not ingredients_list:
            for selector in [
                '[itemprop="recipeIngredient"]',
                'ul.ingredients li',
                'ol.ingredients li',
                'div.ingredients ul li',
                'div.ingredients ol li',
                '[class*="ingredient"]',
                '[class*="ingredients"]',
            ]:
                elements = soup.select(selector)
                if elements:
                    for elem in elements:
                        if elem.name == 'li':
                            text = elem.get_text(strip=True)
                            if text and len(text) > 2 and len(text) < 200:
                                raw_ingredient_lines.append(text)
                                ingredients_list.append(Ingredient(name=text))
                        elif elem.name in ['div', 'span', 'p']:
                            text = elem.get_text(strip=True)
                            # Require longer text for div/span to avoid capturing fragment nodes (e.g. "2", "slices")
                            if text and len(text) > 15 and len(text) < 400:
                                if not re.match(r'^(ingredients?|method|instructions?|directions?):?\s*$', text, re.IGNORECASE):
                                    raw_ingredient_lines.append(text)
                                    ingredients_list.append(Ingredient(name=text))
                    if ingredients_list:
                        break

        # Generic fallback: headings like "Ingredients" / "Ingredients for X" followed by ul/ol or list-like p
        if not ingredients_list:
            container = soup.find('main') or soup.find('article') or soup.find('body')
            if container:
                heading_raw, heading_ingredients = _extract_ingredients_from_heading_lists(container)
                if heading_ingredients:
                    raw_ingredient_lines = heading_raw
                    ingredients_list = heading_ingredients
        # Michelin-style: single paragraph with "Ingredients A:", "500g beef", "Method 1. ..."
        if not ingredients_list:
            container = soup.find('main') or soup.find('article') or soup.find('body')
            if container:
                inline_raw, inline_ingredients = _extract_ingredients_from_inline_prose(container)
                if inline_ingredients:
                    raw_ingredient_lines = inline_raw
                    ingredients_list = inline_ingredients
        
        # Try to find instructions
        instructions = None
        instructions_raw_override: Optional[str] = None
        instruction_parts = []
        container = soup.find('main') or soup.find('article') or soup.find('body')
        if container:
            instructions, instructions_raw_override = _extract_instructions_from_heading_lists(container)
        if not instructions:
            # Look for instruction sections
            # Broad selectors (article p, main p) only add numbered steps to avoid capturing whole article
            broad_selectors = ('article p', 'main p')
            for selector in [
                '[class*="instruction"]',
                '[class*="directions"]',
                '[class*="steps"]',
                '[class*="method"]',
                '[itemprop="recipeInstructions"]',
                'ol.instructions',
                'div.instructions ol',
                'article p',
                'main p',
            ]:
                elements = soup.select(selector)
                if elements:
                    for elem in elements:
                        if elem.name == 'li':
                            text = elem.get_text(strip=True)
                            if text and len(text) > 10:
                                instruction_parts.append(text)
                        elif elem.name in ['div', 'p']:
                            text = elem.get_text(strip=True)
                            if text and len(text) > 20:
                                # For article/main p, only add if it looks like a numbered step
                                if selector in broad_selectors and not re.match(r'^\s*\d+[.)]\s+', text):
                                    continue
                                if not re.match(r'^(the|for|begin|start|first|then|now|after|once|last|final)', text[:20], re.IGNORECASE):
                                    sentences = re.split(r'\.\s+', text)
                                    for sent in sentences:
                                        sent = sent.strip()
                                        if sent and len(sent) > 15:
                                            instruction_parts.append(sent)
                                else:
                                    instruction_parts.append(text)
                    if instruction_parts:
                        break

            # If still no instruction_parts, try to get paragraphs from main content (restrict to avoid whole article)
            if not instruction_parts:
                main_content = soup.find('main') or soup.find('article') or soup.find('body')
                if main_content:
                    paragraphs = main_content.find_all(['p', 'div'])
                    for p in paragraphs:
                        if p.find_parent('table') or p.find_parent(['nav', 'header', 'footer']):
                            continue
                        text = p.get_text(strip=True)
                        if not text or len(text) < 30:
                            continue
                        if len(text) < 100 and text.isupper() and not text.endswith('.'):
                            continue
                        if re.match(r'^(home|about|contact|subscribe|menu|search|©|follow|share)', text[:30], re.IGNORECASE):
                            continue
                        # Only add if it looks like a numbered step; skip article prose
                        if re.match(r'^\s*\d+[.)]\s+', text):
                            instruction_parts.append(text)

            # Last resort: scan main text for a run of numbered steps (e.g. "Procedure1. ... 2. ..." in one block)
            if not instruction_parts and container:
                main_text = (container.get_text() or '')
                for anchor in (r'Procedure', r'Method', r'1\.\s'):
                    idx = re.search(anchor, main_text, re.IGNORECASE)
                    if idx:
                        start = idx.start()
                        chunk = main_text[start:start + 4000]
                        steps_found = re.findall(r'\d+[.)]\s+(.+?)(?=\s*\d+[.)]\s+|\s*$)', chunk, re.DOTALL)
                        if len(steps_found) >= 2:
                            cleaned = []
                            for s in steps_found[:15]:
                                s = s.strip()
                                for stop in (' Today,', ' RELATED', 'Written by', 'Images are'):
                                    i = s.find(stop)
                                    if i > 0:
                                        s = s[:i].strip()
                                if s and len(s) > 10:
                                    cleaned.append(s)
                            if len(cleaned) >= 2:
                                instruction_parts = [f"{i+1}. {s}" for i, s in enumerate(cleaned)]
                            break
                    if instruction_parts:
                        break

            if instruction_parts:
                # Expand blocks that contain "Procedure1. ... 2. ..." or "1. ... 2. ..." into separate steps
                expanded = []
                procedure_or_numbered = re.compile(r'\b(Procedure|Method)\b.*\d+[.)]\s+|\d+[.)]\s+.+\d+[.)]\s+', re.IGNORECASE | re.DOTALL)
                for part in instruction_parts:
                    part = part.strip()
                    if not part or len(part) < 10:
                        continue
                    if len(part) > 200 and procedure_or_numbered.search(part):
                        # Split "Procedure1. ... 2. ..." or "1. ... 2. ..." into steps
                        sub_steps = re.split(r'\s*(?=\d+[.)]\s+)', part)
                        step_num = 0
                        for s in sub_steps:
                            s = re.sub(r'^\s*\d+[.)]\s+', '', s.strip()).strip()
                            if s and len(s) > 5 and not re.match(r'^(RELATED|Written by|Procedure|Method)\b', s[:20], re.IGNORECASE):
                                step_num += 1
                                expanded.append(f"{step_num}. {s}")
                    else:
                        expanded.append(part)
                instruction_parts = expanded
                seen = set()
                unique_parts = []
                for part in instruction_parts:
                    normalized = re.sub(r'\s+', ' ', part.lower().strip())
                    if normalized not in seen and len(part.strip()) > 10:
                        seen.add(normalized)
                        unique_parts.append(part.strip())
                # When we have clear numbered steps, keep only those to avoid article prose (e.g. Michelin)
                step_like = re.compile(r'^\s*\d+[.)]\s+')
                numbered = [p for p in unique_parts if step_like.match(p)]
                if len(numbered) >= 2:
                    filtered = numbered
                else:
                    filtered = unique_parts
                if filtered:
                    instructions = '\n\n'.join(filtered)
                    if len(instructions) > 5500:
                        instructions = instructions[:5500].rsplit('\n\n', 1)[0] + '\n\n...'

        # Try to find times and servings from common patterns
        prep_time = None
        cook_time = None
        servings = None
        
        text_content = soup.get_text()
        
        # Look for time patterns
        time_patterns = [
            (r'prep[:\s]+(\d+)\s*(?:min|minutes?|mins?)', 'prep'),
            (r'cook[:\s]+(\d+)\s*(?:min|minutes?|mins?)', 'cook'),
            (r'(\d+)\s*(?:min|minutes?|mins?)\s+prep', 'prep'),
            (r'(\d+)\s*(?:min|minutes?|mins?)\s+cook', 'cook'),
        ]
        
        for pattern, time_type in time_patterns:
            match = re.search(pattern, text_content, re.IGNORECASE)
            if match:
                minutes = int(match.group(1))
                if time_type == 'prep':
                    prep_time = minutes
                else:
                    cook_time = minutes
        
        # Look for servings (e.g. "Servings: 2", "Serves 4", "Yield: 6")
        servings_match = (
            re.search(r'Servings?[:\s]+(\d+)', text_content, re.IGNORECASE)
            or re.search(r'serves?[:\s]+(\d+)', text_content, re.IGNORECASE)
            or re.search(r'Yield[s]?[:\s]+(\d+)', text_content, re.IGNORECASE)
        )
        if servings_match:
            servings = int(servings_match.group(1))
        
        # Return recipe even if we only have title and description
        # The text fallback will handle cases where we have no structured data
        has_some_content = (
            (ingredients_list and len(ingredients_list) > 0) or 
            (instructions and len(instructions) > 50) or
            (description and len(description) > 50)
        )
        
        if has_some_content or title != "Imported Recipe":
            return (RecipeCreate(
                title=title,
                description=description,
                ingredients=ingredients_list if ingredients_list else None,
                instructions=instructions,
                prep_time_minutes=prep_time,
                cook_time_minutes=cook_time,
                servings=servings,
                source_url=url
            ), raw_ingredient_lines, instructions_raw_override)
        
        return (None, [], None)
    except Exception as e:
        print(f"Error in generic HTML extraction: {e}")
        import traceback
        traceback.print_exc()
        return (None, [], None)


def _extract_from_html(soup: BeautifulSoup, url: str) -> Optional[RecipeCreate]:
    """Wrapper for backward compatibility."""
    recipe, _, _ = _extract_from_html_impl(soup, url)
    return recipe


def _extract_all_text_fallback(soup: BeautifulSoup, url: str) -> Optional[RecipeCreate]:
    """Last resort: extract all main text content from the page"""
    try:
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "header", "footer", "aside", "form"]):
            script.decompose()
        
        # Try to get title
        title = None
        h1 = soup.find('h1')
        if h1:
            title = h1.get_text(strip=True)
            if title and 3 < len(title) < 200:
                pass  # Good title
            else:
                title = None
        
        if not title:
            title_tag = soup.find('title')
            if title_tag:
                title = title_tag.get_text(strip=True)
                # Clean up title
                title = re.sub(r'\s*[-|]\s*.*$', '', title).strip()
                title = re.sub(r'\s*\|.*$', '', title).strip()
        
        if not title or len(title) < 3:
            title = "Imported Recipe"
        
        # Get main content - try to find the main article/content area
        main_content = None
        content_elements = []
        
        # Try specific selectors first
        for selector in ['main', 'article', '[role="main"]', '.content', '.post', '.entry-content', '[class*="post-content"]', '[class*="article-content"]']:
            element = soup.select_one(selector)
            if element:
                # Get all paragraphs and text blocks
                paragraphs = element.find_all(['p', 'div', 'li'])
                for p in paragraphs:
                    text = p.get_text(strip=True)
                    if text and len(text) > 20:
                        # Skip navigation/header text
                        if not re.match(r'^(home|about|contact|subscribe|menu|search)', text[:20], re.IGNORECASE):
                            content_elements.append(text)
                if content_elements:
                    break
        
        # If no specific content area, try to get paragraphs from body
        if not content_elements:
            body = soup.find('body')
            if body:
                # Get all paragraphs, but skip navigation areas
                paragraphs = body.find_all(['p', 'div', 'li'])
                for p in paragraphs:
                    # Skip if in nav/header/footer
                    parent = p.find_parent(['nav', 'header', 'footer'])
                    if parent:
                        continue
                    
                    text = p.get_text(strip=True)
                    if text and len(text) > 30:
                        # Skip navigation/header text and very short text
                        skip_patterns = [
                            r'^(home|about|contact|subscribe|menu|search|©|follow|share|thanks for subscribing)',
                            r'^[A-Z\s]{0,30}$',  # All caps short text
                        ]
                        should_skip = False
                        for pattern in skip_patterns:
                            if re.match(pattern, text[:50], re.IGNORECASE):
                                should_skip = True
                                break
                        
                        if not should_skip:
                            content_elements.append(text)
        
        # Also try to extract tables (for ingredients)
        ingredients_from_tables = []
        tables = soup.find_all('table')
        for table in tables:
            rows = table.find_all('tr')
            for row in rows:
                cells = row.find_all(['td', 'th'])
                if len(cells) >= 2:
                    quantity = cells[0].get_text(strip=True)
                    ingredient = cells[1].get_text(strip=True)
                    if ingredient and len(ingredient) > 1:
                        ingredients_from_tables.append(f"{quantity} {ingredient}")
        
        # Combine content
        if content_elements:
            # Remove duplicates
            seen = set()
            unique_content = []
            for elem in content_elements:
                normalized = re.sub(r'\s+', ' ', elem.lower().strip())
                if normalized not in seen and len(elem.strip()) > 20:
                    seen.add(normalized)
                    unique_content.append(elem.strip())
            
            main_content = '\n\n'.join(unique_content)
            
            # Add table ingredients if found
            if ingredients_from_tables:
                main_content = "INGREDIENTS:\n" + '\n'.join(ingredients_from_tables) + "\n\n" + main_content
        
        # Clean up the text
        if main_content:
            # Remove excessive whitespace
            main_content = re.sub(r'\n{3,}', '\n\n', main_content)
            # Remove very short lines (likely navigation/ads)
            lines = main_content.split('\n')
            filtered_lines = []
            for line in lines:
                line = line.strip()
                if len(line) > 15 or (line and line[0].isdigit()):
                    # Skip common footer/nav text
                    if not re.match(r'^(©|follow|share|subscribe|home|about)', line[:20], re.IGNORECASE):
                        filtered_lines.append(line)
            main_content = '\n'.join(filtered_lines)
            # Limit length to avoid huge content
            if len(main_content) > 15000:
                main_content = main_content[:15000] + "..."
        
        # Always return something if we have a title and any content
        if main_content and len(main_content) > 50:
            return RecipeCreate(
                title=title,
                description=main_content,
                ingredients=None,
                instructions=None,
                prep_time_minutes=None,
                cook_time_minutes=None,
                servings=None,
                source_url=url
            )
        elif title and title != "Imported Recipe":
            # Even if we can't extract content, return the title so user can edit
            return RecipeCreate(
                title=title,
                description="Content could not be automatically extracted. Please edit this recipe manually.",
                ingredients=None,
                instructions=None,
                prep_time_minutes=None,
                cook_time_minutes=None,
                servings=None,
                source_url=url
            )
    except Exception as e:
        print(f"Error in text fallback extraction: {e}")
        import traceback
        traceback.print_exc()
    
    return None


def _get_image_urls_from_soup(soup: BeautifulSoup, base_url: str) -> List[str]:
    """Collect all image URLs from the page (absolute). Prefer larger images, exclude tiny icons."""
    seen = set()
    urls = []
    for img in soup.find_all('img'):
        src = img.get('src')
        if not src or not src.strip():
            continue
        full_url = urljoin(base_url, src.strip())
        if full_url in seen:
            continue
        seen.add(full_url)
        # Skip data URLs and common tracking/icon paths
        if full_url.startswith('data:') or 'pixel' in full_url.lower() or 'tracking' in full_url.lower():
            continue
        w, h = img.get('width'), img.get('height')
        if w and h:
            try:
                if int(w) < 50 or int(h) < 50:
                    continue
            except (ValueError, TypeError):
                pass
        urls.append(full_url)
    return urls


async def extract_recipe_preview_from_url(url: str) -> Optional[Dict]:
    """
    Fetch URL once and return recipe + raw_ingredient_lines + image_urls for the import preview screen.
    Returns a dict compatible with RecipeImportPreview schema.
    """
    async with httpx.AsyncClient(headers=DEFAULT_HTTP_HEADERS) as client:
        try:
            response = await client.get(url, timeout=15.0, follow_redirects=True)
            response.raise_for_status()
            html_content = response.text
            soup = BeautifulSoup(html_content, 'html.parser')
        except Exception as e:
            print(f"Error fetching URL for preview: {e}")
            return None

    image_urls = _get_image_urls_from_soup(soup, url)

    def _preview_payload(recipe: RecipeCreate, raw_lines: List[str], image_urls: List[str], instructions_raw_override: Optional[str] = None) -> Dict:
        """Build preview payload. instructions_raw_override: when set (e.g. full method block), user can trim start/end."""
        raw_inst = instructions_raw_override if instructions_raw_override is not None else recipe.instructions
        raw_inst = _trim_instructions_raw_if_article(raw_inst or "")
        payload = {
            "recipe": recipe.model_dump(),
            "raw_ingredient_lines": raw_lines,
            "image_urls": image_urls,
            "instructions_raw": raw_inst,
        }
        if raw_lines:
            parsed = parse_ingredient_lines(raw_lines, "quantity_unit_name")
            payload["recipe"]["ingredients"] = [p.model_dump() for p in parsed]
        return payload

    # Try soup-based extraction first (single fetch)
    recipe, raw_lines = _extract_from_structured_data_with_raw(soup, url)
    if recipe:
        return _preview_payload(recipe, raw_lines, image_urls)

    recipe, raw_lines, instructions_raw_override = _extract_from_html_impl(soup, url)
    if recipe:
        return _preview_payload(recipe, raw_lines, image_urls, instructions_raw_override)

    fallback_recipe = _extract_all_text_fallback(soup, url)
    if fallback_recipe:
        return {
            "recipe": fallback_recipe.model_dump(),
            "raw_ingredient_lines": [],
            "image_urls": image_urls,
            "instructions_raw": fallback_recipe.instructions,
        }

    # Last: try recipe_scrapers (may do a second fetch)
    try:
        scraper = scrape_me(url)
        if scraper:
            title = scraper.title() if hasattr(scraper, 'title') else None
            description = scraper.description() if hasattr(scraper, 'description') else None
            if description and _is_likely_form_or_ui_junk(description):
                description = None
            instructions = scraper.instructions() if hasattr(scraper, 'instructions') else None
            ingredients_list = []
            raw_ingredients = []
            if hasattr(scraper, 'ingredients'):
                raw_ingredients = [str(ing) for ing in scraper.ingredients()]
                for ing in raw_ingredients:
                    ingredients_list.append(Ingredient(name=ing))
            prep_time = cook_time = None
            if hasattr(scraper, 'total_time') and scraper.total_time():
                t = scraper.total_time() // 2
                prep_time = cook_time = t
            servings = None
            if hasattr(scraper, 'yields') and scraper.yields():
                numbers = re.findall(r'\d+', str(scraper.yields()))
                if numbers:
                    servings = int(numbers[0])
            if title and (ingredients_list or instructions):
                recipe = RecipeCreate(
                    title=title,
                    description=description,
                    ingredients=ingredients_list if ingredients_list else None,
                    instructions=instructions,
                    prep_time_minutes=prep_time,
                    cook_time_minutes=cook_time,
                    servings=servings,
                    source_url=url,
                )
                return _preview_payload(recipe, raw_ingredients, image_urls)
    except Exception as e:
        print(f"recipe-scrapers failed in preview: {e}")

    return None


# Known measurement units (and common abbreviations). If parsed "unit" isn't here, treat as part of name.
_MEASUREMENT_UNITS = frozenset({
    "g", "gr", "gram", "grams", "kg", "kilogram", "kilograms",
    "mg", "ml", "milliliter", "milliliters", "l", "liter", "liters", "litre", "litres",
    "oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds",
    "cup", "cups", "tbsp", "tbs", "tablespoon", "tablespoons",
    "tsp", "teaspoon", "teaspoons", "pinch", "pinches",
    "clove", "cloves", "slice", "slices", "piece", "pieces", "can", "cans",
    "bunch", "bunches", "sprig", "sprigs", "stalk", "stalks", "leaf", "leaves",
    "pack", "packs", "package", "packages", "bag", "bags", "box", "boxes",
    "dash", "drop", "drops", "handful", "handfuls",
})

# Unicode fraction to decimal for quantity parsing (½ ¼ ¾ ⅓ ⅔ etc.)
_UNICODE_FRACTION = {
    "\u00BC": 0.25, "\u00BD": 0.5, "\u00BE": 0.75,  # ¼ ½ ¾
    "\u2153": 1/3, "\u2154": 2/3, "\u2155": 0.2, "\u2156": 1/3, "\u2157": 0.4,
    "\u2158": 0.5, "\u2159": 2/3, "\u215A": 0.8, "\u215B": 0.125, "\u215C": 0.375,
    "\u215D": 0.625, "\u215E": 0.875,
}


def parse_ingredient_lines(raw_lines: List[str], pattern: str = "quantity_unit_name") -> List[Ingredient]:
    """
    Parse raw ingredient lines into Ingredient list using the given pattern.
    pattern: "quantity_unit_name" | "quantity_only" | "name_only"
    """
    result = []
    for line in raw_lines:
        line = (line or "").strip()
        if not line:
            continue
        if pattern == "name_only":
            result.append(Ingredient(name=line))
            continue
        # Normalize line for parsing: replace Unicode fractions with decimal
        parse_line = line
        # Leading fraction only (e.g. "½ cup" -> "0.5 cup")
        for char, val in _UNICODE_FRACTION.items():
            if line.startswith(char) or re.match(r"^\s*" + re.escape(char), line):
                parse_line = re.sub(r"^\s*" + re.escape(char) + r"\s*", str(val) + " ", line)
                break
        # Digit + fraction (e.g. "2½ cups" -> "2.5 cups") so the regex sees one number
        for char, val in _UNICODE_FRACTION.items():
            def repl(m):
                try:
                    return str(float(m.group(1)) + val)
                except (ValueError, TypeError):
                    return m.group(0)
            parse_line = re.sub(r"(\d+)\s*" + re.escape(char), repl, parse_line)
        # Match optional number (or range e.g. 4-6), optional unit (letters), rest is name
        if pattern == "quantity_unit_name":
            m = re.match(r"^\s*([\d./]+(?:-\d+)?(?:\s+\d+/\d+)?)?\s*([a-zA-Zª°]+)?\s*(.+)$", parse_line)
            if m:
                qty_str, unit, name = m.group(1), m.group(2), (m.group(3) or "").strip()
                # Strip leading comma from name (e.g. "200 grams, fresh coconut milk" -> name "fresh coconut milk")
                name = re.sub(r"^,\s*", "", name).strip()
                # Strip range remnant from name (e.g. "4-6 cloves" gave name "-6 cloves" -> "cloves"; "-6 fresh chillies" -> "fresh chillies")
                name = re.sub(r"^-\s*\d+\s+", "", name).strip()
                qty = None
                if qty_str:
                    qty_str = qty_str.strip()
                    # Range: "4-6" -> use first (lower) number
                    if "-" in qty_str and re.match(r"^\d+-\d+", qty_str):
                        try:
                            qty = float(re.match(r"^(\d+)", qty_str).group(1))
                        except (AttributeError, ValueError):
                            pass
                    if qty is None:
                        if "/" in qty_str:
                            parts = re.split(r"\s+", qty_str, 1)
                            try:
                                from fractions import Fraction
                                qty = float(Fraction(parts[0]))
                                if len(parts) > 1:
                                    qty += float(Fraction(parts[1]))
                            except (ValueError, ZeroDivisionError):
                                try:
                                    qty = float(re.search(r"[\d.]+", qty_str).group())
                                except (AttributeError, ValueError):
                                    pass
                        else:
                            try:
                                qty = float(re.sub(r"\s+", "", qty_str))
                            except ValueError:
                                first_num = re.match(r"^[\d.]+", qty_str)
                                if first_num:
                                    try:
                                        qty = float(first_num.group(0))
                                    except ValueError:
                                        pass
                # If "unit" isn't a real measurement (e.g. "ripe" in "1 ripe mango"), treat as part of name
                if unit and unit.lower() not in _MEASUREMENT_UNITS:
                    # If name is a single character, merge without space so "eg" + "g" -> "egg"
                    name = (unit + name) if (name and len(name.strip()) <= 1) else (f"{unit} {name}".strip() if name else unit)
                    unit = None
                result.append(Ingredient(name=name or line, quantity=qty, unit=unit if unit else None))
            else:
                result.append(Ingredient(name=line))
        elif pattern == "quantity_only":
            m = re.match(r"^\s*([\d.]+)\s+(.+)$", line)
            if m:
                try:
                    qty = float(m.group(1))
                    name = m.group(2).strip()
                    result.append(Ingredient(name=name, quantity=qty, unit=None))
                except ValueError:
                    result.append(Ingredient(name=line))
            else:
                result.append(Ingredient(name=line))
        else:
            result.append(Ingredient(name=line))
    return result


def _parse_duration(duration_str: Optional[str]) -> Optional[int]:
    """Parse ISO 8601 duration (PT30M) or similar to minutes"""
    if not duration_str:
        return None
    
    try:
        # ISO 8601 format: PT30M, PT1H30M, etc.
        if duration_str.startswith('PT'):
            duration_str = duration_str[2:]
            minutes = 0
            hours = re.search(r'(\d+)H', duration_str)
            if hours:
                minutes += int(hours.group(1)) * 60
            mins = re.search(r'(\d+)M', duration_str)
            if mins:
                minutes += int(mins.group(1))
            return minutes if minutes > 0 else None
        # Simple number (assume minutes)
        numbers = re.findall(r'\d+', duration_str)
        if numbers:
            return int(numbers[0])
    except:
        pass
    
    return None
