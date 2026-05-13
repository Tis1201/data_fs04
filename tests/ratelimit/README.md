# Rate Limit Testing Tool

A Python script to test Nginx rate limiting configuration by sending multiple requests and analyzing the responses.

## Setup

```bash
# Install dependencies
pip install -r requirements.txt
```

## Usage

```bash
# Basic usage (tests the root endpoint with 100 requests)
python test_rate_limit.py

# Test the webhook endpoint
python test_rate_limit.py --webhook

# Test a specific webhook endpoint
python test_rate_limit.py --webhook --endpoint /api/webhook/custom-endpoint

# Custom number of requests and concurrency
python test_rate_limit.py --webhook --requests 200 --concurrency 10

# Test against a different server
python test_rate_limit.py --webhook --url http://example.com
```

## Examples

Test the main application endpoint:
```bash
python test_rate_limit.py --requests 100 --concurrency 5
```

Test the webhook endpoint:
```bash
python test_rate_limit.py --webhook --requests 50 --concurrency 3
```

## API Key Configuration

The script will look for an API key in your `.env` file. Create a `.env` file in the same directory with:

```
API_KEY=your_api_key_here
```

If no API key is found, it will use a default test key.

## Interpreting Results

The script will show:
- Total and average response times
- Count of responses by status code
- When rate limiting (429 responses) first occurred
- Percentage of requests that were rate limited

If you see 429 responses, it means the rate limiting is working correctly.
