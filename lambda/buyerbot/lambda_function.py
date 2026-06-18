import json
import re
from bedrock_client import get_response


def _clean(text):
    return re.sub(r'<thinking>.*?</thinking>', '', text, flags=re.DOTALL).strip()


def _cors(status, body):
    return {
        "statusCode": status,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
        },
        "body": json.dumps(body, ensure_ascii=False),
    }


def lambda_handler(event, context):
    method = event.get("requestContext", {}).get("http", {}).get("method", "")
    if method == "OPTIONS":
        return _cors(200, {"message": "OK"})

    try:
        body = json.loads(event.get("body") or "{}")
        message = (body.get("message") or "").strip()
        buyer_token = body.get("token")
        history = body.get("history") or []

        if not message:
            return _cors(400, {"error": "message is required"})
        if len(message) > 1000:
            return _cors(400, {"error": "Message too long (max 1000 characters)"})

        text = _clean(get_response(message, buyer_token=buyer_token, history=history))
        return _cors(200, {"response": text})

    except Exception as e:
        print(f"BuyerBot error: {e}")
        return _cors(500, {"error": "BuyerBot is temporarily unavailable. Please try again."})
