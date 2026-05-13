# User Guide: Understanding the Dashboard

This guide explains how to read the metrics, charts, and status indicators on the Fleet Management Dashboard.

## 1. Device Health Overview

The top cards show a real-time summary of your fleet's status:

*   **Healthy**: Total number of devices that are currently **Connected** and operating within safe thresholds.
*   **Warnings**: Devices that are nearing critical resource limits but are still operational.
*   **Critical Issues**: Devices that have exceeded safety thresholds or require immediate attention.
*   **Offline**: Devices that have lost connection to the server.

---

## 2. Thresholds & Alerts

The system uses specific percentage and decimal thresholds to categorize device health:

### **Critical (Status: Red)**
An issue is marked as **Critical** if a device hits these limits:
| Metric | Threshold |
| :--- | :--- |
| **CPU Usage** | 80% or higher |
| **Memory (RAM)** | 80% or higher |
| **Storage (Disk)** | 80% or higher |
| **Network Signal** | Weaker than -75 dBm |

### **Warning (Status: Yellow)**
A **Warning** is triggered for usage between 60% and 80%:
| Metric | Threshold |
| :--- | :--- |
| **CPU Usage** | 60% to 79% |
| **Memory (RAM)** | 60% to 79% |
| **Storage (Disk)** | 60% to 79% |
| **Network Signal** | -65 dBm to -75 dBm |

---

## 3. Issues by Categories (Chart)

The monthly chart tracks historical trends based on **Device Action Logs**.

### **How to Read the Chart:**
*   **CPU Overload**: Tracks events where the device reported high load or failed to process tasks.
*   **Network Unstable**: Tracks failed connectivity checks (pings) and signal drops.
*   **Update Failed**: Tracks failed firmware updates or app installations.
*   **Offline**: Tracks every time a device disconnected from the server.

> [!NOTE]
> The chart compares the **Current Month** data against the **Previous Month** to show the growth or reduction of system issues.

---

## 4. Signal Strength Guide

Signal strength is measured in dBm (decibels relative to a milliwatt). **Lower numbers (closer to 0) are better.**

*   **-30 to -50 dBm**: Excellent.
*   **-51 to -64 dBm**: Good.
*   **-65 to -75 dBm**: Weak (Warning).
*   **Below -75 dBm**: Poor/Critical.

---

## 5. Frequently Asked Questions

**Q: Why do I see a "Warning" but the chart shows 0?**
A: Real-time warnings (top cards) are based on the latest report. The chart reflects **historical failures**. A device might be struggling right now (Warning) without having caused a recorded failure log yet.

**Q: My signal says -1 dBm but I have a network warning?**
A: A -1 dBm signal is perfect. If you have a warning, it likely means the device is "Stale" (it hasn't reported the signal value in over 24 hours), or there is another resource issue (CPU/Memory).