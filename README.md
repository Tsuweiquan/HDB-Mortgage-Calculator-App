# HDB Cash Outlay Calculator

Works out the **cash a Singapore HDB flat buyer must fork out at completion**, after the
mortgage, CPF Ordinary Account savings, housing grants and Buyer's Stamp Duty.

No backend, no build step, no dependencies to install — three static files.

## What it models

| | |
|---|---|
| **Buyer's Stamp Duty** | The banded 1–6% IRAS rates effective 20 Feb 2023 |
| **LTV** | 75%, dropping to 55% on a bank loan when the tenure exceeds 25 years or ends after age 65 |
| **MSR / TDSR** | 30% and 55% of gross monthly income, assessed at the 4% p.a. stress rate, inverted to give the loan each cap supports |
| **Lease** | 99-year lease from TOP; the age-95 pro-ration on CPF (any loan) and on LTV (HDB loan only); the 20-year financing floor and the tenure tail |
| **Grants** | Flat-type grant by room type, plus a Proximity Housing Grant driven by a real distance measurement |
| **Proximity** | Postal codes geocoded through OneMap, great-circle distance, 4 km threshold, plotted on a map |
| **CPF** | Drawn only as needed, capped by the pro-rated Valuation Limit, with the 5% hard-cash floor on bank loans |

The loan granted is the **lowest** of the requested amount, the LTV cap, the MSR cap, the
TDSR cap and the price — and the interface names which one is binding, because that is
usually the thing the buyer can actually act on.

## Running it

Any static server will do:

```sh
python3 -m http.server 8777
```

Then open <http://127.0.0.1:8777>.

## Files

| File | |
|---|---|
| `index.html` | Markup and form |
| `app.js` | All calculation and rendering; regulatory constants are named and grouped at the top |
| `styles.css` | Design tokens and layout, light and dark |
| `SPEC.md` | Requirements specification in EARS notation — the authoritative description of behaviour |

This project is spec-driven: `SPEC.md` leads, the code follows. It carries a constants
register mapping every regulatory figure to its exact location in the code, so a rate
change is a traceable one-line edit, plus a verification table of worked examples.

## Accuracy

Estimates only, and the rules move. Confirm against
[HDB](https://www.hdb.gov.sg/), [CPF Board](https://www.cpf.gov.sg/),
[MAS](https://www.mas.gov.sg/) and [IRAS](https://www.iras.gov.sg/) before committing to
a purchase. Every figure the calculator uses is linked from the references section at the
foot of the app.

Not included: option fee and deposit, conveyancing and legal fees, HDB resale application
fees, valuation, agent commission, resale levy, cash-over-valuation and ABSD.

## Credits

Geocoding and map data © [OneMap](https://www.onemap.gov.sg/), Singapore Land Authority.
Map rendering by [Leaflet](https://leafletjs.com/).
