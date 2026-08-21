export function emptyProductValueSummary() {
  return {
    productCount: 0,
    quantity: 0,
    purchaseTotal: 0,
    sellingTotal: 0,
  };
}

/** Line totals from cost, selling price, and quantity. */
export function computeProductValueTotals({ cost_price, selling_price, quantity } = {}) {
  const qty = Number(quantity) || 0;
  const cost = Number(cost_price) || 0;
  const selling = Number(selling_price) || 0;
  const purchaseTotal = cost * qty;
  const sellingTotal = selling * qty;
  return {
    quantity: qty,
    purchaseTotal,
    sellingTotal,
    potentialProfit: sellingTotal - purchaseTotal,
  };
}
