import urllib.request
import urllib.parse
import json
import os


def _fetch(path, token=None):
    alb_url = os.environ.get('ALB_URL', '')
    url = f"http://{alb_url}{path}"
    req = urllib.request.Request(url)
    if token:
        req.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.reason}"}
    except Exception as e:
        return {"error": str(e)}


def search_listings(search=None, category=None, max_price=None, limit=10):
    params = {"limit": min(int(limit or 10), 50)}
    if search:
        params["search"] = search
    if category:
        params["category"] = category

    qs = urllib.parse.urlencode(params)
    data = _fetch(f"/api/marketplace/listings?{qs}")

    listings = data.get("listings", data) if isinstance(data, dict) else data
    if not isinstance(listings, list):
        return {"error": "Could not fetch listings", "detail": str(data)}

    if max_price is not None:
        listings = [l for l in listings if float(l.get("price", 0)) <= float(max_price)]

    simplified = []
    for l in listings[:limit]:
        farmer = l.get("Farmer") or {}
        simplified.append({
            "id": l.get("id"),
            "product": l.get("product_name"),
            "category": l.get("category"),
            "price": float(l.get("price", 0)),
            "unit": l.get("unit"),
            "price_display": f"₹{l.get('price')}/{l.get('unit')}",
            "quantity_available": f"{l.get('quantity')} {l.get('unit')}",
            "farm_name": farmer.get("farm_name"),
            "location": farmer.get("location"),
            "harvest_date": l.get("harvest_date"),
        })

    return {
        "total_found": len(listings),
        "showing": len(simplified),
        "listings": simplified,
    }


def get_price_stats(product_name):
    qs = urllib.parse.urlencode({"search": product_name, "limit": 100})
    data = _fetch(f"/api/marketplace/listings?{qs}")

    listings = data.get("listings", data) if isinstance(data, dict) else data
    if not isinstance(listings, list) or len(listings) == 0:
        return {"available": False, "message": f"'{product_name}' is not listed in the marketplace right now."}

    prices = []
    for l in listings:
        try:
            prices.append(float(l["price"]))
        except (KeyError, ValueError, TypeError):
            pass

    if not prices:
        return {"available": False, "message": "Could not parse prices from listings."}

    unit = listings[0].get("unit", "kg")
    avg = sum(prices) / len(prices)
    return {
        "product": product_name,
        "available": True,
        "listings_count": len(prices),
        "min_price": round(min(prices), 2),
        "max_price": round(max(prices), 2),
        "avg_price": round(avg, 2),
        "unit": unit,
        "summary": f"₹{min(prices):.0f}–₹{max(prices):.0f} per {unit} (avg ₹{avg:.0f})",
    }


def get_listing_bids(listing_id, token=None):
    data = _fetch(f"/api/marketplace/bids/{int(listing_id)}", token=token)

    if isinstance(data, dict) and "error" in data:
        return data

    bids = data if isinstance(data, list) else data.get("bids", [])
    if not bids:
        return {
            "listing_id": listing_id,
            "bids_count": 0,
            "message": "No bids placed yet. You can start with any amount.",
        }

    amounts = [float(b.get("amount", 0)) for b in bids if b.get("amount")]
    pending = [b for b in bids if b.get("status") == "PENDING"]
    highest = max(amounts) if amounts else 0

    return {
        "listing_id": listing_id,
        "total_bids": len(bids),
        "pending_bids": len(pending),
        "highest_bid": f"₹{highest:.0f}",
        "lowest_bid": f"₹{min(amounts):.0f}" if amounts else "N/A",
        "avg_bid": f"₹{sum(amounts)/len(amounts):.0f}" if amounts else "N/A",
        "competitive_suggestion": f"To win, bid above ₹{highest:.0f}" if highest > 0 else "No competition yet — any amount works.",
    }


def get_available_categories():
    data = _fetch("/api/marketplace/categories")
    categories = data if isinstance(data, list) else []
    return {"categories": categories, "count": len(categories)}
