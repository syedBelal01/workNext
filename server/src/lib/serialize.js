function isObjectId(value) {
  return Boolean(
    value &&
      (value._bsontype === "ObjectId" ||
        value.constructor?.name === "ObjectId")
  );
}

function serialize(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(serialize);
  if (value instanceof Date) return value;
  if (isObjectId(value)) return String(value);
  if (typeof value !== "object") return value;

  const raw = typeof value.toObject === "function"
    ? value.toObject({ virtuals: true })
    : value;

  const out = {};
  for (const [key, nested] of Object.entries(raw)) {
    if (key === "__v") continue;
    if (key === "_id") {
      out.id = String(nested);
      continue;
    }
    out[key] = serialize(nested);
  }
  return out;
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function contains(field, search) {
  return { [field]: { $regex: escapeRegex(search), $options: "i" } };
}

module.exports = { serialize, escapeRegex, contains, isObjectId };
