import { ReplitConnectors } from '@replit/connectors-sdk';

type RevenueCatList<T> = {
  items: T[];
};

type RevenueCatProduct = {
  id: string;
  app_id: string;
  store_identifier: string;
};

type RevenueCatPackage = {
  id: string;
  lookup_key: string;
};

type RevenueCatOffering = {
  id: string;
  is_current: boolean;
};

type RevenueCatEntitlement = {
  id: string;
  lookup_key: string;
};

type TestStorePrice = {
  amount_micros: number;
  currency: string;
};

const connectors = new ReplitConnectors();

async function revenueCatRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await connectors.proxy('revenuecat', path, {
    ...init,
    headers: { 'Content-Type': 'application/json' },
  });

  const body = await response.json();
  if (!response.ok) {
    throw new Error(
      `RevenueCat ${init?.method ?? 'GET'} ${path} failed (${response.status}): ${JSON.stringify(body)}`,
    );
  }

  return body as T;
}

async function main() {
  const projectId = process.env.REVENUECAT_PROJECT_ID;
  const testStoreAppId = process.env.REVENUECAT_TEST_STORE_APP_ID;
  if (!projectId || !testStoreAppId) {
    throw new Error('RevenueCat project and Test Store app IDs must be configured.');
  }

  const [products, offerings, entitlements] = await Promise.all([
    revenueCatRequest<RevenueCatList<RevenueCatProduct>>(
      `/v2/projects/${projectId}/products?limit=100`,
    ),
    revenueCatRequest<RevenueCatList<RevenueCatOffering>>(
      `/v2/projects/${projectId}/offerings?limit=100`,
    ),
    revenueCatRequest<RevenueCatList<RevenueCatEntitlement>>(
      `/v2/projects/${projectId}/entitlements?limit=100`,
    ),
  ]);

  const currentOffering = offerings.items.find((offering) => offering.is_current);
  const proEntitlement = entitlements.items.find((entitlement) => entitlement.lookup_key === 'pro');
  const monthlyProduct = products.items.find(
    (product) =>
      product.app_id === testStoreAppId && product.store_identifier === 'pro_monthly',
  );
  if (!currentOffering || !proEntitlement || !monthlyProduct) {
    throw new Error('The current offering, Pro entitlement, and monthly Test Store product are required.');
  }

  let annualProduct = products.items.find(
    (product) => product.app_id === testStoreAppId && product.store_identifier === 'pro_annual',
  );
  if (!annualProduct) {
    annualProduct = await revenueCatRequest<RevenueCatProduct>(
      `/v2/projects/${projectId}/products`,
      {
        method: 'POST',
        body: JSON.stringify({
          app_id: testStoreAppId,
          store_identifier: 'pro_annual',
          type: 'subscription',
          display_name: 'MyLifelens Pro Annual',
          title: 'MyLifelens Pro Annual',
          subscription: { duration: 'P1Y' },
        }),
      },
    );
  }

  const monthlyPrices = await revenueCatRequest<TestStorePrice[]>(
    `/v2/projects/${projectId}/products/${monthlyProduct.id}/test_store_prices`,
  );
  const annualPrices = monthlyPrices.map((price) => ({
    amount_micros: price.amount_micros * 10,
    currency: price.currency,
  }));

  const existingAnnualPrices = await revenueCatRequest<TestStorePrice[]>(
    `/v2/projects/${projectId}/products/${annualProduct.id}/test_store_prices`,
  );
  if (existingAnnualPrices.length === 0) {
    await revenueCatRequest(
      `/v2/projects/${projectId}/products/${annualProduct.id}/test_store_prices`,
      {
        method: 'POST',
        body: JSON.stringify({ prices: annualPrices }),
      },
    );
  }

  const packages = await revenueCatRequest<RevenueCatList<RevenueCatPackage>>(
    `/v2/projects/${projectId}/offerings/${currentOffering.id}/packages?limit=100`,
  );
  let annualPackage = packages.items.find((item) => item.lookup_key === '$rc_annual');
  if (!annualPackage) {
    annualPackage = await revenueCatRequest<RevenueCatPackage>(
      `/v2/projects/${projectId}/offerings/${currentOffering.id}/packages`,
      {
        method: 'POST',
        body: JSON.stringify({
          lookup_key: '$rc_annual',
          display_name: 'Annual Pro',
          position: 1,
        }),
      },
    );
  }

  const entitlementProducts = await revenueCatRequest<RevenueCatList<RevenueCatProduct>>(
    `/v2/projects/${projectId}/entitlements/${proEntitlement.id}/products?limit=100`,
  );
  if (!entitlementProducts.items.some((product) => product.id === annualProduct.id)) {
    await revenueCatRequest(
      `/v2/projects/${projectId}/entitlements/${proEntitlement.id}/actions/attach_products`,
      {
        method: 'POST',
        body: JSON.stringify({ product_ids: [annualProduct.id] }),
      },
    );
  }

  const packageProducts = await revenueCatRequest<
    RevenueCatList<{ product: RevenueCatProduct }>
  >(`/v2/projects/${projectId}/packages/${annualPackage.id}/products?limit=100`);
  if (!packageProducts.items.some(({ product }) => product.id === annualProduct.id)) {
    await revenueCatRequest(
      `/v2/projects/${projectId}/packages/${annualPackage.id}/actions/attach_products`,
      {
        method: 'POST',
        body: JSON.stringify({
          products: [{ product_id: annualProduct.id, eligibility_criteria: 'all' }],
        }),
      },
    );
  }

  const verifiedPrices = await revenueCatRequest<TestStorePrice[]>(
    `/v2/projects/${projectId}/products/${annualProduct.id}/test_store_prices`,
  );
  const verifiedPackageProducts = await revenueCatRequest<
    RevenueCatList<{ product: RevenueCatProduct }>
  >(`/v2/projects/${projectId}/packages/${annualPackage.id}/products?limit=100`);

  if (
    verifiedPrices.length !== annualPrices.length ||
    !verifiedPackageProducts.items.some(({ product }) => product.id === annualProduct.id)
  ) {
    throw new Error('Annual RevenueCat configuration could not be verified.');
  }

  console.log(
    JSON.stringify(
      {
        annualProductId: annualProduct.id,
        annualPackageId: annualPackage.id,
        entitlement: proEntitlement.lookup_key,
        currencies: verifiedPrices.map((price) => price.currency),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});