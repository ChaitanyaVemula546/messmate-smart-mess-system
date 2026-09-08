#pragma once
// Copy to config.h locally. config.h is ignored by Git.
const char WIFI_SSID[] = "YOUR_WIFI_SSID";
const char WIFI_PASSWORD[] = "YOUR_WIFI_PASSWORD";
const char API_ORIGIN[] = "https://YOUR_API_HOST";
const char DEVICE_TOKEN[] = "YOUR_PER_DEVICE_TOKEN";
// Obtain the real root CA for your HTTPS API. Never call setInsecure().
const char ROOT_CA[] = R"CERT(
PASTE_YOUR_API_ROOT_CA_PEM_HERE
)CERT";
const char DEVICE_ID[] = "WASTE_BIN_01";
// Raw HX711 counts per kilogram, derived from YOUR known-mass calibration.
const float CALIBRATION_FACTOR = 0.0f;
const float CAPACITY_KG = 20.0f;
