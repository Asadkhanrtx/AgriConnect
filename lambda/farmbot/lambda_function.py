import json
import base64
import os
import re
from bedrock_client import call_nova_lite, build_text_payload, build_multimodal_payload
from s3_handler import store_photo, store_chat_log
from sns_handler import trigger_critical_alert


def _clean(text):
    return re.sub(r'<thinking>.*?</thinking>', '', text, flags=re.DOTALL).strip()

MAX_IMAGE_BYTES = int(os.environ.get('MAX_IMAGE_SIZE_MB', '5')) * 1024 * 1024


def lambda_handler(event, context):
    # Handle CORS preflight
    if event.get('requestContext', {}).get('http', {}).get('method') == 'OPTIONS':
        return _cors_response(200, '')

    try:
        body = event.get('body', '{}')
        if isinstance(body, str):
            body = json.loads(body)

        farmer_id = str(body.get('farmer_id', 'anonymous'))
        message = (body.get('message') or '').strip()
        image_b64 = body.get('image')  # base64 string from frontend
        history = body.get('history') or []  # conversation history [{role, text}, ...]

        if not message and not image_b64:
            return _cors_response(400, json.dumps({'error': 'Please send a message or upload a photo.'}))

        photo_key = None

        if image_b64:
            try:
                image_bytes = base64.b64decode(image_b64)
            except Exception:
                return _cors_response(400, json.dumps({'error': 'Invalid image format. Please try again.'}))

            if len(image_bytes) > MAX_IMAGE_BYTES:
                return _cors_response(400, json.dumps({'error': f'Image too large. Maximum size is {MAX_IMAGE_BYTES // (1024*1024)} MB.'}))

            try:
                photo_key = store_photo(farmer_id, image_bytes)
            except Exception as e:
                print(f'Photo store error (non-fatal): {e}')

            payload = build_multimodal_payload(message, image_b64, history=history)
        else:
            payload = build_text_payload(message, history=history)

        response_text = _clean(call_nova_lite(payload))

        is_critical = 'CRITICAL: YES' in response_text
        if is_critical:
            try:
                trigger_critical_alert(farmer_id, message, response_text)
            except Exception as e:
                print(f'SNS alert error (non-fatal): {e}')

        try:
            store_chat_log(farmer_id, message, photo_key, response_text, is_critical)
        except Exception as e:
            print(f'Chat log store error (non-fatal): {e}')

        return _cors_response(200, json.dumps({
            'response': response_text,
            'critical': is_critical
        }))

    except Exception as e:
        print(f'FarmBot unhandled error: {e}')
        return _cors_response(500, json.dumps({
            'error': 'FarmBot is temporarily unavailable. Please try again in a moment.'
        }))


def _cors_response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        'body': body
    }
