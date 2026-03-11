"""
Integration tests for the recipe URL extractor.

Runs the parser against real recipe URLs from multiple sources and asserts
that title, ingredients, instructions, description, and servings are extracted
reasonably. Requires network access.

Run integration tests only:
  pytest tests/test_recipe_extractor_integration.py -v -m integration

Run all tests except integration (no network):
  pytest tests/ -v -m "not integration"

Run full suite (including integration):
  pytest tests/ -v

Avoiding parser failures on new websites:
- Add new URLs to RECIPE_SOURCES with optional strict checks: max_instructions_len,
  instructions_should_not_contain, ingredient_quantity_checks. These catch article
  bloat and wrong quantity parsing.
- The extractor applies _trim_instructions_raw_if_article so long instructions_raw
  containing article phrases are auto-trimmed to the first numbered step.
- Inline-prose split uses a lookbehind so "500g" is not split into "0g". When adding
  new regex splits, avoid matching in the middle of numbers.
- Unit tests (test_inline_prose_*, test_trim_instructions_raw_*) guard these
  behaviours without network; add similar fixtures when fixing new failure modes.
"""
import pytest
from bs4 import BeautifulSoup

from app.services.recipe_extractor import (
    extract_recipe_preview_from_url,
    _is_likely_form_or_ui_junk,
    _extract_ingredients_from_inline_prose,
    _extract_from_structured_data_with_raw,
    _trim_instructions_raw_if_article,
    parse_ingredient_lines,
)


# Recipe URLs from different sources. Each entry must have:
# - min_ingredients: at least 1 (enforced globally); use higher values for known-rich recipes.
# - min_instructions_len: at least 50 (enforced globally); use higher for long method blocks.
# Optional robustness checks (per source):
# - max_instructions_len: instructions must not exceed this (catches article bloat).
# - instructions_should_not_contain: list of phrases that must not appear in instructions (article prose).
# - ingredient_quantity_checks: list of {"name_contains": str, "quantity": number, "unit": str}; at least one
#   ingredient whose name contains the substring must have the given quantity and unit (catches bad parsing).
RECIPE_SOURCES = [
    {
        "url": "https://www.justonecookbook.com/beef-udon/",
        "source": "Just One Cookbook",
        "min_ingredients": 10,
        "min_instructions_len": 500,
        "expect_servings": True,
        "description_should_not_contain": ["validation", "email(required)", "unchanged"],
    },
    {
        "url": "https://guide.michelin.com/my/en/article/dining-in/ceki-penang-recipe-for-nyonya-asam-pedas-fish",
        "source": "Michelin Guide (Ceki Penang)",
        "min_ingredients": 5,
        "min_instructions_len": 200,
        "expect_servings": False,
        "description_should_not_contain": ["validation", "email(required)"],
    },
    {
        "url": "https://guide.michelin.com/sg/en/article/dining-in/recipe-candlenut-beef-rendang",
        "source": "Michelin Guide (Candlenut Rendang)",
        "min_ingredients": 8,
        "min_instructions_len": 400,
        "expect_servings": True,
        "description_should_not_contain": ["validation", "email(required)"],
        "max_instructions_len": 2500,
        "instructions_should_not_contain": [
            "Beef rendang is a starring dish",
            "family dining table",
            "one MICHELIN star",
        ],
        "ingredient_quantity_checks": [
            {"name_contains": "beef short ribs", "quantity": 500, "unit": "g"},
            {"name_contains": "coconut milk", "quantity": 400, "unit": "ml"},
        ],
    },
    {
        "url": "https://www.recipetineats.com/swedish-meatballs/",
        "source": "RecipeTin Eats",
        "min_ingredients": 5,
        "min_instructions_len": 200,
        "expect_servings": False,
        "description_should_not_contain": ["validation", "email(required)"],
    },
    {
        "url": "https://www.seriouseats.com/ultra-fluffy-mashed-potatoes-recipe",
        "source": "Serious Eats",
        "min_ingredients": 3,
        "min_instructions_len": 100,
        "expect_servings": False,
        "description_should_not_contain": ["validation", "email(required)"],
    },
    {
        "url": "https://www.bbcgoodfood.com/recipes/chicken-pasta-bake",
        "source": "BBC Good Food",
        "min_ingredients": 5,
        "min_instructions_len": 100,
        "expect_servings": False,
        "description_should_not_contain": ["validation", "email(required)"],
    },
    {
        "url": "https://www.bbc.co.uk/food/recipes/chicken_fajita_bowl_02683",
        "source": "BBC Food",
        "min_ingredients": 10,
        "min_instructions_len": 400,
        "expect_servings": True,
        "description_should_not_contain": ["validation", "email(required)"],
    },
    {
        "url": "https://www.justonecookbook.com/yaki-udon/",
        "source": "Just One Cookbook (yaki udon)",
        "min_ingredients": 5,
        "min_instructions_len": 200,
        "expect_servings": False,
        "description_should_not_contain": ["validation", "email(required)"],
    },
    {
        "url": "https://www.recipetineats.com/shakshuka/",
        "source": "RecipeTin Eats (shakshuka)",
        "min_ingredients": 5,
        "min_instructions_len": 100,
        "expect_servings": False,
        "description_should_not_contain": ["validation", "email(required)"],
    },
]


