import requests
import sys
import json
import base64
import time
from datetime import datetime

class SignMeetAPITester:
    def __init__(self, base_url="https://signmeet.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.room_id = None
        self.participant_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}" if endpoint else f"{self.api_url}/"
        if headers is None:
            headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Error: {response.text}")
                return False, {}

        except requests.exceptions.RequestException as e:
            print(f"❌ Failed - Network Error: {str(e)}")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_api_root(self):
        """Test API root endpoint"""
        success, response = self.run_test(
            "API Root",
            "GET",
            "",
            200
        )
        if success:
            print(f"   Model loaded: {response.get('model_loaded', 'Unknown')}")
        return success

    def test_create_room(self):
        """Test room creation"""
        success, response = self.run_test(
            "Create Room",
            "POST",
            "rooms",
            200,
            data={
                "name": f"Test Room {datetime.now().strftime('%H%M%S')}",
                "max_participants": 6
            }
        )
        if success and 'id' in response:
            self.room_id = response['id']
            print(f"   Created room ID: {self.room_id}")
        return success

    def test_get_room(self):
        """Test getting room details"""
        if not self.room_id:
            print("❌ Skipped - No room ID available")
            return False
            
        success, response = self.run_test(
            "Get Room",
            "GET",
            f"rooms/{self.room_id}",
            200
        )
        return success

    def test_join_room(self):
        """Test joining a room"""
        if not self.room_id:
            print("❌ Skipped - No room ID available")
            return False
            
        success, response = self.run_test(
            "Join Room",
            "POST",
            f"rooms/{self.room_id}/join",
            200,
            data={
                "name": f"Test Participant {datetime.now().strftime('%H%M%S')}"
            }
        )
        if success and 'id' in response:
            self.participant_id = response['id']
            print(f"   Joined as participant ID: {self.participant_id}")
        return success

    def test_join_nonexistent_room(self):
        """Test joining a non-existent room"""
        success, response = self.run_test(
            "Join Non-existent Room",
            "POST",
            "rooms/nonexistent-room-id/join",
            404,
            data={
                "name": "Test Participant"
            }
        )
        return success

    def test_predict_sign_language(self):
        """Test sign language prediction with sample image"""
        if not self.room_id or not self.participant_id:
            print("❌ Skipped - No room or participant ID available")
            return False

        # Create a simple test image (1x1 pixel base64 encoded)
        # This is a minimal JPEG image in base64
        test_image_b64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/8A"
        
        success, response = self.run_test(
            "Predict Sign Language",
            "POST",
            "predict",
            200,
            data={
                "image_data": test_image_b64,
                "room_id": self.room_id,
                "participant_id": self.participant_id
            }
        )
        return success

    def test_get_room_captions(self):
        """Test getting room captions"""
        if not self.room_id:
            print("❌ Skipped - No room ID available")
            return False
            
        success, response = self.run_test(
            "Get Room Captions",
            "GET",
            f"rooms/{self.room_id}/captions",
            200
        )
        return success

    def test_invalid_endpoints(self):
        """Test invalid endpoints return proper errors"""
        print("\n🔍 Testing Invalid Endpoints...")
        
        # Test invalid room ID
        success1, _ = self.run_test(
            "Get Invalid Room",
            "GET",
            "rooms/invalid-room-id",
            404
        )
        
        # Test invalid prediction without required fields
        success2, _ = self.run_test(
            "Invalid Prediction Request",
            "POST",
            "predict",
            422,  # Validation error
            data={
                "image_data": "invalid"
                # Missing room_id and participant_id
            }
        )
        
        return success1 and success2

def main():
    print("🚀 Starting SignMeet API Tests...")
    print("=" * 50)
    
    tester = SignMeetAPITester()
    
    # Test sequence
    tests = [
        ("API Root", tester.test_api_root),
        ("Create Room", tester.test_create_room),
        ("Get Room", tester.test_get_room),
        ("Join Room", tester.test_join_room),
        ("Join Non-existent Room", tester.test_join_nonexistent_room),
        ("Predict Sign Language", tester.test_predict_sign_language),
        ("Get Room Captions", tester.test_get_room_captions),
        ("Invalid Endpoints", tester.test_invalid_endpoints),
    ]
    
    for test_name, test_func in tests:
        try:
            test_func()
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
        
        # Small delay between tests
        time.sleep(0.5)
    
    # Print final results
    print("\n" + "=" * 50)
    print(f"📊 Final Results: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if tester.tests_passed == tester.tests_run:
        print("🎉 All tests passed!")
        return 0
    else:
        print(f"⚠️  {tester.tests_run - tester.tests_passed} tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())