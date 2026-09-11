// MessMate: ESP32 + R307 fingerprint enrollment, inventory and attendance.
// Fingerprint templates remain inside the sensor; HTTPS sends numeric IDs only.
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <Adafruit_Fingerprint.h>
#include <time.h>
#include "config.h"
#include "trusted-roots.h"
HardwareSerial FingerSerial(2);
Adafruit_Fingerprint finger(&FingerSerial);
bool fingerReady=false, inventoryReady=false, inventoryDirty=false;
bool slots[1001]={};
uint16_t slotLimit=0;
String serialLine;
unsigned long nextWifi=0, nextInventory=0, nextSensorCheck=0, lastFingerPoll=0;
unsigned long nextTimeSync=0;
bool waitingForRemoval=false;
bool due(unsigned long timestamp) { return (long)(millis() - timestamp) >= 0; }
void maintainWifi() {
  if (WiFi.status() != WL_CONNECTED && due(nextWifi)) {
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    nextWifi = millis() + 15000;
  }
  // Start DNS/NTP only after Wi-Fi has an address; retry if the first request fails.
  if (WiFi.status() == WL_CONNECTED && time(nullptr) <= 1700000000 && due(nextTimeSync)) {
    configTime(0, 0, "time.google.com", "pool.ntp.org", "time.nist.gov");
    nextTimeSync = millis() + 60000;
    Serial.println("Wi-Fi connected; synchronizing clock for HTTPS.");
  }
}
bool networkReady() {
  maintainWifi();
  return WiFi.status() == WL_CONNECTED && time(nullptr) > 1700000000;
}
int postJson(const char* path, const char* credential, const String& body, String* result = nullptr) {
  if (!networkReady()) return -1;
  WiFiClientSecure tls;
  tls.setCACert(MESSMATE_ROOTS);
  HTTPClient http;
  http.setConnectTimeout(8000);
  http.setTimeout(15000);
  if (!http.begin(tls, String(API_ORIGIN) + path)) return -1;
  http.addHeader("Authorization", String("Bearer ") + credential);
  http.addHeader("Content-Type", "application/json");
  int code = http.POST(body);
  // Responses contain student details; never dump them or credentials to Serial.
  if (result && code > 0) *result = http.getString();
  http.end();
  return code;
}

// Read only the template index bitmap, never fingerprint images/templates.
// Command 0x1F follows Adafruit's public CircuitPython read_templates protocol.
// Every page must succeed before an inventory can replace the website snapshot.
bool readInventory() {
  if (!fingerReady || finger.getParameters() != FINGERPRINT_OK ||
      finger.capacity < 2 || finger.capacity > 1001) return false;
  bool found[1001] = {};
  const uint16_t capacity = finger.capacity;
  unsigned count = 0;
  for (uint16_t page = 0; page < (capacity + 255) / 256; page++) {
    uint8_t command[] = {0x1F, (uint8_t)page};
    Adafruit_Fingerprint_Packet packet(FINGERPRINT_COMMANDPACKET, sizeof(command), command);
    finger.writeStructuredPacket(packet);
    if (finger.getStructuredPacket(&packet) != FINGERPRINT_OK ||
        packet.type != FINGERPRINT_ACKPACKET || packet.length != 35 ||
        packet.data[0] != FINGERPRINT_OK) {
      Serial.println("Sensor inventory read failed; website inventory preserved. Check R307 protocol/wiring.");
      return false;
    }
    for (unsigned bit = 0; bit < 256; bit++) {
      uint16_t id = page * 256 + bit;
      if (id >= capacity || !(packet.data[1 + bit / 8] & (1 << (bit % 8)))) continue;
      count++;
      if (id == 0) {
        Serial.println("Sensor slot 0 is occupied; MessMate supports IDs starting at 1. No template was changed.");
        continue;
      }
      found[id] = true;
    }
  }
  if (finger.getTemplateCount() != FINGERPRINT_OK || finger.templateCount != count) {
    Serial.println("Sensor count and index disagree; website inventory preserved.");
    return false;
  }
  memcpy(slots, found, sizeof(slots));
  slotLimit = min((uint16_t)1000, (uint16_t)(capacity - 1));
  inventoryReady = true;
  inventoryDirty = true;
  Serial.printf("Read %u enrolled sensor slots. Supported enrollment IDs: 1-%u.\n", count, slotLimit);
  return true;
}
void syncInventory() {
  if (!inventoryReady || !inventoryDirty || !due(nextInventory) || !networkReady()) return;
  String payload = "{\"fingerprintIds\":[";
  bool first = true;
  for (uint16_t id = 1; id <= slotLimit; id++) if (slots[id]) {
    if (!first) payload += ',';
    payload += id;
    first = false;
  }
  payload += "]}";
  int code = postJson("/api/iot/fingerprints", SCANNER_TOKEN, payload);
  Serial.printf("Fingerprint inventory HTTP %d\n", code);
  if (code == 200) {
    inventoryDirty = false;
    Serial.println("Enrolled IDs are available on the website's Fingerprints page.");
  }
  nextInventory = millis() + (code == 200 ? 60000 : 15000);
}


