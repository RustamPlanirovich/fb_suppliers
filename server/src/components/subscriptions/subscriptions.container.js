import { PlansRepository } from './plans.repository.js';
import { SubscriptionsRepository } from './subscriptions.repository.js';
import { PromoCodesRepository } from './promocodes.repository.js';
import { SubscriptionsService } from './subscriptions.service.js';
import { AccessService } from './access.service.js';

export const plansRepository = new PlansRepository();
export const subscriptionsRepository = new SubscriptionsRepository();
export const promoCodesRepository = new PromoCodesRepository();

export const subscriptionsService = new SubscriptionsService(
  plansRepository, subscriptionsRepository, promoCodesRepository,
);

export const accessService = new AccessService(plansRepository, subscriptionsRepository);
