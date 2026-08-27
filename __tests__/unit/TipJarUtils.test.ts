/**
 * @jest-environment node
 */
import type {PurchasesStoreProduct} from 'react-native-purchases';
import {isTipProductId, toTipProducts} from '@libs/TipJarUtils';
import CONST from '@src/CONST';

/** Minimal store-product fixture; only identifier/priceString matter here. */
function product(identifier: string, priceString: string) {
  return {identifier, priceString} as PurchasesStoreProduct;
}

describe('isTipProductId', () => {
  it('accepts every configured tip id', () => {
    CONST.TIPS.PRODUCT_IDS.forEach(id => {
      expect(isTipProductId(id)).toBe(true);
    });
  });

  it('rejects ids that are not tips', () => {
    expect(isTipProductId('supporter_monthly')).toBe(false);
    expect(isTipProductId('')).toBe(false);
  });
});

describe('toTipProducts', () => {
  const [smallBeer, pint, round] = CONST.TIPS.PRODUCT_IDS;

  it('orders products by tier regardless of store order', () => {
    const result = toTipProducts([
      product(round, '249 Kč'),
      product(smallBeer, '49 Kč'),
      product(pint, '99 Kč'),
    ]);
    expect(result).toEqual([
      {id: smallBeer, price: '49 Kč'},
      {id: pint, price: '99 Kč'},
      {id: round, price: '249 Kč'},
    ]);
  });

  it('drops products that are not tips', () => {
    const result = toTipProducts([
      product('supporter_monthly', '39 Kč'),
      product(pint, '99 Kč'),
    ]);
    expect(result).toEqual([{id: pint, price: '99 Kč'}]);
  });

  it('keeps the tier order when the store omits an id', () => {
    const result = toTipProducts([
      product(round, '249 Kč'),
      product(smallBeer, '49 Kč'),
    ]);
    expect(result.map(p => p.id)).toEqual([smallBeer, round]);
  });

  it('returns an empty list for an empty fetch', () => {
    expect(toTipProducts([])).toEqual([]);
  });
});
