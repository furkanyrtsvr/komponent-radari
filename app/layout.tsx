import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'En Ucuzu Burada | Akıllı Elektronik Sepeti',description:'Elektronik komponentleri karşılaştır, KDV, paket ve kargo dahil en ekonomik sepeti hesapla.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="tr" suppressHydrationWarning><body>{children}</body></html>;}
