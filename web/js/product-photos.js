const products = [
  'Wireless Earbuds', 'Mechanical Keyboard', '4K Webcam', 'USB-C Hub 7-in-1',
  'Smart Watch S2', 'Bluetooth Speaker', 'Portable SSD 1TB', 'Noise-Cancelling Headphones',
  'The Pragmatic Tester', 'Clean Automation', 'From Selenium to Playwright', 'API Testing Handbook',
  'Agile QA Field Guide', 'Performance Testing 101', 'TypeScript for Testers', 'Bug Hunting Notebook',
  'Ceramic Coffee Mug', 'LED Desk Lamp', 'Bamboo Cutting Board', 'Knitted Throw Blanket',
  'Minimal Wall Clock', 'Plant Pot Set (3)', 'Aroma Diffuser', 'Woven Storage Basket',
  'Robot Building Kit', '1000-Piece Puzzle', 'Wooden Train Set', 'Remote Control Car',
  'Strategy Board Game', 'Plush Panda', 'Magnetic Tiles (60)', 'Rainbow Kite',
  'Classic Hoodie', 'Running Shoes', 'Denim Jacket', 'Cotton T-Shirt',
  'Wool Beanie', 'Leather Belt', 'Canvas Backpack', 'Sports Socks (3-pack)',
];

export function catalogPhoto(name) {
  const index = products.indexOf(name);
  return index < 0 ? null : '/assets/products/vortex-product-' + (index + 1) + '.webp';
}
