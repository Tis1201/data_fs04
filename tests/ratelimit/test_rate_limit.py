#!/usr/bin/env python3
"""
Rate Limit Testing Script for FS04 Web Application

This script tests the Nginx rate limiting configuration by sending
multiple requests to different endpoints and analyzing the responses.
"""

import requests
import time
import concurrent.futures
import argparse
import sys
import json
import os
from collections import Counter
from rich.console import Console
from rich.table import Table
from rich.progress import Progress
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get API key from environment
API_KEY = os.getenv("API_KEY")
if not API_KEY:
    API_KEY = "test_api_key"  # Fallback for testing

# Initialize rich console for better output
console = Console()

def send_request(url, session=None, is_webhook=False):
    """Send a single request and return the response status code"""
    if session is None:
        session = requests
    
    try:
        start_time = time.time()
        
        if is_webhook:
            # Prepare webhook data and headers
            json_data = {
                "event": "test_event",
                "timestamp": int(time.time()),
                "data": {
                    "message": "Testing rate limits",
                    "number": 42
                }
            }
            
            headers = {
                "X-API-Key": API_KEY,
                "Content-Type": "application/json"
            }
            
            response = session.post(url, json=json_data, headers=headers, timeout=5)
        else:
            # Standard GET request
            response = session.get(url, timeout=5)
            
        end_time = time.time()
        return {
            'status': response.status_code,
            'time': end_time - start_time,
            'url': url
        }
    except requests.exceptions.RequestException as e:
        return {
            'status': 'Error',
            'time': 0,
            'url': url,
            'error': str(e)
        }

def test_rate_limit(base_url, endpoint, requests_count, concurrency, is_webhook=False):
    """Test rate limiting by sending multiple requests"""
    url = f"{base_url}{endpoint}"
    results = []
    
    with Progress() as progress:
        task = progress.add_task(f"[cyan]Testing {endpoint}...", total=requests_count)
        
        # Create a session for connection pooling
        session = requests.Session()
        
        if concurrency > 1:
            # Use concurrent requests
            with concurrent.futures.ThreadPoolExecutor(max_workers=concurrency) as executor:
                futures = [executor.submit(send_request, url, session, is_webhook) for _ in range(requests_count)]
                
                for future in concurrent.futures.as_completed(futures):
                    results.append(future.result())
                    progress.update(task, advance=1)
        else:
            # Sequential requests
            for _ in range(requests_count):
                results.append(send_request(url, session, is_webhook))
                progress.update(task, advance=1)
    
    return results

def analyze_results(results):
    """Analyze and display test results"""
    status_counts = Counter(result['status'] for result in results)
    total_time = sum(result['time'] for result in results)
    avg_time = total_time / len(results) if results else 0
    
    # Create a table for results
    table = Table(title="Rate Limit Test Results")
    table.add_column("Metric", style="cyan")
    table.add_column("Value", style="green")
    
    table.add_row("Total Requests", str(len(results)))
    table.add_row("Total Time", f"{total_time:.2f} seconds")
    table.add_row("Average Response Time", f"{avg_time:.4f} seconds")
    
    for status, count in status_counts.items():
        status_str = str(status)
        style = "green"
        if status == 429:
            style = "yellow"
            status_str = f"{status} (Rate Limited)"
        elif isinstance(status, int) and status >= 400:
            style = "red"
        
        table.add_row(f"Status {status_str}", f"{count} ({count/len(results)*100:.1f}%)", style=style)
    
    console.print(table)
    
    # Show when rate limiting kicked in
    if 429 in status_counts:
        console.print("\n[yellow]Rate Limiting Analysis:[/yellow]")
        status_sequence = []
        for i, result in enumerate(results):
            if result['status'] == 429 and (i == 0 or results[i-1]['status'] != 429):
                status_sequence.append(i + 1)
        
        if status_sequence:
            console.print(f"Rate limiting first triggered at request #{status_sequence[0]}")

def main():
    parser = argparse.ArgumentParser(description="Test Nginx rate limiting configuration")
    parser.add_argument("--url", default="http://localhost", help="Base URL to test")
    parser.add_argument("--endpoint", default="/", help="Endpoint to test")
    parser.add_argument("--requests", type=int, default=100, help="Number of requests to send")
    parser.add_argument("--concurrency", type=int, default=5, help="Number of concurrent requests")
    parser.add_argument("--webhook", action="store_true", help="Test webhook endpoint with POST requests")
    args = parser.parse_args()
    
    # Set default webhook endpoint if --webhook is specified but no endpoint is provided
    if args.webhook and args.endpoint == "/":
        args.endpoint = "/api/webhook/test-endpoint"
    
    console.print(f"[bold cyan]Rate Limit Testing[/bold cyan]")
    console.print(f"Target: {args.url}{args.endpoint}")
    console.print(f"Method: {'POST (webhook)' if args.webhook else 'GET'}")
    console.print(f"Sending {args.requests} requests with concurrency {args.concurrency}\n")
    
    results = test_rate_limit(args.url, args.endpoint, args.requests, args.concurrency, args.webhook)
    analyze_results(results)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        console.print("\n[bold red]Test interrupted by user[/bold red]")
        sys.exit(1)
