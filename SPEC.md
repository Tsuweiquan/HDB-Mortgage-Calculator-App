# HDB Cash Outlay Calculator — Requirements Specification

**Version:** 1.2
**Date:** 2026-09-19
**Status:** Authoritative. v1.1 added the lease model (§3.2), MSR/TDSR (§3.3) and the
CPF Valuation Limit pro-ration (§3.4). v1.2 resolves Open Question 6: the age-95
pro-ration applies to CPF always and to LTV only on an HDB concessionary loan.
**Notation:** EARS (Easy Approach to Requirements Syntax)

---

## 1. Purpose and Scope

### 1.1 Purpose
The HDB Cash Outlay Calculator ("the system") estimates the **cash a Singapore HDB flat buyer
must fork out at completion**, after accounting for the mortgage loan, CPF Ordinary Account
savings, housing grants, and Buyer's Stamp Duty.

### 1.2 In scope
Flat price, room type and TOP year; the remaining-lease model and its effect on loan and CPF;
loan tenure, LTV, MSR and TDSR; CPF OA; flat-type grant; Proximity Housing Grant with
map-based distance measurement; Buyer's Stamp Duty; and the resulting cash figure.

### 1.3 Out of scope
Option fee and deposit, conveyancing and legal fees, HDB resale application fees, valuation
fees, agent commission, cash-over-valuation, Additional Buyer's Stamp Duty, resale levy,
income-ceiling and first-timer eligibility assessment, amortisation schedules beyond the
single stress-tested instalment, and persistence of user data between sessions.

### 1.4 EARS patterns used

| Pattern | Template |
|---|---|
| Ubiquitous | The system shall `<response>`. |
| Event-driven | When `<trigger>`, the system shall `<response>`. |
| State-driven | While `<state>`, the system shall `<response>`. |
| Unwanted behaviour | If `<condition>`, then the system shall `<response>`. |
| Optional feature | Where `<feature>`, the system shall `<response>`. |
| Complex | Combinations of the above. |

---

## 2. Definitions

| Term | Definition |
|---|---|
| **Price** | The agreed purchase price of the flat, in SGD. |
| **LTV** | Loan-to-Value ratio; the loan as a percentage of Price. |
| **Downpayment** | Price − Loan. The portion not covered by the mortgage. |
| **CPF OA** | Combined CPF Ordinary Account balance of all buyers. |
| **CPF Pool** | CPF OA + Total Grants; the non-cash funds available at completion. |
| **BSD** | Buyer's Stamp Duty, per IRAS residential rates effective 20 Feb 2023. |
| **PHG** | Proximity Housing Grant, granted when the new flat is within 4 km of the current/parents' flat. |
| **Minimum Cash** | The portion of Price that regulation requires to be paid in hard cash (5% for bank loans, 0% for HDB loans). |
| **Cash Outlay** | The headline output: cash for downpayment + stamp duty paid in cash. |
| **TOP** | Temporary Occupation Permit. It is an official document issued by the Building and Construction Authority (BCA) in Singapore that allows homeowners to move into a newly completed HDB flat or residential building. |
| **Remaining Lease** | 99 − (current year − TOP year). The years of lease left at the point of purchase. |
| **Years-to-95** | 95 − age of the youngest buyer. The lease span needed for full CPF and full LTV. |
| **Lease Ratio** | min(1, Remaining Lease ÷ Years-to-95). Pro-rates the CPF Valuation Limit on any loan type, and the LTV on an HDB concessionary loan only. |
| **MSR** | Mortgage Servicing Ratio. Monthly property-loan repayments ÷ gross monthly income, capped at 30%. Applies only to HDB flats and ECs bought from a developer. |
| **TDSR** | Total Debt Servicing Ratio. All monthly debt repayments ÷ gross monthly income, capped at 55%. Applies to every property loan. |
| **Stress Rate** | The interest rate at which MSR and TDSR are assessed: the higher of 4% p.a. or the prevailing rate. |
| **Binding Cap** | The lowest of the requested loan, the LTV cap, the MSR cap, the TDSR cap and the flat price — the one that actually determines the loan. |

---

## 3. Functional Requirements

### 3.1 Buyer income and flat details

