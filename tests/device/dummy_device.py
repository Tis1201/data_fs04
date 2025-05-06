import requests
import json
import time
from sseclient import SSEClient
import random
import string
import platform
import socket
import uuid
import psutil
import os
from datetime import datetime

class DummyDevice:
    def __init__(self, base_url="http://localhost:5173"):
        self.base_url = base_url
        self.register_endpoint = f"{self.base_url}/api/device/register"
        self.listen_endpoint = f"{self.base_url}/api/device/listen"
        self.device_info_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'workings', 'deviceId.txt')
        
        # Check if device is already registered
        self.device_id = None
        self.api_key = None
        self.registered = self.load_device_credentials()
        
        if not self.registered:
            # Generate a new PIN for registration
            self.pin = self.generate_pin()
            self.headers = {
                'X-Device-PIN': self.pin,
                'Accept': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json'
            }
            print(f"Generated PIN: {self.pin}")
            print("Device is in REGISTRATION mode")
        else:
            # Use API key for authenticated connection
            self.headers = {
                'X-API-KEY': self.api_key,
                'Accept': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Content-Type': 'application/json'
            }
            print(f"Using existing device ID: {self.device_id}")
            print("Device is in LISTEN mode")

    def generate_pin(self, length=6):
        """Generate a 6-digit PIN"""
        return ''.join(random.choices(string.digits, k=length))

    def get_system_info(self):
        """Gather system information"""
        return {
            'deviceType': 'dummy',  # Could be determined by device role
            'model': platform.machine(),
            'manufacturer': 'Dummy Devices Inc.',
            'osVersion': f"{platform.system()} {platform.release()}",
            'firmwareVersion': '1.0.0',
            'hardwareId': ':'.join(['{:02x}'.format((uuid.getnode() >> elements) & 0xff) 
                                  for elements in range(0, 2*6, 2)][::-1])
        }

    def get_public_ip(self):
        """Get the public IP address using an external service"""
        try:
            response = requests.get('https://api.ipify.org?format=json', timeout=5)
            response.raise_for_status()
            return response.json().get('ip', 'Unknown')
        except Exception as e:
            print(f"Could not get public IP: {e}")
            return 'Unknown'

    def get_network_info(self):
        """Gather network information"""
        try:
            # Get the hostname
            hostname = socket.gethostname()
            
            # Get the local IP address by connecting to a remote server
            # This will use the default route interface
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            try:
                # Connect to a remote server (doesn't actually send any data)
                s.connect(("8.8.8.8", 80))
                local_ip = s.getsockname()[0]
            except Exception:
                # Fallback to hostname lookup if the above fails
                local_ip = socket.gethostbyname(hostname)
            finally:
                s.close()
            
            # Get public IP
            public_ip = self.get_public_ip()
            
            # Get MAC address
            mac = ':'.join(['{:02x}'.format((uuid.getnode() >> elements) & 0xff) 
                          for elements in range(0, 2*6, 2)][::-1])
            
            return {
                'wifiMac': mac,  # In a real device, you'd get this from the WiFi interface
                'lanMac': mac,   # In a real device, you'd get this from the Ethernet interface
                'ipAddress': local_ip,
                'publicIpAddress': public_ip
            }
            
        except Exception as e:
            print(f"Error getting network info: {e}")
            # Return default values if there's an error
            return {
                'wifiMac': '00:00:00:00:00:00',
                'lanMac': '00:00:00:00:00:00',
                'ipAddress': '0.0.0.0',
                'publicIpAddress': 'Unknown'
            }

    def get_additional_info(self):
        """Get additional system information"""
        return {
            'cpuCores': psutil.cpu_count(),
            'totalMemory': psutil.virtual_memory().total,
            'diskUsage': psutil.disk_usage('/').percent,
            'bootTime': psutil.boot_time()
        }

    def load_device_credentials(self):
        """Load device credentials from file if available"""
        try:
            if os.path.exists(self.device_info_path):
                with open(self.device_info_path, 'r') as f:
                    lines = f.readlines()
                    for line in lines:
                        if line.startswith('Device ID:'):
                            self.device_id = line.split(':', 1)[1].strip()
                        elif line.startswith('API Key:'):
                            self.api_key = line.split(':', 1)[1].strip()
                
                if self.device_id and self.api_key:
                    return True
            return False
        except Exception as e:
            print(f"Error loading device credentials: {e}")
            return False

    def connect(self):
        """Connect to the appropriate endpoint based on device state"""
        if self.registered:
            url = self.listen_endpoint
            print(f"Connecting to listen endpoint: {url}")
        else:
            url = f"{self.register_endpoint}?pin={self.pin}"
            print(f"Connecting to registration endpoint: {url}")

        try:
            session = requests.Session()
            session.headers.update(self.headers)
            response = session.get(url, stream=True)
            sse_client = SSEClient(response)
            print("SSE client created, waiting for events...")

            for msg in sse_client.events():
                try:
                    print(f"\n--- New Event ---")
                    # print(f"Event: {msg.event}")

                    if hasattr(msg, 'data') and msg.data:
                        try:
                            data = json.loads(msg.data)
                            # print(f"Data: {json.dumps(data, indent=2)}")

                            # Handle different message types based on device state
                            if msg.event == 'message':
                                action = data.get('payload', {}).get('action')
                                
                                # Registration confirmation in claim mode
                                if not self.registered and action == 'registered':
                                    print(f"Data: {json.dumps(data, indent=2)}")

                                    self.id = data.get('payload', {}).get('id')
                                    self.senderId = data.get('senderId')
                                    self.senderConnectionId = data.get('senderConnectionId')
                                    self.senderConnectionProtocol = data.get('senderConnectionProtocol')

                                    print(f"Sender connection ID: {self.senderConnectionId}")
                                    print(f"Sender connection protocol: {self.senderConnectionProtocol}")
                                    
                                    # Send device info when registration is confirmed
                                    self.send_device_info()
                                
                                # Connection confirmation in listen mode
                                elif self.registered and action == 'connected':
                                    print(f"Successfully connected to listen endpoint")
                                    print(f"Connection ID: {data.get('connectionId')}")
                                    print(f"Device ID: {data.get('deviceId')}")
                                
                                # Handle commands in listen mode
                                elif self.registered and action not in ['ping', 'connected']:
                                    print(f"Received command: {action}")
                                    print(f"Command data: {json.dumps(data.get('payload', {}), indent=2)}")
                                    # Here you would implement command handling logic
                            if msg.event == 'message' and data.get('payload', {}).get('action') == 'ping':
                                print(f"Ping received from server {data.get('payload', {}).get('deviceId')}")
                             

                        except json.JSONDecodeError:
                            print(f"Data (raw): {msg.data}")
                    else:
                        print("No data in message")

                    time.sleep(0.1)

                except Exception as e:
                    print(f"Error processing message: {str(e)}")
                    continue

        except KeyboardInterrupt:
            print("\nSSE connection closed by user")
        except Exception as e:
            print(f"Error: {str(e)}")
        finally:
            if 'session' in locals():
                session.close()
            print("Test completed")

    def send_device_info(self):
        """Send device information to the server."""
        try:
            # Gather all device information
            device_info = {
                **self.get_system_info(),
                **self.get_network_info(),
                'additionalInfo': self.get_additional_info(),
                'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
            }
            
            
            # Send device info to api/device/add
            device_info['id'] = self.id  # Provided device ID
            device_info['pin'] = self.pin  # Include the generated PIN
            device_info['senderId'] = self.senderId
            device_info['senderConnectionId'] = self.senderConnectionId
            device_info['senderConnectionProtocol'] = self.senderConnectionProtocol
            
            print("Sending device information:")
            print(json.dumps(device_info, indent=2))

            try:
                response = requests.post(
                    f"{self.base_url}/api/device/add",
                    json=device_info,
                    headers={'Content-Type': 'application/json'}
                )
                
                try:
                    response.raise_for_status()
                    response_data = response.json()
                    print("Device info sent successfully")
                    print(f"Response: {response_data}")
                except requests.exceptions.HTTPError as http_err:
                    print(f"HTTP error occurred: {http_err}")
                    if response.content:
                        try:
                            error_data = response.json()
                            print(f"Error details: {json.dumps(error_data, indent=2)}")
                        except ValueError:
                            print(f"Response content: {response.text}")
                    raise
                except json.JSONDecodeError as json_err:
                    print(f"Failed to parse JSON response: {json_err}")
                    print(f"Response content: {response.text}")
                    raise
                except Exception as err:
                    print(f"Unexpected error: {err}")
                    print(f"Response content: {response.text}" if hasattr(response, 'text') else "No response content")
                    raise
                
                # Save device ID and API key to file
                if response_data.get('success') and response_data.get('deviceId') and response_data.get('deviceApiKey'):
                    device_info_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'workings')
                    os.makedirs(device_info_dir, exist_ok=True)
                    
                    with open(os.path.join(device_info_dir, 'deviceId.txt'), 'w') as f:
                        f.write(f"Device ID: {response_data['deviceId']}\n")
                        f.write(f"API Key: {response_data['deviceApiKey']}\n")
                        f.write(f"Timestamp: {datetime.now().isoformat()}\n")
                    
                    print(f"Device information saved to workings/deviceId.txt")
            except requests.exceptions.RequestException as e:
                print(f"Failed to send device info: {e}")
            
        except Exception as e:
            print(f"Error sending device info: {str(e)}")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Dummy IoT Device')
    parser.add_argument('--force-register', action='store_true', help='Force registration mode even if credentials exist')
    parser.add_argument('--url', default='http://localhost:5173', help='Base URL of the server')
    
    args = parser.parse_args()
    
    dummy_device = DummyDevice(base_url=args.url)
    
    # Override registration status if forced
    if args.force_register and dummy_device.registered:
        print("Forcing registration mode despite existing credentials")
        dummy_device.registered = False
        dummy_device.pin = dummy_device.generate_pin()
        dummy_device.headers = {
            'X-Device-PIN': dummy_device.pin,
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json'
        }
        print(f"Generated PIN: {dummy_device.pin}")
    
    dummy_device.connect()