// Запросы к GraphQL площадки. Отправляются полным текстом, без сохранённых хешей:
// хеши меняются с каждой сборкой их сайта, а текст запроса — нет.
export const GAME_QUERY = `query GamePage($slug: String) {
  game(slug: $slug) {
    id
    slug
    name
    categories { id slug name }
  }
}`;

export const ITEMS_QUERY = `query items($pagination: Pagination, $filter: ItemFilter) {
  items(pagination: $pagination, filter: $filter) {
    totalCount
    pageInfo { hasNextPage endCursor }
    edges {
      cursor
      node {
        id
        slug
        name
        price
        status
        user { id username }
      }
    }
  }
}`;
