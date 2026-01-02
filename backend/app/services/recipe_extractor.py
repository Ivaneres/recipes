from typing import Optional, Dict, List
import httpx
from bs4 import BeautifulSoup
import json
import re
from recipe_scrapers import scrape_me
from app.schemas.recipe import RecipeCreate, Ingredient


async def extract_recipe_from_url(url: str) -> Optional[RecipeCreate]:
    """Extract recipe data from a URL with multiple fallback strategies"""
    async with httpx.AsyncClient() as client:
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
    """Extract recipe from JSON-LD structured data"""
    try:
        # Look for JSON-LD script tags
        json_scripts = soup.find_all('script', type='application/ld+json')
        for script in json_scripts:
            try:
                data = json.loads(script.string)
                # Handle both single objects and arrays
                if isinstance(data, list):
                    data = data[0] if data else {}
                
                # Check if it's a recipe
                if data.get('@type') == 'Recipe' or 'Recipe' in str(data.get('@type', [])):
                    title = data.get('name', '')
                    description = data.get('description', '')
                    
                    # Extract ingredients
                    ingredients_list = []
                    recipe_ingredients = data.get('recipeIngredient', [])
                    if isinstance(recipe_ingredients, list):
                        for ing in recipe_ingredients:
                            if isinstance(ing, str):
                                ingredients_list.append(Ingredient(name=ing))
                    
                    # Extract instructions
                    instructions = None
                    recipe_instructions = data.get('recipeInstructions', [])
                    if isinstance(recipe_instructions, list):
                        instruction_parts = []
                        for step in recipe_instructions:
                            if isinstance(step, dict):
                                text = step.get('text', '')
                                if text:
                                    instruction_parts.append(text)
                            elif isinstance(step, str):
                                instruction_parts.append(step)
                        if instruction_parts:
                            instructions = '\n'.join(f"{i+1}. {step}" for i, step in enumerate(instruction_parts))
                    
                    # Extract times
                    prep_time = _parse_duration(data.get('prepTime'))
                    cook_time = _parse_duration(data.get('cookTime'))
                    
                    # Extract servings
                    servings = None
                    recipe_yield = data.get('recipeYield', '')
                    if recipe_yield:
                        numbers = re.findall(r'\d+', str(recipe_yield))
                        if numbers:
                            servings = int(numbers[0])
                    
                    if title:
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
            except (json.JSONDecodeError, KeyError, AttributeError):
                continue
    except Exception as e:
        print(f"Error extracting structured data: {e}")
    
    return None


def _extract_from_html(soup: BeautifulSoup, url: str) -> Optional[RecipeCreate]:
    """Generic HTML parsing fallback"""
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
        
        # Try to find description
        description = None
        for selector in ['[class*="description"]', '[class*="summary"]', 'meta[name="description"]']:
            element = soup.select_one(selector)
            if element:
                if element.name == 'meta':
                    description = element.get('content', '')
                else:
                    description = element.get_text(strip=True)
                if description:
                    break
        
        # Try to find ingredients
        ingredients_list = []
        # First try tables (common in blog recipes)
        tables = soup.find_all('table')
        for table in tables:
            rows = table.find_all('tr')
            # Skip header row if it exists
            start_idx = 0
            if rows and any(cell.get_text(strip=True).lower() in ['quantity', 'amount', 'ingredient', 'item'] for cell in rows[0].find_all(['td', 'th'])):
                start_idx = 1
            
            for row in rows[start_idx:]:
                cells = row.find_all(['td', 'th'])
                if len(cells) >= 2:
                    # Usually quantity in first cell, ingredient in second
                    quantity = cells[0].get_text(strip=True)
                    ingredient_name = cells[1].get_text(strip=True)
                    if ingredient_name and len(ingredient_name) > 1:
                        # Try to parse quantity
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
                    # Single cell might be ingredient only
                    text = cells[0].get_text(strip=True)
                    if text and len(text) > 2 and len(text) < 200:
                        ingredients_list.append(Ingredient(name=text))
            if ingredients_list:
                break
        
        # If no table found, try list-based selectors
        if not ingredients_list:
            for selector in [
                '[class*="ingredient"]',
                '[class*="ingredients"]',
                '[itemprop="recipeIngredient"]',
                'ul.ingredients',
                'div.ingredients ul',
                'ol.ingredients',
            ]:
                elements = soup.select(selector)
                if elements:
                    for elem in elements:
                        if elem.name == 'li':
                            text = elem.get_text(strip=True)
                            if text and len(text) > 2 and len(text) < 200:
                                ingredients_list.append(Ingredient(name=text))
                        elif elem.name in ['div', 'span', 'p']:
                            text = elem.get_text(strip=True)
                            if text and len(text) > 2 and len(text) < 200:
                                # Check if it contains ingredient-like text
                                if not re.match(r'^(ingredients?|method|instructions?|directions?):?\s*$', text, re.IGNORECASE):
                                    ingredients_list.append(Ingredient(name=text))
                    if ingredients_list:
                        break
        
        # Try to find instructions
        instructions = None
        instruction_parts = []
        
        # Look for instruction sections
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
                        # Skip very short paragraphs (likely headers/navigation)
                        if text and len(text) > 20:
                            # Check if it's not a header
                            if not re.match(r'^(the|for|begin|start|first|then|now|after|once|last|final)', text[:20], re.IGNORECASE):
                                # Split by sentences or newlines
                                sentences = re.split(r'\.\s+', text)
                                for sent in sentences:
                                    sent = sent.strip()
                                    if sent and len(sent) > 15:
                                        instruction_parts.append(sent)
                            else:
                                instruction_parts.append(text)
                if instruction_parts:
                    break
        
        # If still no instructions, try to get all paragraphs from main content
        if not instruction_parts:
            main_content = soup.find('main') or soup.find('article') or soup.find('body')
            if main_content:
                paragraphs = main_content.find_all(['p', 'div'])
                for p in paragraphs:
                    # Skip if in table or navigation
                    if p.find_parent('table') or p.find_parent(['nav', 'header', 'footer']):
                        continue
                    
                    text = p.get_text(strip=True)
                    # Skip very short or header-like text
                    if text and len(text) > 30:
                        # Skip if it looks like a heading (all caps short text)
                        if not (len(text) < 100 and text.isupper() and not text.endswith('.')):
                            # Skip navigation text
                            if not re.match(r'^(home|about|contact|subscribe|menu|search|©|follow|share)', text[:30], re.IGNORECASE):
                                instruction_parts.append(text)
        
        if instruction_parts:
            # Remove duplicates and clean up
            seen = set()
            unique_parts = []
            for part in instruction_parts:
                # Normalize and check for duplicates
                normalized = re.sub(r'\s+', ' ', part.lower().strip())
                if normalized not in seen and len(part.strip()) > 10:
                    seen.add(normalized)
                    unique_parts.append(part.strip())
            
            if unique_parts:
                instructions = '\n\n'.join(unique_parts)
        
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
        
        # Look for servings
        servings_match = re.search(r'serves?[:\s]+(\d+)', text_content, re.IGNORECASE)
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
        
        return None
    except Exception as e:
        print(f"Error in generic HTML extraction: {e}")
        import traceback
        traceback.print_exc()
        return None


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