- **REQ-FLAT-1** — The system shall provide a room-type selector offering 2-room Flexi, 3-room, 4-room, 5-room, and Executive/Maisonette.
- **REQ-FLAT-2** — The system shall provide a numeric input for the flat purchase price in SGD, pre-filled with a default of $900,000.
- **REQ-FLAT-3** — If the entered price is negative or non-numeric, then the system shall treat the price as 0.
- **REQ-FLAT-4** — While no price has been entered, the system shall display the guidance text "Enter a flat price to begin." in place of the result subtitle.
- **REQ-FLAT-5** — The system shall provide a numeric input for the flat's TOP year, bounded to the range (current year − 99) to the current year inclusive.
- **REQ-FLAT-6** — The system shall compute Remaining Lease = 99 − (current year − TOP year) and shall display it together with the years of lease already used.
- **REQ-FLAT-7** — The system shall provide a numeric input for the age of the youngest buyer, bounded to 21–80, pre-filled with a default of 31.

### 3.2 Lease, loan tenure and LTV

- **REQ-LOAN-1** — The system shall offer two mutually exclusive loan-entry modes: *LTV ratio* and *manual loan amount*.
- **REQ-LOAN-2** — The system shall default to LTV mode with an LTV of 75%.
- **REQ-LOAN-3** — While LTV mode is selected, the system shall compute Loan = Price × LTV ÷ 100 and shall hide the manual loan input.
- **REQ-LOAN-4** — While manual mode is selected, the system shall use the entered loan amount verbatim and shall hide the LTV input. The field shall be pre-filled at 75% of the default price.
- **REQ-LOAN-5** — If the resulting loan exceeds the price, then the system shall cap the loan at the price.
- **REQ-LOAN-6** — If the entered LTV is outside 0–100, then the system shall clamp it to that range.
- **REQ-LOAN-7** — The system shall compute Downpayment = Price − Loan and shall display it together with its percentage of Price to one decimal place.
- **REQ-LOAN-8** — The system shall provide a loan-type selector offering *HDB concessionary loan* and *bank loan*.
- **REQ-LOAN-9** — Where the loan type is a bank loan, the system shall set Minimum Cash = 5% of Price.
- **REQ-LOAN-10** — Where the loan type is an HDB concessionary loan, the system shall set Minimum Cash = 0.
- **REQ-LOAN-11** — The system shall compute Years-to-95 = 95 − age of the youngest buyer, and Lease Ratio = min(1, Remaining Lease ÷ Years-to-95).
- **REQ-LOAN-12** — Where the Remaining Lease covers the youngest buyer to age 95, the system shall apply a Lease Ratio of 1 and shall grant the full LTV.
- **REQ-LOAN-13** — Where the loan is an HDB concessionary loan and the Remaining Lease does not cover the youngest buyer to age 95, the system shall pro-rate the LTV by the Lease Ratio and shall state the pro-ration and its two operands.
- **REQ-LOAN-14** — If the Remaining Lease is 20 years or less, then the system shall set the maximum loan to 0 and the usable CPF to 0, and shall state that the purchase must be made entirely in cash.
- **REQ-LOAN-15** — The system shall cap the loan tenure at the shortest of: the policy maximum for the loan type (25 years for an HDB concessionary loan, 30 for a bank loan), (65 − age of the youngest buyer), and (Remaining Lease − 20).
- **REQ-LOAN-16** — When the requested tenure exceeds the cap, the system shall clamp it and shall name which of the three limits bound it.
- **REQ-LOAN-17** — Where the loan is a bank loan and the tenure exceeds 25 years or (tenure + age) exceeds 65, the system shall reduce the base LTV to 55% before applying the Lease Ratio.
- **REQ-LOAN-18** — The system shall display the effective LTV after both the age/tenure reduction and the lease pro-ration have been applied.
- **REQ-LOAN-19** — The system shall compute the LTV cap as (75%, or 55% where REQ-LOAN-17 applies) × Lease Ratio, and shall pre-populate the Target LTV field with that cap.
- **REQ-LOAN-20** — While the Target LTV field is auto-populated, the system shall use the unrounded cap for the calculation and treat the displayed two-decimal value as presentation only.
- **REQ-LOAN-21** — When the user edits the Target LTV field, the system shall stop auto-populating it, treat the entered value as authoritative, still cap it at the computed LTV cap, and offer a control to restore the computed value.
- **REQ-LOAN-22** — The system shall display the derivation of the LTV cap beneath the field, naming the base rate, the pro-ration percentage and the result.
- **REQ-LOAN-23** — Where the loan is a bank loan, the system shall **not** pro-rate the LTV by the Lease Ratio. A bank loan's LTV shall be governed by the tenure and age-65 tests of REQ-LOAN-17, with the lease constraining it only through the tenure cap of REQ-LOAN-15.
- **REQ-LOAN-24** — Where the loan is a bank loan and the Lease Ratio is below 1, the system shall state that the bank LTV is not pro-rated, that CPF usage still is, and what an HDB loan on the same flat would be pro-rated to.

