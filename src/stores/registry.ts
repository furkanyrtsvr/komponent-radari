import {PilpaketiAdapter} from './qukasoft';
import {PilsitesiAdapter} from './ticimax';
import {HobidevreAdapter} from './woocommerce';
import {EkomponentAdapter} from './ekomponent';
import { DirencAdapter } from "./direnc";
import { RobotistanAdapter } from "./robotistan";
import { Robo90Adapter } from "./robo90";
import { RobizAdapter } from "./robiz";
import { KomponentciAdapter } from "./komponentci";
import { RobotsepetiAdapter } from "./robotsepeti";
import { MotorobitAdapter } from "./motorobit";
import { RobolinkAdapter } from "./robolink";
import { SammAdapter } from "./samm";
import { OzdisanAdapter } from "./ozdisan";
import { IdeasoftAdapter } from "./ideasoft";
import { RobocomboAdapter } from "./robocombo";
import { RobotronikAdapter } from "./robotronik";
import { JsonLdAdapter } from "./base";
import type { StoreConfig, StoreAdapter } from "./types";
const registry: Record<string, new (s: StoreConfig) => StoreAdapter> = {
  direnc: DirencAdapter,
  robotistan: RobotistanAdapter,
  robo90: Robo90Adapter,
  robiz: RobizAdapter,
  komponentci: KomponentciAdapter,
  robotsepeti: RobotsepetiAdapter,
  motorobit: MotorobitAdapter,
  robolink: RobolinkAdapter,
  samm: SammAdapter,
  ozdisan: OzdisanAdapter,
  robotzade: IdeasoftAdapter,
  robitshop: IdeasoftAdapter,
  robocombo: RobocomboAdapter,
  robotronik: RobotronikAdapter,
  pilpaketi: PilpaketiAdapter,
  pilsitesi: PilsitesiAdapter,
  ekomponent: EkomponentAdapter,
  ulutas: IdeasoftAdapter,
  hobidevre: HobidevreAdapter,
  f1depo: IdeasoftAdapter,
};
export function adapterFor(store: StoreConfig): StoreAdapter {
  return new (registry[store.id] || JsonLdAdapter)(store);
}
