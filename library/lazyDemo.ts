import { lazy, type ComponentType } from "react";

/** A Demo that is code-split: its module (and its CSS/JS) loads only when rendered or preloaded. */
export type LazyDemo = ComponentType & { preload: () => Promise<unknown> };

export function lazyDemo(load: () => Promise<{ Demo: ComponentType }>): LazyDemo {
  const C = lazy(() => load().then((m) => ({ default: m.Demo })));
  return Object.assign(C, { preload: load }) as unknown as LazyDemo;
}