### 3.3 MSR and TDSR

- **REQ-MSR-1** — The system shall provide numeric inputs for gross monthly household income, pre-filled with a default of $13,000, and for other monthly debt repayments, defaulting to 0.
- **REQ-MSR-2** — The system shall provide a stress-test rate input defaulting to 4% p.a.
- **REQ-MSR-16** — The system shall provide a separate input for the interest rate the buyer will actually pay, defaulting to 2.6% p.a., the HDB concessionary rate (CPF OA rate + 0.1%).
- **REQ-MSR-17** — The system shall compute and display the monthly instalment at the actual interest rate, distinctly from the instalment assessed at the stress-test rate, and shall label which rate each figure uses.
- **REQ-MSR-18** — The system shall display the total interest payable over the loan tenure at the actual interest rate.
- **REQ-MSR-19** — The system shall assess MSR and TDSR at the stress-test rate only, never at the actual rate.
- **REQ-MSR-3** — The system shall cap the Mortgage Servicing Ratio at 30% of gross monthly income.
- **REQ-MSR-4** — Where the property is an HDB flat or an EC whose MOP has not expired, the system shall apply the MSR cap. Since the system models HDB flats only, MSR shall always apply.
- **REQ-MSR-5** — The system shall cap the Total Debt Servicing Ratio at 55% of gross monthly income, inclusive of other monthly debt repayments.
- **REQ-MSR-6** — The system shall compute the monthly instalment as a level amortising payment over the loan tenure at the stress-test rate: `M = P·i / (1 − (1+i)^−n)`, where `i` is the monthly rate and `n` the number of months.
- **REQ-MSR-7** — The system shall derive the MSR loan cap by inverting that formula: `P = M·(1 − (1+i)^−n) / i`, with `M` = 30% of gross monthly income.
- **REQ-MSR-8** — The system shall derive the TDSR loan cap by the same inversion with `M` = (55% of gross monthly income − other monthly debts), floored at 0.
- **REQ-MSR-9** — The system shall set the loan to the lowest of: the requested amount, the LTV cap, the MSR cap, the TDSR cap, and the flat price.
- **REQ-MSR-10** — The system shall name which of those five limits is binding, in both the loan-eligibility summary and the purchase breakdown.
- **REQ-MSR-11** — If MSR is the binding cap, then the system shall display the shortfall against the LTV cap and shall state that the gap becomes upfront cash or CPF.
- **REQ-MSR-12** — If TDSR is the binding cap, then the system shall display the other-debt figure responsible and shall state that clearing it raises borrowing power.
- **REQ-MSR-13** — While gross monthly income is 0, the system shall not apply the MSR and TDSR caps and shall display "MSR not assessed" with a prompt to enter income.
- **REQ-MSR-14** — The system shall display the resulting MSR and TDSR as percentages with a proportional bar against their 30% and 55% limits, and shall mark a bar that exceeds its limit.
- **REQ-MSR-15** — The system shall display the monthly instalment, the effective LTV and the loan granted in a summary card adjacent to the cash figure.

### 3.4 CPF Ordinary Account

- **REQ-CPF-1** — The system shall provide a numeric input for the combined CPF OA balance of all buyers.
- **REQ-CPF-2** — The system shall draw from CPF only the amount required, never the full balance, and shall report any unused balance as remaining in the CPF OA.
- **REQ-CPF-3** — The system shall apply CPF Pool to the downpayment up to a maximum of (Downpayment − Minimum Cash).
- **REQ-CPF-4** — If Minimum Cash is greater than 0, then the system shall display a note stating the exact cash amount that CPF cannot cover and why.
- **REQ-CPF-5** — The system shall cap the total CPF applied to the purchase at the pro-rated Valuation Limit = Price × Lease Ratio, **regardless of loan type** — the pro-ration is a CPF rule and is unaffected by who lends.
- **REQ-CPF-6** — If the CPF Pool exceeds the pro-rated Valuation Limit, then the system shall display the blocked amount and shall exclude it from the funds available for the downpayment.
- **REQ-CPF-7** — If the Remaining Lease is 20 years or less, then the system shall set the usable CPF to 0.

### 3.5 Grants

