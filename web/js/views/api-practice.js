import { $, esc, isDatabaseMode } from '../core.js';
import { levels, validLevel, levelOptions } from '../practice-levels.js';

const field = (label, pass) => ({ label, pass });
const status = (response, expected) => field(`HTTP ${expected}`, response.status === expected);
const json = response => field('Response declares JSON', response.headers.get('content-type')?.includes('application/json'));
const errorMessage = response => field('Response includes an error message', typeof response.body?.error === 'string');
const catalog = path => prefix => [{ path: prefix + path }];
const graphqlQuery = 'query Catalog($search: String) { products(q: $search, limit: 3) { name category price } }';

const examples = [
  { id: 'health', level: 1, title: 'Check service health', task: 'Confirm the service responds before starting a checkout test.',
    requests: () => [{ path: '/api/health' }],
    check: ([r]) => [status(r, 200), json(r), field('Body reports ok: true', r.body?.ok === true)] },
  { id: 'catalog', level: 1, title: 'Read a catalog page', task: 'Check the product shape and match the total in the body to the response header.',
    requests: catalog('/products?limit=3'),
    check: ([r]) => [status(r, 200), json(r),
      field('Returns 1–3 products with an ID, name and numeric price', Array.isArray(r.body?.items) && r.body.items.length > 0 && r.body.items.length <= 3 &&
        r.body.items.every(p => Number.isInteger(p?.id) && typeof p.name === 'string' && Number.isFinite(p.price))),
      field('X-Total-Count matches the body total', Number.isInteger(r.body?.total) && r.headers.get('x-total-count') === String(r.body.total))] },
  { id: 'guest-cart', level: 1, title: 'Check a guest cart', task: 'Verify the cart endpoint requires a session. This request runs without account credentials.',
    requests: catalog('/cart'),
    check: ([r]) => [status(r, 401), json(r), errorMessage(r), field('No cart data returned', r.body?.items === undefined)] },
  { id: 'validation', level: 2, title: 'Validate catalog parameters', task: 'Send a page size above the supported limit. Check for a validation response and no product data.',
    requests: catalog('/products?limit=51'),
    check: ([r]) => [status(r, 400), json(r), errorMessage(r), field('No catalog data returned', r.body?.items === undefined)] },
  { id: 'missing-product', level: 2, title: 'Distinguish invalid and missing products', task: 'Compare a malformed product ID with a valid ID outside the demo catalog.',
    requests: prefix => [{ path: prefix + '/products/not-a-product' }, { path: prefix + '/products/2147483647' }],
    check: ([invalid, missing]) => [field('Malformed ID returns 400', invalid.status === 400),
      field('Missing product returns 404', missing.status === 404), errorMessage(invalid), errorMessage(missing)] },
  { id: 'sorting', level: 2, title: 'Sort available products by price', task: 'Assert that available items are priced from lowest to highest and every returned product is in stock.',
    requests: catalog('/products?inStock=true&sort=price_asc&limit=5'),
    check: ([r]) => {
      const items = Array.isArray(r.body?.items) ? r.body.items : [];
      const priced = items.length >= 2 && items.every(p => Number.isFinite(p?.price));
      return [status(r, 200), field('At least two products with numeric prices', priced),
        field('Prices are in ascending order', priced && items.every((p, i) => !i || items[i - 1].price <= p.price)),
        field('Every product has available stock', items.length > 0 && items.every(p => p?.stock > 0))];
    } },
  { id: 'pagination', level: 3, title: 'Compare two catalog pages', task: 'Check that product IDs do not repeat between pages and that both responses report the same total.',
    requests: prefix => [1, 2].map(page => ({ path: `${prefix}/products?page=${page}&limit=3&sort=price_asc` })),
    check: ([a, b]) => {
      const ids = [a, b].map(r => Array.isArray(r.body?.items) ? r.body.items.map(item => item?.id) : []);
      return [status(a, 200), status(b, 200), field('Both pages contain products', ids.every(list => list.length > 0)),
        field('Pages report the requested page numbers and the same total', a.body?.page === 1 && b.body?.page === 2 && a.body.total === b.body.total),
        field('IDs are numeric and do not overlap', ids.every(list => list.length > 0 && list.every(Number.isInteger)) && ids[0].every(id => !ids[1].includes(id)))];
    } },
  { id: 'product-details', level: 3, title: 'Follow a listing into product details', task: 'Take a product ID from the catalog response and use it to fetch the detail record. Verify the name and price agree.',
    requests: catalog('/products?limit=1'),
    followUp: (prefix, [r]) => {
      const id = r.body?.items?.[0]?.id;
      return r.status === 200 && Number.isInteger(id) && id > 0 ? { path: `${prefix}/products/${id}` } : null;
    },
    check: ([list, detail]) => {
      const item = list.body?.items?.[0];
      return [status(list, 200), field('Product detail returns HTTP 200', detail?.status === 200),
        field('Detail matches the catalog ID, name and price', Boolean(item && detail?.body) && detail.body.id === item.id &&
          detail.body.name === item.name && detail.body.price === item.price)];
    } },
  { id: 'graphql-variables', level: 3, title: 'Query a catalog with GraphQL variables', task: 'Search the catalog with a variable. Compare matching results, an empty result and the requested field names.',
    input: { label: 'Product search', value: 'Keyboard' },
    requests: (_, search = 'Keyboard') => [{ path: '/api/graphql', body: { query: graphqlQuery, variables: { search } } }],
    check: ([r], [request]) => {
      const items = r.body?.data?.products;
      const search = request.body.variables.search.trim().toLowerCase();
      return [status(r, 200), field('No GraphQL errors', !r.body?.errors?.length && Array.isArray(items)),
        field('Returns up to 3 products with only name, category and price', Array.isArray(items) && items.length <= 3 &&
          items.every(p => p && Object.keys(p).sort().join(',') === 'category,name,price')),
        field('Every returned name matches the search', Array.isArray(items) && items.every(p => typeof p?.name === 'string' && p.name.toLowerCase().includes(search)))];
    } },
  { id: 'graphql-errors', level: 3, title: 'Inspect GraphQL validation errors', task: 'Request an unknown stock field. HTTP succeeds, so check the GraphQL error envelope as well.',
    requests: () => [{ path: '/api/graphql', body: { query: '{ products(limit: 1) { warehouseBin } }' } }],
    check: ([r]) => [status(r, 200), json(r), field('GraphQL reports an unknown warehouseBin field',
      Array.isArray(r.body?.errors) && r.body.errors.some(error => typeof error?.message === 'string' && error.message.includes('warehouseBin'))), field('No partial catalog data returned', r.body?.data == null)] },
];

