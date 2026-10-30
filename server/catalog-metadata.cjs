// Shared read-only configuration. This module never initializes the memory store.
const CATEGORIES = ['Electronics', 'Books', 'Home', 'Toys', 'Fashion'];
const SHIPPING = {
  standard: { label: 'Standard (5-7 days)', price: 5.99, freeOver: 100 },
  express: { label: 'Express (2-3 days)', price: 14.99 },
  nextday: { label: 'Next day', price: 24.99 }
};
const COUNTRIES = {
  IN: { name: 'India', states: ['Telangana', 'Karnataka', 'Maharashtra', 'Tamil Nadu', 'Jharkhand', 'Delhi'], zip: /^\d{6}$/, zipHint: '6 digits' },
  US: { name: 'United States', states: ['California', 'New York', 'Texas', 'Washington', 'Florida'], zip: /^\d{5}$/, zipHint: '5 digits' },
  UK: { name: 'United Kingdom', states: ['England', 'Scotland', 'Wales', 'Northern Ireland'], zip: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i, zipHint: 'UK postcode, e.g. SW1A 1AA' }
};
const storeMetadata = () => ({
  categories: CATEGORIES,
  shipping: Object.entries(SHIPPING).map(([id, value]) => ({ id, ...value })),
  countries: Object.entries(COUNTRIES).map(([code, c]) => ({ code, name: c.name, states: c.states, zipHint: c.zipHint }))
});
module.exports = { CATEGORIES, SHIPPING, COUNTRIES, storeMetadata };
