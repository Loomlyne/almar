# Follow-ups item 7: destinations first, then the rule goes live

**Decided:** 2026-10-19 13:42 CET by the owner, in the controller session's question form. Option chosen: "I'll add destinations first".

## The question

Follow-ups item 7 (migration `20261019130000_ops_save_publish_rules.sql`, PR #22) makes a Save of a published
destination or catalog item keep what Publish requires: a hero photo, a photo, and at least one destination. Publish
(`ops_publish`) already requires all three. The controller's read-only count on live (2026-10-19, before landing) found:

| Live rows | Count |
|---|---|
| Published destinations | 5, all with a hero photo |
| Published catalog items | 45, all with a photo |
| Published catalog items with **no destination** | **24**: 19 experiences, 5 services |

The import published these 24 without going through `ops_publish`. With item 7 live, the next Save of any of them would
be refused ("One destination needed") until a destination is added.

## The decision

The owner gives the 24 items their destinations in the dashboard (Catalog -> the item -> Destinations) **before** item 7
is applied live. Item 7 lands unchanged.

**Landing gate (controller):** right before applying `20261019130000` live, re-run the read-only count. Apply only when
it reads 0 published catalog items without a destination, 0 without a photo and 0 published destinations without a hero
photo. If it is above 0, the code may still land on `main`, but the migration waits, and it is applied before the next almar-ops
deploy that carries item 7's client messages.

## The 24 items (English names on live)

Experiences: Amazon Rainforest Expedition; Artisan Workshop Experiences; Highland Trekking Experiences; Mountain
Adventure Excursions; Pastry & Dessert Masterclass; Private Museum Experiences; Private Picnic Experiences; Private
Surfing Lessons; Rural Farm & Nature Visits; Scuba Diving Expeditions; Snorkeling Adventures; Sunrise Yoga & Wellness
Retreats; Tayrona Coastal Escape; Traditional Cooking Classes; Truffle & Foraging Experiences; VIP Cultural Access; VIP
Dinner & Show Experiences; Wellness & Andean Retreat; Wine & Spirits Tastings.

Services: In-Villa Private Chef; Personal Security Detail; Pop-Up Bar Experiences; Pop-Up Cinema at Your Villa;
Wellness & Spa Coordination.
