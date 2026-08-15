const DEFAULT_TITLES = {
  success: "Success",
  error: "Error",
  info: "Info",
  warning: "Warning",
};

let notifyApi = null;

export function bindNotifyApi(api) {
  notifyApi = api;
}

function fallbackNotify(type, message, options = {}) {
  const title = options.title || DEFAULT_TITLES[type] || "Notice";
  console[type === "error" ? "error" : "log"](`[${title}] ${message}`);
}

function call(type, message, options = {}) {
  if (notifyApi) {
    return notifyApi[type](message, options);
  }
  fallbackNotify(type, message, options);
  return null;
}

/** Global notification API — use anywhere after ToastProvider mounts. */
export const notify = {
  success(message, options) {
    return call("success", message, options);
  },
  error(message, options) {
    return call("error", message, options);
  },
  info(message, options) {
    return call("info", message, options);
  },
  warning(message, options) {
    return call("warning", message, options);
  },
  dismiss(id) {
    notifyApi?.dismiss?.(id);
  },
};
