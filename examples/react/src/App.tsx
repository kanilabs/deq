import type React from "react";
import { DeqIcon, KurdishSun, RojHalfSun } from "@0xdolan/deq-react";

export function App(): React.JSX.Element {
  return (
    <main>
      <h1>Deq + React</h1>
      <RojHalfSun />
      <KurdishSun size={48} color="#ED2024" strokeWidth={1.5} />
      <DeqIcon name="roj-half-sun" size="3em" title="" />
    </main>
  );
}
