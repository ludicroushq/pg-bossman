// Typed events registry for bossman

export type EventsDef<T extends Record<string, unknown>> = {
  // marker for TS only
  __events?: T;
};

export function defineEvents<
  T extends Record<string, unknown>,
>(): EventsDef<T> {
  return {} as EventsDef<T>;
}

export type EventKeys<T extends EventsDef<Record<string, unknown>>> =
  keyof NonNullable<T["__events"]> & string;
export type EventPayloads<T extends EventsDef<Record<string, unknown>>> =
  NonNullable<T["__events"]>;
export type EventPayload<
  TEvents extends EventsDef<Record<string, unknown>>,
  E extends EventKeys<TEvents>,
> = EventPayloads<TEvents>[E];

export function eventQueueName(event: string): string {
  return `__bossman_event__${event}`;
}
