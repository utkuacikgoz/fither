# ADR-0029: Responsive controls and an always-visible offer action

- Status: accepted
- Date: 2026-09-13

## Decision

Primary buttons, answer rows and offer plans share native-driver press
feedback. Press-in takes 90 ms and release takes 180 ms with ease-out,
no bounce and a restrained 0.98 scale. Screen entrances retain the existing
300 ms envelope. These shorter control timings answer the design system's
under-100-ms feedback requirement. Actions never wait for motion.

Screens pass their live reduced-motion preference to controls. When reduced,
controls retain immediate colour feedback with no movement. A preference
change or disabled state stops any running press animation.

The paywall scrolls the promise, real capability ladder, plans and legal
details above a fixed purchase footer. The footer states the selected
offering's actual localised price and cancellation terms. Plan selection
updates that disclosure. Expired access uses its existing paid-access copy.
Plan names and prices stack vertically for unrestricted text scaling.

Pending checkout and restore have explicit status copy. The purchase action,
plan choices, restore and optional exit cannot submit another operation
while the current operation is pending. Cancellation restores the ordinary
controls without an error. Purchase failures appear beside the purchase action.

## Validation and limits

Component coverage checks immediate actions during motion, live reduced-motion
changes, busy accessibility state, duplicate prevention, selected-price updates
and cancellation. Native simulator screenshots verify the entry and offer
layouts. This improves presentation and feedback; it is not evidence of a
conversion lift or commissioned movement-demonstration quality.
