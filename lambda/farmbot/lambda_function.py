import json
import boto3
import os

bedrock = boto3.client("bedrock-runtime", region_name=os.environ.get("BEDROCK_REGION", "us-east-1"))

def lambda_handler(event, context):
    body = json.loads(event.get("body", "{}"))
    message = body.get("message", "")

    response = bedrock.converse(
        modelId=os.environ.get("MODEL_ID", "amazon.nova-lite-v1:0"),
        messages=[{"role": "user", "content": [{"text": message}]}],
        system=[{"text": "You are FarmBot, an AI assistant for AgriConnect farmers. Help with farming queries, crop advice, and agricultural best practices."}],
    )

    reply = response["output"]["message"]["content"][0]["text"]

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"reply": reply}),
    }