def _assert_preview_structure(preview: dict, source_name: str) -> None:
    """Shared assertions for preview payload structure."""
    assert preview is not None, f"{source_name}: preview should not be None"
    assert "recipe" in preview, f"{source_name}: preview should have 'recipe'"
    recipe = preview["recipe"]
    assert isinstance(recipe.get("title"), str), f"{source_name}: recipe should have string title"
    assert len(recipe["title"]) >= 3, f"{source_name}: title too short"
    assert "ingredients" in recipe, f"{source_name}: recipe should have 'ingredients'"
    assert isinstance(recipe["ingredients"], list), f"{source_name}: ingredients should be a list"


def _assert_no_form_junk_in_description(description: str | None, source_name: str) -> None:
    """Description must not be form/UI junk (e.g. newsletter labels)."""
    if not description:
        return
    assert not _is_likely_form_or_ui_junk(description), (
        f"{source_name}: description looks like form/UI junk: {description[:80]!r}..."
    )


def _assert_recipe_has_substance(recipe: dict, source_name: str) -> None:
    """Ensure parsed recipe is usable: non-empty ingredients, non-blank instructions, no blank ingredient names."""
    ingredients = recipe.get("ingredients") or []
    assert len(ingredients) >= 1, (
        f"{source_name}: recipe must have at least one ingredient, got {len(ingredients)}"
    )
    for i, ing in enumerate(ingredients):
        name = (ing.get("name") if isinstance(ing, dict) else str(ing)).strip()
        assert name, (
            f"{source_name}: ingredient[{i}] must not be blank, got {ing!r}"
        )
    instructions = (recipe.get("instructions") or "").strip()
    assert len(instructions) >= 50, (
        f"{source_name}: instructions must not be blank or trivial (>= 50 chars), got length {len(instructions)}"
    )


@pytest.mark.integration
@pytest.mark.parametrize("case", RECIPE_SOURCES, ids=[c["source"] for c in RECIPE_SOURCES])
async def test_extract_preview_from_url(case: dict) -> None:
    """Fetch each recipe URL and assert title, ingredients, instructions, and description."""
    url = case["url"]
    source = case["source"]
    preview = await extract_recipe_preview_from_url(url)

    _assert_preview_structure(preview, source)
    recipe = preview["recipe"]
    _assert_recipe_has_substance(recipe, source)

    # Title
    assert len(recipe["title"]) >= 3, f"{source}: title too short"

    # Ingredients (per-case minimums; _assert_recipe_has_substance already ensures non-empty)
    ingredients = recipe.get("ingredients") or []
    min_ing = case.get("min_ingredients", 1)
    assert len(ingredients) >= min_ing, (
        f"{source}: expected at least {min_ing} ingredients, got {len(ingredients)}"
    )

    # Instructions
    instructions = recipe.get("instructions") or ""
    min_inst = case.get("min_instructions_len", 0)
    assert len(instructions) >= min_inst, (
        f"{source}: expected instructions length >= {min_inst}, got {len(instructions)}"
    )
    if case.get("max_instructions_len") is not None:
        max_inst = case["max_instructions_len"]
        assert len(instructions) <= max_inst, (
            f"{source}: instructions should not exceed {max_inst} chars (got {len(instructions)}); possible article bloat"
        )
    if case.get("instructions_should_not_contain"):
        inst_lower = instructions.lower()
        for phrase in case["instructions_should_not_contain"]:
            assert phrase.lower() not in inst_lower, (
                f"{source}: instructions must not contain article prose: {phrase!r}"
            )

    # Optional: assert specific ingredient quantities were parsed correctly
    if case.get("ingredient_quantity_checks"):
        for check in case["ingredient_quantity_checks"]:
            name_contains = check["name_contains"].lower()
            expected_qty = check["quantity"]
            expected_unit = (check.get("unit") or "").lower()
            matching = [
                ing for ing in ingredients
                if name_contains in (ing.get("name") or "").lower()
            ]
            assert matching, (
                f"{source}: no ingredient name containing {name_contains!r}; cannot check quantity/unit"
            )
            ing = matching[0]
            actual_qty = ing.get("quantity")
            actual_unit = (ing.get("unit") or "").lower()
            assert actual_qty == expected_qty, (
                f"{source}: ingredient with {name_contains!r} should have quantity {expected_qty}, got {actual_qty}"
            )
            assert actual_unit == expected_unit, (
                f"{source}: ingredient with {name_contains!r} should have unit {expected_unit!r}, got {actual_unit!r}"
            )

    # Description must not be form junk
    _assert_no_form_junk_in_description(recipe.get("description"), source)
    if case.get("description_should_not_contain"):
        desc = (recipe.get("description") or "").lower()
        for phrase in case["description_should_not_contain"]:
            assert phrase.lower() not in desc, (
                f"{source}: description should not contain {phrase!r}"
            )

    # Servings (optional)
    if case.get("expect_servings") and recipe.get("servings") is not None:
        assert isinstance(recipe["servings"], (int, float)), (
            f"{source}: servings should be numeric when present"
        )


