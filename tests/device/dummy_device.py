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

class DummyDevice:
    def __init__(self, base_url="http://localhost:5173"):
        self.base_url = base_url
        self.register_endpoint = f"{self.base_url}/api/device/register"
        self.pin = self.generate_pin()
        self.headers = {
            'X-Device-PIN': self.pin,
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json'
        }
        print(f"Generated PIN: {self.pin}")

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

    def connect(self):
        url = f"{self.register_endpoint}?pin={self.pin}"
        print(f"Connecting to {url}")

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

                            if msg.event == 'message' and data.get('payload', {}).get('action') == 'registered':
                                
                                print(f"Data: {json.dumps(data, indent=2)}")

                                
                                # Send device info when registration is confirmed
                                self.send_device_info()
                                # break
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
            
            print("Sending device information:")
            print(json.dumps(device_info, indent=2))
            
            # Here you would typically send the data to your server
            # For example:
            # response = requests.post(
            #     f"{self.base_url}/api/device/info",
            #     json=device_info,
            #     headers={'Content-Type': 'application/json'}
            # )
            # response.raise_for_status()
            # print("Device info sent successfully")
            
        except Exception as e:
            print(f"Error sending device info: {str(e)}")

if __name__ == "__main__":
    dummy_device = DummyDevice()
    dummy_device.connect()