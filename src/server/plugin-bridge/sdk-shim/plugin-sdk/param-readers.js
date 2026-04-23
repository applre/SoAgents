/** Shim for openclaw/plugin-sdk/param-readers */

function readParamRaw(params, key) {
  if (Object.hasOwn(params, key)) return params[key];
  const snake = key.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
  if (snake !== key && Object.hasOwn(params, snake)) return params[snake];
  return undefined;
}

function readNumberParam(params, key, options) {
  const { required = false, label = key, integer = false, strict = false } = options ?? {};
  const raw = readParamRaw(params, key);
  let value;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    value = raw;
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed) {
      const parsed = strict ? Number(trimmed) : Number.parseFloat(trimmed);
      if (Number.isFinite(parsed)) value = parsed;
    }
  }
  if (value === undefined) {
    if (required) throw new Error(`${label} required`);
    return undefined;
  }
  return integer ? Math.trunc(value) : value;
}

function readStringArrayParam(params, key, options) {
  const { required = false, label = key } = options ?? {};
  const raw = readParamRaw(params, key);
  if (Array.isArray(raw)) {
    const values = raw
      .filter((e) => typeof e === 'string')
      .map((e) => e.trim())
      .filter(Boolean);
    if (values.length === 0) {
      if (required) throw new Error(`${label} required`);
      return undefined;
    }
    return values;
  }
  if (typeof raw === 'string') {
    const value = raw.trim();
    if (!value) {
      if (required) throw new Error(`${label} required`);
      return undefined;
    }
    return [value];
  }
  if (required) throw new Error(`${label} required`);
  return undefined;
}

function readStringOrNumberParam(params, key, options) {
  const { required = false, label = key } = options ?? {};
  const raw = readParamRaw(params, key);
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  if (typeof raw === 'string') {
    const value = raw.trim();
    if (value) return value;
  }
  if (required) throw new Error(`${label} required`);
  return undefined;
}

function readStringParam(params, key, options) {
  const { required = false, trim = true, label = key, allowEmpty = false } = options ?? {};
  const raw = readParamRaw(params, key);
  if (typeof raw !== 'string') {
    if (required) throw new Error(`${label} required`);
    return undefined;
  }
  const value = trim ? raw.trim() : raw;
  if (!value && !allowEmpty) {
    if (required) throw new Error(`${label} required`);
    return undefined;
  }
  return value;
}

module.exports = {
  readNumberParam,
  readStringArrayParam,
  readStringOrNumberParam,
  readStringParam,
};
