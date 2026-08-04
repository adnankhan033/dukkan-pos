const LOG_PREFIX = "[ZATCA]";

export const zatcaLogger = {
  info(message, meta) {
    console.info(LOG_PREFIX, message, meta ?? "");
  },
  warn(message, meta) {
    console.warn(LOG_PREFIX, message, meta ?? "");
  },
  error(message, meta) {
    console.error(LOG_PREFIX, message, meta ?? "");
  },
  debug(message, meta) {
    if (import.meta.env?.DEV) {
      console.debug(LOG_PREFIX, message, meta ?? "");
    }
  },
};
