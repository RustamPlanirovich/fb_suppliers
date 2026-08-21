export const IS_DEV = ['localhost', '127.0.0.1'].includes(location.hostname);

export const API_URL = IS_DEV ? 'http://localhost:3000/api' : '/api';

// Должны совпадать с медиазапросами в CSS
export const BREAKPOINTS = { md: 768, lg: 1024, xl: 1280 };

export const EVENTS = {
  ROUTE: 'app:route',
  TOAST: 'app:toast',
  AUTH: 'app:auth',
  TABLE_SELECT: 'table:select',
  TABLE_ACTION: 'table:action',
  TABLE_PAGE: 'table:page',
  FILTERS_CHANGE: 'filters:change',
  MODAL_SUBMIT: 'modal:submit',
};

export const PAGE_LIMIT = 25;

export const BULK_MAX = 500;

export const TOAST_TIMEOUT_MS = 4000;
