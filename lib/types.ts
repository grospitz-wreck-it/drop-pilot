export type ProfileKind = 'ticket' | 'drop';
export type PaymentPreference = 'paypal' | 'klarna';
export type MonitorStatus = 'active' | 'paused';
export interface SearchProfile { id:string; kind:ProfileKind; name:string; url:string; keywords:string[]; quantity:number; maxPrice:number|null; instantBuy:boolean; paymentPreference:PaymentPreference; status:MonitorStatus; createdAt:string; }
export interface ActivityItem { id:string; title:string; detail:string; time:string; tone:'neutral'|'success'|'warning'; }
