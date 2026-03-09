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
"""
import pytest

from app.services.recipe_extractor import (
    extract_recipe_preview_from_url,
    _is_likely_form_or_ui_junk,
)


# Recipe URLs from different sources; each can have optional expected bounds
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


@pytest.mark.integration
@pytest.mark.parametrize("case", RECIPE_SOURCES, ids=[c["source"] for c in RECIPE_SOURCES])
async def test_extract_preview_from_url(case: dict) -> None:
    """Fetch each recipe URL and assert title, ingredients, instructions, and description."""
    url = case["url"]
    source = case["source"]
    preview = await extract_recipe_preview_from_url(url)

    _assert_preview_structure(preview, source)
    recipe = preview["recipe"]

    # Title
    assert len(recipe["title"]) >= 3, f"{source}: title too short"

    # Ingredients
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
