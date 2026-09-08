// SOFTWARE API VERIFIED; REQUIRES CALIBRATION AND PHYSICAL HARDWARE VERIFICATION.
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <HX711.h>
#include <Preferences.h>
#include <time.h>
#include <math.h>
#include <esp_system.h>
#include "config.h"
HX711 scale;
Preferences state;
String pending;
unsigned long nextAttempt = 0;
unsigned long backoff = 1000;
unsigned long nextSample = 0;
bool calibrated = false;
float lastReported = -1;

String measurementId() {
  char id[37];
  snprintf(id, sizeof(id), "%08x-%04x-4%03x-%04x-%08x%04x",
    (unsigned)esp_random(), (unsigned)(esp_random() & 0xffff),
    (unsigned)(esp_random() & 0x0fff), (unsigned)(0x8000 | (esp_random() & 0x3fff)),
    (unsigned)esp_random(), (unsigned)(esp_random() & 0xffff));
  return String(id);
}
void queueReading(float kg, bool tare) {
  // Keep exactly one pending event in NVS, including its retry identifier.
  char weight[24]; snprintf(weight, sizeof(weight), "%.3f", kg);
  pending = String("{\"deviceId\":\"") + DEVICE_ID + "\",\"weightKg\":" + weight +
    ",\"measurementId\":\"" + measurementId() + "\",\"tare\":" + (tare ? "true" : "false") + "}";
  state.putString("pending", pending);
  lastReported = kg;
}
void flushPending() {
  if (!pending.length() || (long)(millis()-nextAttempt)<0) return;
  if (WiFi.status()!=WL_CONNECTED) { WiFi.reconnect(); nextAttempt=millis()+5000; return; }
  if (time(nullptr)<1700000000) {nextAttempt=millis()+2000;return;}
  WiFiClientSecure tls; tls.setCACert(ROOT_CA);
  HTTPClient http;
  if (!http.begin(tls,String(API_ORIGIN)+"/api/iot/waste")) {nextAttempt=millis()+5000;return;}
  http.setTimeout(8000);
  http.addHeader("Authorization",String("Bearer ")+DEVICE_TOKEN);
  http.addHeader("Content-Type","application/json");
  int status=http.POST(pending);http.end();
  Serial.printf("Waste HTTP status: %d\n",status);
  if(status==200||status==201){pending="";state.remove("pending");backoff=1000;}
  else {nextAttempt=millis()+backoff;backoff=min(backoff*2,60000UL);
    if(status>=400&&status<500&&status!=429)Serial.println("Reading retained. Correct device configuration or inspect API validation; do not discard silently.");}
}
void setup(){
 Serial.begin(115200);state.begin("messmate",false);
 scale.begin(32,33); // HX711 DOUT=32, SCK=33; logic must be ESP32-compatible.
 if(CALIBRATION_FACTOR==0){Serial.println("Set the measured counts-per-kg CALIBRATION_FACTOR first.");while(true)delay(1000);}
 scale.set_scale(CALIBRATION_FACTOR);
 calibrated=state.getBool("tared",false);
 if(calibrated)scale.set_offset(state.getLong("offset",0));
 pending=state.getString("pending","");
 WiFi.mode(WIFI_STA);WiFi.begin(WIFI_SSID,WIFI_PASSWORD);
 configTime(0,0,"pool.ntp.org","time.nist.gov");
 Serial.println("Empty bin, then send t to tare. Never tare a loaded bin or automatically on reboot.");
}
void loop(){
 flushPending();
 if(Serial.available()&&Serial.read()=='t'){
   if(pending.length()){Serial.println("Deliver the previous reading before tare.");return;}
   if(!scale.wait_ready_timeout(1000)){Serial.println("HX711 unavailable.");return;}
   scale.tare(20);state.putLong("offset",scale.get_offset());state.putBool("tared",true);
   calibrated=true;queueReading(0,true);return;
 }
 if(!calibrated||pending.length()||(long)(millis()-nextSample)<0){delay(30);return;}
 nextSample=millis()+30000;
 if(!scale.wait_ready_timeout(1000))return;
 const float a=scale.get_units(10),b=scale.get_units(10);
 if(!isfinite(a)||!isfinite(b)||fabs(a-b)>0.03f||b<-.05f||b>CAPACITY_KG){Serial.println("Unstable or out-of-range reading ignored.");return;}
 const float kg=max(0.0f,b);
 // Small noise is filtered here; the server also maintains a per-session high-water mark.
 if(lastReported<0||fabs(kg-lastReported)>=0.02f)queueReading(kg,false);
}
