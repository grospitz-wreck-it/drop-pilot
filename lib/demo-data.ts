import type { ActivityItem, SearchProfile } from './types';
export const DEMO_PROFILES: SearchProfile[] = [
{id:'demo-ticket-1',kind:'ticket',name:'Omegadoom – Konzertticket',url:'https://example.com/event',keywords:['Omegadoom','Stehplatz'],quantity:2,maxPrice:85,instantBuy:false,paymentPreference:'paypal',status:'active',createdAt:'2026-11-05T09:00:00.000Z'},
{id:'demo-drop-1',kind:'drop',name:'Pokémon Booster-Displays',url:'',keywords:['Pokémon','Booster-Display','Elite Trainer Box'],quantity:2,maxPrice:65,instantBuy:true,paymentPreference:'paypal',status:'active',createdAt:'2026-11-05T09:05:00.000Z'}];
export const DEMO_ACTIVITY: ActivityItem[] = [
{id:'activity-1',title:'Pokémon-Suchprofil bereit',detail:'3 Suchbegriffe · Produkt-Discovery vorbereitet',time:'Gerade eben',tone:'success'},
{id:'activity-2',title:'Konzertmonitor angelegt',detail:'Event-URL hinterlegt · 2 Tickets',time:'Vor 4 Min.',tone:'neutral'},
{id:'activity-3',title:'Checkout-Schutz aktiv',detail:'Keine Zahlung ohne erforderliche Autorisierung',time:'System',tone:'warning'}];