- **REQ-GRANT-1** — The system shall provide a grant-scheme preset selector with the options *My own figures* (defaults: $25,000 / $10,000 / $10,000) and *HDB 2026 published figures* (defaults: $80,000 / $50,000 / $20,000).
- **REQ-GRANT-2** — When a preset is selected, the system shall overwrite the flat-type and proximity grant amounts with that preset's values and shall recalculate.
- **REQ-GRANT-3** — The system shall allow every grant amount to be edited after a preset is applied.
- **REQ-GRANT-4** — When a preset is selected, the system shall display an explanatory hint describing the provenance of that preset's figures.
- **REQ-GRANT-5** — Where the room type is 5-room or Executive/Maisonette, the system shall apply the "5-room & above" grant amount.
- **REQ-GRANT-6** — Where the room type is 4-room or smaller, the system shall apply the "4-room & below" grant amount.
- **REQ-GRANT-7** — While the flat-type grant eligibility checkbox is unticked, the system shall apply a flat-type grant of 0 and shall display "—" for that line.
- **REQ-GRANT-8** — The system shall provide an "other grants" input for amounts such as the Enhanced CPF Housing Grant, and shall add it to Total Grants.
- **REQ-GRANT-9** — The system shall compute Total Grants = flat-type grant + proximity grant + other grants.
- **REQ-GRANT-10** — The system shall treat all grants as CPF funds, not cash, consistent with HDB disbursing grants into the CPF OA.

### 3.6 Proximity Housing Grant and distance measurement

- **REQ-PROX-1** — The system shall provide two 6-digit postal-code inputs: the new flat and the current/parents' flat.
- **REQ-PROX-2** — When the user activates *Measure distance*, or presses Enter in either postal-code field, the system shall geocode both postal codes via the OneMap search API.
- **REQ-PROX-3** — If either postal code is not exactly six digits, then the system shall display "Both postal codes must be 6 digits." and shall not call the geocoding API.
- **REQ-PROX-4** — If the geocoding API returns no match for a postal code, then the system shall display an error naming that postal code, shall clear any prior distance result, and shall exclude the proximity grant from the calculation.
- **REQ-PROX-18** — If the geocoding API returns an error message and no usable result, then the system shall surface that provider message rather than reporting the postal code as not found.
- **REQ-PROX-5** — If the geocoding request fails or the network is unavailable, then the system shall display an error message and shall leave the remainder of the calculation fully functional.
- **REQ-PROX-6** — While a geocoding request is in flight, the system shall disable the *Measure distance* control and shall display "Looking up addresses…".
- **REQ-PROX-7** — When both postal codes are resolved, the system shall compute the great-circle (straight-line) distance between them using the haversine formula on a 6371.0088 km earth radius.
- **REQ-PROX-8** — When a distance has been computed, the system shall display it in kilometres to two decimal places together with the full resolved address of each flat.
- **REQ-PROX-9** — Where the computed distance is strictly less than 4 km, the system shall treat the proximity grant as eligible and shall state the qualifying grant amount.
- **REQ-PROX-10** — Where the computed distance is 4 km or greater, the system shall treat the proximity grant as not eligible and shall display "Further than 4 km — no Proximity Housing Grant."
- **REQ-PROX-11** — While no distance has been measured, the system shall display "not checked" on the proximity grant line and shall display a note prompting the user to measure the distance.
- **REQ-PROX-12** — The system shall display a map on page load, centred on Singapore, using OneMap basemap tiles.
- **REQ-PROX-13** — When a distance has been computed, the system shall plot a marker at each flat, a dashed connecting line labelled with the distance, and a 4 km radius circle centred on the new flat.
- **REQ-PROX-14** — When plotting a new measurement, the system shall remove all map layers from the previous measurement.
- **REQ-PROX-15** — When the map layers are plotted, the system shall fit the viewport to contain both markers and the 4 km circle.
- **REQ-PROX-16** — The system shall colour the connecting line green when the distance qualifies for the grant and red when it does not.
- **REQ-PROX-17** — The system shall attribute OneMap and the Singapore Land Authority for geocoding and map data.

### 3.7 Buyer's Stamp Duty

- **REQ-BSD-1** — The system shall compute BSD on the purchase price using the IRAS residential tiers effective 20 February 2023:

  | Band | Rate |
  |---|---|
  | First $180,000 | 1% |
  | Next $180,000 (to $360,000) | 2% |
  | Next $640,000 (to $1,000,000) | 3% |
  | Next $500,000 (to $1,500,000) | 4% |
  | Next $1,500,000 (to $3,000,000) | 5% |
  | Above $3,000,000 | 6% |

