/**
 * Server-side Firestore REST API utility
 * Used by generateMetadata() for dynamic SEO (runs on server, no client SDK needed)
 */

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields: Record<string, FirestoreValue> } }
  | { nullValue: null };

function extractValue(val: FirestoreValue): unknown {
  if ("stringValue" in val) return val.stringValue;
  if ("integerValue" in val) return Number(val.integerValue);
  if ("doubleValue" in val) return val.doubleValue;
  if ("booleanValue" in val) return val.booleanValue;
  if ("nullValue" in val) return null;
  if ("arrayValue" in val)
    return val.arrayValue.values?.map(extractValue) ?? [];
  if ("mapValue" in val) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val.mapValue.fields)) {
      obj[k] = extractValue(v);
    }
    return obj;
  }
  return null;
}

function parseDoc(fields: Record<string, FirestoreValue>): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields)) {
    obj[k] = extractValue(v);
  }
  return obj;
}

/** Get a single document by path, e.g. "vendors/abc123" */
export async function getDocument(path: string) {
  try {
    const res = await fetch(`${BASE}/${path}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.fields) return null;
    return parseDoc(data.fields);
  } catch {
    return null;
  }
}

/** Query a collection for a field == value, return first match { id, data } */
export async function queryCollection(
  collectionPath: string,
  field: string,
  value: string,
) {
  try {
    const res = await fetch(`${BASE}:runQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: collectionPath }],
          where: {
            fieldFilter: {
              field: { fieldPath: field },
              op: "EQUAL",
              value: { stringValue: value },
            },
          },
          limit: 1,
        },
      }),
      next: { revalidate: 60 },
    });

    if (!res.ok) return null;
    const results = await res.json();

    if (!Array.isArray(results) || !results[0]?.document) return null;

    const doc = results[0].document;
    const id = doc.name.split("/").pop()!;
    return { id, data: parseDoc(doc.fields) };
  } catch {
    return null;
  }
}