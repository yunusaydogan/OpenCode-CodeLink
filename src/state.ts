import type { Reference } from "./references.ts";
export type ViewState = {
  tabs: string[];
  active: string;
  refs: Reference[];
  basket: string[];
};
export const initialState = (): ViewState => ({
  tabs: [],
  active: "",
  refs: [],
  basket: [],
});
export type StatePort = {
  readonly value: ViewState | undefined;
  set(value: ViewState): void;
};
