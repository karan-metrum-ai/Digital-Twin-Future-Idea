# ServerRackTwin (React + TS)

Single-file component ported from the HTML prototype.

## Install
```
npm i three @types/three
```

## Use
```tsx
import ServerRackTwin, { Playground } from './ServerRackTwin';
<ServerRackTwin view="thermal" temps={[0.4, 0.9, ...]} showCovers showAirflow />
```
`temps` is one 0..1 value per server slot, bottom → top (20 slots). `Playground` is a ready demo shell.

## Files
- ServerRackTwin.tsx — model (rack-model), airflow sim (heat-sim), thermal shader (thermal-view), component + Playground.
- The original module files are kept alongside as reference.
