import { FunpayClient } from '../../funpay/funpay.client.js';
import { FunpayParser } from '../../funpay/funpay.parser.js';
import { FunpayCatalogParser } from '../../funpay/funpay.catalog.parser.js';
import { FunpayCatalogService } from '../../funpay/funpay.catalog.service.js';

const client = new FunpayClient();
const parser = new FunpayParser();
const catalog = new FunpayCatalogService(client, new FunpayCatalogParser());

// FunPay: публичные страницы разделов, разбор HTML.
export const funpayProvider = {
  code: 'funpay',
  title: 'FunPay',
  // Каталог площадки читается целиком, поэтому доступен поиск по названию игры.
  catalogHint: 'Введите название игры или сервиса',
  async games({ q, refresh } = {}) {
    if (refresh) return catalog.games({ refresh: true });
    return catalog.search(q, 40);
  },
  async fetchNode({ nodeId, kind = 'lots', url }) {
    const target = url ?? client.nodeUrl(nodeId, kind);
    return parser.parseNode(await client.fetchHtml(target));
  },
  nodeUrl: (nodeId, kind = 'lots') => client.nodeUrl(nodeId, kind),
};