@pytest.mark.integration
async def test_just_one_cookbook_ingredient_parsing() -> None:
    """Just One Cookbook: quantities like 2½ and 1½ parse correctly."""
    url = "https://www.justonecookbook.com/beef-udon/"
    preview = await extract_recipe_preview_from_url(url)
    assert preview is not None
    ingredients = (preview.get("recipe") or {}).get("ingredients") or []
    # First ingredient is "2½ cups dashi..."
    dashi = next((i for i in ingredients if "dashi" in (i.get("name") or "").lower()), None)
    assert dashi is not None, "Expected a dashi ingredient"
    assert dashi.get("quantity") == 2.5, f"Expected quantity 2.5 for 2½ cups, got {dashi.get('quantity')}"
    assert (dashi.get("unit") or "").lower() == "cups", f"Expected unit cups, got {dashi.get('unit')}"


@pytest.mark.integration
async def test_michelin_instructions_not_whole_article() -> None:
    """Michelin Ceki: instructions should be procedure steps, not the full article."""
    url = "https://guide.michelin.com/my/en/article/dining-in/ceki-penang-recipe-for-nyonya-asam-pedas-fish"
    preview = await extract_recipe_preview_from_url(url)
    assert preview is not None
    instructions = (preview.get("recipe") or {}).get("instructions") or ""
    # Should have numbered steps and not be 10k+ chars of article
    assert len(instructions) <= 6000, "Instructions should be capped, not full article"
    assert "1." in instructions or "Blend" in instructions, "Expected procedure steps"
    assert "Dining In" not in instructions or instructions.count("Dining In") <= 1, (
        "Instructions should not repeat nav/section text"
    )


def test_inline_prose_michelin_like_block_parses_ingredients() -> None:
    """Unit test: Michelin-style single-paragraph recipe yields multiple ingredients."""
    html = (
        "<div><p>Beef Rendang Serves 4, with rice as part of a multi-course meal "
        "500g beef short ribs, cut into 5cm chunks Ingredients A: 60g peeled shallots "
        "20g peeled garlic 60g big red chilli, stem removed 15g peeled galangal "
        "5g peeled ginger 3g candlenut Ingredients B: 1 lemongrass, bruised "
        "3 kaffir lime leaves 1 turmeric leaf 1 stick cinnamon 1 star anise "
        "400ml fresh coconut milk ½ tsp salt ¼ tsp sugar For ground dry spices: "
        "2g fennel seeds 4g coriander seeds 1g black pepper Ingredients D 35g kerisik "
        "(shredded, toasted coconut paste) 2g ground dry spices Method 1. Blend all the spices."
        "</p></div>"
    )
    soup = BeautifulSoup(html, "html.parser")
    raw, ingredients = _extract_ingredients_from_inline_prose(soup)
    assert len(raw) >= 8, f"Expected multiple ingredient lines, got {raw}"
    joined = " ".join(raw).lower()
    assert "beef short ribs" in joined
    assert "fennel seeds" in joined
    # Regression: split must not break "500g" into "0g" (use (?<!\d) in split pattern)
    first_beef = next((r for r in raw if "beef short ribs" in r.lower()), None)
    assert first_beef is not None and first_beef.strip().startswith("500g"), (
        f"First beef line should start with 500g, got {first_beef!r}"
    )
    parsed = parse_ingredient_lines(raw, "quantity_unit_name")
    beef_ing = next((p for p in parsed if "beef short ribs" in (p.name or "").lower()), None)
    assert beef_ing is not None and beef_ing.quantity == 500 and (beef_ing.unit or "").lower() == "g", (
        f"Parsed beef should be 500 g, got {beef_ing}"
    )


