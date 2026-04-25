/**
 * Unit tests for src/lib/firestore-rest.ts
 * Tests the Firestore REST API wrapper used by generateMetadata() for SEO.
 */

import { getDocument, queryCollection } from '@/lib/firestore-rest';

// ─── helpers ──────────────────────────────────────────────────────────────────

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok,
    status,
    json: jest.fn().mockResolvedValueOnce(body),
    text: jest.fn().mockResolvedValueOnce(JSON.stringify(body)),
  }) as any;
}

function mockFetchReject(error: Error) {
  global.fetch = jest.fn().mockRejectedValueOnce(error) as any;
}

// ─── getDocument ──────────────────────────────────────────────────────────────

describe('getDocument', () => {
  beforeEach(() => jest.resetAllMocks());

  test('returns parsed document fields on success', async () => {
    mockFetchOnce({
      fields: {
        name: { stringValue: 'Camping Co' },
        rating: { doubleValue: 4.5 },
        stock: { integerValue: '10' },
        active: { booleanValue: true },
      },
    });

    const result = await getDocument('vendors/abc123');

    expect(result).toEqual({ name: 'Camping Co', rating: 4.5, stock: 10, active: true });
  });

  test('returns null when document has no fields key', async () => {
    mockFetchOnce({});
    expect(await getDocument('vendors/missing')).toBeNull();
  });

  test('returns null on non-OK HTTP response', async () => {
    mockFetchOnce({}, false, 404);
    expect(await getDocument('vendors/notfound')).toBeNull();
  });

  test('returns null when fetch throws a network error', async () => {
    mockFetchReject(new Error('network timeout'));
    expect(await getDocument('vendors/any')).toBeNull();
  });

  test('handles nullValue field', async () => {
    mockFetchOnce({ fields: { code: { nullValue: null } } });
    expect(await getDocument('vendors/v1')).toEqual({ code: null });
  });

  test('handles arrayValue field (including nested maps)', async () => {
    mockFetchOnce({
      fields: {
        tags: {
          arrayValue: {
            values: [
              { stringValue: 'camping' },
              { mapValue: { fields: { key: { stringValue: 'val' } } } },
            ],
          },
        },
      },
    });
    const result = await getDocument('vendors/v1') as any;
    expect(result.tags).toEqual(['camping', { key: 'val' }]);
  });

  test('handles empty arrayValue', async () => {
    mockFetchOnce({ fields: { items: { arrayValue: {} } } });
    const result = await getDocument('vendors/v1') as any;
    expect(result.items).toEqual([]);
  });

  test('handles nested mapValue field', async () => {
    mockFetchOnce({
      fields: {
        address: {
          mapValue: {
            fields: {
              city: { stringValue: 'Kuantan' },
              postcode: { integerValue: '25300' },
            },
          },
        },
      },
    });
    const result = await getDocument('vendors/v1') as any;
    expect(result.address).toEqual({ city: 'Kuantan', postcode: 25300 });
  });
});

// ─── queryCollection ──────────────────────────────────────────────────────────

describe('queryCollection', () => {
  beforeEach(() => jest.resetAllMocks());

  test('returns id and parsed data on a matching document', async () => {
    mockFetchOnce([
      {
        document: {
          name: 'projects/proj/databases/(default)/documents/vendors/slug123',
          fields: {
            slug: { stringValue: 'my-shop' },
            city: { stringValue: 'KL' },
          },
        },
      },
    ]);

    const result = await queryCollection('vendors', 'slug', 'my-shop');

    expect(result).toEqual({ id: 'slug123', data: { slug: 'my-shop', city: 'KL' } });
  });

  test('returns null when result array is empty', async () => {
    mockFetchOnce([{}]);
    expect(await queryCollection('vendors', 'slug', 'ghost')).toBeNull();
  });

  test('returns null when fetch returns non-OK status', async () => {
    mockFetchOnce({}, false, 400);
    expect(await queryCollection('vendors', 'slug', 'test')).toBeNull();
  });

  test('returns null when fetch throws', async () => {
    mockFetchReject(new Error('offline'));
    expect(await queryCollection('vendors', 'slug', 'test')).toBeNull();
  });

  test('returns null when response is not an array', async () => {
    mockFetchOnce({ error: 'bad request' });
    expect(await queryCollection('vendors', 'slug', 'test')).toBeNull();
  });

  test('extracts the last path segment as the document id', async () => {
    mockFetchOnce([
      {
        document: {
          name: 'projects/p/databases/(default)/documents/collection/docId999',
          fields: { x: { stringValue: 'y' } },
        },
      },
    ]);

    const result = await queryCollection('collection', 'x', 'y');
    expect(result?.id).toBe('docId999');
  });

  test('sends a structured query POST body with the correct field filter', async () => {
    mockFetchOnce([
      {
        document: {
          name: 'projects/p/databases/(default)/documents/vendors/abc',
          fields: { slug: { stringValue: 'test-slug' } },
        },
      },
    ]);

    await queryCollection('vendors', 'slug', 'test-slug');

    const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);
    expect(body.structuredQuery.where.fieldFilter.field.fieldPath).toBe('slug');
    expect(body.structuredQuery.where.fieldFilter.value.stringValue).toBe('test-slug');
    expect(body.structuredQuery.from[0].collectionId).toBe('vendors');
  });
});