- **REQ-BSD-2** — The system shall display a per-band breakdown showing the rate, the price range it applies to, and the duty for that band, followed by the total.
- **REQ-BSD-3** — While the price is 0, the system shall display no stamp-duty breakdown.
- **REQ-BSD-4** — The system shall provide a control to pay BSD from leftover CPF OA, defaulting to off.
- **REQ-BSD-5** — While *pay BSD from CPF* is enabled, the system shall apply leftover CPF Pool to the BSD up to the lesser of the leftover and the BSD, and shall treat only the remainder as cash.
- **REQ-BSD-6** — While *pay BSD from CPF* is disabled, the system shall treat the entire BSD as cash.

### 3.8 Cash outlay calculation

- **REQ-CALC-1** — The system shall compute the result in the following order: Lease Ratio → tenure cap → LTV cap → MSR cap → TDSR cap → binding loan → Downpayment → Total Grants → CPF Pool (bounded by the pro-rated Valuation Limit) → CPF applied to downpayment (bounded by Minimum Cash) → cash for downpayment → BSD → BSD paid in cash → Cash Outlay.
- **REQ-CALC-2** — The system shall compute Cash Outlay = cash for downpayment + BSD paid in cash.
- **REQ-CALC-3** — The system shall never produce a negative cash-for-downpayment figure; surplus CPF and grants shall be reported as a remaining CPF balance instead.
- **REQ-CALC-4** — The system shall display the Cash Outlay as the single most prominent figure on the page, with a subtitle decomposing it into its downpayment and stamp-duty parts.
- **REQ-CALC-5** — The system shall display an itemised breakdown grouped into the sections: Purchase, Applied to downpayment, Of which grants, Stamp duty, and Cash to fork out.
- **REQ-CALC-10** — If the Remaining Lease is 20 years or less, then the system shall report the Cash Outlay as the full price plus stamp duty.
- **REQ-CALC-6** — If CPF Pool is less than the downpayment, then the system shall display the shortfall amount as a warning note.
- **REQ-CALC-7** — If cash for downpayment is 0 and a price has been entered, then the system shall state that CPF and grants cover the entire downpayment.
- **REQ-CALC-8** — If CPF remains after the purchase, then the system shall display the remaining amount and note its value as an instalment buffer.
- **REQ-CALC-9** — The system shall display a standing note listing the costs excluded from the calculation (§1.3).

### 3.9 PDF export

- **REQ-PDF-1** — The system shall provide an "Export PDF" control in the page header.
- **REQ-PDF-2** — When the control is activated, the system shall build a report from the current result and open the browser's print dialog, where "Save as PDF" produces the file.
- **REQ-PDF-3** — The system shall produce the report as selectable vector text, without any external library or network request.
- **REQ-PDF-4** — The report shall contain: a title and preparation date, the cash-outlay figure with its two components, the inputs, the financing position (lease, LTV cap, MSR and TDSR caps, loan granted, instalment, ratios), the grants including the proximity result, the banded stamp-duty breakdown, and the cash-outlay derivation.
- **REQ-PDF-5** — The report shall carry the same disclaimer and exclusions as the on-screen footer.
- **REQ-PDF-6** — While printing, the system shall hide the header, the form, the on-screen results and the map, and shall show only the report.
- **REQ-PDF-7** — The report shall be laid out for A4 and shall avoid breaking a table row or orphaning a heading across pages.
- **REQ-PDF-8** — When the user prints via the browser rather than the control, the system shall rebuild the report first so that it reflects the current inputs.

### 3.10 Visual design

- **REQ-VIS-1** — The system shall use the "Airy" visual direction: Bricolage Grotesque for display type over Plus Jakarta Sans for body, a soft off-white ground, pill and large-radius surfaces, and a single colour-filled hero block for the cash figure.
- **REQ-VIS-2** — The system shall display a capital-stack bar showing how the purchase price is paid, as proportional segments for the housing loan, CPF Ordinary Account, grants, and the buyer's cash.
- **REQ-VIS-3** — The capital-stack segments shall sum exactly to the purchase price, with the buyer's cash as the remainder.
- **REQ-VIS-4** — The system shall direct-label every capital-stack segment with its name, amount and percentage, so that identity is never conveyed by colour alone.
- **REQ-VIS-5** — The capital-stack palette shall pass validation for lightness band, chroma floor, colour-blind separation and contrast against the surface, in both light and dark themes, with the dark steps derived against the dark surface rather than inverted from the light ones.
- **REQ-VIS-6** — While a segment is zero, the system shall omit it from both the bar and the legend.
- **REQ-VIS-7** — The system shall display the lease as a used/remaining proportional bar alongside its explanatory text.
- **REQ-VIS-8** — All interactive controls shall present a touch target of at least 44 px.

