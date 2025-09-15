#!/usr/bin/env python3
"""
Debug script to test frontend loading
"""
import requests
import re
import time
from urllib.parse import urljoin

def test_frontend():
    base_url = "http://localhost:5176/app/"
    
    # Configure session to bypass proxy for localhost
    session = requests.Session()
    session.proxies = {
        'http': None,
        'https': None
    }
    
    print("🔍 Testing frontend loading...")
    
    try:
        # Test 1: Main HTML page
        print("\n1. Testing main HTML page...")
        response = session.get(base_url, timeout=5)
        print(f"   Status: {response.status_code}")
        print(f"   Content-Type: {response.headers.get('Content-Type', 'Unknown')}")
        
        if response.status_code == 200:
            print("   ✅ Main page loads successfully")
            
            # Check for root element
            if 'id="root"' in response.text:
                print("   ✅ Root element found")
            else:
                print("   ❌ Root element missing!")
                
        else:
            print(f"   ❌ Main page failed to load: {response.status_code}")
            return
            
        # Test 2: Main JavaScript
        print("\n2. Testing main JavaScript...")
        js_urls = re.findall(r'src="([^"]*)"', response.text)
        
        for js_url in js_urls:
            full_url = urljoin(base_url, js_url.lstrip('/app'))
            if js_url.startswith('/app'):
                full_url = f"http://localhost:5176{js_url}"
                
            print(f"   Testing: {js_url}")
            try:
                js_response = session.get(full_url, timeout=5)
                print(f"   Status: {js_response.status_code}")
                
                if js_response.status_code == 200:
                    print(f"   ✅ JavaScript loads ({len(js_response.text)} chars)")
                else:
                    print(f"   ❌ JavaScript failed: {js_response.status_code}")
                    
            except Exception as e:
                print(f"   ❌ JavaScript request failed: {e}")
                
        # Test 3: Backend services
        print("\n3. Testing backend services...")
        
        # SSE Server
        try:
            sse_response = session.get("http://localhost:8001/", timeout=3)
            print(f"   SSE Server (8001): {sse_response.status_code} ✅")
        except Exception as e:
            print(f"   SSE Server (8001): Failed - {e} ❌")
            
        # Test 4: Console simulation
        print("\n4. Analyzing potential JavaScript issues...")
        
        # Check for React imports in main.tsx
        try:
            main_js = session.get(f"http://localhost:5176/app/src/main.tsx", timeout=5)
            if main_js.status_code == 200:
                content = main_js.text
                if "createRoot" in content:
                    print("   ✅ React createRoot found")
                if "StrictMode" in content:
                    print("   ✅ React StrictMode found")
                if "BrowserRouter" in content:
                    print("   ✅ React Router found")
                if "ErrorBoundary" in content:
                    print("   ✅ Error Boundary found")
                if "App" in content:
                    print("   ✅ App component import found")
                    
            else:
                print(f"   ❌ Could not load main.tsx: {main_js.status_code}")
                
        except Exception as e:
            print(f"   ❌ Error analyzing main.tsx: {e}")
            
        print("\n📊 Analysis Summary:")
        print("   - If all components ✅ but page is white:")
        print("     → Likely React rendering error or CSS issue")
        print("   - If JavaScript ❌:")
        print("     → Module loading or import error")
        print("   - If backend ❌:")
        print("     → API connectivity issue")
            
    except Exception as e:
        print(f"❌ Test failed: {e}")

if __name__ == "__main__":
    test_frontend()