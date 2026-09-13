import { Redirect } from "expo-router";

// A universal link lands here: https://fither.pro/s/<scenario> opens the
// app when it is installed (associatedDomains in app.json; the site's
// association file names this path). The scenario is counted by the
// root deep-link tracker (analytics/deep-link.ts) from the URL itself;
// this route only has to exist so the router never shows a dead page,
// and it sends her to the launch surface, which routes by her state.
export default function ScenarioLinkRoute() {
  return <Redirect href="/" />;
}