### 3.11 Interaction and presentation

- **REQ-UI-1** — When any input changes, the system shall recalculate and re-render all outputs without a page reload and without an explicit submit action.
- **REQ-UI-2** — If the form is submitted, then the system shall suppress the default submission and navigation.
- **REQ-UI-3** — The system shall format every monetary value in SGD with thousands separators and no decimal places.
- **REQ-UI-9** — The system shall display every monetary *input* with thousands separators as the user types, e.g. `1000000` shown as `1,000,000`.
- **REQ-UI-10** — When reading a monetary input, the system shall strip all non-digit characters, so that both `1,000,000` and `1000000` parse to the same value.
- **REQ-UI-11** — When reformatting a monetary input during typing, the system shall keep the caret beside the same digit it preceded.
- **REQ-UI-12** — If a monetary input is left empty on blur, then the system shall set it to `0`.
- **REQ-UI-13** — The system shall apply monetary formatting only to money fields, leaving year, age, tenure, percentage and rate inputs unformatted.
- **REQ-UI-4** — While the viewport is at least 900 px wide, the system shall present the form and the results side by side with the results panel pinned while scrolling.
- **REQ-UI-5** — While the viewport is narrower than 900 px, the system shall stack the results panel below the form and shall not pin it.
- **REQ-UI-6** — The system shall render correctly at viewport widths down to 400 px without horizontal scrolling of the page body, and shall never require the viewer to zoom out to read the results.
- **REQ-UI-14** — The system shall keep a side gutter of at least 16 px at every viewport width.
- **REQ-UI-15** — Where a table's content cannot fit the viewport, the system shall scroll that table inside its own container rather than widening the page.
- **REQ-UI-16** — The system shall size every grid track and flex item so it may shrink below its content's intrinsic minimum, so that no descendant can widen the page.
- **REQ-UI-17** — The system shall never clip or hide horizontal overflow on the document or body, since that conceals content instead of fitting it and interferes with pinch-zoom.
- **REQ-UI-18** — The system shall place the PDF export control after the results and before the references.
- **REQ-UI-7** — Where the viewer's operating system requests a dark colour scheme, the system shall render a dark palette.
- **REQ-UI-8** — The system shall display a disclaimer stating that the figures are estimates, that rates and grants change, and that HDB, CPF Board and IRAS are the authoritative sources.

---

## 4. Non-Functional Requirements

- **REQ-NFR-1** — The system shall run as a static client-side web application requiring no backend server of its own.
- **REQ-NFR-2** — The system shall complete a recalculation within 50 ms of an input change on commodity hardware.
- **REQ-NFR-3** — The system shall transmit no user data to any third party other than the two postal codes sent to the OneMap geocoding API, and only when the user triggers the distance measurement.
- **REQ-NFR-7** — The system shall perform every calculation in the browser, with no server-side processing, no database and no account.
- **REQ-NFR-8** — The system shall state plainly on the page, and in the exported PDF, that no data is saved and that the figures never leave the device apart from the postal-code lookup.
- **REQ-NFR-4** — The system shall persist no user data between sessions.
- **REQ-NFR-5** — If any third-party resource (map tiles, geocoding, Leaflet) fails to load, then the system shall keep the full calculator functional apart from distance measurement.
- **REQ-NFR-6** — The system shall keep all regulatory constants — BSD tiers, the 4 km proximity threshold, the 5% bank-loan cash floor, the MSR and TDSR caps, the stress-rate floor, the lease thresholds and the grant presets — in named, single-source declarations so that a rate change is a one-line edit.

---

## 5. Constants Register

Values requiring review whenever policy changes.