void serviceDuringEnrollment() { maintainWifi(); delay(25); }
bool waitForImage() {
  unsigned long until = millis() + 45000;
  while (!due(until)) {
    uint8_t status = finger.getImage();
    if (status == FINGERPRINT_OK) return true;
    if (status != FINGERPRINT_NOFINGER) {
      Serial.printf("Fingerprint capture error %u; enrollment cancelled.\n", status);
      return false;
    }
    serviceDuringEnrollment();
  }
  Serial.println("Enrollment timed out; no template changed.");
  return false;
}
bool waitForRemoval() {
  unsigned long until = millis() + 30000;
  while (!due(until)) {
    uint8_t status = finger.getImage();
    if (status == FINGERPRINT_NOFINGER) return true;
    if (status != FINGERPRINT_OK) return false;
    serviceDuringEnrollment();
  }
  Serial.println("Finger removal timed out.");
  return false;
}
void enroll(uint16_t id) {
  // Enrollment attempts never become attendance, including cancellation/errors.
  waitingForRemoval = true;
  if (!fingerReady || !readInventory()) { Serial.println("Cannot enroll until a complete sensor inventory is readable."); return; }
  if (id < 1 || id > slotLimit || slots[id]) {
    Serial.println("Choose an unused ID within the sensor range. Existing fingerprints are never overwritten."); return;
  }
  Serial.printf("Enroll ID %u: place finger (45-second timeout).\n", id);
  if (!waitForImage() || finger.image2Tz(1) != FINGERPRINT_OK) return;
  uint8_t match = finger.fingerSearch();
  if (match == FINGERPRINT_OK) {
    Serial.printf("That finger is already enrolled as ID %u. Use that ID on the website.\n", finger.fingerID);
    waitingForRemoval = true;
    return;
  }
  if (match != FINGERPRINT_NOTFOUND) { Serial.println("Sensor search failed; enrollment cancelled."); return; }
  Serial.println("Remove your finger.");
  if (!waitForRemoval()) return;
  Serial.println("Place the same finger again.");
  if (!waitForImage() || finger.image2Tz(2) != FINGERPRINT_OK) return;
  if (finger.createModel() != FINGERPRINT_OK) { Serial.println("Fingerprints did not match. Try again."); return; }
  if (finger.storeModel(id) != FINGERPRINT_OK) { Serial.println("Sensor could not store the template."); return; }
  Serial.printf("Fingerprint ID %u stored inside R307. Assign it to a student on the website.\n", id);
  inventoryReady = false;
  readInventory();
  nextInventory = millis();
  waitingForRemoval = true;
}
void pollFingerprint() {
  if (!fingerReady || millis() - lastFingerPoll < 150) return;
  lastFingerPoll = millis();
  uint8_t capture = finger.getImage();
  if (waitingForRemoval) {
    if (capture == FINGERPRINT_NOFINGER) waitingForRemoval = false;
    return;
  }
  if (capture == FINGERPRINT_NOFINGER) return;
  if (capture != FINGERPRINT_OK) return;
  waitingForRemoval = true;
  if (finger.image2Tz(1) != FINGERPRINT_OK || finger.fingerSearch() != FINGERPRINT_OK) {
    Serial.println("Fingerprint not recognized. Enroll it first with e <id>."); return;
  }
  uint16_t id = finger.fingerID;
  if (id < 1 || id > 1000) { Serial.println("Unsupported sensor ID; website IDs start at 1."); return; }
  if (!networkReady()) { Serial.println("Scan not sent: waiting for Wi-Fi/time. Scan again after connection."); return; }
  String response;
  String payload = String("{\"fingerprintId\":") + id + "}";
  int status = postJson("/api/iot/attendance", SCANNER_TOKEN, payload, &response);
  // No delayed/offline attendance: server uses the current meal at receipt time.
  Serial.printf("Fingerprint ID %u attendance HTTP %d\n", id, status);
  if (status == 200) {
    Serial.println(response.indexOf("already_recorded") >= 0 ? "Attendance already recorded for this meal." : "Attendance recorded on the website.");
  } else if (status == 404) Serial.println("Enrolled ID needs an active student assignment on the website.");
  else if (status == 409) Serial.println("No active meal. Enrollment still appears on the Fingerprints page.");
  else if (status == 401 || status == 403) Serial.println("Check scanner credential and enabled status in Devices.");
  else Serial.println("Request not confirmed. Remove your finger and scan again; duplicate attendance is safe.");
}
void printHelp() {
  Serial.println("MessMate R307: Serial Monitor 115200 baud, Newline ending.");
  Serial.println("e <id> : enroll an unused fingerprint ID; sync : reread all enrolled IDs.");
  Serial.println("status : connection state; ? : help. Normal scans record meal attendance.");
  Serial.println("After enrollment, open the website's Fingerprints page and assign the ID to a student.");
  Serial.println("No command in this sketch deletes or overwrites existing fingerprints.");
}
void processSerial() {
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\r') continue;
    if (ch != '\n') {
      if (serialLine.length() < 64) serialLine += ch;
      else serialLine = "";
      continue;
    }
    String command = serialLine;
    serialLine = "";
    command.trim();
    if (command.startsWith("e ")) {
      String arg = command.substring(2); arg.trim();
      bool numeric = arg.length() > 0;
      for (unsigned i = 0; i < arg.length(); i++) if (!isDigit(arg[i])) numeric = false;
      long id = arg.toInt();
      if (numeric && id >= 1 && id <= 1000) enroll((uint16_t)id);
      else Serial.println("Use e <unused fingerprint ID>.");
    } else if (command == "sync") {
      if (readInventory()) nextInventory = millis();
    } else if (command == "status") {
      Serial.printf("Wi-Fi: %s; time: %s; R307: %s; inventory: %s\n",
        WiFi.status() == WL_CONNECTED ? "connected" : "disconnected",
        time(nullptr) > 1700000000 ? "ready" : "waiting",
        fingerReady ? "ready" : "unavailable",
        inventoryReady ? (inventoryDirty ? "waiting to upload" : "synced") : "unavailable");
    } else if (command.length()) printHelp();
  }
}
void setup() {
  Serial.begin(115200);
  FingerSerial.begin(57600, SERIAL_8N1, FINGER_RX, FINGER_TX);
  finger.begin(57600);
  WiFi.mode(WIFI_STA);
  maintainWifi();
  printHelp();
}
void loop() {
  maintainWifi();
  if (!fingerReady && due(nextSensorCheck)) {
    fingerReady = finger.verifyPassword();
    nextSensorCheck = millis() + 5000;
    if (fingerReady) readInventory();
    else Serial.println("R307 unavailable: check power, common ground, TX to GPIO16 and RX to GPIO17.");
  }
  processSerial();
  pollFingerprint();
  if (fingerReady && due(nextInventory)) {
    if ((!inventoryDirty && !waitingForRemoval) || !inventoryReady) {
      if (!readInventory()) nextInventory = millis() + 15000;
    }
    syncInventory();
  }
  delay(10);
}
