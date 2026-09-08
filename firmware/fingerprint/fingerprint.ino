// SOFTWARE API VERIFIED; THIS SKETCH REQUIRES HARDWARE/TOOLCHAIN VERIFICATION.
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Adafruit_Fingerprint.h>
#include <time.h>
#include "config.h"
HardwareSerial sensorSerial(2);
Adafruit_Fingerprint sensor(&sensorSerial);
unsigned long nextWifiAttempt = 0;
unsigned long lastScan = 0;
unsigned long wifiBackoff = 1000;

bool connectWifi() {
  if (WiFi.status() == WL_CONNECTED) { wifiBackoff = 1000; return true; }
  if ((long)(millis() - nextWifiAttempt) >= 0) {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    nextWifiAttempt = millis() + wifiBackoff;
    wifiBackoff = min(wifiBackoff * 2, 30000UL);
  }
  return false;
}
int sendAttendance(uint16_t id) {
  if (!connectWifi() || time(nullptr) < 1700000000) return -1;
  WiFiClientSecure tls;
  tls.setCACert(ROOT_CA);
  HTTPClient http;
  if (!http.begin(tls, String(API_ORIGIN) + "/api/iot/attendance")) return -1;
  http.setTimeout(8000);
  http.addHeader("Authorization", String("Bearer ") + DEVICE_TOKEN);
  http.addHeader("Content-Type", "application/json");
  const int status = http.POST(String("{\"fingerprintId\":") + id + "}");
  // Only print status; never log bearer credentials or student response bodies.
  Serial.printf("Attendance HTTP status: %d\n", status);
  http.end();
  return status;
}
void setup() {
  Serial.begin(115200);
  sensorSerial.begin(57600, SERIAL_8N1, 16, 17);
  sensor.begin(57600);
  if (!sensor.verifyPassword()) {
    Serial.println("Sensor unavailable: verify power, UART wiring and sensor password.");
    while (true) delay(1000);
  }
  WiFi.mode(WIFI_STA);
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
  Serial.println("Scanner ready. Enroll on sensor, then assign IDs in MessMate.");
}
void loop() {
  connectWifi();
  if (millis() - lastScan < 2000) { delay(40); return; }
  if (sensor.getImage() != FINGERPRINT_OK) { delay(60); return; }
  if (sensor.image2Tz() != FINGERPRINT_OK || sensor.fingerFastSearch() != FINGERPRINT_OK) {
    Serial.println("Fingerprint not recognized by sensor."); delay(800); return;
  }
  lastScan = millis();
  const int status = sendAttendance(sensor.fingerID);
  // Retry only brief transient failure. Backend resolves CURRENT meal, not scan time.
  if (status < 0 || status >= 500) { delay(1000); sendAttendance(sensor.fingerID); }
  if (status == 401 || status == 403) Serial.println("Check device credential, type and enabled status.");
  if (status == 409) Serial.println("No active meal. Do not retry outside the meal window.");
  const unsigned long until = millis() + 5000;
  while (sensor.getImage() != FINGERPRINT_NOFINGER && (long)(millis()-until)<0) delay(80);
}
