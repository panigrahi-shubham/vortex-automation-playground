const query = 'query Catalog($search: String) { products(q: $search, limit: 3) { name category price } }';

export default {
  id: 'graphql',
  title: 'GraphQL catalog query',
  tag: 'waitForResponse() · request.post()',
  level: 3,
  task: 'Search for Keyboard. Verify the query returns only name, category, and price for matching products.',
  body: `<form class="row"><label for="vortex-graphql-search">Product search</label><input id="vortex-graphql-search" value="Keyboard">
    <button type="submit" class="btn sm" data-testid="vortex-graphql-run">Run GraphQL query</button></form>
    <pre class="out" role="status" data-testid="vortex-graphql-result"></pre>`,
  mount(el, { signal }) {
    const status = el.querySelector('pre');
    const button = el.querySelector('button');
    el.querySelector('form').onsubmit = async event => {
      event.preventDefault();
      button.disabled = true;
      status.textContent = 'Loading';
      try {
        const response = await fetch('/api/graphql', {
          method: 'POST', signal, headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, variables: { search: el.querySelector('input').value } }),
        });
        const result = await response.json();
        if (!signal.aborted) status.textContent = JSON.stringify(result, null, 2);
      } catch {
        if (!signal.aborted) status.textContent = 'GraphQL request failed';
      } finally {
        if (!signal.aborted) button.disabled = false;
      }
    };
  },
};
