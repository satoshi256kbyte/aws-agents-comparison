import json


def handler(event, context):
    """Return a small deterministic response for the deployed smoke test."""
    return {
        "statusCode": 200,
        "headers": {"content-type": "application/json"},
        "body": json.dumps({
            "service": "sample-lambda-api",
            "message": "AWS agents comparison verification",
        }),
    }
