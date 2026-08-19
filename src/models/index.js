/**
 * Data models for NexttelPOS.
 * These shapes mirror SQLite rows and future Drupal REST API responses.
 */

/** @typedef {Object} User
 * @property {number} id
 * @property {string} username
 * @property {string} [full_name]
 * @property {string} role
 */

/** @typedef {Object} Product
 * @property {number} id
 * @property {string} name
 * @property {string} [sku]
 * @property {string} [barcode]
 * @property {number} [category_id]
 * @property {number} cost_price
 * @property {number} selling_price
 * @property {number} quantity
 * @property {number} min_stock
 * @property {string} [image]
 */

/** @typedef {Object} Category
 * @property {number} id
 * @property {string} name
 * @property {string} [description]
 */

/** @typedef {Object} Customer
 * @property {number} id
 * @property {string} name
 * @property {string} [phone]
 * @property {string} [email]
 * @property {string} [address]
 * @property {string} [notes]
 */

/** @typedef {Object} Supplier
 * @property {number} id
 * @property {string} company
 * @property {string} [contact_person]
 * @property {string} [phone]
 * @property {string} [email]
 * @property {string} [address]
 */

/** @typedef {Object} Sale
 * @property {number} id
 * @property {string} sale_number
 * @property {number} [customer_id]
 * @property {number} subtotal
 * @property {number} discount
 * @property {number} vat
 * @property {number} total
 * @property {string} payment_method
 * @property {string} status
 */

/** @typedef {Object} SaleItem
 * @property {number} id
 * @property {number} sale_id
 * @property {number} product_id
 * @property {number} quantity
 * @property {number} unit_price
 * @property {number} discount
 * @property {number} total
 */

/** @typedef {Object} Purchase
 * @property {number} id
 * @property {string} purchase_number
 * @property {number} [supplier_id]
 * @property {number} subtotal
 * @property {number} total
 */

/** @typedef {Object} Expense
 * @property {number} id
 * @property {string} name
 * @property {number} amount
 * @property {string} expense_date
 * @property {string} [notes]
 */

/** @typedef {Object} Settings
 * @property {string} store_name
 * @property {string} store_address
 * @property {string} vat_percent
 * @property {string} currency
 * @property {string} receipt_footer
 */

export {};
