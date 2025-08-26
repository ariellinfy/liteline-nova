const enabled = import.meta.env.DEV;

export const makeLogger = (ns: string) => ({
  log: enabled ? console.log.bind(console, `[${ns}]`) : () => {},
  warn: enabled ? console.warn.bind(console, `[${ns}]`) : () => {},
  error: enabled ? console.error.bind(console, `[${ns}]`) : () => {},
  debug: enabled ? console.debug.bind(console, `[${ns}]`) : () => {},
});