| Constant | Value | Source | Location |
|---|---|---|---|
| BSD tiers | 1/2/3/4/5/6% | IRAS, effective 20 Feb 2023 | `app.js` → `BSD_TIERS` |
| HDB lease length | 99 years | HDB | `app.js` → `LEASE_TOTAL_YEARS` |
| CPF lease age cap | 95 | CPF Board / HDB | `app.js` → `CPF_LEASE_AGE_CAP` |
| Minimum lease to finance | 20 years | CPF Board / MAS | `app.js` → `MIN_LEASE_FINANCE` |
| Lease tail at loan maturity | 20 years | MAS | `app.js` → `LEASE_TAIL_YEARS` |
| MSR cap | 30% | MAS — HDB flats & new ECs | `app.js` → `MSR_CAP` |
| TDSR cap | 55% | MAS — all property loans | `app.js` → `TDSR_CAP` |
| Stress-test rate floor | 4.0% p.a. | MAS | `app.js` → `STRESS_RATE_FLOOR` |
| HDB concessionary rate | 2.6% p.a. | HDB — CPF OA rate + 0.1% | `app.js` → `HDB_CONCESSIONARY` |
| Age + tenure limit | 65 | MAS | `app.js` → `AGE_TENURE_LIMIT` |
| Max tenure | 25 yr HDB / 30 yr bank | HDB / MAS | `app.js` → `MAX_TENURE` |
| Full-LTV tenure limit | 25 years | MAS Notice 632 | `app.js` → `FULL_LTV_MAX_TENURE` |
| Reduced LTV | 55% | MAS Notice 632 | `app.js` → `REDUCED_LTV` |
| Default LTV | 75% | HDB / MAS | `index.html` → `#ltv` |
| Bank-loan cash floor | 5% of price | MAS | `app.js` → `BANK_CASH_FLOOR` |
| Proximity threshold | 4 km | HDB PHG | `app.js` → `measure` |
| Preset "own figures" | 25k / 10k / 10k | Product owner | `app.js` → `PRESETS.custom` |
| Preset "HDB 2026" | 80k / 50k / 20k | HDB published amounts | `app.js` → `PRESETS.official` |

---

## 6. Traceability

| Area | Requirements | Implementation |
|---|---|---|
| Buyer income & flat details | REQ-FLAT-1..7 | `index.html` §0–1, `app.js` → `readInputs` |
| Lease, tenure & LTV | REQ-LOAN-1..22 | `app.js` → `leaseProfile`, `compute`, `renderLeaseBox`, `renderTenureBox` |
| MSR & TDSR | REQ-MSR-1..19 | `index.html` §0 & §2, `app.js` → `monthlyPayment`, `principalFromPayment`, `compute`, `renderMsrBox`, `renderRatioCard` |
| CPF | REQ-CPF-1..7 | `app.js` → `compute`, `renderCpfCapBox` |
| Grants | REQ-GRANT-1..10 | `index.html` §4, `app.js` → `PRESETS`, `applyPreset`, `compute` |
| Proximity | REQ-PROX-1..18 | `index.html` §5, `app.js` → `geocode`, `haversineKm`, `measure`, `initMap` |
| Stamp duty | REQ-BSD-1..6 | `app.js` → `BSD_TIERS`, `buyerStampDuty`, `renderBsdTable` |
| Cash outlay | REQ-CALC-1..10 | `app.js` → `compute`, `renderBreakdown`, `renderNotes` |
| Visual design | REQ-VIS-1..8 | `styles.css` tokens; `app.js` → `renderCapitalStack`, `renderLeaseBox` |
| PDF export | REQ-PDF-1..8 | `index.html` header + `#printReport`, `app.js` → `buildPrintReport`, `exportPdf`; `styles.css` `@media print` |
| Interaction | REQ-UI-1..18 | `app.js` → `recalc`, `moneyValue`, `setMoney`, `formatMoneyField`, wiring; `styles.css` |

---

## 7. Verification

Baseline scenario **B**, unless a row states otherwise: 4-room, $650,000, TOP 1990, youngest
buyer 35, gross income $9,000/month, no other debt, HDB loan, 75% LTV, 25-year tenure,
4% stress rate, $80,000 CPF OA, $25,000 flat grant, no PHG, BSD in cash. Evaluated at 2026.

