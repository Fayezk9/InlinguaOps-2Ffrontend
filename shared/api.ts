/**
 * Shared types between client and server
 */

export interface DemoResponse {
  message: string;
}

export interface FetchOrdersRequest {
  orderIds: (string | number)[];
}

export type WooOrder = {
  id: number;
  number?: string;
  status: string;
  total: string;
  currency: string;
  date_created: string;
  billing?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
  payment_method?: string;
  payment_method_title?: string;
};

export type OrderSummary = {
  id: number;
  number: string;
  status: string;
  total: string;
  currency: string;
  createdAt: string;
  customerName: string;
  email: string;
  phone: string;
  paymentMethod: string;
  link: string;
};

export type OrderFetchOk = { ok: true; id: string; order: OrderSummary };
export type OrderFetchErr = { ok: false; id: string; error: string };
export type OrderFetchResult = OrderFetchOk | OrderFetchErr;

export interface FetchOrdersResponse {
  results: OrderFetchResult[];
  okCount: number;
  errorCount: number;
}
