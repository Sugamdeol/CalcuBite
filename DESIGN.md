# CalcuBite design decisions

The app is an everyday nutrition workspace for people looking up packaged foods and estimating home-cooked meals. The primary sequence is food entry → inspect the basis and uncertainty → adjust the amount eaten → log a meal → review the day.

Ascent remains the visual direction: warm paper, lime navigation, lavender selections, magenta actions, dark crisp borders and strong type. Energy 3/5, rhythm 2/5, motion 1/5. The repeated app controls stay predictable; large promotional blocks no longer consume the mobile workspace. A persistent bottom navigation and 44 px controls keep the five core tools reachable.

Anti-slop review prioritized working controls, explicit empty/loading/error states, labeled macros, no invented nutrition data, source attribution and keyboard dialogs. Charts show reported grams and calculated macro energy proportions; incomplete information is not replaced with random scores or default percentages.

Taste applies to the public landing page, consistent with its stated exclusion of dashboards and multi-step products. Landing intent: variance 6, motion 3, density 4. The warm editorial headline remains; the copy now explains the concrete lookup and diary workflow and limits offline claims to saved diary access. Existing launch links remain intact. The labeled example is illustrative rather than a live user diary.

Reduced-motion CSS is honored. Native forms, buttons and the existing vanilla JavaScript stack remain. No new UI framework or build dependency was introduced.

The modern app refinement uses Taste's contextual redesign principles while respecting its dashboard exclusion. App intent: variance 5, motion 2, density 4. Softer borders and smaller corners give the existing Ascent palette more breathing room. The result hierarchy is source and basis → overview → prominent energy value and labeled macros → detailed charts. The weekly report starts with logging coverage and logged-day averages, then a short review and three next steps. Missing days stay missing; partial logs cannot establish actual daily intake. No decorative imagery competes with the nutrition data.
