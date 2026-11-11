const { buildSchema, graphql, GraphQLError } = require('graphql');

const schema = buildSchema(`
  type Product { id: Int!, name: String!, category: String!, price: Float!, stock: Int!, rating: Float! }
  type Category { name: String!, count: Int! }
  type Review { id: ID!, productId: Int!, rating: Int!, title: String!, body: String! }
  type Query {
    products(q: String, category: String, offset: Int = 0, limit: Int = 12): [Product!]!
    categories(q: String, offset: Int = 0, limit: Int = 12): [Category!]!
    reviews(productId: Int!, rating: Int, offset: Int = 0, limit: Int = 12): [Review!]!
  }
`);

function page({ offset, limit }) {
  if (!Number.isInteger(offset) || offset < 0 || offset > 1000 || !Number.isInteger(limit) || limit < 1 || limit > 50) {
    throw new GraphQLError('Use offset 0–1000 and limit 1–50.');
  }
  return { skip: offset, take: limit };
}

function publicProduct(product) {
  return { ...product, price: Number(product.price), rating: Number(product.rating) };
}

function memoryQueries(db) {
  return {
    products(args) {
      const { skip, take } = page(args);
      const q = (args.q || '').trim().toLowerCase();
      return db.products.filter(p => (!args.category || p.category === args.category) && p.name.toLowerCase().includes(q))
        .slice(skip, skip + take).map(publicProduct);
    },
    categories(args) {
      const { skip, take } = page(args);
      const q = (args.q || '').trim().toLowerCase();
      const counts = new Map();
      for (const { category } of db.products) counts.set(category, (counts.get(category) || 0) + 1);
      return [...counts].filter(([name]) => name.toLowerCase().includes(q)).sort(([a], [b]) => a.localeCompare(b))
        .slice(skip, skip + take).map(([name, count]) => ({ name, count }));
    },
    reviews(args) {
      const { skip, take } = page(args);
      return db.reviews.filter(r => r.productId === args.productId && (args.rating == null || r.rating === args.rating))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id).slice(skip, skip + take);
    },
  };
}

function databaseQueries(db) {
  return {
    async products(args) {
      const where = { deletedAt: null };
      if (args.category) where.category = args.category;
      if (args.q?.trim()) where.name = { contains: args.q.trim(), mode: 'insensitive' };
      return (await db.product.findMany({ where, orderBy: { id: 'asc' }, ...page(args) })).map(publicProduct);
    },
    async categories(args) {
      const where = { deletedAt: null };
      if (args.q?.trim()) where.category = { contains: args.q.trim(), mode: 'insensitive' };
      const groups = await db.product.groupBy({ by: ['category'], where, _count: { _all: true }, orderBy: { category: 'asc' }, ...page(args) });
      return groups.map(group => ({ name: group.category, count: group._count._all }));
    },
    reviews(args) {
      return db.review.findMany({
        where: { productId: args.productId, product: { deletedAt: null }, ...(args.rating != null && { rating: args.rating }) },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...page(args),
      });
    },
  };
}

function catalogGraphql(database) {
  const rootValue = database ? databaseQueries(database) : memoryQueries(require('../../server/store').db);
  return async (req, res, next) => {
    const { query, variables, operationName } = req.body || {};
    if (typeof query !== 'string' || !query.trim() || query.length > 4000
      || (variables != null && (typeof variables !== 'object' || Array.isArray(variables)))
      || (operationName != null && typeof operationName !== 'string')) {
      return res.status(400).json({ errors: [{ message: 'Provide a GraphQL query of at most 4000 characters.' }] });
    }
    try {
      const result = await graphql({ schema, source: query, rootValue, variableValues: variables, operationName });
      for (const error of result.errors || []) {
        if (error.originalError && !(error.originalError instanceof GraphQLError)) return next(error.originalError);
      }
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = { catalogGraphql };