def test_trim_instructions_raw_strips_article_prose() -> None:
    """Unit test: instructions_raw with article + method is trimmed to method only (avoids new-site bloat)."""
    blob = (
        "Share\n\nBeef rendang is a starring dish in chef Malcolm Lee's repertoire and it appears "
        "at his family dining table as it does on the menu of his one MICHELIN star restaurant.\n\n"
        "1. Blend all the spices from the list of Ingredients A in a food processor.\n\n"
        "2. Place the spice mixture into a big pot and add in coconut milk."
    )
    out = _trim_instructions_raw_if_article(blob, max_len_before_trim=100)
    assert "Share" not in out and "family dining table" not in out and "one MICHELIN star" not in out, (
        "Trimmed instructions should not contain article phrases"
    )
    assert out.strip().startswith("1."), "Trimmed text should start with first step"
    assert "Blend all the spices" in out


def test_structured_data_at_graph_extracts_recipe() -> None:
    """Unit test: JSON-LD with @graph (e.g. BBC Food) yields recipe with ingredients."""
    import json
    ld = {
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "WebPage", "name": "Recipe page"},
            {
                "@type": "Recipe",
                "name": "Test bowl",
                "recipeIngredient": ["110g brown rice", "2 chicken thighs, diced", "1 lime"],
                "recipeInstructions": [
                    {"@type": "HowToStep", "text": "Cook the rice."},
                    "Serve.",
                ],
                "recipeYield": "2",
            },
        ],
    }
    html = f'<html><head><script type="application/ld+json">{json.dumps(ld)}</script></head><body></body></html>'
    soup = BeautifulSoup(html, "html.parser")
    recipe, raw_lines = _extract_from_structured_data_with_raw(soup, "https://example.com/recipe")
    assert recipe is not None, "Should extract recipe from @graph"
    assert recipe.title == "Test bowl"
    assert len(recipe.ingredients or []) >= 3, "Should have at least 3 ingredients from recipeIngredient"
    assert raw_lines == ["110g brown rice", "2 chicken thighs, diced", "1 lime"]
    assert recipe.instructions and "1. Cook the rice." in recipe.instructions and "2. Serve." in recipe.instructions
    assert recipe.servings == 2


def test_structured_data_edge_cases() -> None:
    """Unit test: recipeInstructions as string, HowToSection/hasPart, ingredient objects, recipeYield array, HTML entities."""
    import json
    ld = {
        "@type": "Recipe",
        "name": "Test &amp; Easy Bowl",
        "recipeIngredient": [
            "2 cups flour",
            {"@type": "Ingredient", "name": "1&frac12; cups milk"},
        ],
        "recipeInstructions": [
            {
                "@type": "HowToSection",
                "name": "Prep",
                "hasPart": [
                    {"@type": "HowToStep", "text": "Preheat oven to 350°F."},
                    {"@type": "HowToStep", "text": "Mix dry ingredients."},
                ],
            },
            "Bake for 25 minutes.",
        ],
        "recipeYield": ["4 servings", "optional second value"],
    }
    html = f'<html><head><script type="application/ld+json">{json.dumps(ld)}</script></head><body></body></html>'
    soup = BeautifulSoup(html, "html.parser")
    recipe, raw_lines = _extract_from_structured_data_with_raw(soup, "https://example.com/recipe")
    assert recipe is not None
    assert recipe.title == "Test & Easy Bowl", "HTML entities in name should be unescaped"
    assert len(recipe.ingredients or []) == 2
    assert "2 cups flour" in raw_lines
    assert "1½ cups milk" in raw_lines or "1 1/2" in str(raw_lines), "&frac12; should be unescaped in ingredient"
    assert recipe.instructions
    assert "1. Preheat oven" in recipe.instructions and "2. Mix dry" in recipe.instructions
    assert "3. Bake for 25" in recipe.instructions
    assert recipe.servings == 4, "recipeYield as array: first element should be used"


def test_structured_data_instructions_single_string() -> None:
    """Unit test: recipeInstructions as a single string (valid schema.org) yields numbered steps."""
    import json
    ld = {
        "@type": "Recipe",
        "name": "One-Pot Pasta",
        "recipeIngredient": ["400g pasta", "2 cups water"],
        "recipeInstructions": "Bring water to a boil. Add pasta and cook for 10 minutes. Drain and serve.",
    }
    html = f'<html><head><script type="application/ld+json">{json.dumps(ld)}</script></head><body></body></html>'
    soup = BeautifulSoup(html, "html.parser")
    recipe, _ = _extract_from_structured_data_with_raw(soup, "https://example.com/recipe")
    assert recipe is not None
    assert recipe.instructions
    assert "Bring water" in recipe.instructions and "Add pasta" in recipe.instructions