| ID | Check | Expected |
|---|---|---|
| V-1 | BSD on $1,000,000 | $24,600 |
| V-2 | BSD on $1,500,000 | $44,600 |
| V-3 | BSD on $650,000 | $14,100 |
| V-4 | Scenario B | Lease 63 yr, ratio 100%, loan $487,500 bound by requested LTV, instalment $2,573, MSR 28.6%, cash outlay $71,600 |
| V-5 | B with PHG qualifying at $10k | Cash outlay $61,600 |
| V-6 | B, room type 5-room | Flat-type grant falls to $10,000 |
| V-7 | B, bank loan | At least $32,500 (5% of price) remains cash regardless of CPF |
| V-8 | Postal codes 560123 and 560123 | Distance 0.00 km; grant eligible |
| V-9 | Postal code "12345" entered | Validation message; no API call |
| V-10 | B with price 0 | Cash outlay $0; no stamp-duty breakdown |
| V-11 | B with income $5,000 | MSR binds: loan $284,179, instalment $1,500, MSR exactly 30.0%, cash outlay $274,921 |
| V-12 | B with TOP 1977 (50 yr lease) | Ratio 83.3%, effective LTV 62.50%, loan $406,250, cash outlay $152,850 |
| V-13 | B with TOP 1970, age 40, bank loan | Tenure capped at 23 yr by remaining lease; ratio 78.18%; LTV stays 75% (bank, not pro-rated); CPF VL capped at $508,182 |
| V-14 | B with TOP 1930 (3 yr lease) | No loan, no CPF; cash outlay $664,100 = price + BSD |
| V-15 | B with bank loan, 30-yr tenure, age 30 | Tenure 30 > 25, so LTV cut to 55%; no lease pro-ration on a bank loan; loan $357,500 |
| V-16 | B with income 0 | MSR and TDSR not assessed; loan unchanged at $487,500 |
| V-17 | $900k, TOP 1987, age 31, **bank**, 25-yr tenure | Lease ratio 93.75%, but LTV stays **75%** → $675,000. 25-yr tenure leaves 35 yr of lease at maturity, clearing both the 20-yr MAS tail and a 30-yr house rule |
| V-22 | V-17 but **HDB loan** | LTV pro-rated to 70.3125% → $632,813. Same flat, same buyer, lower LTV |
| V-23 | V-17, CPF check | CPF Valuation Limit pro-rated to $843,750 on both loan types — the CPF rule is unaffected by lender |
| V-18 | V-22, computed cap fed back into the field three times | Effective LTV stays 70.3125% and the LTV cap stays $632,813 — no compounding |
| V-19 | V-17 with the target manually set to 60% | Effective LTV 60%; LTV cap $540,000 |
| V-20 | V-17 with the target manually set to 80% | Capped at 75%; the rules override the request |
| V-21 | Export PDF | Report renders with all seven sections; header, form and map hidden |
| V-24 | Load at 320, 375, 393 and 430 px | `document.scrollWidth` equals the viewport at every width; no element outside the viewport bar map tiles clipped by the map container |
| V-25 | Defaults, instalment at 2.6% vs 4% | S$1,289/month actually paid against S$1,500 assessed; total interest S$102,591 over 25 years |

All sixteen were executed against the implementation on 2026-09-19 and passed.

---

## 8. Open Questions

1. **Grant amounts.** The default preset uses the figures supplied by the product owner
   ($25k for 4-room, $10k for 5-room, $10k PHG). HDB's published 2026 amounts are materially
   higher ($80k / $50k CPF Housing Grant; $20k PHG for living near, $30k for living with).
   The second preset carries the published figures. **Which should be the default?**
2. **EHG.** Currently entered manually under "other grants". Should the system implement the
   full income-tier table (up to $120,000) instead?
3. **Resale levy.** Second-timers owe a resale levy that increases cash outlay. Add as an input?
4. **Option fee / deposit.** Out of scope today, though it changes the *timing* of cash outlay
   materially. Add a timeline view?
5. **ABSD.** Not modelled, on the assumption of first-property Singapore Citizen buyers.
   Should the system support PR and second-property buyers?
6. ~~**The lease rule in REQ-LOAN-11 as originally drafted.**~~ **RESOLVED in v1.2.**
   Two corrections were applied to the draft when implementing:

   - **The arithmetic.** A flat with TOP 1987 has used 39 years by 2026, not 49, leaving
     60 years — not 50. The example's figures describe a **1977** flat.
   - **The mechanism.** There is no fixed 30-year tail. Three rules operate, now all implemented:
     1. **Tenure** (REQ-LOAN-15) — the loan must finish with 20 years of lease left.
     2. **Bank LTV** (REQ-LOAN-17, REQ-LOAN-23) — 75%, dropping to 55% if the tenure exceeds
        25 years or ends after age 65. **Not** pro-rated by lease.
     3. **HDB-loan LTV and all CPF usage** (REQ-LOAN-11..13, REQ-CPF-5) — pro-rated by
        Remaining Lease ÷ Years-to-95 whenever the lease misses the youngest buyer's age 95.

   The product owner's position was adopted: a 60-year lease with a 25-year bank loan leaves
   35 years at maturity, clearing both the 20-year MAS tail and the owner's stricter 30-year
   rule, so the bank LTV stays at 75%. The pro-ration now bites only on HDB loans and on CPF.
   Consequence: on the same flat, a bank loan lends 75% where an HDB loan lends 70.31%.

7. **Average vs youngest age.** HDB sets loan tenure from the *average* age of buyers, while
   the age-95 pro-ration uses the *youngest*. The system uses one age input for both, which is
   conservative on pro-ration and optimistic on tenure for couples of differing ages. Split
   into two inputs?
