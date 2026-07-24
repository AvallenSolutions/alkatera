# Carbon intensity benchmarks: questions for Anne Jones

From: Tim Etherington-Judge, alka**tera**
Date: 24 July 2026

## What we are asking you to look at

alka**tera** scores a drinks producer's climate performance partly on **carbon
intensity**: their measured per-unit emissions divided by an industry benchmark
for their category. That ratio drives a 0-100 sub-score which is 60% of their
climate score, which in turn feeds the headline "vitality" score they see, share
internally, and may eventually put in front of customers or retailers.

Reviewing it this week we found two problems we cannot resolve ourselves. Both
are about **system boundary**, and if either is real then every intensity score
in the product is wrong by an unknown margin.

We would rather find this out from you now than from a customer's auditor later.

---

## Question 1: are our benchmark figures actually lifecycle?

Our benchmark table asserts, in its header:

> "These benchmarks represent lifecycle emissions including raw materials,
> production, packaging, and distribution."

But the sources are a mix, and at least two of them look to us like they might
be **operational** studies (facility-level scope 1 and 2 per hectolitre) rather
than lifecycle:

| Category | kg CO2e / litre | Cited source | Year |
|---|---|---|---|
| Spirits | 3.0 | BIER / Institute of Brewing & Distilling | 2023 |
| Beer & Cider | 0.85 | BIER 2023 Benchmarking Study | 2023 |
| Wine | 1.6 | ScienceDirect, wine carbon footprint review | 2022 |
| Ready-to-Drink | 0.55 | BIER Carbonated Soft Drinks study (used as an RTD proxy) | 2023 |
| Non-Alcoholic | 0.35 | BIER Carbonated Soft Drinks / Bottled Water | 2023 |
| Whisky / Bourbon / Rye | 3.8 | MDPI, Scottish malt whisky GHG study | 2018 |
| Sparkling Wine | 2.0 | Nature, eco-innovation and wine carbon footprint | 2024 |
| Still / Sparkling Water | 0.15 / 0.20 | IBWA environmental footprint study | 2021 |

Our specific worry is the **BIER 2023 Benchmarking Study**, which we understand
to be a water / energy / GHG benchmarking exercise across member facilities —
i.e. operational, not cradle-to-anything. If that is what it is, then for Beer &
Cider, RTD and Non-Alcoholic we are dividing a full lifecycle numerator by an
operational denominator, and every one of those customers looks far worse than
they are.

**What we would like to know:**

1. For each row above, what boundary is that figure actually on? Cradle-to-gate,
   cradle-to-distribution, cradle-to-grave, or operational scope 1+2 only?
2. Where the boundary is wrong for our purpose, is there a better published
   figure you would point us at, or should we mark that category "no benchmark"
   and show nothing rather than something misleading?
3. Is **Beer & Cider at 0.85 kg CO2e/litre** credible as a lifecycle figure? Our
   own reasoning says the glass in a 330ml bottle is roughly 0.16-0.20 kg CO2e,
   which is already 0.5-0.6 kg/litre before any liquid, brewing, distribution or
   end-of-life. That suggests 0.85 describes canned and kegged industrial volume
   and will badly misrepresent a glass-packing craft brewer. Are we right?
4. Is using a **carbonated soft drinks study as an RTD proxy** defensible, given
   an alcoholic RTD carries spirit in it?

---

## Question 2: the numerator and the denominator are on different boundaries (we think this is the bigger one)

This one is ours, not a question about your sources, but it needs your judgement.

The **numerator** is the customer's own measured per-unit figure from their LCA
in our platform. Its boundary **varies by product**, because we let them choose:
cradle-to-gate, cradle-to-shelf (adds distribution), cradle-to-consumer (adds the
use phase), cradle-to-grave (adds end-of-life).

The **denominator** is a single fixed number per category.

We have checked the code: **nothing anywhere adjusts for this.** A cradle-to-gate
product and a cradle-to-grave product are compared against the same benchmark.

Two consequences, and we would like your view on how serious each is:

- **Within one customer's portfolio**, two products can be scored on different
  bases, so their relative intensity ranking may be an artefact of which
  lifecycle stages each LCA happens to include.
- **Worse: the deeper lifecycle stages are tier-gated in our pricing.**
  Distribution unlocks on our mid tier; use phase and end-of-life on our top
  tier. So a customer who upgrades and switches on end-of-life adds emissions to
  their numerator against an unchanged denominator, and **their intensity score
  gets worse for doing more thorough work.** That is obviously the wrong
  incentive and we intend to fix it regardless, but we would value your steer on
  the right fix.

**What we would like to know:**

5. Is the only defensible approach to **normalise both sides to one boundary** —
   and if so which? Our instinct is cradle-to-gate, on the grounds that it is
   the only stage set every customer has, but that discards packaging
   end-of-life, which for drinks is material.
6. Alternatively, should we hold **a benchmark per boundary** (a cradle-to-gate
   figure and a cradle-to-grave figure per category) and pick the one matching
   the product? Is there published data at that granularity, or are we inventing
   a level of precision the literature does not support?
7. If neither is practical, is it more honest to **stop scoring intensity
   numerically** and instead present the customer's figure beside a clearly
   labelled reference range, with no 0-100 derived from it?

---

## Question 3: the denominator unit

We currently score **per unit** (per bottle or can), by scaling the per-litre
benchmark by the product's declared unit size.

We have been advised internally that **per litre** is the sector norm and that
per unit is dangerous, because it is blind to pack format: shifting from 700ml
glass to 200ml cans improves per-unit intensity dramatically while per-litre
intensity might worsen.

8. Do you agree per litre of packaged product is the right basis for a drinks
   intensity comparison?
9. Is there a case for **per litre of pure alcohol** as a secondary metric? We
   are inclined against it as a headline, because a growing number of our
   customers are non-alcoholic and it divides by zero for them.
10. ESRS E1-6 requires an intensity per net revenue. Would you present that
    alongside, or is it too easily distorted by pricing and premiumisation to
    show next to a physical intensity?

---

## Question 4: precision

Each benchmark is a single point estimate, and our scoring curve moves 15 points
between a ratio of 1.00 and 1.15. "Wine, 1.6 kg/litre" spans bulk-shipped
bag-in-box through to heavy sparkling bottles.

11. Should each benchmark carry an **uncertainty range**, with the score flat
    across that range so that "indistinguishable from typical" reads the same
    everywhere inside it? If so, what range would you put on each category?
12. Is a **category-level** benchmark the right granularity at all, given
    packaging is usually the largest single lever in drinks? We already model
    packaging parametrically, so we could construct a format-aware benchmark
    (category liquid reference, plus a modelled pack reference for the declared
    format at a reference weight). Is that sound, or over-engineering?

---

## Context you may want

- Our customers are small and mid-size drinks producers: gin and rum distillers,
  craft brewers, English wine, and a growing number of non-alcoholic brands.
- The score is currently an internal management tool. We have **not** put it on
  packaging or in consumer-facing marketing, and we are aware that doing so may
  engage the EU's new rules on sustainability labels from September 2026.
- We would rather show "we cannot benchmark this yet" than show a number we
  cannot defend. If your answer to several of these is "you do not have the data
  to do this", that is a useful answer and we will act on it.

## Where this sits in the code, if useful

`lib/industry-benchmarks.ts` holds the table; `lib/vitality/environmental.ts`
holds the scoring curves; `app/api/vitality/composite/route.ts` assembles the
inputs. Happy to share any of it.
