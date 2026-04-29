# TML OEM API — Postman Guide

## Step 1: Import the Collection

1. Open **Postman**
2. Click **Import** → select `TML-OEM-API.postman_collection.json`
3. The collection appears with 8 requests ready to use

---

## Step 2: Run in Order

Run the requests **top to bottom**. Tokens and IDs are saved automatically.

| # | Request | What it does |
|---|---|---|
| 1 | **Generate Token** | Gets auth token — saved automatically |
| 2 | **Order Creation** | Creates order with vehicles — tracking ID saved automatically |
| 3 | **Order Status** | Shows live status of all vehicles in the order |
| 4 | **SPOC Update** | Assigns a point of contact to the vehicle |
| 5 | **AIS140 Cert Request** | Raises an AIS140 certification ticket |
| 6 | **Mining Cert Request** | Raises a mining certification ticket |
| 7 | **AIS140 Ticket Status** | Check status of AIS140 ticket(s) for a vehicle |
| 8 | **Mining Ticket Status** | Check status of mining ticket(s) for a vehicle |

---

## Notes

**Ticket Status — All vs Single:**
- `ticket_no: null` → returns **all tickets** for that VIN (full history)
- `ticket_no: "AIS-TKT-XXXX"` → returns **only that specific ticket**

**Timestamps:**
- `updated_at` in Order Status is in **Unix epoch milliseconds**
- Convert at [epochconverter.com](https://epochconverter.com)

**Renewing a ticket:**
- Call AIS140 or Mining Cert Request again for the same VIN → a **new ticket number** is created automatically

---

## Credentials

| Field | Value |
|---|---|
| client_id | `tml-client-id` |
| client_secret | `tml-client-secret` |
| Base URL | `https://tml-oem-api.vercel.app` |
