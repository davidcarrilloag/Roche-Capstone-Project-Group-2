---
doc_id: SOP-012-EN
title: Laboratory Equipment Maintenance & Support
version: v1.0
date: "2026-06-02"
language: en
topic_tags:
  - maintenance
  - preventive-maintenance
  - calibration
  - support
  - troubleshooting
  - instruments
roche_use_cases: "8"
source: Roche Basel Campus
origin: synthetic
---

# Laboratory Equipment Maintenance & Support

## 1. Preventive Maintenance (PM)

- Every instrument has a **PM schedule based on the manufacturer's
  recommendations**. Scheduled PM and calibration windows are booked through
  **SLS Core** and performed by qualified technicians.
- **Do not silence or skip a due-PM flag.** An instrument past its PM or
  calibration due date must not be used for reportable results.
- All maintenance, calibration and repair activity is logged in **BioLIMS v4**
  (servicing date, work performed, parts, technician).

## 2. Routine User Checks (before each use)

- Confirm the instrument is **within its calibration date** and shows no PM/error
  flag.
- Check consumables, seals and fill levels; verify environmental conditions
  (temperature, humidity) are within spec.
- For measurement instruments, run the daily **system suitability / reference
  standard** check where required.

## 3. Calibration

- Follow the manufacturer interval and use the **correct certified reference
  materials**. For drift detection and corrective action, see *Instrument
  Calibration Drift — Detection, Assessment, and Management Procedure*.

## 4. When Equipment Fails or Drifts

1. **Stop using the instrument** and tag it **"Out of Service."**
2. Log the fault as an **equipment deviation in BioLIMS v4**.
3. **Open a support ticket** (ServiceNow) via the Scientist Assistant or the
   Service Portal — include the instrument ID, what failed, and the error message.
4. Maintenance/vendor coordination is handled by **Lab Operations**; instrument
   **connectivity/PC** issues go to the **Global Campus IT Service Desk**
   (`it-helpdesk.basel-campus.internal`, ext `*4433`).
5. Return to service **only after verification** confirms performance meets spec,
   recorded in BioLIMS v4.

## 5. Maintenance Frequency (typical)

| Activity | Frequency |
|----------|-----------|
| User pre-use checks | Every use |
| Performance verification (QC/reference) | Daily–weekly per instrument |
| Preventive maintenance service | Per manufacturer (e.g. quarterly/annual) |
| Calibration | Per manufacturer interval (risk-based) |

## 6. Records

Keep detailed records of all maintenance and calibration — they support
compliance and help spot recurring faults before they cause downtime.
