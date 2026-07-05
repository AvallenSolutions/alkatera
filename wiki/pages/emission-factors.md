---
title: Emission Factors
slug: emission-factors
type: concept
tags: [carbon-accounting, data, methodology]
summary: The published conversion numbers that turn things you can count, like litres of diesel or tonnes of glass, into greenhouse gas emissions.
sources:
  - title: UK Government greenhouse gas conversion factors for company reporting
    url: https://www.gov.uk/government/collections/government-conversion-factors-for-company-reporting
  - title: ecoinvent database
    url: https://ecoinvent.org/
  - title: Agribalyse (ADEME)
    url: https://agribalyse.ademe.fr/
last_reviewed: 2026-07-05
status: published
---

**In short:** An emission factor is a published conversion number that turns something you can count into greenhouse gas emissions. Litres of diesel times the diesel factor equals kg CO2e. Every carbon calculation, from a company [[carbon-footprint]] to a [[product-carbon-footprint]], is built from them.

## How they work

You cannot meter the CO2 leaving a van's exhaust, but you know how many litres of diesel it used. Scientists have measured what burning a litre of diesel emits, across all gases, converted into the common unit explained at [[greenhouse-gases-and-co2e]]. Multiply your activity data by that factor and you have your emissions. The same logic applies to a kWh of electricity, a tonne of glass, a kilometre of road freight or a night in a hotel.

## The main databases

- **UK Government conversion factors**: published free every June by the Department for Energy Security and Net Zero (DESNZ), and still widely called "the Defra factors" after the department that originally published them. They cover fuels, electricity, transport, waste and more, and are the default for UK company reporting including [[secr|SECR]]. The electricity factor changes every year as the grid decarbonises, so always use the edition matching your reporting year.
- **ecoinvent**: a large licensed international database of life-cycle data covering thousands of materials and processes worldwide. The workhorse behind most [[life-cycle-assessment]] software, and where factors for things like glass, aluminium and cardboard usually come from.
- **Agribalyse**: a free French government (ADEME) database focused on agriculture and food, with detailed data for crops and food products. Especially useful for ingredients, from barley and grapes to cream and botanicals.

Other sources include national inventories, sector bodies and supplier-published data.

## Choosing the right factor

Three questions decide whether a factor fits:

1. **Geography**: electricity in France is far lower-carbon than in Poland; barley grown in the UK differs from barley grown in Australia.
2. **Time**: use the factor year that matches your data year, especially for electricity.
3. **What it represents**: check the units and what the factor includes. A "glass" factor may or may not include forming the bottle.

For purchased electricity, there is a further wrinkle: grid-average factors versus contract-based figures, explained at [[market-based-vs-location-based]].

## What this means for drinks businesses

- You will rarely pick factors by hand; carbon platforms embed these databases. Your job is supplying accurate quantities, weights and distances.
- Remember every factor is an average. A supplier's own measured figure for your specific bottle or malt beats any database value; that is the case for [[primary-vs-secondary-data|primary data]].
- When your footprint moves year on year, check whether emissions changed or the factors did. Both are legitimate, but say which.
- Big levers show up through factors: virgin glass versus [[recycled-content|recycled]], road versus rail, and the falling UK electricity factor all flow straight into your numbers. See [[drinks-carbon-hotspots]].
