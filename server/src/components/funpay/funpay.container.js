// Сборка зависимостей компонента: клиент, парсеры, сервисы.
import { SuppliersRepository } from '../suppliers/suppliers.repository.js';
import {
  catalogService, marketRepository, offersRepository, offersHistoryRepository,
  variantsStatsRepository,
} from '../catalog/catalog.container.js';
import { FunpayClient } from './funpay.client.js';
import { FunpayParser } from './funpay.parser.js';
import { FunpayCatalogParser } from './funpay.catalog.parser.js';
import { FunpayUserParser } from './funpay.user.parser.js';
import { FunpayCatalogService } from './funpay.catalog.service.js';
import { FunpaySyncService } from './funpay.sync.service.js';
import { SourceNodesRepository } from './source.nodes.repository.js';

export const funpayClient = new FunpayClient();
export const funpayParser = new FunpayParser();
export const funpayUserParser = new FunpayUserParser();
export const sourceNodesRepository = new SourceNodesRepository();

export const funpayCatalogService = new FunpayCatalogService(
  funpayClient, new FunpayCatalogParser(),
);

export const funpaySyncService = new FunpaySyncService({
  client: funpayClient,
  parser: funpayParser,
  market: marketRepository,
  catalog: catalogService,
  stats: variantsStatsRepository,
  suppliersRepo: new SuppliersRepository(),
  offersRepo: offersRepository,
  historyRepo: offersHistoryRepository,
});
