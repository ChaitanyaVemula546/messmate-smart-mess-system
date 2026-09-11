#pragma once
// Copy to config.h. This local file is excluded from Git and deployment uploads.
const char WIFI_SSID[] = "YOUR_WIFI_SSID";
const char WIFI_PASSWORD[] = "YOUR_WIFI_PASSWORD";
const char API_ORIGIN[] = "https://messmate-smart-mess-system.vercel.app";
const char SCANNER_TOKEN[] = "YOUR_FINGERPRINT_SCANNER_TOKEN";
// Your R307: sensor TX to GPIO16, sensor RX to GPIO17; UART 57600 baud.
constexpr int FINGER_RX = 16;
constexpr int FINGER_TX = 17;