const shellQuote = value => "'" + value.replaceAll("'", "'\\''") + "'";

function command({ path, body }) {
  const target = shellQuote(location.origin + path);
  return body ? `curl -i ${target} -H 'Content-Type: application/json' --data ${shellQuote(JSON.stringify(body))}` : `curl -i ${target}`;
}

async function fetchExample({ path, body }, signal) {
  const started = performance.now();
  const response = await fetch(path, {
    method: body ? 'POST' : 'GET',
    ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    credentials: 'omit', cache: 'no-store', signal
  });
  const content = await response.text();
  let parsed;
  try { parsed = JSON.parse(content); } catch { /* Display the original non-JSON response. */ }
  return { status: response.status, headers: response.headers, body: parsed, content, elapsed: Math.round(performance.now() - started) };
}

export function mountPractice(el, query, isCurrent) {
  const prefix = isDatabaseMode() ? '/api/v2' : '/api';
  const page = new AbortController();
  for (const event of ['route', 'popstate']) window.addEventListener(event, () => page.abort(), { once: true, signal: page.signal });
  el.innerHTML = `<div class="row qa-filters"><label for="qa-api-level">Difficulty</label><select id="qa-api-level">${levelOptions()}</select>
    <span class="small muted">Catalog and account endpoints use <code>${prefix}</code> in this environment.</span></div>
    ${Object.entries(levels).map(([level, { name, description }]) => `<section class="qa-level" data-level="${level}" aria-labelledby="qa-api-level-${level}">
      <div class="qa-level-head"><h2 id="qa-api-level-${level}">Level ${level} · ${name}</h2><p>${description}</p></div>
      <div class="qa-api-grid">${examples.filter(example => String(example.level) === level).map(example => `<article class="card qa-api-example" data-example="${example.id}" aria-labelledby="qa-${example.id}-title">
        <h3 id="qa-${example.id}-title">${example.title}</h3><p class="muted">${example.task}</p>
        <div class="qa-methods">${example.requests(prefix).map(request => `<code>${request.body ? 'POST' : 'GET'} ${esc(request.path)}</code>`).join('')}</div>
        ${example.input ? `<label class="qa-example-input">${example.input.label}<input type="search" maxlength="120" value="${esc(example.input.value)}"></label>` : ''}
        <div class="row"><button type="button" class="btn sm">Run example</button><span class="small" role="status"></span></div>
        <details class="qa-selector"><summary>cURL command</summary><pre class="qa-curl">${esc(example.requests(prefix).map(command).join('\n\n'))}</pre></details>
        <div class="qa-api-results"></div>
      </article>`).join('')}</div></section>`).join('')}`;
  const picker = $('#qa-api-level', el);
  const showLevel = () => {
    for (const section of el.querySelectorAll('.qa-level')) section.hidden = Boolean(picker.value && section.dataset.level !== picker.value);
  };
  picker.value = validLevel(query.get('level'));
  picker.onchange = () => {
    const url = new URL(location.href);
    if (picker.value) url.searchParams.set('level', picker.value); else url.searchParams.delete('level');
    history.replaceState(history.state, '', url);
    showLevel();
  };
  showLevel();
  for (const example of examples) {
    const card = $('[data-example="' + example.id + '"]', el);
    const button = $('button', card);
    const announcement = $('[role=status]', card);
    const results = $('.qa-api-results', card);
    const input = $('input', card);
    const requestsForCard = () => example.requests(prefix, input?.value);
    if (input) input.oninput = () => { $('.qa-curl', card).textContent = requestsForCard().map(command).join('\n\n'); };
    button.onclick = async () => {
      button.disabled = true;
      announcement.textContent = 'Sending request…';
      results.replaceChildren();
      try {
        const requests = requestsForCard();
        const signal = AbortSignal.any([page.signal, AbortSignal.timeout(12000)]);
        const responses = await Promise.all(requests.map(request => fetchExample(request, signal)));
        const nextRequest = example.followUp?.(prefix, responses);
        if (nextRequest) {
          requests.push(nextRequest);
          responses.push(await fetchExample(nextRequest, signal));
        }
        if (!isCurrent() || page.signal.aborted) return;
        const checks = example.check(responses, requests);
        const passed = checks.filter(check => check.pass).length;
        announcement.textContent = `${passed} of ${checks.length} checks passed`;
        results.innerHTML = `<ul class="qa-checks">${checks.map(check => `<li data-result="${check.pass ? 'pass' : 'fail'}"><strong>${check.pass ? 'Pass' : 'Fail'}</strong> ${esc(check.label)}</li>`).join('')}</ul>
          ${responses.map((r, i) => {
            const pretty = r.body === undefined ? r.content : JSON.stringify(r.body, null, 2);
            const headers = ['content-type', 'x-total-count', 'cache-control'].flatMap(name => r.headers.has(name) ? [`${name}: ${r.headers.get(name)}`] : []);
            return `<details class="qa-selector"><summary>Response ${responses.length > 1 ? i + 1 + ' · ' : ''}HTTP ${r.status} · ${r.elapsed} ms</summary>
              <pre>${esc(command(requests[i]))}</pre><pre>${esc(headers.join('\n'))}</pre><pre>${esc(pretty.slice(0, 8000))}${pretty.length > 8000 ? '\n… (preview truncated)' : ''}</pre></details>`;
          }).join('')}`;
      } catch {
        if (isCurrent() && !page.signal.aborted) announcement.textContent = 'The response could not be checked. Verify your connection and try again.';
      } finally {
        if (!page.signal.aborted) button.disabled = false;
      }
    };
  }
}
