#pragma once
// Copy to config.h locally. config.h is ignored by Git.
const char WIFI_SSID[] = "YOUR_WIFI_SSID";
const char WIFI_PASSWORD[] = "YOUR_WIFI_PASSWORD";
const char API_ORIGIN[] = "https://messmate-smart-mess-system.vercel.app";
const char DEVICE_TOKEN[] = "YOUR_PER_DEVICE_TOKEN";
// Obtain the real root CA for your HTTPS API. Never call setInsecure().
const char ROOT_CA[] = R"CERT(
PASTE_YOUR_API_ROOT_CA_PEM_HERE
)CERT";
